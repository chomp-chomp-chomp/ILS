-- Migration 018: Book Cover Management System
-- Creates tables and functions for comprehensive cover image management
-- Supports multiple sources, manual uploads, bulk fetching, and priority queues

-- ============================================================================
-- COVERS TABLE
-- ============================================================================
-- Stores cover image metadata and URLs for MARC records
-- Supports multiple sizes and sources with fallback options

CREATE TABLE IF NOT EXISTS covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Record association
  marc_record_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,
  isbn VARCHAR(20),  -- ISBN used to fetch the cover (may differ from record ISBN for multi-ISBN books)

  -- Image URLs and metadata
  source VARCHAR(50) NOT NULL,  -- 'openlibrary', 'google', 'librarything', 'upload', 'generated'
  original_url TEXT,  -- Original full-size image URL
  thumbnail_small_url TEXT,  -- Small thumbnail (100px)
  thumbnail_medium_url TEXT,  -- Medium thumbnail (200px)
  thumbnail_large_url TEXT,  -- Large thumbnail (400px)

  -- Supabase Storage paths (if stored locally)
  storage_path_original TEXT,
  storage_path_small TEXT,
  storage_path_medium TEXT,
  storage_path_large TEXT,

  -- Image metadata
  width INTEGER,
  height INTEGER,
  file_size INTEGER,  -- bytes
  mime_type VARCHAR(50),

  -- Quality and status
  quality_score INTEGER DEFAULT 0,  -- 0-100, higher is better
  is_placeholder BOOLEAN DEFAULT false,  -- True for generated/fallback covers
  fetch_status VARCHAR(50) DEFAULT 'success',  -- 'success', 'failed', 'pending'
  fetch_error TEXT,  -- Error message if fetch failed

  -- Usage tracking
  is_active BOOLEAN DEFAULT true,  -- Current cover for this record
  view_count INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ,

  -- Audit
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_filename VARCHAR(255)
);

-- Indexes for performance
CREATE INDEX idx_covers_marc_record ON covers(marc_record_id);
CREATE INDEX idx_covers_isbn ON covers(isbn);
CREATE INDEX idx_covers_source ON covers(source);
CREATE INDEX idx_covers_active ON covers(marc_record_id, is_active) WHERE is_active = true;
CREATE INDEX idx_covers_fetch_status ON covers(fetch_status);

-- Only one active cover per record
CREATE UNIQUE INDEX idx_covers_one_active_per_record ON covers(marc_record_id) WHERE is_active = true;

-- ============================================================================
-- COVER FETCH QUEUE TABLE
-- ============================================================================
-- Queue for bulk cover fetching with priority and retry logic

CREATE TABLE IF NOT EXISTS cover_fetch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Record to fetch
  marc_record_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,
  isbn VARCHAR(20),
  title VARCHAR(500),
  author VARCHAR(500),

  -- Priority and scheduling
  priority INTEGER DEFAULT 50,  -- 0-100, higher = more important
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),

  -- Processing status
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Sources to try (in order)
  sources_to_try JSONB DEFAULT '["openlibrary", "google", "librarything"]'::JSONB,
  sources_tried JSONB DEFAULT '[]'::JSONB,

  -- Results
  successful_source VARCHAR(50),
  cover_id UUID REFERENCES covers(id),
  error_message TEXT,

  -- Retry logic
  next_retry_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_fetch_queue_status ON cover_fetch_queue(status);
CREATE INDEX idx_fetch_queue_priority ON cover_fetch_queue(priority DESC, scheduled_for ASC);
CREATE INDEX idx_fetch_queue_marc_record ON cover_fetch_queue(marc_record_id);
CREATE INDEX idx_fetch_queue_next_retry ON cover_fetch_queue(next_retry_at) WHERE status = 'failed';

-- Unique constraint: only one pending/processing job per record
CREATE UNIQUE INDEX idx_fetch_queue_one_active_per_record
  ON cover_fetch_queue(marc_record_id)
  WHERE status IN ('pending', 'processing');

