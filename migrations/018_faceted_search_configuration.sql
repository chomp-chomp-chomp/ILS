-- Migration: Faceted Search Configuration System
-- Description: Enables admin-configurable faceted search without code changes
-- Created: 2025-12-30

-- =============================================================================
-- FACET CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE facet_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Facet identification
  facet_key VARCHAR(50) NOT NULL UNIQUE,
  facet_label VARCHAR(100) NOT NULL,
  facet_description TEXT,

  -- Data source configuration
  source_type VARCHAR(50) NOT NULL, -- 'marc_field', 'database_column', 'items_field', 'computed'
  source_field VARCHAR(100) NOT NULL, -- MARC field (e.g., '650', 'material_type') or db column
  source_subfield VARCHAR(10), -- MARC subfield (e.g., 'a' for 650$a)

  -- Display configuration
  display_type VARCHAR(50) DEFAULT 'checkbox_list', -- 'checkbox_list', 'date_range', 'numeric_range', 'tag_cloud'
  display_order INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  is_collapsed_by_default BOOLEAN DEFAULT false,
  show_count BOOLEAN DEFAULT true,
  max_items INTEGER DEFAULT 10,
  show_more_threshold INTEGER DEFAULT 5,

  -- Aggregation settings
  aggregation_method VARCHAR(50) DEFAULT 'distinct_values', -- 'distinct_values', 'decade_buckets', 'year_buckets', 'custom_ranges'
  bucket_size INTEGER, -- For numeric/date bucketing (e.g., 10 for decades)
  custom_ranges JSONB, -- For custom range definitions

  -- Sorting
  sort_by VARCHAR(50) DEFAULT 'count_desc', -- 'count_desc', 'count_asc', 'label_asc', 'label_desc', 'custom'
  custom_sort_order TEXT[], -- For manual ordering of facet values

  -- Value formatting
  value_formatter VARCHAR(50), -- 'material_type', 'language_code', 'year', 'custom'
  value_format_mapping JSONB, -- Custom value to label mapping

  -- Filtering
  filter_param_name VARCHAR(50), -- URL parameter name (e.g., 'material_types', 'languages')
  multi_select BOOLEAN DEFAULT true,
  apply_to_search_field VARCHAR(100), -- Which search field this facet filters

  -- Performance
  cache_enabled BOOLEAN DEFAULT true,
  cache_ttl INTEGER DEFAULT 3600, -- Cache time-to-live in seconds

  -- Conditional display
  show_only_for_search_types VARCHAR(50)[], -- e.g., ['keyword', 'advanced']
  min_results_to_show INTEGER DEFAULT 1,

  -- Access control
  public_visible BOOLEAN DEFAULT true,
  staff_only BOOLEAN DEFAULT false,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for quick lookups
CREATE INDEX idx_facet_config_key ON facet_configuration(facet_key);
CREATE INDEX idx_facet_config_enabled ON facet_configuration(is_enabled, is_active);
CREATE INDEX idx_facet_config_order ON facet_configuration(display_order) WHERE is_enabled = true AND is_active = true;

-- =============================================================================
-- FACET VALUES CACHE TABLE
-- =============================================================================

CREATE TABLE facet_values_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facet_key VARCHAR(50) NOT NULL REFERENCES facet_configuration(facet_key) ON DELETE CASCADE,

  -- Facet value
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,

  -- Context (for filtered caches)
  filter_context JSONB, -- Stores active filters when this cache was computed

  -- Cache metadata
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Composite unique constraint
  UNIQUE(facet_key, value, filter_context)
);

-- Indexes for cache lookups
CREATE INDEX idx_facet_cache_key ON facet_values_cache(facet_key);
CREATE INDEX idx_facet_cache_expires ON facet_values_cache(expires_at);
CREATE INDEX idx_facet_cache_context ON facet_values_cache USING gin(filter_context);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_facet_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facet_config_updated
  BEFORE UPDATE ON facet_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_facet_config_timestamp();

