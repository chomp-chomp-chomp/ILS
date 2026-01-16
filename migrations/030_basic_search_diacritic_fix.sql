-- Migration 030: Fix diacritic-insensitive basic keyword search
-- Creates an RPC function for basic search that properly handles diacritics
-- Created: 2026-01-16

-- Create a function for basic keyword search that handles diacritics correctly
CREATE OR REPLACE FUNCTION search_marc_records_basic(
  search_query TEXT
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  control_number VARCHAR,
  isbn VARCHAR,
  issn VARCHAR,
  title_statement JSONB,
  main_entry_personal_name JSONB,
  publication_info JSONB,
  physical_description VARCHAR,
  series_statement JSONB,
  general_note TEXT[],
  summary TEXT,
  subject_topical JSONB[],
  subject_geographic JSONB[],
  material_type VARCHAR,
  language_code VARCHAR,
  cataloging_source VARCHAR,
  marc_json JSONB,
  search_vector TSVECTOR,
  status VARCHAR,
  visibility VARCHAR,
  added_entry_personal_name JSONB[],
  added_entry_corporate_name JSONB[],
  edition_statement VARCHAR,
  publication_frequency VARCHAR,
  target_audience VARCHAR,
  contents TEXT,
  bibliography_note TEXT,
  cover_image_url TEXT,
  related_records_ids UUID[]
) AS $$
BEGIN
  -- Normalize the search query to remove diacritics
  search_query := remove_diacritics(search_query);
  
  -- Search against the pre-normalized search_vector
  -- The search_vector was created with remove_diacritics() in the trigger
  -- So this will match records regardless of diacritics
  RETURN QUERY
  SELECT m.*
  FROM marc_records m
  WHERE m.status = 'active'
    AND m.visibility = 'public'
    AND m.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add helpful comment
COMMENT ON FUNCTION search_marc_records_basic IS
  'Performs diacritic-insensitive full-text search using websearch syntax. Searching for "Zizek" will match "Žižek". Returns results ranked by relevance.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_marc_records_basic TO anon, authenticated;