-- ============================================================================
-- COVER STATISTICS VIEW
-- ============================================================================
-- Provides overview of cover coverage and quality

CREATE OR REPLACE VIEW cover_statistics AS
SELECT
  -- Total records
  (SELECT COUNT(*) FROM marc_records) as total_records,

  -- Records with covers
  (SELECT COUNT(DISTINCT marc_record_id) FROM covers WHERE is_active = true) as records_with_covers,

  -- Coverage percentage
  ROUND(
    (SELECT COUNT(DISTINCT marc_record_id)::NUMERIC FROM covers WHERE is_active = true) * 100.0 /
    NULLIF((SELECT COUNT(*)::NUMERIC FROM marc_records), 0),
    2
  ) as coverage_percentage,

  -- By source
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND source = 'openlibrary') as openlibrary_count,
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND source = 'google') as google_count,
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND source = 'librarything') as librarything_count,
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND source = 'upload') as upload_count,
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND source = 'generated') as generated_count,

  -- Quality metrics
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND is_placeholder = false) as real_covers,
  (SELECT COUNT(*) FROM covers WHERE is_active = true AND is_placeholder = true) as placeholder_covers,
  (SELECT AVG(quality_score)::INTEGER FROM covers WHERE is_active = true AND is_placeholder = false) as avg_quality_score,

  -- Queue status
  (SELECT COUNT(*) FROM cover_fetch_queue WHERE status = 'pending') as pending_fetches,
  (SELECT COUNT(*) FROM cover_fetch_queue WHERE status = 'failed') as failed_fetches;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get next item from fetch queue
