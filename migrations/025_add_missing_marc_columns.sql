-- Migration: Add missing columns to marc_records
-- These columns are used by facets and search but were never added to the schema
-- Created: 2026-01-05

-- Add language_code column (used by language facet)
ALTER TABLE marc_records
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(10);

-- Add status column (used for filtering active/inactive records)
ALTER TABLE marc_records
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Add visibility column (used for public/staff-only records)
ALTER TABLE marc_records
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'public';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marc_records_language ON marc_records(language_code);
CREATE INDEX IF NOT EXISTS idx_marc_records_status ON marc_records(status);
CREATE INDEX IF NOT EXISTS idx_marc_records_visibility ON marc_records(visibility);

-- Add helpful comments
COMMENT ON COLUMN marc_records.language_code IS
  'ISO 639-2/B language code (eng, spa, fre, etc.) for the primary language of the material';

COMMENT ON COLUMN marc_records.status IS
  'Record status: active, deleted, suppressed. Only active records appear in public catalog.';

COMMENT ON COLUMN marc_records.visibility IS
  'Visibility level: public (OPAC), staff_only, hidden. Controls who can see the record.';

-- Set default values for existing records
UPDATE marc_records
SET
  status = COALESCE(status, 'active'),
  visibility = COALESCE(visibility, 'public')
WHERE status IS NULL OR visibility IS NULL;
