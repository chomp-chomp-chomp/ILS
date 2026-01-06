-- Single query that shows ALL results in ONE table
-- Run this entire file

WITH branding_info AS (
  SELECT
    footer_text,
    show_powered_by,
    show_header,
    jsonb_array_length(COALESCE(header_links, '[]'::jsonb)) as header_count,
    updated_at
  FROM branding_configuration
  WHERE is_active = true
),
facet_info AS (
  SELECT
    COUNT(*) as total_facets,
    COUNT(*) FILTER (WHERE is_enabled = true) as enabled_facets
  FROM facet_configuration
),
catalog_info AS (
  SELECT
    COUNT(*) as total_records,
    COUNT(DISTINCT material_type) as material_types,
    COUNT(DISTINCT language_code) FILTER (WHERE language_code IS NOT NULL) as languages
  FROM marc_records
),
holdings_info AS (
  SELECT
    COUNT(*) as total_holdings,
    COUNT(DISTINCT marc_record_id) as records_with_holdings
  FROM holdings
)
SELECT
  '📋 BRANDING' as category,
  'Footer Text' as item,
  footer_text as value
FROM branding_info

UNION ALL SELECT '📋 BRANDING', 'Show Powered By', show_powered_by::text FROM branding_info
UNION ALL SELECT '📋 BRANDING', 'Show Header', show_header::text FROM branding_info
UNION ALL SELECT '📋 BRANDING', 'Header Links Count', header_count::text FROM branding_info
UNION ALL SELECT '📋 BRANDING', 'Last Updated', updated_at::text FROM branding_info

UNION ALL SELECT '🔍 FACETS', 'Total Facets', total_facets::text FROM facet_info
UNION ALL SELECT '🔍 FACETS', 'Enabled Facets', enabled_facets::text FROM facet_info

UNION ALL SELECT '📚 CATALOG', 'Total Records', total_records::text FROM catalog_info
UNION ALL SELECT '📚 CATALOG', 'Material Types', material_types::text FROM catalog_info
UNION ALL SELECT '📚 CATALOG', 'Languages', languages::text FROM catalog_info

UNION ALL SELECT '📦 HOLDINGS', 'Total Holdings', total_holdings::text FROM holdings_info
UNION ALL SELECT '📦 HOLDINGS', 'Records with Holdings', records_with_holdings::text FROM holdings_info

ORDER BY category, item;
