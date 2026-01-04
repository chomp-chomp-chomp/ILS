-- Migration: Add diacritic-insensitive search
-- Allows searching for "Zizek" to match "Žižek", etc.
-- Created: 2026-01-04

-- First, try to enable the unaccent extension
-- This extension removes diacritics from text
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create a wrapper function that uses unaccent if available
-- This function is IMMUTABLE which is required for use in indexes
CREATE OR REPLACE FUNCTION remove_diacritics(text)
RETURNS text AS $$
BEGIN
  -- Try to use unaccent if available
  BEGIN
    RETURN unaccent($1);
  EXCEPTION WHEN undefined_function THEN
    -- If unaccent is not available, return original text
    -- At least searches will still work, just not diacritic-insensitive
    RETURN $1;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the search_vector function to remove diacritics before indexing
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  subject_text TEXT := '';
BEGIN
  -- Extract all subject headings from the subject_topical array
  IF NEW.subject_topical IS NOT NULL THEN
    SELECT string_agg(elem->>'a', ' ')
    INTO subject_text
    FROM unnest(NEW.subject_topical) AS elem
    WHERE elem->>'a' IS NOT NULL;
  END IF;

  -- Apply remove_diacritics() to all text before creating search_vector
  NEW.search_vector :=
    -- 'A' weight (highest): Title
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.title_statement->>'a', ''))),
      'A'
    ) ||

    -- 'B' weight (high): Author and Subjects
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.main_entry_personal_name->>'a', ''))),
      'B'
    ) ||
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(subject_text, ''))),
      'B'
    ) ||

    -- 'C' weight (medium): Publisher and Series
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.publication_info->>'b', ''))),
      'C'
    ) ||
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.series_statement->>'a', ''))),
      'C'
    ) ||

    -- 'D' weight (low): Summary
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.summary, ''))),
      'D'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to normalize search queries (remove diacritics)
-- This will be used in the application code when performing searches
CREATE OR REPLACE FUNCTION normalize_search_query(query TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN remove_diacritics(query);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Rebuild search_vector for all existing records with the new diacritic-insensitive indexing
UPDATE marc_records SET updated_at = NOW();

-- Add helpful comment
COMMENT ON FUNCTION update_marc_search_vector() IS
  'Updates search_vector with weighted, diacritic-insensitive indexing: A=title, B=author+subjects, C=publisher+series, D=summary. Searching for "Zizek" will match "Žižek".';

COMMENT ON FUNCTION remove_diacritics(text) IS
  'Removes diacritics from text using unaccent extension if available. Used for diacritic-insensitive search.';

COMMENT ON FUNCTION normalize_search_query(text) IS
  'Normalizes search queries by removing diacritics. Use this on user input before searching to enable diacritic-insensitive search.';