-- Invalidate cache when configuration changes
CREATE OR REPLACE FUNCTION invalidate_facet_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete cached values for this facet
  DELETE FROM facet_values_cache WHERE facet_key = NEW.facet_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facet_config_invalidate_cache
  AFTER UPDATE ON facet_configuration
  FOR EACH ROW
  WHEN (OLD.source_field IS DISTINCT FROM NEW.source_field
    OR OLD.aggregation_method IS DISTINCT FROM NEW.aggregation_method
    OR OLD.bucket_size IS DISTINCT FROM NEW.bucket_size)
  EXECUTE FUNCTION invalidate_facet_cache();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE facet_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE facet_values_cache ENABLE ROW LEVEL SECURITY;

-- Public read access to enabled facets
CREATE POLICY "Public read access to enabled facets"
  ON facet_configuration FOR SELECT
  TO anon, authenticated
  USING (is_enabled = true AND is_active = true AND (staff_only = false OR auth.role() = 'authenticated'));

-- Admin write access
CREATE POLICY "Authenticated users can manage facets"
  ON facet_configuration FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public read access to cache
CREATE POLICY "Public read access to facet cache"
  ON facet_values_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write access to cache
CREATE POLICY "Authenticated users can manage cache"
  ON facet_values_cache FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- DEFAULT FACET CONFIGURATIONS
-- =============================================================================

-- 1. Material Type Facet
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  value_formatter,
  value_format_mapping,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled
) VALUES (
  'material_type',
  'Material Type',
  'Filter by type of material (books, DVDs, etc.)',
  'database_column',
  'material_type',
  'checkbox_list',
  1,
  'distinct_values',
  'count_desc',
  'material_type',
  '{"book":"Books","ebook":"E-Books","serial":"Serials/Journals","audiobook":"Audiobooks","dvd":"DVDs","cdrom":"CD-ROMs","electronic":"Electronic Resources","manuscript":"Manuscripts","map":"Maps","music":"Music","visual-material":"Visual Materials"}',
  'material_types',
  'material_type',
  15,
  true
);

-- 2. Language Facet
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  value_formatter,
  value_format_mapping,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled
) VALUES (
  'language',
  'Language',
  'Filter by language of the material',
  'database_column',
  'language_code',
  'checkbox_list',
  2,
  'distinct_values',
  'count_desc',
  'language_code',
  '{"eng":"English","spa":"Spanish","fre":"French","ger":"German","ita":"Italian","rus":"Russian","chi":"Chinese","jpn":"Japanese","ara":"Arabic","por":"Portuguese"}',
  'languages',
  'language_code',
  10,
  true
);

-- 3. Publication Decade Facet
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  source_subfield,
  display_type,
  display_order,
  aggregation_method,
  bucket_size,
  sort_by,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled
) VALUES (
  'publication_decade',
  'Publication Decade',
  'Filter by decade of publication',
  'marc_field',
  'publication_info',
  'c',
  'checkbox_list',
  3,
  'decade_buckets',
  10,
  'label_desc',
  'publication_decades',
  'publication_info->c',
  10,
  true
);

-- 4. Availability Facet
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  value_format_mapping,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled
) VALUES (
  'availability',
  'Availability',
  'Filter by availability status',
  'items_field',
  'status',
  'checkbox_list',
  4,
  'distinct_values',
  'custom',
  '{"available":"Available Now","checked_out":"Checked Out","unavailable":"Unavailable"}',
  'availability',
  'items.status',
  5,
  true
);

-- 5. Location Facet
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled
) VALUES (
  'location',
  'Location',
  'Filter by physical location',
  'items_field',
  'location',
  'checkbox_list',
  5,
  'distinct_values',
  'label_asc',
  'locations',
  'items.location',
  10,
  true
);

