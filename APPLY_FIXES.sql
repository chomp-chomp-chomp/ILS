-- ============================================================================
-- APPLY ALL FIXES FOR SEARCH AND FACETS
-- ============================================================================
--
-- This script applies two critical migrations:
-- 1. Faceted Search Configuration (Migration 018)
-- 2. Diacritic-Insensitive Search (Migration 024)
--
-- Run this entire script in Supabase SQL Editor
-- Expected execution time: 30-60 seconds (depending on catalog size)
-- ============================================================================

\echo 'Starting migration application...'
\echo ''

-- ============================================================================
-- MIGRATION 1: FACETED SEARCH CONFIGURATION
-- ============================================================================

\echo 'Migration 1: Creating facet configuration tables...'

-- Create facet_configuration table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'facet_configuration') THEN

    CREATE TABLE facet_configuration (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      facet_key VARCHAR(50) NOT NULL UNIQUE,
      facet_label VARCHAR(100) NOT NULL,
      facet_description TEXT,
      source_type VARCHAR(50) NOT NULL,
      source_field VARCHAR(100) NOT NULL,
      source_subfield VARCHAR(10),
      display_type VARCHAR(50) DEFAULT 'checkbox_list',
      display_order INTEGER DEFAULT 0,
      is_enabled BOOLEAN DEFAULT true,
      is_collapsed_by_default BOOLEAN DEFAULT false,
      show_count BOOLEAN DEFAULT true,
      max_items INTEGER DEFAULT 10,
      show_more_threshold INTEGER DEFAULT 5,
      aggregation_method VARCHAR(50) DEFAULT 'distinct_values',
      bucket_size INTEGER,
      custom_ranges JSONB,
      sort_by VARCHAR(50) DEFAULT 'count_desc',
      custom_sort_order TEXT[],
      value_formatter VARCHAR(50),
      value_format_mapping JSONB,
      filter_param_name VARCHAR(50),
      multi_select BOOLEAN DEFAULT true,
      apply_to_search_field VARCHAR(100),
      cache_enabled BOOLEAN DEFAULT true,
      cache_ttl INTEGER DEFAULT 3600,
      show_only_for_search_types VARCHAR(50)[],
      min_results_to_show INTEGER DEFAULT 1,
      public_visible BOOLEAN DEFAULT true,
      staff_only BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      updated_by UUID REFERENCES auth.users(id)
    );

    CREATE INDEX idx_facet_config_key ON facet_configuration(facet_key);
    CREATE INDEX idx_facet_config_enabled ON facet_configuration(is_enabled, is_active);
    CREATE INDEX idx_facet_config_order ON facet_configuration(display_order) WHERE is_enabled = true AND is_active = true;

    RAISE NOTICE 'Created facet_configuration table';
  ELSE
    RAISE NOTICE 'facet_configuration table already exists';
  END IF;
END $$;

-- Create facet_values_cache table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'facet_values_cache') THEN

    CREATE TABLE facet_values_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      facet_key VARCHAR(50) NOT NULL REFERENCES facet_configuration(facet_key) ON DELETE CASCADE,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      filter_context JSONB,
      cached_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      UNIQUE(facet_key, value, filter_context)
    );

    CREATE INDEX idx_facet_cache_key ON facet_values_cache(facet_key);
    CREATE INDEX idx_facet_cache_expires ON facet_values_cache(expires_at);
    CREATE INDEX idx_facet_cache_context ON facet_values_cache USING gin(filter_context);

    RAISE NOTICE 'Created facet_values_cache table';
  ELSE
    RAISE NOTICE 'facet_values_cache table already exists';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE facet_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE facet_values_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Public read access to enabled facets" ON facet_configuration;
CREATE POLICY "Public read access to enabled facets"
  ON facet_configuration FOR SELECT
  TO anon, authenticated
  USING (is_enabled = true AND is_active = true AND (staff_only = false OR auth.role() = 'authenticated'));

DROP POLICY IF EXISTS "Authenticated users can manage facets" ON facet_configuration;
CREATE POLICY "Authenticated users can manage facets"
  ON facet_configuration FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public read access to facet cache" ON facet_values_cache;
CREATE POLICY "Public read access to facet cache"
  ON facet_values_cache FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage cache" ON facet_values_cache;
CREATE POLICY "Authenticated users can manage cache"
  ON facet_values_cache FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

\echo 'Migration 1: Inserting default facet configurations...'

