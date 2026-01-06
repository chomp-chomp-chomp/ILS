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

-- Check if the new columns exist that are needed for header/footer
SELECT
  'Required columns check:' AS info,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configuration' AND column_name = 'show_header'
  ) as has_show_header,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configuration' AND column_name = 'header_links'
  ) as has_header_links,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configuration' AND column_name = 'show_homepage_info'
  ) as has_show_homepage_info,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configuration' AND column_name = 'homepage_info_links'
  ) as has_homepage_info_links;
