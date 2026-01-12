-- DANGER: Complete Catalog Wipe
-- This script deletes ALL bibliographic records and related data
-- USE WITH EXTREME CAUTION - THIS CANNOT BE UNDONE

-- ============================================================================
-- WHAT WILL BE DELETED:
-- ============================================================================
-- ✓ All MARC records (marc_records)
-- ✓ All holdings/items
-- ✓ All checkouts (circulation history)
-- ✓ All authority references
-- ✓ All related record links
-- ✓ All cover images
-- ✓ All attachments
-- ✓ All reading lists
-- ============================================================================

BEGIN;

-- Step 1: Show what will be deleted (run this first to verify)
SELECT
  'marc_records' as table_name,
  COUNT(*) as records_to_delete
FROM marc_records
UNION ALL
SELECT 'holdings', COUNT(*) FROM holdings
UNION ALL
SELECT 'checkouts', COUNT(*) FROM checkouts
UNION ALL
SELECT 'authority_references', COUNT(*) FROM authority_references
UNION ALL
SELECT 'related_records', COUNT(*) FROM related_records
UNION ALL
SELECT 'cover_images', COUNT(*) FROM cover_images
UNION ALL
SELECT 'marc_attachments', COUNT(*) FROM marc_attachments
UNION ALL
SELECT 'reading_lists', COUNT(*) FROM reading_lists;

-- STOP HERE AND REVIEW THE COUNTS ABOVE
-- If you're sure you want to proceed, comment out the ROLLBACK below
-- and uncomment the deletion commands

ROLLBACK; -- Safety: prevents accidental execution

-- ============================================================================
-- DELETION COMMANDS (uncomment to execute)
-- ============================================================================

/*
BEGIN;

-- Delete in correct order (respecting foreign key constraints)

-- 1. Delete checkouts first (references holdings)
DELETE FROM checkouts;

-- 2. Delete holdings (references marc_records)
DELETE FROM holdings;

-- 3. Delete authority references (references marc_records)
DELETE FROM authority_references;

-- 4. Delete related records (references marc_records)
DELETE FROM related_records;

-- 5. Delete cover images (references marc_records)
DELETE FROM cover_images;

-- 6. Delete attachments (references marc_records)
DELETE FROM marc_attachments;

-- 7. Delete reading lists (references marc_records)
DELETE FROM reading_lists;

-- 8. Finally, delete all MARC records
DELETE FROM marc_records;

-- Optional: Reset any sequences/counters
-- (PostgreSQL auto-increment counters - usually not necessary)
-- ALTER SEQUENCE IF EXISTS marc_records_id_seq RESTART WITH 1;

COMMIT;

-- Verify deletion
SELECT
  'marc_records' as table_name,
  COUNT(*) as remaining
FROM marc_records
UNION ALL
SELECT 'holdings', COUNT(*) FROM holdings;

-- Expected result: 0 records in all tables
*/
