-- ============================================================================
-- BRANDING ADMIN DIAGNOSTICS
-- ============================================================================
--
-- Run this in Supabase SQL Editor to diagnose branding admin issues
-- This will show what columns exist and what data is saved
--
-- ============================================================================

-- Check what columns exist in branding_configuration table
SELECT
  'Branding table columns:' AS info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'branding_configuration'
ORDER BY ordinal_position;

-- Check if branding data exists
SELECT
  'Branding records:' AS info,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_active = true) as active_records
FROM branding_configuration;

-- Show the active branding configuration (all columns)
SELECT
  'Active branding data:' AS info,
  *
FROM branding_configuration
WHERE is_active = true;

-- Check RLS policies
SELECT
  'RLS Policies:' AS info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'branding_configuration';

-- Test if you can insert/update branding
-- This will fail if RLS is blocking, but that's ok - we just want to see the error
DO $$
BEGIN
  -- Try to update or insert
  IF EXISTS (SELECT 1 FROM branding_configuration WHERE is_active = true) THEN
    RAISE NOTICE 'Branding record exists - ready for updates';
  ELSE
    RAISE NOTICE 'No active branding record - will need to insert one';
  END IF;
END $$;

-- Show recent Postgres logs related to branding table
-- (This may not work depending on your Supabase plan)
SELECT
  'Recent errors:' AS info,
  *
FROM postgres_logs
WHERE event_message LIKE '%branding%'
ORDER BY timestamp DESC
LIMIT 10;
