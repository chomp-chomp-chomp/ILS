-- Migration 022: Archives and Visibility Features
-- Description: Adds archive/trash functionality and staff-only visibility controls
-- Created: 2026-01-05

-- ================================================================
-- 1. ADD STATUS AND VISIBILITY COLUMNS TO marc_records
-- ================================================================

-- Add status column for archive/trash management
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  CHECK (status IN ('active', 'archived', 'deleted'));

-- Add visibility column for public/staff-only control
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public'
  CHECK (visibility IN ('public', 'staff_only', 'hidden'));

-- Add archived_at timestamp for audit trail
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add archived_by for tracking who archived
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Add deleted_at timestamp for soft deletes
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_by for tracking who deleted
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- ================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Index on status for filtering active/archived/deleted records
CREATE INDEX IF NOT EXISTS idx_marc_records_status ON marc_records(status);

-- Index on visibility for public/staff filtering
CREATE INDEX IF NOT EXISTS idx_marc_records_visibility ON marc_records(visibility);

-- Composite index for common queries (status + visibility)
CREATE INDEX IF NOT EXISTS idx_marc_records_status_visibility
  ON marc_records(status, visibility);

-- ================================================================
-- 3. UPDATE EXISTING RECORDS TO DEFAULT VALUES
-- ================================================================

-- Set all existing records to 'active' and 'public'
UPDATE marc_records
SET status = 'active', visibility = 'public'
WHERE status IS NULL OR visibility IS NULL;

-- ================================================================
-- 4. UPDATE ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Drop existing public read policy
DROP POLICY IF EXISTS "Public read access" ON marc_records;

-- Create new public read policy that respects visibility and status
CREATE POLICY "Public read access for active visible records"
  ON marc_records FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active' AND
    visibility = 'public'
  );

-- Create staff read policy for all records (including archived/staff-only)
CREATE POLICY "Staff read access to all records"
  ON marc_records FOR SELECT
  TO authenticated
  USING (
    -- Authenticated users (staff) can see everything except permanently deleted
    status IN ('active', 'archived') OR
    (status = 'deleted' AND deleted_at > NOW() - INTERVAL '30 days')  -- Trash retention: 30 days
  );

-- Update write policies to allow status/visibility changes
DROP POLICY IF EXISTS "Authenticated users can insert" ON marc_records;
DROP POLICY IF EXISTS "Authenticated users can update" ON marc_records;
DROP POLICY IF EXISTS "Authenticated users can delete" ON marc_records;

CREATE POLICY "Authenticated users can insert"
  ON marc_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update"
  ON marc_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete"
  ON marc_records FOR DELETE
  TO authenticated
  USING (true);

-- ================================================================
-- 5. CREATE HELPER FUNCTIONS
-- ================================================================

-- Function to archive a record (soft delete to archive)
CREATE OR REPLACE FUNCTION archive_marc_record(
  record_id UUID,
  user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE marc_records
  SET
    status = 'archived',
    archived_at = NOW(),
    archived_by = user_id
  WHERE id = record_id AND status = 'active';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a record from archive
CREATE OR REPLACE FUNCTION restore_marc_record(
  record_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE marc_records
  SET
    status = 'active',
    archived_at = NULL,
    archived_by = NULL
  WHERE id = record_id AND status = 'archived';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to soft delete a record (moves to trash)
CREATE OR REPLACE FUNCTION soft_delete_marc_record(
  record_id UUID,
  user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE marc_records
  SET
    status = 'deleted',
    deleted_at = NOW(),
    deleted_by = user_id
  WHERE id = record_id AND status IN ('active', 'archived');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete old trash records
CREATE OR REPLACE FUNCTION purge_old_deleted_records()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Permanently delete records that have been in trash for > 30 days
  WITH deleted AS (
    DELETE FROM marc_records
    WHERE status = 'deleted'
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get archive statistics
CREATE OR REPLACE FUNCTION get_archive_stats()
RETURNS TABLE (
  active_count BIGINT,
  archived_count BIGINT,
  deleted_count BIGINT,
  staff_only_count BIGINT,
  hidden_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE status = 'archived') AS archived_count,
    COUNT(*) FILTER (WHERE status = 'deleted') AS deleted_count,
    COUNT(*) FILTER (WHERE visibility = 'staff_only') AS staff_only_count,
    COUNT(*) FILTER (WHERE visibility = 'hidden') AS hidden_count
  FROM marc_records;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 6. CREATE VIEWS FOR COMMON QUERIES
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
-- 7. GRANT PERMISSIONS ON VIEWS
-- ================================================================

-- Public can read the public view
GRANT SELECT ON marc_records_public TO anon, authenticated;

-- Staff can read archive, trash, and staff-only views
GRANT SELECT ON marc_records_archived TO authenticated;
GRANT SELECT ON marc_records_trash TO authenticated;
GRANT SELECT ON marc_records_staff_only TO authenticated;

-- ================================================================
-- 8. CREATE SCHEDULED JOB FOR TRASH PURGING (OPTIONAL)
-- ================================================================

-- Note: This requires pg_cron extension to be enabled
-- Run this separately if you want automatic trash purging:
/*
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule trash purge to run daily at 2 AM
SELECT cron.schedule(
  'purge-deleted-records',
  '0 2 * * *',  -- Every day at 2 AM
  $$SELECT purge_old_deleted_records()$$
);
*/

-- ================================================================
-- 9. ADD COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON COLUMN marc_records.status IS 'Record status: active (live), archived (hidden from OPAC, searchable in archives), deleted (trash, retained for 30 days)';
COMMENT ON COLUMN marc_records.visibility IS 'Visibility level: public (OPAC + staff), staff_only (staff view only), hidden (completely hidden)';
COMMENT ON COLUMN marc_records.archived_at IS 'Timestamp when record was archived';
COMMENT ON COLUMN marc_records.archived_by IS 'User who archived the record';
COMMENT ON COLUMN marc_records.deleted_at IS 'Timestamp when record was soft-deleted (moved to trash)';
COMMENT ON COLUMN marc_records.deleted_by IS 'User who deleted the record';

COMMENT ON FUNCTION archive_marc_record(UUID, UUID) IS 'Archive a record (moves from active to archived state)';
COMMENT ON FUNCTION restore_marc_record(UUID) IS 'Restore a record from archive back to active';
COMMENT ON FUNCTION soft_delete_marc_record(UUID, UUID) IS 'Soft delete a record (moves to trash, retained for 30 days)';
COMMENT ON FUNCTION purge_old_deleted_records() IS 'Permanently delete records that have been in trash for more than 30 days';
COMMENT ON FUNCTION get_archive_stats() IS 'Get count statistics for active, archived, deleted, staff_only, and hidden records';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

-- Summary of changes:
-- ✓ Added status column (active/archived/deleted)
-- ✓ Added visibility column (public/staff_only/hidden)
-- ✓ Added audit trail columns (archived_at, archived_by, deleted_at, deleted_by)
-- ✓ Created indexes for performance
-- ✓ Updated RLS policies to respect visibility and status
-- ✓ Created helper functions for archive/restore/delete operations
-- ✓ Created views for common filtering scenarios
-- ✓ Added trash retention (30-day soft delete before permanent deletion)

-- Next steps:
-- 1. Update admin cataloging interface to show archive/restore/delete buttons
-- 2. Create archive browser page at /admin/cataloging/archives
-- 3. Create trash browser page at /admin/cataloging/trash
-- 4. Update search queries to filter by status and visibility
-- 5. Add visibility toggle to record edit form
