-- Authority Control System
-- Implements comprehensive authority control for names and subjects
-- Supports LCNAF (Library of Congress Name Authority File) and LCSH (Library of Congress Subject Headings)

-- ============================================================================
-- 1. AUTHORITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Authority heading (the authorized form)
  heading TEXT NOT NULL,

  -- Type of authority
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'personal_name',      -- 100 - Personal names (e.g., "Twain, Mark, 1835-1910")
    'corporate_name',     -- 110 - Corporate/organization names
    'meeting_name',       -- 111 - Conference/meeting names
    'geographic_name',    -- 151 - Geographic names
    'topical_subject',    -- 150 - Topical subjects
    'genre_form'          -- 155 - Genre/form terms
  )),

  -- Source of authority
  source VARCHAR(50) DEFAULT 'local' CHECK (source IN (
    'lcnaf',    -- Library of Congress Name Authority File
    'lcsh',     -- Library of Congress Subject Headings
    'local',    -- Locally created authority
    'viaf',     -- Virtual International Authority File
    'fast'      -- Faceted Application of Subject Terminology
  )),

  -- Library of Congress Control Number (LCCN)
  lccn VARCHAR(50),

  -- Additional identifiers
  viaf_id VARCHAR(50),
  fast_id VARCHAR(50),

  -- Biographical/historical note (for context)
  note TEXT,

  -- Dates (for personal names)
  birth_date VARCHAR(20),
  death_date VARCHAR(20),

  -- Variant forms (stored as array for quick lookup)
  -- e.g., ["Smith, John", "J. Smith", "John Smith"]
  variant_forms TEXT[],

  -- Full MARC authority record (if imported from LoC)
  marc_authority JSONB,

  -- Last synchronized with external authority file
  last_sync_at TIMESTAMPTZ,

  -- Usage statistics
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_authorities_heading ON authorities(heading);
CREATE INDEX IF NOT EXISTS idx_authorities_type ON authorities(type);
CREATE INDEX IF NOT EXISTS idx_authorities_source ON authorities(source);
CREATE INDEX IF NOT EXISTS idx_authorities_lccn ON authorities(lccn) WHERE lccn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authorities_variant_forms ON authorities USING GIN(variant_forms);

-- Unique constraint: same heading + type can't exist twice from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_authorities_unique ON authorities(heading, type, source);

-- Add search_vector column for full-text search
ALTER TABLE authorities ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Create index on search_vector
CREATE INDEX IF NOT EXISTS idx_authorities_search_vector ON authorities USING GIN(search_vector);

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION update_authority_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.heading, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.variant_forms, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.note, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-update search_vector
DROP TRIGGER IF EXISTS trigger_authority_search_vector ON authorities;
CREATE TRIGGER trigger_authority_search_vector
  BEFORE INSERT OR UPDATE ON authorities
  FOR EACH ROW
  EXECUTE FUNCTION update_authority_search_vector();

-- ============================================================================
-- 2. AUTHORITY CROSS REFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS authority_cross_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- The authority this reference belongs to
  authority_id UUID NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,

  -- Type of cross-reference
  ref_type VARCHAR(20) NOT NULL CHECK (ref_type IN (
    'see',           -- "USE" - this heading is not authorized, see the authorized heading
    'see_also',      -- "SEE ALSO" - related authorized heading
    'see_from'       -- Inverse of "see" - for the authorized heading, show what refers to it
  )),

  -- The reference text
  -- For "see": the non-authorized form pointing to this authority
  -- For "see_also": the related authorized heading
  reference_text TEXT NOT NULL,

  -- Optional: link to another authority record
  related_authority_id UUID REFERENCES authorities(id) ON DELETE SET NULL,

  -- Note explaining the relationship
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_cross_refs_authority ON authority_cross_refs(authority_id);
CREATE INDEX IF NOT EXISTS idx_cross_refs_type ON authority_cross_refs(ref_type);
CREATE INDEX IF NOT EXISTS idx_cross_refs_text ON authority_cross_refs(reference_text);

