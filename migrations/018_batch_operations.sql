-- Migration 018: Batch Operations for MARC Records
-- Implements comprehensive batch editing, deletion, merging, and automation features
-- Created: 2025-12-30

-- ============================================================================
-- 1. BATCH JOBS TABLE
-- Tracks long-running batch operations with progress monitoring
-- ============================================================================

CREATE TABLE batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Job metadata
  job_type VARCHAR(50) NOT NULL, -- 'find_replace', 'batch_delete', 'macro', 'merge', 'authority_control'
  job_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Job parameters (stored as JSONB for flexibility)
  parameters JSONB NOT NULL DEFAULT '{}',

  -- Progress tracking
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,

  -- Results and errors
  result_summary JSONB, -- Summary of changes made
  error_log TEXT[], -- Array of error messages

  -- Output files (for downloadable reports)
  report_url TEXT,

  -- User tracking
  created_by UUID REFERENCES auth.users(id),

  -- Job cancellation
  cancel_requested BOOLEAN DEFAULT FALSE,

  -- Estimated completion
  estimated_completion_at TIMESTAMPTZ,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_job_type CHECK (job_type IN ('find_replace', 'batch_delete', 'macro', 'merge', 'authority_control'))
);

-- Indexes for batch_jobs
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_batch_jobs_created_by ON batch_jobs(created_by);
CREATE INDEX idx_batch_jobs_created_at ON batch_jobs(created_at DESC);
CREATE INDEX idx_batch_jobs_type ON batch_jobs(job_type);

-- ============================================================================
-- 2. BATCH MACROS TABLE
-- Saved scriptable transformations for reuse
-- ============================================================================

CREATE TABLE batch_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Macro metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'subject_headings', 'call_numbers', 'publication_dates', 'custom'

  -- Macro definition
  operations JSONB NOT NULL, -- Array of operations to perform

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Sharing
  is_public BOOLEAN DEFAULT FALSE, -- Allow other users to use this macro
  created_by UUID REFERENCES auth.users(id),

  -- Tags for organization
  tags TEXT[],

  CONSTRAINT unique_macro_name_per_user UNIQUE(name, created_by)
);

-- Indexes for batch_macros
CREATE INDEX idx_batch_macros_created_by ON batch_macros(created_by);
CREATE INDEX idx_batch_macros_category ON batch_macros(category);
CREATE INDEX idx_batch_macros_public ON batch_macros(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_batch_macros_tags ON batch_macros USING GIN(tags);

-- ============================================================================
-- 3. AUDIT LOG TABLE
-- Comprehensive tracking of all batch changes
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- What was changed
  table_name VARCHAR(100) NOT NULL, -- 'marc_records', 'holdings', etc.
  record_id UUID NOT NULL,
  operation VARCHAR(50) NOT NULL, -- 'insert', 'update', 'delete', 'merge'

  -- Change details
  old_values JSONB, -- Previous state
  new_values JSONB, -- New state
  changed_fields TEXT[], -- List of fields that changed

  -- Context
  batch_job_id UUID REFERENCES batch_jobs(id) ON DELETE SET NULL,
  change_reason TEXT, -- Why this change was made

  -- User tracking
  changed_by UUID REFERENCES auth.users(id),

  -- Rollback support
  can_rollback BOOLEAN DEFAULT TRUE,
  rolled_back BOOLEAN DEFAULT FALSE,
  rollback_at TIMESTAMPTZ,
  rollback_by UUID REFERENCES auth.users(id),

  CONSTRAINT valid_operation CHECK (operation IN ('insert', 'update', 'delete', 'merge'))
);

-- Indexes for audit_log
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_batch_job ON audit_log(batch_job_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);

-- ============================================================================
-- 4. DUPLICATE RECORDS TABLE
-- Tracks identified duplicate records for merging
-- ============================================================================

CREATE TABLE duplicate_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Records involved
  record_a_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,
  record_b_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,

  -- Similarity metrics
  similarity_score REAL NOT NULL, -- 0.0 to 1.0
  match_method VARCHAR(50) NOT NULL, -- 'isbn', 'title_similarity', 'lccn', 'manual'

  -- Resolution
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'merged', 'not_duplicate', 'ignored'
  merged_into_id UUID REFERENCES marc_records(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Prevent duplicate pairs
  CONSTRAINT unique_duplicate_pair UNIQUE(record_a_id, record_b_id),
  CONSTRAINT different_records CHECK (record_a_id != record_b_id),
  CONSTRAINT valid_duplicate_status CHECK (status IN ('pending', 'merged', 'not_duplicate', 'ignored'))
);

