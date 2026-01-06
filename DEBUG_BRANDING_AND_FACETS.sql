-- ============================================
-- COMPREHENSIVE DIAGNOSTIC: BRANDING & FACETS
-- ============================================

-- 1. Check branding configuration data
SELECT
  'BRANDING DATA' as check_type,
  library_name,
  primary_color,
  show_header,
  show_homepage_info,
  show_powered_by,
  is_active,
  (header_links::text) as header_links_preview,
  (homepage_info_links::text) as info_links_preview
FROM branding_configuration
WHERE is_active = true;

-- 2. Check if facet_configuration table exists and has data
SELECT
  'FACET CONFIG' as check_type,
  COUNT(*) as total_facets,
  COUNT(*) FILTER (WHERE is_enabled = true) as enabled_facets
FROM facet_configuration;

-- 3. List all facets
SELECT
  'FACET DETAILS' as check_type,
  facet_key,
  facet_label,
  is_enabled,
  display_order
FROM facet_configuration
ORDER BY display_order;

-- 4. Check if there's any catalog data for facets to work with
SELECT
  'CATALOG DATA' as check_type,
  COUNT(*) as total_records,
  COUNT(DISTINCT material_type) as distinct_material_types,
  COUNT(DISTINCT language_code) as distinct_languages,
  COUNT(*) FILTER (WHERE material_type IS NOT NULL) as records_with_material_type
FROM marc_records;

-- 5. Sample material types from actual data
SELECT
  'MATERIAL TYPES IN DATA' as check_type,
  material_type,
  COUNT(*) as count
FROM marc_records
WHERE material_type IS NOT NULL
GROUP BY material_type
ORDER BY count DESC
LIMIT 10;

-- 6. Check if unaccent extension is installed (for Unicode search)
SELECT
  'UNACCENT EXTENSION' as check_type,
  extname,
  extversion
FROM pg_extension
WHERE extname = 'unaccent';
