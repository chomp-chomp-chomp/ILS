-- Migration 023: Fix date_entered field length
-- MARC 008 fields are 40 characters, not 8
-- This fixes "value too long for type character varying(8)" errors during import

-- ================================================================
-- 1. DROP DEPENDENT VIEWS
-- ================================================================

DROP VIEW IF EXISTS marc_records_public CASCADE;
DROP VIEW IF EXISTS marc_records_archived CASCADE;
DROP VIEW IF EXISTS marc_records_trash CASCADE;
DROP VIEW IF EXISTS marc_records_staff_only CASCADE;

-- ================================================================
-- 2. ALTER COLUMN TYPE
-- ================================================================

-- Alter the column to accommodate full MARC 008 data
ALTER TABLE marc_records
  ALTER COLUMN date_entered TYPE VARCHAR(40);

-- Add comment to document the field
COMMENT ON COLUMN marc_records.date_entered IS 'MARC 008 field - 40-character fixed field with coded information';

-- ================================================================
-- 3. RECREATE VIEWS (from migration 022)
-- ================================================================

-- View for active public records (what the OPAC should see)
CREATE OR REPLACE VIEW marc_records_public AS
SELECT *
FROM marc_records
WHERE status = 'active' AND visibility = 'public';

-- View for archived records
CREATE OR REPLACE VIEW marc_records_archived AS
SELECT *
FROM marc_records
WHERE status = 'archived';

-- View for trash (soft-deleted records)
CREATE OR REPLACE VIEW marc_records_trash AS
SELECT *
FROM marc_records
WHERE status = 'deleted';

-- View for staff-only records
CREATE OR REPLACE VIEW marc_records_staff_only AS
SELECT *
FROM marc_records
WHERE visibility = 'staff_only' AND status = 'active';

-- ================================================================
-- 4. RESTORE PERMISSIONS ON VIEWS
-- ================================================================

-- Public can read the public view
GRANT SELECT ON marc_records_public TO anon, authenticated;

-- Staff can read archive, trash, and staff-only views
GRANT SELECT ON marc_records_archived TO authenticated;
GRANT SELECT ON marc_records_trash TO authenticated;
GRANT SELECT ON marc_records_staff_only TO authenticated;
