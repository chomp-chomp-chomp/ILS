-- Simple one-query diagnostic for branding issues
-- Run this in Supabase SQL Editor

-- Check if branding record exists and show its data
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '❌ NO BRANDING RECORD EXISTS - Need to create one'
    ELSE '✅ Branding record exists'
  END as status,
  COUNT(*) as total_records,
  MAX(id::text) as record_id,
  MAX(library_name) as library_name,
  MAX(show_header::text) as show_header,
  MAX(show_powered_by::text) as show_powered_by,
  MAX(is_active::text) as is_active
FROM branding_configuration
WHERE is_active = true;
