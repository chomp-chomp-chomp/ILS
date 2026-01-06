-- ============================================
-- SIMPLE DIAGNOSTIC - NO COMPLEX UNIONS
-- ============================================

-- 1. Check branding footer settings
SELECT
  'FOOTER SETTINGS' as check_name,
  footer_text,
  show_powered_by,
  updated_at
FROM branding_configuration
WHERE is_active = true;

-- 2. Check facet configuration
SELECT
  'FACETS' as check_name,
  facet_key,
  facet_label,
  is_enabled,
  display_order
FROM facet_configuration
ORDER BY display_order;

-- 3. Check catalog data counts
SELECT
  'CATALOG DATA' as check_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT material_type) as material_type_count,
  COUNT(DISTINCT language_code) FILTER (WHERE language_code IS NOT NULL) as language_count
FROM marc_records;

-- 4. Check material types
SELECT
  'MATERIAL TYPES' as check_name,
  material_type,
  COUNT(*) as count
FROM marc_records
WHERE material_type IS NOT NULL
GROUP BY material_type;

-- 5. Check languages
SELECT
  'LANGUAGES' as check_name,
  COALESCE(language_code, 'NULL') as language,
  COUNT(*) as count
FROM marc_records
GROUP BY language_code;

-- 6. Check holdings for availability facet
SELECT
  'HOLDINGS' as check_name,
  COUNT(*) as total_holdings,
  COUNT(DISTINCT marc_record_id) as records_with_holdings
FROM holdings;
