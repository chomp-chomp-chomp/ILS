-- ============================================
-- DIAGNOSE WHY FACETS ARE EMPTY
-- ============================================

-- Check 1: Do records have the fields facets need?
SELECT
  'Material Type Data' as check_type,
  material_type,
  COUNT(*) as count
FROM marc_records
WHERE material_type IS NOT NULL
GROUP BY material_type;

-- Check 2: Do records have language data?
SELECT
  'Language Data' as check_type,
  language_code,
  COUNT(*) as count
FROM marc_records
WHERE language_code IS NOT NULL
GROUP BY language_code;

-- Check 3: Do records have publication years?
SELECT
  'Publication Year Data' as check_type,
  publication_info->>'c' as pub_year,
  COUNT(*) as count
FROM marc_records
WHERE publication_info->>'c' IS NOT NULL
GROUP BY publication_info->>'c'
ORDER BY pub_year DESC
LIMIT 20;

-- Check 4: Do records have subjects?
SELECT
  'Subject Data' as check_type,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE subject_topical IS NOT NULL AND subject_topical != '[]'::jsonb) as records_with_subjects,
  COUNT(*) FILTER (WHERE subject_topical IS NULL OR subject_topical = '[]'::jsonb) as records_without_subjects
FROM marc_records;

-- Check 5: Do records have holdings/items for availability facet?
SELECT
  'Holdings Data' as check_type,
  COUNT(DISTINCT marc_record_id) as records_with_holdings,
  COUNT(*) as total_holdings,
  COUNT(*) FILTER (WHERE status = 'available') as available_items,
  COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out_items
FROM holdings;

-- Check 6: Sample a few records to see their data
SELECT
  'Sample Records' as check_type,
  id,
  title_statement->>'a' as title,
  material_type,
  language_code,
  publication_info->>'c' as year,
  (SELECT COUNT(*) FROM holdings WHERE marc_record_id = marc_records.id) as holdings_count
FROM marc_records
LIMIT 5;
