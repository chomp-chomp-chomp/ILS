-- Diagnostic Test Script for Diacritic-Insensitive Search
-- Run this in Supabase SQL Editor to check if the migration was applied correctly
-- Created: 2026-01-10

-- ==============================================================================
-- TEST 1: Check if unaccent extension is installed
-- ==============================================================================
SELECT
  'TEST 1: unaccent extension' as test_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS - unaccent extension is installed'
    ELSE '❌ FAIL - unaccent extension is NOT installed'
  END as result
FROM pg_extension
WHERE extname = 'unaccent';

-- ==============================================================================
-- TEST 2: Check if remove_diacritics() function exists
-- ==============================================================================
SELECT
  'TEST 2: remove_diacritics() function' as test_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS - remove_diacritics() function exists'
    ELSE '❌ FAIL - remove_diacritics() function does NOT exist'
  END as result
FROM pg_proc
WHERE proname = 'remove_diacritics';

-- ==============================================================================
-- TEST 3: Check if normalize_search_query() function exists
-- ==============================================================================
SELECT
  'TEST 3: normalize_search_query() function' as test_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS - normalize_search_query() function exists'
    ELSE '❌ FAIL - normalize_search_query() function does NOT exist'
  END as result
FROM pg_proc
WHERE proname = 'normalize_search_query';

-- ==============================================================================
-- TEST 4: Check if update_marc_search_vector() trigger function exists
-- ==============================================================================
SELECT
  'TEST 4: update_marc_search_vector() trigger' as test_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS - update_marc_search_vector() trigger function exists'
    ELSE '❌ FAIL - update_marc_search_vector() trigger function does NOT exist'
  END as result
FROM pg_proc
WHERE proname = 'update_marc_search_vector';

-- ==============================================================================
-- TEST 5: Test remove_diacritics() function with sample data
-- ==============================================================================
SELECT
  'TEST 5: remove_diacritics() functionality' as test_name,
  input,
  remove_diacritics(input) as output,
  CASE
    WHEN remove_diacritics(input) = expected THEN '✅ PASS'
    ELSE '❌ FAIL - Expected: ' || expected
  END as result
FROM (
  VALUES
    ('Žižek', 'Zizek'),
    ('Café', 'Cafe'),
    ('Müller', 'Muller'),
    ('José', 'Jose'),
    ('Björk', 'Bjork'),
    ('Čapek', 'Capek')
) AS test_data(input, expected);

-- ==============================================================================
-- TEST 6: Check if search_vector includes diacritic removal
-- ==============================================================================
-- This checks if the trigger function definition includes remove_diacritics
SELECT
  'TEST 6: Search vector trigger includes diacritic removal' as test_name,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%remove_diacritics%'
    THEN '✅ PASS - Trigger uses remove_diacritics()'
    ELSE '❌ FAIL - Trigger does NOT use remove_diacritics()'
  END as result
FROM pg_proc
WHERE proname = 'update_marc_search_vector'
LIMIT 1;

-- ==============================================================================
-- TEST 7: Check if search_vector is populated for existing records
-- ==============================================================================
SELECT
  'TEST 7: Search vectors are populated' as test_name,
  COUNT(*) as total_records,
  COUNT(search_vector) as records_with_search_vector,
  CASE
    WHEN COUNT(*) = COUNT(search_vector) THEN '✅ PASS - All records have search_vector'
    WHEN COUNT(search_vector) > 0 THEN '⚠️ PARTIAL - Some records missing search_vector'
    ELSE '❌ FAIL - No records have search_vector'
  END as result
FROM marc_records;

-- ==============================================================================
-- TEST 8: Test actual search functionality
-- ==============================================================================
-- This tests if searching for "Zizek" finds records containing "Žižek"
-- First, let's see if there are any records with diacritics in the title or author

SELECT
  'TEST 8: Sample records with diacritics' as test_name,
  id,
  title_statement->>'a' as title,
  main_entry_personal_name->>'a' as author,
  '(Check if these contain diacritics)' as note
FROM marc_records
WHERE
  (title_statement->>'a') ~ '[À-ž]' OR
  (main_entry_personal_name->>'a') ~ '[À-ž]'
LIMIT 5;

-- ==============================================================================
-- TEST 9: Test normalized search (simulating what the app does)
-- ==============================================================================
-- Search for "Zizek" (no diacritics) using full-text search
-- This should match "Žižek" if the migration is working

SELECT
  'TEST 9: Search test - "Zizek" should match "Žižek"' as test_name,
  COUNT(*) as matching_records,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Possible PASS - Found records (check if they contain Žižek)'
    ELSE '⚠️ No results - Either no Žižek records exist, or search is not working'
  END as result
FROM marc_records
WHERE search_vector @@ websearch_to_tsquery('english', 'Zizek');

-- ==============================================================================
-- TEST 10: Show function definitions for manual inspection
-- ==============================================================================
SELECT
  'TEST 10: remove_diacritics() function definition' as test_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'remove_diacritics'
LIMIT 1;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
SELECT
  '═══════════════════════════════════════════════════════════════' as divider,
  'DIAGNOSTIC SUMMARY' as title;

SELECT
  '1. If all tests pass (✅), the migration is correctly applied.' as interpretation
UNION ALL
SELECT
  '2. If TEST 1 or 2 fails (❌), run the migration script.' as interpretation
UNION ALL
SELECT
  '3. If TEST 5 fails, the unaccent extension may not be working.' as interpretation
UNION ALL
SELECT
  '4. If TEST 7 shows partial results, run: UPDATE marc_records SET updated_at = NOW();' as interpretation
UNION ALL
SELECT
  '5. If TEST 9 shows no results, check if you have records with "Žižek" in your database.' as interpretation;

-- ==============================================================================
-- TROUBLESHOOTING: Create a test record with diacritics
-- ==============================================================================
-- Uncomment and run this if you want to create a test record to verify search

/*
INSERT INTO marc_records (
  title_statement,
  main_entry_personal_name,
  material_type,
  status,
  visibility
) VALUES (
  '{"a": "Less Than Nothing: Hegel and the Shadow of Dialectical Materialism"}'::jsonb,
  '{"a": "Žižek, Slavoj"}'::jsonb,
  'book',
  'active',
  'public'
);

-- After inserting, search for "Zizek" (no diacritics) and it should find this record
SELECT
  title_statement->>'a' as title,
  main_entry_personal_name->>'a' as author
FROM marc_records
WHERE search_vector @@ websearch_to_tsquery('english', 'Zizek')
  AND main_entry_personal_name->>'a' LIKE '%Žižek%';
*/
