-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a function to suggest spell corrections based on catalog data
CREATE OR REPLACE FUNCTION suggest_spell_correction(search_term TEXT, similarity_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(
  suggestion TEXT,
  similarity_score FLOAT,
  source_type TEXT
) AS $$
BEGIN
  -- Return suggestions from various catalog fields using trigram similarity
  RETURN QUERY
  WITH all_terms AS (
    -- Extract titles
    SELECT DISTINCT
      title_statement->>'a' AS term,
      'title' AS source
    FROM marc_records
    WHERE title_statement->>'a' IS NOT NULL

    UNION

    -- Extract author names
    SELECT DISTINCT
      main_entry_personal_name->>'a' AS term,
      'author' AS source
    FROM marc_records
    WHERE main_entry_personal_name->>'a' IS NOT NULL

    UNION

    -- Extract subject headings
    SELECT DISTINCT
      jsonb_array_elements(subject_headings_topical)->>'a' AS term,
      'subject' AS source
    FROM marc_records
    WHERE jsonb_array_length(subject_headings_topical) > 0

    UNION

    -- Extract publisher names
    SELECT DISTINCT
      publication_info->>'b' AS term,
      'publisher' AS source
    FROM marc_records
    WHERE publication_info->>'b' IS NOT NULL
  ),
  -- Calculate similarity scores
  scored_terms AS (
    SELECT
      term,
      similarity(LOWER(term), LOWER(search_term)) AS score,
      source
    FROM all_terms
    WHERE similarity(LOWER(term), LOWER(search_term)) > similarity_threshold
      AND LOWER(term) != LOWER(search_term) -- Exclude exact matches
  )
  -- Return top suggestions ordered by similarity
  SELECT
    term AS suggestion,
    score AS similarity_score,
    source AS source_type
  FROM scored_terms
  ORDER BY score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create an optimized function for multi-word search queries
CREATE OR REPLACE FUNCTION suggest_query_correction(search_query TEXT)
RETURNS TABLE(
  suggested_query TEXT,
  confidence FLOAT
) AS $$
DECLARE
  words TEXT[];
  word TEXT;
  corrected_words TEXT[];
  best_correction RECORD;
  final_confidence FLOAT := 1.0;
BEGIN
  -- Split query into words
  words := string_to_array(LOWER(search_query), ' ');

  -- For each word, find best correction
  FOREACH word IN ARRAY words
  LOOP
    -- Skip very short words (likely correct)
    IF length(word) <= 2 THEN
      corrected_words := array_append(corrected_words, word);
      CONTINUE;
    END IF;

    -- Find best correction for this word
    SELECT suggestion, similarity_score INTO best_correction
    FROM suggest_spell_correction(word, 0.4)
    ORDER BY similarity_score DESC
    LIMIT 1;

    IF best_correction.suggestion IS NOT NULL THEN
      corrected_words := array_append(corrected_words, LOWER(best_correction.suggestion));
      final_confidence := final_confidence * best_correction.similarity_score;
    ELSE
      -- Keep original word if no good correction found
      corrected_words := array_append(corrected_words, word);
    END IF;
  END LOOP;

  -- Return corrected query if different from original
  IF array_to_string(corrected_words, ' ') != LOWER(search_query) THEN
    suggested_query := array_to_string(corrected_words, ' ');
    confidence := final_confidence;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create indexes on commonly searched fields to improve performance
CREATE INDEX IF NOT EXISTS idx_title_trgm ON marc_records USING gin ((title_statement->>'a') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_author_trgm ON marc_records USING gin ((main_entry_personal_name->>'a') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_publisher_trgm ON marc_records USING gin ((publication_info->>'b') gin_trgm_ops);

COMMENT ON FUNCTION suggest_spell_correction IS 'Suggests spell corrections for search terms using trigram similarity against catalog data';
COMMENT ON FUNCTION suggest_query_correction IS 'Suggests corrections for multi-word search queries';