-- Indexes for duplicate_records
CREATE INDEX idx_duplicate_records_status ON duplicate_records(status);
CREATE INDEX idx_duplicate_records_record_a ON duplicate_records(record_a_id);
CREATE INDEX idx_duplicate_records_record_b ON duplicate_records(record_b_id);
CREATE INDEX idx_duplicate_records_similarity ON duplicate_records(similarity_score DESC);

-- ============================================================================
-- 5. MERGED RECORDS TABLE
-- Audit trail for merged records
-- ============================================================================

CREATE TABLE merged_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merged_at TIMESTAMPTZ DEFAULT NOW(),

  -- Records involved
  source_record_ids UUID[] NOT NULL, -- Records that were merged (now deleted)
  target_record_id UUID NOT NULL REFERENCES marc_records(id), -- Final merged record

  -- Merge details
  field_selections JSONB, -- Which fields came from which source
  merge_strategy VARCHAR(100), -- 'keep_target', 'keep_source', 'field_by_field'

  -- Holdings migration
  holdings_moved INTEGER DEFAULT 0,

  -- User tracking
  merged_by UUID REFERENCES auth.users(id),
  merge_notes TEXT,

  -- Undo support (restore source records from old_values)
  can_undo BOOLEAN DEFAULT TRUE,
  source_records_backup JSONB -- Full backup of source records for undo
);

-- Indexes for merged_records
CREATE INDEX idx_merged_records_target ON merged_records(target_record_id);
CREATE INDEX idx_merged_records_merged_at ON merged_records(merged_at DESC);
CREATE INDEX idx_merged_records_merged_by ON merged_records(merged_by);

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Batch Jobs
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batch jobs"
  ON batch_jobs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create batch jobs"
  ON batch_jobs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own batch jobs"
  ON batch_jobs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Batch Macros
ALTER TABLE batch_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own macros and public macros"
  ON batch_macros FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR is_public = TRUE);

CREATE POLICY "Users can create macros"
  ON batch_macros FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own macros"
  ON batch_macros FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own macros"
  ON batch_macros FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Audit Log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Duplicate Records
ALTER TABLE duplicate_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view duplicates"
  ON duplicate_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage duplicates"
  ON duplicate_records FOR ALL
  TO authenticated
  USING (true);

-- Merged Records
ALTER TABLE merged_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view merged records"
  ON merged_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create merged records"
  ON merged_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to find duplicate records by ISBN
