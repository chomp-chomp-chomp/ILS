-- Migration: Add additional MARC21 fields for comprehensive cataloging
-- Fields: 024, 246, 250, 336/337/338 (RDA), 505, 546, 655, 050, 082

-- Add new columns to marc_records table
ALTER TABLE marc_records
  -- Standard identifiers
  ADD COLUMN IF NOT EXISTS other_standard_identifier JSONB[], -- 024 array of {type, value, qualifier}

  -- Title fields
  ADD COLUMN IF NOT EXISTS varying_form_title JSONB[], -- 246 array of {type, title, subtitle}
  ADD COLUMN IF NOT EXISTS edition_statement JSONB, -- 250 {a: edition, b: statement of responsibility}

  -- RDA carrier/content/media types
  ADD COLUMN IF NOT EXISTS content_type JSONB[], -- 336 array of {a: term, b: code, 2: source}
  ADD COLUMN IF NOT EXISTS media_type JSONB[], -- 337 array of {a: term, b: code, 2: source}
  ADD COLUMN IF NOT EXISTS carrier_type JSONB[], -- 338 array of {a: term, b: code, 2: source}

  -- Additional notes
  ADD COLUMN IF NOT EXISTS formatted_contents_note TEXT[], -- 505
  ADD COLUMN IF NOT EXISTS language_note TEXT, -- 546

  -- Additional subject access
  ADD COLUMN IF NOT EXISTS genre_form_term JSONB[], -- 655 array of {a: term, v: form, x: general, y: chronological, z: geographic, 2: source}

  -- Call numbers
  ADD COLUMN IF NOT EXISTS lc_call_number JSONB, -- 050 {a: classification, b: item number}
  ADD COLUMN IF NOT EXISTS dewey_call_number JSONB; -- 082 {a: number, 2: edition}

-- Create indexes for new searchable fields
CREATE INDEX IF NOT EXISTS idx_marc_other_standard_id ON marc_records USING GIN(other_standard_identifier);
CREATE INDEX IF NOT EXISTS idx_marc_genre_form ON marc_records USING GIN(genre_form_term);
CREATE INDEX IF NOT EXISTS idx_marc_lc_call_number ON marc_records((lc_call_number->>'a'));
CREATE INDEX IF NOT EXISTS idx_marc_dewey_call_number ON marc_records((dewey_call_number->>'a'));

-- Update the search vector function to include new fields
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    -- Title (weight A - highest priority)
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'b', '')), 'A') ||

    -- Variant titles (weight A) - JSONB[] array
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(elem->>'title', ' ') FROM unnest(COALESCE(NEW.varying_form_title, ARRAY[]::jsonb[])) AS elem),
      ''
    )), 'A') ||

    -- Author (weight B - high priority)
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_corporate_name->>'a', '')), 'B') ||

    -- Subjects (weight B) - JSONB[] arrays
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(elem->>'a', ' ') FROM unnest(COALESCE(NEW.subject_topical, ARRAY[]::jsonb[])) AS elem),
      ''
    )), 'B') ||
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(elem->>'a', ' ') FROM unnest(COALESCE(NEW.subject_geographic, ARRAY[]::jsonb[])) AS elem),
      ''
    )), 'B') ||
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(elem->>'a', ' ') FROM unnest(COALESCE(NEW.genre_form_term, ARRAY[]::jsonb[])) AS elem),
      ''
    )), 'B') ||

    -- Publisher (weight C - medium priority)
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.series_statement->>'a', '')), 'C') ||

    -- Summary and notes (weight D - low priority)
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.general_note, ' '), '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.bibliography_note, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.formatted_contents_note, ' '), '')), 'D') ||

    -- Standard identifiers (simple config, no stemming)
    setweight(to_tsvector('simple', COALESCE(NEW.isbn, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.issn, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(
      (SELECT string_agg(elem->>'value', ' ') FROM unnest(COALESCE(NEW.other_standard_identifier, ARRAY[]::jsonb[])) AS elem),
      ''
    )), 'B');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON COLUMN marc_records.other_standard_identifier IS 'MARC 024 - Other standard identifiers (UPC, EAN, ISMN, etc.)';
COMMENT ON COLUMN marc_records.varying_form_title IS 'MARC 246 - Variant titles (portion, parallel, distinctive, other)';
COMMENT ON COLUMN marc_records.edition_statement IS 'MARC 250 - Edition statement and responsibility';
COMMENT ON COLUMN marc_records.content_type IS 'MARC 336 - RDA content type (text, cartographic image, etc.)';
COMMENT ON COLUMN marc_records.media_type IS 'MARC 337 - RDA media type (unmediated, computer, audio, etc.)';
COMMENT ON COLUMN marc_records.carrier_type IS 'MARC 338 - RDA carrier type (volume, online resource, audio disc, etc.)';
COMMENT ON COLUMN marc_records.formatted_contents_note IS 'MARC 505 - Formatted contents note (table of contents, etc.)';
COMMENT ON COLUMN marc_records.language_note IS 'MARC 546 - Language note';
COMMENT ON COLUMN marc_records.genre_form_term IS 'MARC 655 - Index term for genre/form';
COMMENT ON COLUMN marc_records.lc_call_number IS 'MARC 050 - Library of Congress Classification';
COMMENT ON COLUMN marc_records.dewey_call_number IS 'MARC 082 - Dewey Decimal Classification';

-- Rebuild search vectors for existing records (runs in background)
-- Uncomment the line below AFTER testing the migration on a few records
-- UPDATE marc_records SET updated_at = NOW();

COMMIT;
