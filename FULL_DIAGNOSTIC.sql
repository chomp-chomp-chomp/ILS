-- ============================================
-- COMPREHENSIVE SINGLE-QUERY DIAGNOSTIC
-- Run this entire file - it will show ONE table with all results
-- ============================================

-- Show everything in one result table
SELECT
  'SUMMARY' as section,
  'Branding Active' as metric,
  COUNT(*)::text as value,
  1 as sort_order
FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'SUMMARY', 'Facets (total/enabled)',
  (SELECT COUNT(*)::text || ' / ' || COUNT(*) FILTER (WHERE is_enabled = true)::text FROM facet_configuration),
  2

UNION ALL

SELECT 'SUMMARY', 'MARC Records', COUNT(*)::text, 3 FROM marc_records

UNION ALL

SELECT 'SUMMARY', 'Material Types', COUNT(DISTINCT material_type)::text, 4 FROM marc_records WHERE material_type IS NOT NULL

UNION ALL

SELECT 'SUMMARY', 'Languages', COUNT(DISTINCT language_code)::text, 5 FROM marc_records WHERE language_code IS NOT NULL

UNION ALL

SELECT 'SUMMARY', 'Holdings', COUNT(*)::text, 6 FROM holdings

UNION ALL

SELECT 'SUMMARY', 'Unaccent Extension',
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN 'INSTALLED' ELSE 'MISSING' END,
  7

UNION ALL

SELECT 'BRANDING', 'show_header', show_header::text, 10 FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'show_powered_by', show_powered_by::text, 11 FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'footer_text', footer_text, 12 FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'header_links_count', jsonb_array_length(COALESCE(header_links, '[]'::jsonb))::text, 13 FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'BRANDING', 'primary_color', primary_color, 14 FROM branding_configuration WHERE is_active = true

UNION ALL

SELECT 'FACETS', facet_label, is_enabled::text, 20 + display_order FROM facet_configuration

UNION ALL

SELECT 'DATA-MATERIALS', 'Material: ' || material_type, COUNT(*)::text, 100
FROM marc_records
WHERE material_type IS NOT NULL
GROUP BY material_type

UNION ALL

SELECT 'DATA-LANGUAGES', 'Language: ' || COALESCE(language_code, 'NULL'), COUNT(*)::text, 200
FROM marc_records
GROUP BY language_code
LIMIT 10

UNION ALL

SELECT 'DATA-YEARS', 'Year: ' || (publication_info->>'c'), COUNT(*)::text, 300
FROM (
  SELECT publication_info->>'c' as year, COUNT(*) as count
  FROM marc_records
  WHERE publication_info->>'c' IS NOT NULL
  GROUP BY publication_info->>'c'
  ORDER BY publication_info->>'c' DESC
  LIMIT 10
) sub

UNION ALL

SELECT 'HOLDINGS', 'Status: ' || COALESCE(status, 'NULL'), COUNT(*)::text, 400
FROM holdings
GROUP BY status

ORDER BY sort_order, section, metric;
