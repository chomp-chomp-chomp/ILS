-- Search Form Configuration Migration
-- Run this in Supabase SQL Editor
-- This creates functionality for customizing search forms and display options

-- 1. Search field configuration table
CREATE TABLE search_field_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Field identification
  field_key VARCHAR(50) NOT NULL UNIQUE, -- keyword, title, author, subject, isbn, etc.
  field_label VARCHAR(100) NOT NULL,     -- Display label
  field_type VARCHAR(50) NOT NULL,        -- text, select, date, number

  -- Appearance
  placeholder_text VARCHAR(255),
  help_text TEXT,

  -- Behavior
  is_enabled BOOLEAN DEFAULT true,
  is_default_visible BOOLEAN DEFAULT true, -- Show in basic search
  display_order INTEGER DEFAULT 0,

  -- Advanced search options
  show_in_advanced BOOLEAN DEFAULT true,
  operator_options JSONB,                 -- ['contains', 'exact', 'starts_with', etc.]

  -- Autocomplete / suggestions
  enable_autocomplete BOOLEAN DEFAULT false,
  autocomplete_source VARCHAR(100),       -- table.column or 'function_name'

  -- Validation
  is_required BOOLEAN DEFAULT false,
  min_length INTEGER,
  max_length INTEGER,
  validation_regex VARCHAR(255),

  -- Tracking
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_search_field_order ON search_field_configuration(display_order);
CREATE INDEX idx_search_field_enabled ON search_field_configuration(is_enabled);

-- 2. Search configuration (global settings)
CREATE TABLE search_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search behavior
  default_search_type VARCHAR(50) DEFAULT 'keyword', -- keyword, title, author, advanced
  enable_spell_correction BOOLEAN DEFAULT true,
  spell_correction_threshold REAL DEFAULT 0.4,
  min_results_for_suggestion INTEGER DEFAULT 5,

  -- Results display
  results_per_page INTEGER DEFAULT 20,
  results_layout VARCHAR(50) DEFAULT 'list', -- list, grid, compact
  show_covers BOOLEAN DEFAULT true,
  show_availability BOOLEAN DEFAULT true,
  show_call_number BOOLEAN DEFAULT true,

  -- Facets
  enable_facets BOOLEAN DEFAULT true,
  facet_material_types BOOLEAN DEFAULT true,
  facet_languages BOOLEAN DEFAULT true,
  facet_publication_years BOOLEAN DEFAULT true,
  facet_locations BOOLEAN DEFAULT true,
  facet_availability BOOLEAN DEFAULT true,
  max_facet_values INTEGER DEFAULT 10,

  -- Advanced search
  enable_advanced_search BOOLEAN DEFAULT true,
  enable_boolean_operators BOOLEAN DEFAULT true,

  -- Sorting
  default_sort VARCHAR(50) DEFAULT 'relevance', -- relevance, title, author, date
  available_sort_options JSONB DEFAULT '["relevance", "title", "author", "date_newest", "date_oldest"]'::JSONB,

  -- Active configuration
  is_active BOOLEAN DEFAULT true,

  -- Tracking
  updated_by UUID REFERENCES auth.users(id)
);

-- Only one active configuration at a time
CREATE UNIQUE INDEX idx_search_config_active ON search_configuration(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE search_field_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_configuration ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view enabled search fields
CREATE POLICY "Public can view enabled search fields"
  ON search_field_configuration FOR SELECT
  TO public
  USING (is_enabled = true);

-- Authenticated users can view all search fields
CREATE POLICY "Authenticated users can view all search fields"
  ON search_field_configuration FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage search fields
CREATE POLICY "Authenticated users can manage search fields"
  ON search_field_configuration FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public can view active search configuration
CREATE POLICY "Public can view active search configuration"
  ON search_configuration FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all search configurations
CREATE POLICY "Authenticated users can view all search configurations"
  ON search_configuration FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage search configurations
CREATE POLICY "Authenticated users can manage search configurations"
  ON search_configuration FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Triggers
CREATE TRIGGER search_field_updated_at
  BEFORE UPDATE ON search_field_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER search_config_updated_at
  BEFORE UPDATE ON search_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_search_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other configurations
    UPDATE search_configuration
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_config_single_active
  BEFORE INSERT OR UPDATE ON search_configuration
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_search_config();

-- Insert default search fields
INSERT INTO search_field_configuration (field_key, field_label, field_type, placeholder_text, help_text, display_order, is_default_visible, show_in_advanced, operator_options) VALUES
  ('keyword', 'Search', 'text', 'Search by title, author, subject, ISBN...', 'Search across all fields', 1, true, true, '["contains", "exact"]'::JSONB),
  ('title', 'Title', 'text', 'Enter book title', 'Search by book or item title', 2, false, true, '["contains", "exact", "starts_with"]'::JSONB),
  ('author', 'Author', 'text', 'Enter author name', 'Search by author or creator', 3, false, true, '["contains", "exact", "starts_with"]'::JSONB),
  ('subject', 'Subject', 'text', 'Enter subject or topic', 'Search by subject headings', 4, false, true, '["contains", "exact"]'::JSONB),
  ('isbn', 'ISBN', 'text', 'Enter ISBN (with or without hyphens)', 'Search by International Standard Book Number', 5, false, true, '["exact"]'::JSONB),
  ('issn', 'ISSN', 'text', 'Enter ISSN', 'Search by International Standard Serial Number', 6, false, true, '["exact"]'::JSONB),
  ('publisher', 'Publisher', 'text', 'Enter publisher name', 'Search by publisher', 7, false, true, '["contains", "exact"]'::JSONB),
  ('series', 'Series', 'text', 'Enter series name', 'Search by series title', 8, false, true, '["contains", "exact"]'::JSONB),
  ('call_number', 'Call Number', 'text', 'Enter call number', 'Search by shelving location', 9, false, true, '["contains", "exact", "starts_with"]'::JSONB),
  ('publication_year', 'Publication Year', 'number', 'Enter year (YYYY)', 'Search by publication date', 10, false, true, '["exact", "range"]'::JSONB);

-- Insert default search configuration
INSERT INTO search_configuration (
  default_search_type,
  enable_spell_correction,
  results_per_page,
  results_layout,
  enable_facets,
  enable_advanced_search,
  is_active
) VALUES (
  'keyword',
  true,
  20,
  'list',
  true,
  true,
  true
);

COMMENT ON TABLE search_field_configuration IS 'Configuration for individual search form fields';
COMMENT ON TABLE search_configuration IS 'Global search behavior and display settings';
COMMENT ON COLUMN search_field_configuration.field_key IS 'Unique identifier for the search field';
COMMENT ON COLUMN search_field_configuration.display_order IS 'Order in which fields appear (lower = earlier)';
COMMENT ON COLUMN search_configuration.spell_correction_threshold IS 'Minimum similarity (0-1) for spell suggestions';
