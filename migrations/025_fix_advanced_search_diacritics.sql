-- Migration: Fix advanced search to support diacritic-insensitive matching
-- Problem: Advanced search ILIKE compares normalized query against raw database fields
-- Solution: Create RPC function that normalizes both sides of the comparison
-- Created: 2026-01-10

-- Create a function for diacritic-insensitive advanced search
CREATE OR REPLACE FUNCTION search_marc_records_advanced(
  search_title TEXT DEFAULT NULL,
  search_author TEXT DEFAULT NULL,
  search_subject TEXT DEFAULT NULL,
  search_isbn TEXT DEFAULT NULL,
  search_publisher TEXT DEFAULT NULL,
  search_year_from TEXT DEFAULT NULL,
  search_year_to TEXT DEFAULT NULL,
  search_material_type TEXT DEFAULT NULL,
  search_operator TEXT DEFAULT 'AND'
)
RETURNS SETOF marc_records AS $$
DECLARE
  sql_query TEXT := 'SELECT * FROM marc_records WHERE status = ''active'' AND visibility = ''public''';
  conditions TEXT[] := ARRAY[]::TEXT[];
  condition TEXT;
BEGIN
  -- Build conditions array with diacritic-insensitive comparisons

  -- Title search (normalize both sides)
  IF search_title IS NOT NULL AND search_title != '' THEN
    conditions := array_append(conditions,
      format('remove_diacritics(title_statement->>''a'') ILIKE ''%%'' || remove_diacritics(%L) || ''%%''', search_title)
    );
  END IF;

  -- Author search (normalize both sides)
  IF search_author IS NOT NULL AND search_author != '' THEN
    conditions := array_append(conditions,
      format('remove_diacritics(main_entry_personal_name->>''a'') ILIKE ''%%'' || remove_diacritics(%L) || ''%%''', search_author)
    );
  END IF;

  -- Subject search (use search_vector since subjects are indexed there)
  IF search_subject IS NOT NULL AND search_subject != '' THEN
    conditions := array_append(conditions,
      format('search_vector @@ websearch_to_tsquery(''english'', %L)', search_subject)
    );
  END IF;

  -- ISBN search (no diacritics expected, just normalize hyphens)
  IF search_isbn IS NOT NULL AND search_isbn != '' THEN
    conditions := array_append(conditions,
      format('isbn ILIKE ''%%'' || %L || ''%%''', regexp_replace(search_isbn, '-', '', 'g'))
    );
  END IF;

  -- Publisher search (normalize both sides)
  IF search_publisher IS NOT NULL AND search_publisher != '' THEN
    conditions := array_append(conditions,
      format('remove_diacritics(publication_info->>''b'') ILIKE ''%%'' || remove_diacritics(%L) || ''%%''', search_publisher)
    );
  END IF;

  -- Year range filters
  IF search_year_from IS NOT NULL AND search_year_from != '' THEN
    conditions := array_append(conditions,
      format('(publication_info->>''c'') >= %L', search_year_from)
    );
  END IF;

  IF search_year_to IS NOT NULL AND search_year_to != '' THEN
    conditions := array_append(conditions,
      format('(publication_info->>''c'') <= %L', search_year_to)
    );
  END IF;

  -- Material type filter
  IF search_material_type IS NOT NULL AND search_material_type != '' THEN
    conditions := array_append(conditions,
      format('material_type = %L', search_material_type)
    );
  END IF;

  -- Combine conditions with operator (AND or OR)
  IF array_length(conditions, 1) > 0 THEN
    IF search_operator = 'OR' THEN
      sql_query := sql_query || ' AND (' || array_to_string(conditions, ' OR ') || ')';
    ELSE
      sql_query := sql_query || ' AND (' || array_to_string(conditions, ' AND ') || ')';
    END IF;
  END IF;

  -- Execute the dynamic query
  RETURN QUERY EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add helpful comment
COMMENT ON FUNCTION search_marc_records_advanced IS
  'Performs advanced search with diacritic-insensitive matching on all text fields. Normalizes both the search query and database field values using remove_diacritics() before comparison.';

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION search_marc_records_advanced TO anon, authenticated;
