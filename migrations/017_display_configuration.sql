-- Display Configuration Migration
-- Run this in Supabase SQL Editor
-- This creates functionality for customizing which MARC fields are displayed and how

-- 1. Display field configuration table
CREATE TABLE display_field_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Field identification
  field_key VARCHAR(50) NOT NULL UNIQUE, -- title, author, isbn, subject, etc.
  field_label VARCHAR(100) NOT NULL,     -- Display label
  marc_field VARCHAR(10),                 -- MARC field reference (e.g., "245" for title)

  -- Display contexts
  show_in_results BOOLEAN DEFAULT true,   -- Show in search results list
  show_in_detail BOOLEAN DEFAULT true,    -- Show in record detail page
  show_in_brief BOOLEAN DEFAULT true,     -- Show in brief/compact view
  show_in_opac BOOLEAN DEFAULT true,      -- Show in public catalog
  show_in_staff BOOLEAN DEFAULT true,     -- Show in staff catalog

  -- Appearance
  display_order INTEGER DEFAULT 0,
  display_style VARCHAR(50) DEFAULT 'text', -- text, link, badge, heading, list
  css_class VARCHAR(100),                   -- Custom CSS class

  -- Formatting
  prefix_text VARCHAR(50),                -- Text before value (e.g., "ISBN: ")
  suffix_text VARCHAR(50),                -- Text after value
  separator VARCHAR(10) DEFAULT ', ',      -- For multi-value fields
  max_values INTEGER,                      -- Limit for multi-value fields (null = no limit)

  -- Link behavior (for clickable fields)
  make_clickable BOOLEAN DEFAULT false,
  link_type VARCHAR(50),                  -- search_author, search_subject, search_series, external_url
  link_pattern VARCHAR(255),              -- URL pattern with {value} placeholder

  -- Conditional display
  hide_if_empty BOOLEAN DEFAULT true,
  show_only_if_material_type VARCHAR(255)[], -- Array of material types

  -- Tracking
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_display_field_order ON display_field_configuration(display_order);
CREATE INDEX idx_display_field_results ON display_field_configuration(show_in_results);
CREATE INDEX idx_display_field_detail ON display_field_configuration(show_in_detail);

-- 2. Display configuration (global settings)
CREATE TABLE display_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Results list appearance
  results_show_covers BOOLEAN DEFAULT true,
  results_cover_size VARCHAR(50) DEFAULT 'medium', -- small, medium, large
  results_show_availability BOOLEAN DEFAULT true,
  results_show_location BOOLEAN DEFAULT true,
  results_show_call_number BOOLEAN DEFAULT true,
  results_show_material_badge BOOLEAN DEFAULT true,
  results_compact_mode BOOLEAN DEFAULT false,

  -- Record detail appearance
  detail_show_cover BOOLEAN DEFAULT true,
  detail_cover_size VARCHAR(50) DEFAULT 'large',
  detail_show_marc BOOLEAN DEFAULT false,        -- Show raw MARC for staff
  detail_show_holdings BOOLEAN DEFAULT true,
  detail_show_related BOOLEAN DEFAULT true,
  detail_show_subjects_as_tags BOOLEAN DEFAULT true,
  detail_group_by_category BOOLEAN DEFAULT true, -- Group fields into sections

  -- Holdings display
  holdings_show_barcode BOOLEAN DEFAULT true,
  holdings_show_call_number BOOLEAN DEFAULT true,
  holdings_show_location BOOLEAN DEFAULT true,
  holdings_show_status BOOLEAN DEFAULT true,
  holdings_show_notes BOOLEAN DEFAULT true,
  holdings_show_electronic_access BOOLEAN DEFAULT true,

  -- Cover images
  cover_source VARCHAR(50) DEFAULT 'openlibrary', -- openlibrary, google, local
  cover_fallback_icon BOOLEAN DEFAULT true,       -- Show icon if no cover available

  -- Active configuration
  is_active BOOLEAN DEFAULT true,

  -- Tracking
  updated_by UUID REFERENCES auth.users(id)
);

-- Only one active configuration at a time
CREATE UNIQUE INDEX idx_display_config_active ON display_configuration(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE display_field_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE display_configuration ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view enabled display fields
CREATE POLICY "Public can view enabled display fields"
  ON display_field_configuration FOR SELECT
  TO public
  USING (show_in_opac = true);

-- Authenticated users can view all display fields
CREATE POLICY "Authenticated users can view all display fields"
  ON display_field_configuration FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage display fields
CREATE POLICY "Authenticated users can manage display fields"
  ON display_field_configuration FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public can view active display configuration
CREATE POLICY "Public can view active display configuration"
  ON display_configuration FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all display configurations
CREATE POLICY "Authenticated users can view all display configurations"
  ON display_configuration FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage display configurations
CREATE POLICY "Authenticated users can manage display configurations"
  ON display_configuration FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Triggers
CREATE TRIGGER display_field_updated_at
  BEFORE UPDATE ON display_field_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER display_config_updated_at
  BEFORE UPDATE ON display_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_display_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other configurations
    UPDATE display_configuration
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER display_config_single_active
  BEFORE INSERT OR UPDATE ON display_configuration
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_display_config();

-- Insert default display fields
INSERT INTO display_field_configuration (field_key, field_label, marc_field, display_order, display_style, make_clickable, link_type, show_in_results, show_in_detail, show_in_brief) VALUES
  ('title', 'Title', '245', 1, 'heading', false, null, true, true, true),
  ('author', 'Author', '100', 2, 'link', true, 'search_author', true, true, true),
  ('publication', 'Published', '260/264', 3, 'text', false, null, true, true, false),
  ('isbn', 'ISBN', '020', 4, 'text', false, null, false, true, false),
  ('issn', 'ISSN', '022', 5, 'text', false, null, false, true, false),
  ('material_type', 'Format', 'type', 6, 'badge', false, null, true, true, true),
  ('subjects', 'Subjects', '650', 7, 'list', true, 'search_subject', false, true, false),
  ('series', 'Series', '490/830', 8, 'link', true, 'search_series', false, true, false),
  ('summary', 'Description', '520', 9, 'text', false, null, false, true, false),
  ('contents', 'Contents', '505', 10, 'text', false, null, false, true, false),
  ('notes', 'Notes', '5XX', 11, 'text', false, null, false, true, false),
  ('physical', 'Physical Description', '300', 12, 'text', false, null, false, true, false),
  ('language', 'Language', '041', 13, 'text', false, null, false, true, false),
  ('publisher', 'Publisher', '260/264', 14, 'text', false, null, false, true, false),
  ('edition', 'Edition', '250', 15, 'text', false, null, false, true, false);

-- Insert default display configuration
INSERT INTO display_configuration (
  results_show_covers,
  results_show_availability,
  detail_show_cover,
  detail_show_subjects_as_tags,
  is_active
) VALUES (
  true,
  true,
  true,
  true,
  true
);

COMMENT ON TABLE display_field_configuration IS 'Configuration for individual MARC field display';
COMMENT ON TABLE display_configuration IS 'Global display and appearance settings';
COMMENT ON COLUMN display_field_configuration.field_key IS 'Unique identifier for the display field';
COMMENT ON COLUMN display_field_configuration.display_style IS 'How to render the field: text, link, badge, heading, list';
COMMENT ON COLUMN display_field_configuration.make_clickable IS 'Whether the field value should be clickable';
COMMENT ON COLUMN display_field_configuration.link_type IS 'What the link should do: search_author, search_subject, search_series, external_url';
