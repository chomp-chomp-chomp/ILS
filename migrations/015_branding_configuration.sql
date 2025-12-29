-- Branding Configuration Migration
-- Run this in Supabase SQL Editor
-- This creates functionality for customizing library branding and appearance

-- 1. Branding configuration table
CREATE TABLE branding_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Library identity
  library_name VARCHAR(255) DEFAULT 'Library Catalog',
  library_tagline VARCHAR(255),

  -- Logo
  logo_url TEXT,
  favicon_url TEXT,

  -- Colors (hex format)
  primary_color VARCHAR(7) DEFAULT '#e73b42',
  secondary_color VARCHAR(7) DEFAULT '#667eea',
  accent_color VARCHAR(7) DEFAULT '#2c3e50',
  background_color VARCHAR(7) DEFAULT '#ffffff',
  text_color VARCHAR(7) DEFAULT '#333333',

  -- Typography
  font_family VARCHAR(100) DEFAULT 'system-ui, -apple-system, sans-serif',
  heading_font VARCHAR(100),

  -- Custom CSS
  custom_css TEXT,
  custom_head_html TEXT, -- For analytics, fonts, etc.

  -- Footer
  footer_text TEXT DEFAULT 'Powered by Open Library System',
  show_powered_by BOOLEAN DEFAULT true,

  -- Contact info
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_address TEXT,

  -- Social media
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,

  -- Features toggles
  show_covers BOOLEAN DEFAULT true,
  show_facets BOOLEAN DEFAULT true,
  items_per_page INTEGER DEFAULT 20,

  -- Active configuration
  is_active BOOLEAN DEFAULT true,

  -- Tracking
  updated_by UUID REFERENCES auth.users(id)
);

-- Only one active configuration at a time
CREATE UNIQUE INDEX idx_branding_active ON branding_configuration(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE branding_configuration ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view active branding configuration
CREATE POLICY "Public can view active branding"
  ON branding_configuration FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all configurations
CREATE POLICY "Authenticated users can view all branding"
  ON branding_configuration FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create configurations
CREATE POLICY "Authenticated users can create branding"
  ON branding_configuration FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update configurations
CREATE POLICY "Authenticated users can update branding"
  ON branding_configuration FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete configurations
CREATE POLICY "Authenticated users can delete branding"
  ON branding_configuration FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at
CREATE TRIGGER branding_updated_at
  BEFORE UPDATE ON branding_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_branding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other configurations
    UPDATE branding_configuration
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branding_single_active
  BEFORE INSERT OR UPDATE ON branding_configuration
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_branding();

-- Insert default branding configuration
INSERT INTO branding_configuration (
  library_name,
  library_tagline,
  primary_color,
  secondary_color,
  accent_color,
  is_active
) VALUES (
  'Library Catalog',
  'Explore our collection',
  '#e73b42',
  '#667eea',
  '#2c3e50',
  true
);

COMMENT ON TABLE branding_configuration IS 'Customizable branding and appearance settings for the library catalog';
COMMENT ON COLUMN branding_configuration.library_name IS 'Name of the library displayed throughout the site';
COMMENT ON COLUMN branding_configuration.primary_color IS 'Main brand color (hex format)';
COMMENT ON COLUMN branding_configuration.custom_css IS 'Custom CSS to override default styles';
COMMENT ON COLUMN branding_configuration.is_active IS 'Whether this is the active branding configuration';
