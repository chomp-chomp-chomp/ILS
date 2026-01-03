-- Migration: Add subjects to search_vector
-- Fixes subject search functionality by including subject_topical in full-text search index
-- Created: 2026-01-03

-- Drop the old trigger function and recreate it with subjects included
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    -- 'A' weight (highest): Title
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||

    -- 'B' weight (high): Author and Subjects
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(elem->>'a', ' ')
       FROM jsonb_array_elements(COALESCE(NEW.subject_topical, '[]'::jsonb)) AS elem
       WHERE elem->>'a' IS NOT NULL),
      ''
    )), 'B') ||

    -- 'C' weight (medium): Publisher and Series
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.series_statement->>'a', '')), 'C') ||

    -- 'D' weight (low): Summary
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger already exists, so we don't need to recreate it
-- But we need to rebuild the search_vector for all existing records

-- Update all existing records to rebuild their search_vector with subjects included
UPDATE marc_records SET updated_at = NOW();

-- Verify the migration
-- Run this query to check that subjects are now searchable:
-- SELECT title_statement->>'a' as title,
--        subject_topical,
--        ts_rank(search_vector, websearch_to_tsquery('english', 'your-test-subject')) as rank
-- FROM marc_records
-- WHERE search_vector @@ websearch_to_tsquery('english', 'your-test-subject')
-- ORDER BY rank DESC
-- LIMIT 10;

COMMENT ON FUNCTION update_marc_search_vector() IS 'Updates search_vector with weighted indexing: A=title, B=author+subjects, C=publisher+series, D=summary';