-- ============================================================================
-- 3. MARC RECORDS TO AUTHORITIES LINKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS marc_authority_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- The MARC bibliographic record
  marc_record_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,

  -- The authority record
  authority_id UUID NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,

  -- Which MARC field this link applies to
  -- e.g., '100' for main entry personal name, '650' for subject
  marc_field VARCHAR(10) NOT NULL,

  -- Array index for repeatable fields (e.g., multiple 650 subjects)
  field_index INTEGER DEFAULT 0,

  -- Confidence score (0-1) for automatic matches
  confidence REAL DEFAULT 1.0,

  -- Was this link created automatically or manually?
  is_automatic BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_marc_auth_links_marc ON marc_authority_links(marc_record_id);
CREATE INDEX IF NOT EXISTS idx_marc_auth_links_authority ON marc_authority_links(authority_id);
CREATE INDEX IF NOT EXISTS idx_marc_auth_links_field ON marc_authority_links(marc_field);

-- Unique constraint: one authority per MARC field per record
CREATE UNIQUE INDEX IF NOT EXISTS idx_marc_auth_links_unique ON marc_authority_links(
  marc_record_id, marc_field, field_index
);

-- ============================================================================
-- 4. AUTHORITY UPDATE LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS authority_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- The authority that was updated
  authority_id UUID REFERENCES authorities(id) ON DELETE SET NULL,

  -- Type of update
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created',
    'updated',
    'merged',
    'deleted',
    'synced_from_loc',
    'heading_corrected'
  )),

  -- Old and new values (for auditing)
  old_value JSONB,
  new_value JSONB,

  -- How many MARC records were affected
  records_affected INTEGER DEFAULT 0,

  -- User who performed the action
  performed_by UUID REFERENCES auth.users(id),

  -- Optional note
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_log_authority ON authority_update_log(authority_id);
CREATE INDEX IF NOT EXISTS idx_auth_log_action ON authority_update_log(action);
CREATE INDEX IF NOT EXISTS idx_auth_log_created ON authority_update_log(created_at DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_cross_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marc_authority_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_update_log ENABLE ROW LEVEL SECURITY;

-- Public read access to authorities and cross-references
DROP POLICY IF EXISTS "Public read access to authorities" ON authorities;
CREATE POLICY "Public read access to authorities"
  ON authorities FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read access to cross references" ON authority_cross_refs;
CREATE POLICY "Public read access to cross references"
  ON authority_cross_refs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read access to authority links" ON marc_authority_links;
CREATE POLICY "Public read access to authority links"
  ON marc_authority_links FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read access to update log" ON authority_update_log;
CREATE POLICY "Public read access to update log"
  ON authority_update_log FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can write (admin access)
DROP POLICY IF EXISTS "Authenticated users can insert authorities" ON authorities;
CREATE POLICY "Authenticated users can insert authorities"
  ON authorities FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update authorities" ON authorities;
CREATE POLICY "Authenticated users can update authorities"
  ON authorities FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete authorities" ON authorities;
CREATE POLICY "Authenticated users can delete authorities"
  ON authorities FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert cross refs" ON authority_cross_refs;
CREATE POLICY "Authenticated users can insert cross refs"
  ON authority_cross_refs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update cross refs" ON authority_cross_refs;
CREATE POLICY "Authenticated users can update cross refs"
  ON authority_cross_refs FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete cross refs" ON authority_cross_refs;
CREATE POLICY "Authenticated users can delete cross refs"
  ON authority_cross_refs FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert authority links" ON marc_authority_links;
CREATE POLICY "Authenticated users can insert authority links"
  ON marc_authority_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update authority links" ON marc_authority_links;
CREATE POLICY "Authenticated users can update authority links"
  ON marc_authority_links FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete authority links" ON marc_authority_links;
CREATE POLICY "Authenticated users can delete authority links"
  ON marc_authority_links FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert log entries" ON authority_update_log;
CREATE POLICY "Authenticated users can insert log entries"
  ON authority_update_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_authority_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_authority_updated_at ON authorities;
CREATE TRIGGER trigger_authority_updated_at
  BEFORE UPDATE ON authorities
  FOR EACH ROW
  EXECUTE FUNCTION update_authority_updated_at();

-- Increment usage count when authority is linked to a MARC record
CREATE OR REPLACE FUNCTION increment_authority_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE authorities
  SET usage_count = usage_count + 1
  WHERE id = NEW.authority_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_usage ON marc_authority_links;
CREATE TRIGGER trigger_increment_usage
  AFTER INSERT ON marc_authority_links
  FOR EACH ROW
  EXECUTE FUNCTION increment_authority_usage();

-- Decrement usage count when link is deleted
CREATE OR REPLACE FUNCTION decrement_authority_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE authorities
  SET usage_count = usage_count - 1
  WHERE id = OLD.authority_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_decrement_usage ON marc_authority_links;
CREATE TRIGGER trigger_decrement_usage
  AFTER DELETE ON marc_authority_links
  FOR EACH ROW
  EXECUTE FUNCTION decrement_authority_usage();

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to search authorities with fuzzy matching
CREATE OR REPLACE FUNCTION search_authorities(
  search_term TEXT,
  authority_type VARCHAR(50) DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  heading TEXT,
  type VARCHAR(50),
  source VARCHAR(50),
  lccn VARCHAR(50),
  variant_forms TEXT[],
  usage_count INTEGER,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.heading,
    a.type,
    a.source,
    a.lccn,
    a.variant_forms,
    a.usage_count,
    GREATEST(
      similarity(a.heading, search_term),
      COALESCE(
        (SELECT MAX(similarity(variant, search_term))
         FROM unnest(a.variant_forms) variant),
        0
      )
    ) as similarity_score
  FROM authorities a
  WHERE
    (authority_type IS NULL OR a.type = authority_type)
    AND (
      a.heading ILIKE '%' || search_term || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(a.variant_forms) variant
        WHERE variant ILIKE '%' || search_term || '%'
      )
      OR a.search_vector @@ plainto_tsquery('english', search_term)
    )
  ORDER BY similarity_score DESC, a.usage_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to find unauthorized headings in MARC records
DROP FUNCTION IF EXISTS find_unauthorized_headings(VARCHAR);
DROP FUNCTION IF EXISTS find_unauthorized_headings();

CREATE OR REPLACE FUNCTION find_unauthorized_headings(
  field_type VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE (
  marc_record_id UUID,
  field VARCHAR(10),
  field_index INTEGER,
  heading TEXT,
  suggested_authority_id UUID,
  suggested_heading TEXT,
  confidence REAL
) AS $$
BEGIN
  RETURN QUERY
  -- Personal names (100, 600, 700, 800)
  SELECT
    m.id as marc_record_id,
    '100' as field,
    0 as field_index,
    m.main_entry_personal_name->>'a' as heading,
    a.id as suggested_authority_id,
    a.heading as suggested_heading,
    similarity(m.main_entry_personal_name->>'a', a.heading) as confidence
  FROM marc_records m
  LEFT JOIN marc_authority_links mal ON m.id = mal.marc_record_id AND mal.marc_field = '100'
  CROSS JOIN LATERAL (
    SELECT id, heading FROM authorities
    WHERE type = 'personal_name'
      AND similarity(m.main_entry_personal_name->>'a', heading) > 0.6
    ORDER BY similarity(m.main_entry_personal_name->>'a', heading) DESC
    LIMIT 1
  ) a
  WHERE
    m.main_entry_personal_name IS NOT NULL
    AND mal.id IS NULL  -- No authority link exists
    AND (field_type IS NULL OR field_type = '100')
    AND m.main_entry_personal_name->>'a' != a.heading  -- Heading doesn't match exactly

  UNION ALL

  -- Subjects (650)
  SELECT
    m.id as marc_record_id,
    '650' as field,
    (t.idx - 1) as field_index,
    subj->>'a' as heading,
    a.id as suggested_authority_id,
    a.heading as suggested_heading,
    similarity(subj->>'a', a.heading) as confidence
  FROM marc_records m,
       jsonb_array_elements(COALESCE(m.subject_topical, '[]'::jsonb)) WITH ORDINALITY AS t(subj, idx)
  LEFT JOIN marc_authority_links mal
    ON m.id = mal.marc_record_id
    AND mal.marc_field = '650'
    AND mal.field_index = (t.idx - 1)
  CROSS JOIN LATERAL (
    SELECT id, heading FROM authorities
    WHERE type = 'topical_subject'
      AND similarity(subj->>'a', heading) > 0.6
    ORDER BY similarity(subj->>'a', heading) DESC
    LIMIT 1
  ) a
  WHERE
    subj->>'a' IS NOT NULL
    AND mal.id IS NULL
    AND (field_type IS NULL OR field_type = '650')
    AND subj->>'a' != a.heading

  ORDER BY confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. SAMPLE DATA (for testing)
-- ============================================================================

-- Insert some sample authorities
INSERT INTO authorities (heading, type, source, lccn, variant_forms, note) VALUES
  ('Twain, Mark, 1835-1910', 'personal_name', 'lcnaf', 'n79021164',
   ARRAY['Clemens, Samuel Langhorne', 'Clemens, Samuel L.', 'Mark Twain'],
   'American author and humorist'),

  ('Shakespeare, William, 1564-1616', 'personal_name', 'lcnaf', 'n78095332',
   ARRAY['Shakspeare, William', 'Shaksper, William'],
   'English playwright and poet'),

  ('United States. Congress', 'corporate_name', 'lcnaf', 'n79022775',
   ARRAY['Congress (U.S.)', 'U.S. Congress'],
   'Legislative branch of the United States government'),

  ('World War (1939-1945)', 'topical_subject', 'lcsh', 'sh85148273',
   ARRAY['Second World War', 'WWII', 'WW2'],
   'Global war 1939-1945'),

  ('Artificial intelligence', 'topical_subject', 'lcsh', 'sh85008180',
   ARRAY['AI', 'Machine intelligence'],
   'Intelligence demonstrated by machines'),

  ('New York (N.Y.)', 'geographic_name', 'lcsh', 'sh85091221',
   ARRAY['New York City', 'NYC', 'New York'],
   'Largest city in the United States');

-- Insert cross-references
INSERT INTO authority_cross_refs (authority_id, ref_type, reference_text, note)
SELECT
  a.id,
  'see_from',
  variant,
  'Non-authorized form'
FROM authorities a,
     unnest(a.variant_forms) variant
WHERE a.variant_forms IS NOT NULL;

-- Add some "see also" references
INSERT INTO authority_cross_refs (authority_id, ref_type, reference_text)
SELECT id, 'see_also', 'World War (1914-1918)'
FROM authorities WHERE heading = 'World War (1939-1945)';

INSERT INTO authority_cross_refs (authority_id, ref_type, reference_text)
SELECT id, 'see_also', 'Machine learning'
FROM authorities WHERE heading = 'Artificial intelligence';

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE authorities IS 'Authority control records for names, subjects, and other controlled headings';
COMMENT ON TABLE authority_cross_refs IS 'Cross-references between authority records (see/see also)';
COMMENT ON TABLE marc_authority_links IS 'Links bibliographic records to authority records';
COMMENT ON TABLE authority_update_log IS 'Audit log of authority record changes';

COMMENT ON COLUMN authorities.heading IS 'The authorized form of the heading';
COMMENT ON COLUMN authorities.type IS 'Type of authority: personal_name, corporate_name, geographic_name, topical_subject, etc.';
COMMENT ON COLUMN authorities.source IS 'Source: lcnaf, lcsh, local, viaf, fast';
COMMENT ON COLUMN authorities.lccn IS 'Library of Congress Control Number';
COMMENT ON COLUMN authorities.variant_forms IS 'Array of non-authorized variant forms';
COMMENT ON COLUMN authorities.usage_count IS 'Number of bibliographic records using this authority';

COMMENT ON FUNCTION search_authorities IS 'Search authorities with fuzzy matching and similarity scoring';
COMMENT ON FUNCTION find_unauthorized_headings IS 'Find MARC records with headings not linked to authorities';

-- Function to get authority statistics
CREATE OR REPLACE FUNCTION get_authority_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM authorities),
    'by_type', (
      SELECT json_object_agg(type, count)
      FROM (
        SELECT type, COUNT(*) as count
        FROM authorities
        GROUP BY type
      ) t
    ),
    'by_source', (
      SELECT json_object_agg(source, count)
      FROM (
        SELECT source, COUNT(*) as count
        FROM authorities
        GROUP BY source
      ) s
    ),
    'total_links', (SELECT COUNT(*) FROM marc_authority_links),
    'avg_usage', (SELECT AVG(usage_count) FROM authorities)
  ) INTO stats;

  RETURN stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_authority_stats IS 'Get statistics about authority records';
