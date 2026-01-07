-- Comprehensive Branding Configuration Diagnostic
-- Run this in Supabase SQL Editor to diagnose branding persistence issues
-- Created: 2026-01-07

-- ================================================================
-- 1. CHECK IF BRANDING TABLE EXISTS AND ITS STRUCTURE
-- ================================================================

SELECT 
  '1. Branding Configuration Table Structure' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'branding_configuration'
ORDER BY ordinal_position;

-- ================================================================
-- 2. CHECK CURRENT ACTIVE BRANDING CONFIGURATION
-- ================================================================

SELECT 
  '2. Active Branding Configuration' as section,
  id,
  library_name,
  show_powered_by,
  footer_text,
  show_header,
  show_homepage_info,
  is_active,
  created_at,
  updated_at,
  updated_by
FROM branding_configuration
WHERE is_active = true;

-- ================================================================
-- 3. CHECK ALL BRANDING CONFIGURATIONS (INCLUDING INACTIVE)
-- ================================================================

SELECT 
  '3. All Branding Configurations' as section,
  id,
  library_name,
  is_active,
  created_at,
  updated_at
FROM branding_configuration
ORDER BY updated_at DESC;

-- ================================================================
-- 4. CHECK RLS POLICIES ON BRANDING TABLE
-- ================================================================

SELECT 
  '4. Row Level Security Policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'branding_configuration';

-- ================================================================
-- 5. CHECK IF TABLE HAS RLS ENABLED
-- ================================================================

SELECT 
  '5. RLS Status' as section,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'branding_configuration';

-- ================================================================
-- 6. CHECK FOR MISSING COLUMNS
-- ================================================================

WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id', 'created_at', 'updated_at', 'library_name', 'library_tagline',
    'logo_url', 'homepage_logo_url', 'favicon_url', 'primary_color',
    'secondary_color', 'accent_color', 'background_color', 'text_color',
    'font_family', 'heading_font', 'custom_css', 'custom_head_html',
    'footer_text', 'show_powered_by', 'contact_email', 'contact_phone',
    'contact_address', 'facebook_url', 'twitter_url', 'instagram_url',
    'show_covers', 'show_facets', 'items_per_page', 'is_active', 'updated_by',
    'show_header', 'header_links', 'show_homepage_info', 'homepage_info_title',
    'homepage_info_content', 'homepage_info_links'
  ]) AS column_name
),
actual_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'branding_configuration'
)
SELECT 
  '6. Missing Columns Check' as section,
  ec.column_name as expected_column,
  CASE 
    WHEN ac.column_name IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END as status
FROM expected_columns ec
LEFT JOIN actual_columns ac ON ec.column_name = ac.column_name
ORDER BY 
  CASE WHEN ac.column_name IS NULL THEN 0 ELSE 1 END,
  ec.column_name;

-- ================================================================
-- 7. CHECK FOR TRIGGERS ON BRANDING TABLE
-- ================================================================

SELECT 
  '7. Triggers on Branding Table' as section,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'branding_configuration'
ORDER BY trigger_name;

-- ================================================================
-- 8. TEST UPDATE PERMISSIONS (DRY RUN)
-- ================================================================

-- This checks if updates would be allowed with current RLS policies
EXPLAIN (FORMAT TEXT)
UPDATE branding_configuration
SET updated_at = NOW()
WHERE is_active = true;

-- ================================================================
-- SUMMARY
-- ================================================================

SELECT 
  '9. Summary' as section,
  (SELECT COUNT(*) FROM branding_configuration) as total_configs,
  (SELECT COUNT(*) FROM branding_configuration WHERE is_active = true) as active_configs,
  (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'branding_configuration'
  ) as total_columns,
  (
    SELECT COUNT(*)
    FROM pg_policies
    WHERE tablename = 'branding_configuration'
  ) as total_policies;

-- ================================================================
-- DIAGNOSTIC COMPLETE
-- ================================================================

-- Next steps based on results:
-- 1. If columns are missing, run migration 024_header_homepage_info.sql
-- 2. If RLS policies are blocking updates, check authentication
-- 3. If no active config exists, insert default configuration
-- 4. Check application logs for detailed error messages