-- 6. Subject Facet (Top-level)
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  source_subfield,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled,
  is_collapsed_by_default
) VALUES (
  'subject',
  'Subject',
  'Filter by subject heading',
  'marc_field',
  'subject_topical',
  'a',
  'checkbox_list',
  6,
  'distinct_values',
  'count_desc',
  'subjects',
  'subject_topical',
  15,
  true,
  true
);

-- 7. Author Facet (Top authors)
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  source_subfield,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled,
  is_collapsed_by_default
) VALUES (
  'author',
  'Author',
  'Filter by author',
  'marc_field',
  'main_entry_personal_name',
  'a',
  'checkbox_list',
  7,
  'distinct_values',
  'count_desc',
  'authors',
  'main_entry_personal_name->a',
  10,
  false,
  true
);

-- 8. Publication Year Range Facet
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  source_subfield,
  display_type,
  display_order,
  aggregation_method,
  sort_by,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled,
  is_collapsed_by_default
) VALUES (
  'publication_year_range',
  'Publication Year',
  'Filter by publication year range',
  'marc_field',
  'publication_info',
  'c',
  'date_range',
  8,
  'year_buckets',
  'label_desc',
  'year_range',
  'publication_info->c',
  20,
  false,
  true
);

-- 9. Call Number Range Facet (for browsing)
INSERT INTO facet_configuration (
  facet_key,
  facet_label,
  facet_description,
  source_type,
  source_field,
  display_type,
  display_order,
  aggregation_method,
  custom_ranges,
  sort_by,
  filter_param_name,
  apply_to_search_field,
  max_items,
  is_enabled,
  is_collapsed_by_default
) VALUES (
  'call_number_range',
  'Call Number Range',
  'Browse by call number classification',
  'items_field',
  'call_number',
  'checkbox_list',
  9,
  'custom_ranges',
  '[
    {"label":"000-099 Computer Science, Information & General Works","min":"000","max":"099"},
    {"label":"100-199 Philosophy & Psychology","min":"100","max":"199"},
    {"label":"200-299 Religion","min":"200","max":"299"},
    {"label":"300-399 Social Sciences","min":"300","max":"399"},
    {"label":"400-499 Language","min":"400","max":"499"},
    {"label":"500-599 Science","min":"500","max":"599"},
    {"label":"600-699 Technology","min":"600","max":"699"},
    {"label":"700-799 Arts & Recreation","min":"700","max":"799"},
    {"label":"800-899 Literature","min":"800","max":"899"},
    {"label":"900-999 History & Geography","min":"900","max":"999"}
  ]',
  'label_asc',
  'call_number_ranges',
  'items.call_number',
  10,
  false,
  true
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to refresh facet cache for a specific facet
CREATE OR REPLACE FUNCTION refresh_facet_cache(facet_key_param VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old cache entries for this facet
  DELETE FROM facet_values_cache WHERE facet_key = facet_key_param;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Note: Cache will be rebuilt on next query
  -- or you can implement specific rebuild logic here

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all facet caches
CREATE OR REPLACE FUNCTION refresh_all_facet_caches()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM facet_values_cache;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_facet_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM facet_values_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE facet_configuration IS 'Configuration for dynamic faceted search - allows admins to create and configure facets without code changes';
COMMENT ON TABLE facet_values_cache IS 'Materialized cache of facet values and counts for performance optimization';

COMMENT ON COLUMN facet_configuration.source_type IS 'Type of data source: marc_field (JSONB MARC field), database_column (direct column), items_field (from items table), computed (custom logic)';
COMMENT ON COLUMN facet_configuration.display_type IS 'UI display type: checkbox_list, date_range, numeric_range, tag_cloud';
COMMENT ON COLUMN facet_configuration.aggregation_method IS 'How to aggregate values: distinct_values, decade_buckets, year_buckets, custom_ranges';
COMMENT ON COLUMN facet_configuration.sort_by IS 'How to sort facet values: count_desc, count_asc, label_asc, label_desc, custom';
COMMENT ON COLUMN facet_configuration.value_formatter IS 'How to format facet values for display: material_type, language_code, year, custom';