-- Insert default facets (with conflict handling)
INSERT INTO facet_configuration (
  facet_key, facet_label, facet_description, source_type, source_field,
  display_type, display_order, aggregation_method, sort_by, value_formatter,
  value_format_mapping, filter_param_name, apply_to_search_field, max_items, is_enabled
) VALUES
  ('material_type', 'Material Type', 'Filter by type of material', 'database_column', 'material_type',
   'checkbox_list', 1, 'distinct_values', 'count_desc', 'material_type',
   '{"book":"Books","ebook":"E-Books","serial":"Serials/Journals","audiobook":"Audiobooks","dvd":"DVDs","cdrom":"CD-ROMs","electronic":"Electronic Resources","manuscript":"Manuscripts","map":"Maps","music":"Music","visual-material":"Visual Materials"}',
   'material_types', 'material_type', 15, true),

  ('language', 'Language', 'Filter by language', 'database_column', 'language_code',
   'checkbox_list', 2, 'distinct_values', 'count_desc', 'language_code',
   '{"eng":"English","spa":"Spanish","fre":"French","ger":"German","ita":"Italian","rus":"Russian","chi":"Chinese","jpn":"Japanese","ara":"Arabic","por":"Portuguese"}',
   'languages', 'language_code', 10, true),

  ('publication_decade', 'Publication Decade', 'Filter by decade', 'marc_field', 'publication_info',
   'checkbox_list', 3, 'decade_buckets', 10, 'label_desc', NULL,
   'publication_decades', 'publication_info->c', 10, true),

  ('availability', 'Availability', 'Filter by availability', 'items_field', 'status',
   'checkbox_list', 4, 'distinct_values', 'custom', NULL,
   '{"available":"Available","checked_out":"Checked Out","unavailable":"Unavailable"}',
   'availability', 'items.status', 5, true),

  ('location', 'Location', 'Filter by location', 'items_field', 'location',
   'checkbox_list', 5, 'distinct_values', 'label_asc', NULL, NULL,
   'locations', 'items.location', 10, true)
ON CONFLICT (facet_key) DO UPDATE SET
  facet_label = EXCLUDED.facet_label,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

\echo 'Migration 1: Facet configuration completed'
\echo ''

-- ============================================================================
-- MIGRATION 2: DIACRITIC-INSENSITIVE SEARCH
-- ============================================================================

\echo 'Migration 2: Enabling diacritic-insensitive search...'

-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

\echo 'Migration 2: Creating diacritic removal functions...'

-- Create diacritic removal function
CREATE OR REPLACE FUNCTION remove_diacritics(text)
RETURNS text AS $$
BEGIN
  -- Try to use unaccent if available
  BEGIN
    RETURN unaccent($1);
  EXCEPTION WHEN undefined_function THEN
    -- If unaccent is not available, return original text
    RETURN $1;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create search query normalization function
CREATE OR REPLACE FUNCTION normalize_search_query(query TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN remove_diacritics(query);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

\echo 'Migration 2: Updating search vector function...'

-- Update search vector function to use diacritic removal
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  subject_text TEXT := '';
BEGIN
  -- Extract all subject headings
  IF NEW.subject_topical IS NOT NULL THEN
    SELECT string_agg(elem->>'a', ' ')
    INTO subject_text
    FROM unnest(NEW.subject_topical) AS elem
    WHERE elem->>'a' IS NOT NULL;
  END IF;

  -- Apply diacritic removal to all text fields before indexing
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

\echo 'Migration 2: Rebuilding search vectors for all records...'
\echo 'This may take a moment...'

-- Rebuild all search vectors with diacritic-insensitive indexing
UPDATE marc_records SET updated_at = NOW();

\echo 'Migration 2: Adding function comments...'

-- Add helpful comments
COMMENT ON FUNCTION update_marc_search_vector() IS
  'Updates search_vector with weighted, diacritic-insensitive indexing. Searching for "Zizek" will match "Žižek".';

COMMENT ON FUNCTION remove_diacritics(text) IS
  'Removes diacritics from text using unaccent extension. Used for diacritic-insensitive search.';

COMMENT ON FUNCTION normalize_search_query(text) IS
  'Normalizes search queries by removing diacritics. Use this on user input before searching.';

\echo ''
\echo '============================================================================'
\echo 'MIGRATION COMPLETE!'
\echo '============================================================================'
\echo ''
\echo 'Summary of changes:'
\echo '  ✓ Created facet_configuration table with 5 default facets'
\echo '  ✓ Created facet_values_cache table for performance'
\echo '  ✓ Enabled unaccent extension for diacritic removal'
\echo '  ✓ Created remove_diacritics() and normalize_search_query() functions'
\echo '  ✓ Updated search_vector function to remove diacritics before indexing'
\echo '  ✓ Rebuilt search vectors for all existing records'
\echo ''
\echo 'Next steps:'
\echo '  1. Test facets: Visit /catalog/search/results?q=test and check sidebar'
\echo '  2. Test Unicode search: Search for "Zizek" and verify it finds "Žižek"'
\echo '  3. Check footer: Visit any public page and scroll to bottom'
\echo ''
\echo 'See MIGRATION_INSTRUCTIONS.md for detailed verification steps.'
\echo '============================================================================'

-- Show facet configuration status
SELECT
  facet_key,
  facet_label,
  is_enabled,
  display_order,
  source_type
FROM facet_configuration
WHERE is_enabled = true
ORDER BY display_order;