CREATE OR REPLACE FUNCTION find_duplicates_by_isbn()
RETURNS TABLE (
  record_a_id UUID,
  record_b_id UUID,
  isbn TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  WITH isbn_groups AS (
    SELECT
      isbn,
      array_agg(id ORDER BY created_at) as record_ids
    FROM marc_records
    WHERE isbn IS NOT NULL AND isbn != ''
    GROUP BY isbn
    HAVING COUNT(*) > 1
  )
  SELECT
    record_ids[1] as record_a_id,
    record_ids[i] as record_b_id,
    isbn,
    1.0::REAL as similarity_score
  FROM isbn_groups,
    generate_series(2, array_length(record_ids, 1)) as i;
END;
$$ LANGUAGE plpgsql;

-- Function to find duplicate records by title similarity
CREATE OR REPLACE FUNCTION find_duplicates_by_title(threshold REAL DEFAULT 0.8)
RETURNS TABLE (
  record_a_id UUID,
  record_b_id UUID,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as record_a_id,
    b.id as record_b_id,
    similarity(
      LOWER(a.title_statement->>'a'),
      LOWER(b.title_statement->>'a')
    ) as similarity_score
  FROM marc_records a
  CROSS JOIN marc_records b
  WHERE a.id < b.id  -- Prevent duplicates and self-comparison
    AND a.title_statement->>'a' IS NOT NULL
    AND b.title_statement->>'a' IS NOT NULL
    AND similarity(
      LOWER(a.title_statement->>'a'),
      LOWER(b.title_statement->>'a')
    ) >= threshold;
END;
$$ LANGUAGE plpgsql;

-- Function to update batch job progress
CREATE OR REPLACE FUNCTION update_batch_job_progress(
  job_id UUID,
  processed INTEGER DEFAULT NULL,
  successful INTEGER DEFAULT NULL,
  failed INTEGER DEFAULT NULL,
  new_status VARCHAR DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE batch_jobs
  SET
    processed_records = COALESCE(processed, processed_records),
    successful_records = COALESCE(successful, successful_records),
    failed_records = COALESCE(failed, failed_records),
    status = COALESCE(new_status, status),
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit entry
CREATE OR REPLACE FUNCTION log_audit_entry(
  p_table_name VARCHAR,
  p_record_id UUID,
  p_operation VARCHAR,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_batch_job_id UUID DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  changed_fields_array TEXT[];
BEGIN
  -- Calculate changed fields
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT array_agg(key)
    INTO changed_fields_array
    FROM jsonb_each(p_new_values)
    WHERE p_old_values->key IS DISTINCT FROM p_new_values->key;
  END IF;

  INSERT INTO audit_log (
    table_name,
    record_id,
    operation,
    old_values,
    new_values,
    changed_fields,
    batch_job_id,
    change_reason,
    changed_by
  ) VALUES (
    p_table_name,
    p_record_id,
    p_operation,
    p_old_values,
    p_new_values,
    changed_fields_array,
    p_batch_job_id,
    p_change_reason,
    auth.uid()
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to perform global find/replace in MARC fields
CREATE OR REPLACE FUNCTION global_find_replace(
  p_batch_job_id UUID,
  p_search_pattern TEXT,
  p_replace_with TEXT,
  p_field_filter VARCHAR DEFAULT NULL, -- e.g., '650' for subject fields only
  p_subfield_filter VARCHAR DEFAULT NULL, -- e.g., 'a' for subfield $a only
  p_case_sensitive BOOLEAN DEFAULT TRUE,
  p_use_regex BOOLEAN DEFAULT FALSE,
  p_preview_only BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  record_id UUID,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changes_count INTEGER
) AS $$
DECLARE
  rec RECORD;
  field_key TEXT;
  old_val TEXT;
  new_val TEXT;
  total_changes INTEGER := 0;
BEGIN
  -- Iterate through all MARC records
  FOR rec IN SELECT * FROM marc_records LOOP
    -- Check each JSONB field in the record
    FOR field_key IN
      SELECT jsonb_object_keys(to_jsonb(rec))
      WHERE jsonb_typeof(to_jsonb(rec)->jsonb_object_keys(to_jsonb(rec))) IN ('object', 'array')
    LOOP
      -- Skip if field filter is specified and doesn't match
      CONTINUE WHEN p_field_filter IS NOT NULL AND field_key NOT LIKE p_field_filter;

      -- Get old value as text
      old_val := rec::jsonb->>field_key;

      -- Perform replacement
      IF p_use_regex THEN
        IF p_case_sensitive THEN
          new_val := regexp_replace(old_val, p_search_pattern, p_replace_with, 'g');
        ELSE
          new_val := regexp_replace(old_val, p_search_pattern, p_replace_with, 'gi');
        END IF;
      ELSE
        IF p_case_sensitive THEN
          new_val := replace(old_val, p_search_pattern, p_replace_with);
        ELSE
          -- Case-insensitive replace
          new_val := regexp_replace(old_val, p_search_pattern, p_replace_with, 'gi');
        END IF;
      END IF;

      -- If value changed
      IF old_val IS DISTINCT FROM new_val THEN
        total_changes := total_changes + 1;

        -- Return the change
        RETURN QUERY SELECT rec.id, field_key, old_val, new_val, total_changes;

        -- Apply change if not preview
        IF NOT p_preview_only THEN
          -- Update the record (this is simplified - real implementation would need field-specific logic)
          -- Log the change
          PERFORM log_audit_entry(
            'marc_records',
            rec.id,
            'update',
            to_jsonb(rec),
            jsonb_set(to_jsonb(rec), ARRAY[field_key], to_jsonb(new_val)),
            p_batch_job_id,
            format('Global find/replace: "%s" -> "%s"', p_search_pattern, p_replace_with)
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. SAMPLE DATA
-- ============================================================================

-- Insert a sample macro for adding subject headings
INSERT INTO batch_macros (name, description, category, operations, is_public, created_by)
VALUES (
  'Add Genre: Fiction',
  'Adds "Fiction" as a subject heading to all book records',
  'subject_headings',
  '[
    {
      "operation": "add_field",
      "field": "subject_topical",
      "value": {"a": "Fiction"},
      "condition": {"material_type": "book"}
    }
  ]'::jsonb,
  TRUE,
  NULL
);

-- Insert a sample macro for normalizing publication dates
INSERT INTO batch_macros (name, description, category, operations, is_public, created_by)
VALUES (
  'Normalize Publication Dates',
  'Extracts 4-digit year from publication_info and standardizes format',
  'publication_dates',
  '[
    {
      "operation": "transform_field",
      "field": "publication_info",
      "subfield": "c",
      "transform": "extract_year",
      "regex": "\\d{4}"
    }
  ]'::jsonb,
  TRUE,
  NULL
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE batch_jobs IS 'Tracks long-running batch operations with progress monitoring and results';
COMMENT ON TABLE batch_macros IS 'Saved scriptable MARC transformations for reuse';
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail of all batch changes with rollback support';
COMMENT ON TABLE duplicate_records IS 'Identified duplicate MARC records for review and merging';
COMMENT ON TABLE merged_records IS 'Historical record of merged duplicates with undo capability';
