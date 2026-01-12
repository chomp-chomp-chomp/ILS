-- Migration 023: Fix date_entered field length
-- MARC 008 fields are 40 characters, not 8
-- This fixes "value too long for type character varying(8)" errors during import

-- Alter the column to accommodate full MARC 008 data
ALTER TABLE marc_records
  ALTER COLUMN date_entered TYPE VARCHAR(40);

-- Add comment to document the field
COMMENT ON COLUMN marc_records.date_entered IS 'MARC 008 field - 40-character fixed field with coded information';
