-- ============================================
-- COMPREHENSIVE SINGLE-QUERY DIAGNOSTIC
-- Run this entire file - it will show ONE table with all results
-- ============================================

DO $$
DECLARE
  branding_count INTEGER;
  facet_count INTEGER;
  enabled_facet_count INTEGER;
  marc_count INTEGER;
  material_types_count INTEGER;
  languages_count INTEGER;
  holdings_count INTEGER;
  has_unaccent BOOLEAN;
BEGIN
  -- Count branding records
  SELECT COUNT(*) INTO branding_count FROM branding_configuration WHERE is_active = true;

  -- Count facets
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_enabled = true)
  INTO facet_count, enabled_facet_count
  FROM facet_configuration;

  -- Count catalog data
  SELECT
    COUNT(*),
    COUNT(DISTINCT material_type) FILTER (WHERE material_type IS NOT NULL),
    COUNT(DISTINCT language_code) FILTER (WHERE language_code IS NOT NULL)
  INTO marc_count, material_types_count, languages_count
  FROM marc_records;

  -- Count holdings
  SELECT COUNT(*) INTO holdings_count FROM holdings;

  -- Check unaccent
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'unaccent') INTO has_unaccent;

  -- Display summary
  RAISE NOTICE '============================================';
  RAISE NOTICE 'DIAGNOSTIC SUMMARY';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Branding records: %', branding_count;
  RAISE NOTICE 'Total facets: % (% enabled)', facet_count, enabled_facet_count;
  RAISE NOTICE 'MARC records: %', marc_count;
  RAISE NOTICE 'Material types: %', material_types_count;
  RAISE NOTICE 'Languages: %', languages_count;
  RAISE NOTICE 'Holdings: %', holdings_count;
  RAISE NOTICE 'Unaccent extension: %', CASE WHEN has_unaccent THEN 'INSTALLED' ELSE 'MISSING' END;
  RAISE NOTICE '============================================';
END $$;

-- Show everything in one result table
SELECT
  'SUMMARY' as section,
  'Branding Active' as metric,
  COUNT(*)::text as value
FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'SUMMARY', 'Facets (total/enabled)',
  (SELECT COUNT(*)::text || ' / ' || COUNT(*) FILTER (WHERE is_enabled = true)::text FROM facet_configuration)

UNION ALL

SELECT 'SUMMARY', 'MARC Records', COUNT(*)::text FROM marc_records

UNION ALL

SELECT 'SUMMARY', 'Material Types', COUNT(DISTINCT material_type)::text FROM marc_records WHERE material_type IS NOT NULL

UNION ALL

SELECT 'SUMMARY', 'Languages', COUNT(DISTINCT language_code)::text FROM marc_records WHERE language_code IS NOT NULL

UNION ALL

SELECT 'SUMMARY', 'Holdings', COUNT(*)::text FROM holdings

UNION ALL

SELECT 'SUMMARY', 'Unaccent Extension',
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN 'INSTALLED' ELSE 'MISSING' END

UNION ALL

SELECT 'BRANDING', 'show_header', show_header::text FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'show_powered_by', show_powered_by::text FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'header_links_count', jsonb_array_length(COALESCE(header_links, '[]'::jsonb))::text FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'primary_color', primary_color FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'FACETS', facet_label, is_enabled::text FROM facet_configuration ORDER BY display_order

UNION ALL

SELECT 'DATA', 'Material: ' || material_type, COUNT(*)::text
FROM marc_records
WHERE material_type IS NOT NULL
GROUP BY material_type

UNION ALL

SELECT 'DATA', 'Language: ' || COALESCE(language_code, 'NULL'), COUNT(*)::text
FROM marc_records
GROUP BY language_code
LIMIT 10

UNION ALL

SELECT 'DATA', 'Year: ' || (publication_info->>'c'), COUNT(*)::text
FROM marc_records
WHERE publication_info->>'c' IS NOT NULL
GROUP BY publication_info->>'c'
ORDER BY publication_info->>'c' DESC
LIMIT 10

UNION ALL

SELECT 'HOLDINGS', 'Status: ' || COALESCE(status, 'NULL'), COUNT(*)::text
FROM holdings
GROUP BY status

ORDER BY section, metric;
