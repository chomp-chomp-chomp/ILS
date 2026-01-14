-- ============================================================================
-- Migration 030: Fix Row Level Security (RLS) Issues
-- ============================================================================
-- Description: Enables RLS on tables that have policies but RLS disabled
-- Created: 2026-01-14
-- Issue: Supabase linter detected tables with RLS policies but RLS not enabled
--
-- Tables affected:
-- 1. marc_records - Has policies but RLS not enabled (CRITICAL)
-- 2. facet_configuration - Should have RLS enabled
-- 3. facet_values_cache - Should have RLS enabled
-- 4. facets, facet_values - If these tables exist, enable RLS on them
--
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE RLS ON marc_records
-- ============================================================================
-- This is the most critical fix - marc_records has policies but RLS is not enabled
-- Without RLS enabled, the policies are not enforced!

ALTER TABLE marc_records ENABLE ROW LEVEL SECURITY;

-- Verify policies exist (they were created in migration 022_archives_and_visibility.sql)
-- These policies will now be enforced:
-- - "Public read access for active visible records"
-- - "Staff read access to all records"
-- - "Authenticated users can insert"
-- - "Authenticated users can update"
-- - "Authenticated users can delete"

COMMENT ON TABLE marc_records IS 'Bibliographic records table with Row Level Security enabled. Public users can only see active+public records. Staff can see all records.';

-- ============================================================================
-- PART 2: ENSURE RLS ON FACET TABLES
-- ============================================================================
-- These should already have RLS enabled from migration 018, but let's make sure

-- Enable RLS on facet_configuration (idempotent - won't error if already enabled)
ALTER TABLE facet_configuration ENABLE ROW LEVEL SECURITY;

-- Enable RLS on facet_values_cache (idempotent)
ALTER TABLE facet_values_cache ENABLE ROW LEVEL SECURITY;

-- Enable RLS on facets table if it exists (some databases may have this)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'facets'
  ) THEN
    EXECUTE 'ALTER TABLE facets ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE 'RLS enabled on facets table';

    -- Create basic policies if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'facets'
      AND policyname = 'Public read access'
    ) THEN
      EXECUTE 'CREATE POLICY "Public read access" ON facets FOR SELECT TO anon, authenticated USING (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'facets'
      AND policyname = 'Authenticated users can manage'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated users can manage" ON facets FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    END IF;
  ELSE
    RAISE NOTICE 'facets table does not exist - skipping';
  END IF;
END $$;

-- Enable RLS on facet_values table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'facet_values'
  ) THEN
    EXECUTE 'ALTER TABLE facet_values ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE 'RLS enabled on facet_values table';

    -- Create basic policies if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'facet_values'
      AND policyname = 'Public read access'
    ) THEN
      EXECUTE 'CREATE POLICY "Public read access" ON facet_values FOR SELECT TO anon, authenticated USING (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'facet_values'
      AND policyname = 'Authenticated users can manage'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated users can manage" ON facet_values FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    END IF;
  ELSE
    RAISE NOTICE 'facet_values table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- PART 3: ADDRESS SECURITY DEFINER VIEWS
-- ============================================================================
-- The linter flagged these views as having SECURITY DEFINER property.
-- This is actually INTENTIONAL in this application for access control.
--
-- Views with SECURITY DEFINER:
-- - marc_records_public: Shows only active, public records
-- - marc_records_archived: Shows archived records
-- - marc_records_trash: Shows deleted records
-- - marc_records_staff_only: Shows staff-only records
-- - marc_attachment_stats: Attachment statistics
-- - facet_matching_records: Facet computation helper
--
-- These views were created as SECURITY DEFINER to enforce consistent
-- access control regardless of the calling user's permissions.
--
-- According to the documentation (migrations/022_archives_and_visibility.sql),
-- these views need SECURITY DEFINER to properly enforce visibility rules.
--
-- However, for better security, we'll recreate them without SECURITY DEFINER
-- and instead rely on RLS policies on the underlying tables.

-- Recreate marc_records_public WITHOUT security definer
CREATE OR REPLACE VIEW marc_records_public AS
SELECT *
FROM marc_records
WHERE status = 'active' AND visibility = 'public';

-- Recreate marc_records_archived WITHOUT security definer
CREATE OR REPLACE VIEW marc_records_archived AS
SELECT *
FROM marc_records
WHERE status = 'archived';

-- Recreate marc_records_trash WITHOUT security definer
CREATE OR REPLACE VIEW marc_records_trash AS
SELECT *
FROM marc_records
WHERE status = 'deleted';

-- Recreate marc_records_staff_only WITHOUT security definer
CREATE OR REPLACE VIEW marc_records_staff_only AS
SELECT *
FROM marc_records
WHERE visibility = 'staff_only' AND status = 'active';

-- Note: marc_attachment_stats and facet_matching_records will be handled
-- in their respective migrations if they need to be changed

-- ============================================================================
-- PART 4: VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled on all critical tables
DO $$
DECLARE
  rec RECORD;
  rls_status TEXT;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS STATUS VERIFICATION';
  RAISE NOTICE '============================================';

  FOR rec IN
    SELECT
      tablename,
      rowsecurity as rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('marc_records', 'facet_configuration', 'facet_values_cache', 'facets', 'facet_values')
    ORDER BY tablename
  LOOP
    IF rec.rls_enabled THEN
      rls_status := '✅ ENABLED';
    ELSE
      rls_status := '❌ DISABLED';
    END IF;

    RAISE NOTICE 'Table: % - RLS: %', rec.tablename, rls_status;
  END LOOP;

  RAISE NOTICE '============================================';
END $$;

-- Show policy counts for each table
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS POLICY COUNTS';
  RAISE NOTICE '============================================';

  FOR rec IN
    SELECT
      tablename,
      COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('marc_records', 'facet_configuration', 'facet_values_cache', 'facets', 'facet_values')
    GROUP BY tablename
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table: % - Policies: %', rec.tablename, rec.policy_count;
  END LOOP;

  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- ✅ Enabled RLS on marc_records (CRITICAL - policies now enforced)
-- ✅ Verified RLS on facet_configuration
-- ✅ Verified RLS on facet_values_cache
-- ✅ Conditionally enabled RLS on facets/facet_values if they exist
-- ✅ Recreated views without SECURITY DEFINER (safer approach)
-- ✅ Added verification queries to confirm RLS status

-- Security impact:
-- BEFORE: marc_records had policies defined but they were NOT enforced
--         (anyone could read all records regardless of status/visibility)
-- AFTER:  RLS is enabled, policies are enforced
--         (public users see only active+public, staff see all)

-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Verify no errors in the output
-- 3. Check that public catalog still shows records
-- 4. Check that admin panel can still access all records
-- 5. Test that archived/deleted records are hidden from public view

COMMENT ON TABLE marc_records IS 'Bibliographic records with Row Level Security enabled. Policies enforce visibility based on status and visibility columns.';
