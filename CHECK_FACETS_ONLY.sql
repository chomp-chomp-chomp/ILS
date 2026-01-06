-- Quick check: Does facet_configuration table exist?
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'facet_configuration'
    )
    THEN '✅ facet_configuration table EXISTS'
    ELSE '❌ facet_configuration table MISSING - need to run FIX_ALL_ISSUES.sql'
  END as status;

-- If it exists, show facet count
SELECT
  '📊 Facet count:' as info,
  COUNT(*) as total_facets,
  COUNT(*) FILTER (WHERE is_enabled = true) as enabled_facets
FROM facet_configuration
WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'facet_configuration'
);

-- Check if there's catalog data for facets to use
SELECT
  '📚 Catalog data:' as info,
  COUNT(*) as total_marc_records,
  COUNT(DISTINCT material_type) FILTER (WHERE material_type IS NOT NULL) as material_types_count,
  COUNT(*) FILTER (WHERE material_type IS NULL) as records_without_material_type
FROM marc_records;