CREATE OR REPLACE FUNCTION get_next_cover_fetch()
RETURNS TABLE (
  queue_id UUID,
  marc_record_id UUID,
  isbn VARCHAR,
  title VARCHAR,
  author VARCHAR,
  sources_to_try JSONB
) AS $$
BEGIN
  RETURN QUERY
  UPDATE cover_fetch_queue
  SET
    status = 'processing',
    updated_at = NOW(),
    last_attempt_at = NOW(),
    attempts = attempts + 1
  WHERE id = (
    SELECT id FROM cover_fetch_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND attempts < max_attempts
    ORDER BY priority DESC, scheduled_for ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    id as queue_id,
    cover_fetch_queue.marc_record_id,
    cover_fetch_queue.isbn,
    cover_fetch_queue.title,
    cover_fetch_queue.author,
    cover_fetch_queue.sources_to_try;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark fetch as completed
CREATE OR REPLACE FUNCTION complete_cover_fetch(
  queue_id UUID,
  success BOOLEAN,
  source VARCHAR DEFAULT NULL,
  cover_id UUID DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF success THEN
    UPDATE cover_fetch_queue
    SET
      status = 'completed',
      successful_source = source,
      cover_id = cover_id,
      updated_at = NOW()
    WHERE id = queue_id;
  ELSE
    UPDATE cover_fetch_queue
    SET
      status = CASE
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'pending'
      END,
      error_message = error_msg,
      next_retry_at = NOW() + (attempts * INTERVAL '1 hour'),
      updated_at = NOW()
    WHERE id = queue_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Queue covers for records without them
CREATE OR REPLACE FUNCTION queue_missing_covers(
  limit_count INTEGER DEFAULT 100,
  priority_level INTEGER DEFAULT 50,
  material_type_filter VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO cover_fetch_queue (
    marc_record_id,
    isbn,
    title,
    author,
    priority,
    status
  )
  SELECT
    m.id,
    m.isbn,
    m.title_statement->>'a',
    m.main_entry_personal_name->>'a',
    priority_level,
    'pending'
  FROM marc_records m
  WHERE
    -- No active cover
    NOT EXISTS (
      SELECT 1 FROM covers c
      WHERE c.marc_record_id = m.id
        AND c.is_active = true
    )
    -- Not already in queue
    AND NOT EXISTS (
      SELECT 1 FROM cover_fetch_queue q
      WHERE q.marc_record_id = m.id
        AND q.status IN ('pending', 'processing')
    )
    -- Has ISBN (better chance of finding cover)
    AND m.isbn IS NOT NULL
    -- Optional material type filter
    AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
  ORDER BY m.created_at DESC  -- Prioritize recent records
  LIMIT limit_count;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate priority based on popularity
CREATE OR REPLACE FUNCTION calculate_cover_priority(record_id UUID)
RETURNS INTEGER AS $$
DECLARE
  checkout_count INTEGER;
  list_count INTEGER;
  priority INTEGER := 50;  -- Base priority
BEGIN
  -- Count checkouts
  SELECT COUNT(*) INTO checkout_count
  FROM checkouts
  WHERE marc_record_id = record_id;

  -- Count reading list appearances
  SELECT COUNT(*) INTO list_count
  FROM reading_list_items
  WHERE marc_record_id = record_id;

  -- Calculate priority (0-100)
  priority := LEAST(100, 50 + (checkout_count * 5) + (list_count * 3));

  RETURN priority;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate fallback cover URL (placeholder with title/author)
CREATE OR REPLACE FUNCTION generate_fallback_cover_url(
  title TEXT,
  author TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
  -- This will be replaced by actual generated image service
  -- For now, return a data URI or placeholder service
  RETURN 'https://via.placeholder.com/400x600/e73b42/ffffff?text=' ||
    encode(substring(title, 1, 30), 'escape');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE covers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_fetch_queue ENABLE ROW LEVEL SECURITY;

-- Public read access to covers
CREATE POLICY "Public read access to covers"
  ON covers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can manage covers
CREATE POLICY "Authenticated users can insert covers"
  ON covers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update covers"
  ON covers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete covers"
  ON covers FOR DELETE
  TO authenticated
  USING (true);

-- Public read access to queue stats
CREATE POLICY "Public read access to fetch queue"
  ON cover_fetch_queue FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can manage queue
CREATE POLICY "Authenticated users can manage fetch queue"
  ON cover_fetch_queue FOR ALL
  TO authenticated
  USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for covers
CREATE OR REPLACE FUNCTION update_covers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_covers_timestamp
  BEFORE UPDATE ON covers
  FOR EACH ROW
  EXECUTE FUNCTION update_covers_updated_at();

-- Update timestamp trigger for fetch queue
CREATE TRIGGER trigger_update_fetch_queue_timestamp
  BEFORE UPDATE ON cover_fetch_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_covers_updated_at();

-- Ensure only one active cover per record
CREATE OR REPLACE FUNCTION ensure_one_active_cover()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other covers for this record
    UPDATE covers
    SET is_active = false
    WHERE marc_record_id = NEW.marc_record_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_one_active_cover
  AFTER INSERT OR UPDATE ON covers
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_one_active_cover();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Add some helpful comments
COMMENT ON TABLE covers IS 'Stores book cover images from multiple sources with thumbnails and metadata';
COMMENT ON TABLE cover_fetch_queue IS 'Queue for bulk fetching covers with priority and retry logic';
COMMENT ON COLUMN covers.quality_score IS 'Image quality score 0-100, based on resolution and completeness';
COMMENT ON COLUMN cover_fetch_queue.priority IS 'Fetch priority 0-100, higher = more important (popular items)';

-- Grant access to statistics view
GRANT SELECT ON cover_statistics TO anon, authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment to verify after running migration:

-- SELECT 'Migration 018 completed successfully' as status;
-- SELECT * FROM cover_statistics;
-- SELECT COUNT(*) as covers_table_exists FROM information_schema.tables WHERE table_name = 'covers';
-- SELECT COUNT(*) as queue_table_exists FROM information_schema.tables WHERE table_name = 'cover_fetch_queue';
