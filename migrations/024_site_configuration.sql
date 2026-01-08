-- Site Configuration Migration
-- Run this in Supabase SQL Editor
-- This creates the single source of truth for public-site header/footer/homepage info
-- and styling with light/dark themes plus per-page-type overrides

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Site configuration table
CREATE TABLE IF NOT EXISTS site_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,

  -- Header configuration
  header_enabled BOOLEAN DEFAULT false,
  header_logo_url TEXT,
  header_links JSONB DEFAULT '[]'::jsonb, -- array of { title, url, order }

  -- Footer configuration
  footer_enabled BOOLEAN DEFAULT false,
  footer_text TEXT DEFAULT '',
  footer_links JSONB DEFAULT '[]'::jsonb, -- array of { title, url, order }

  -- Homepage info configuration
  homepage_info_enabled BOOLEAN DEFAULT false,
  homepage_info_title TEXT DEFAULT '',
  homepage_info_content TEXT DEFAULT '', -- plain text
  homepage_info_links JSONB DEFAULT '[]'::jsonb, -- array of { title, url, order }

  -- Theme configuration
  theme_mode TEXT DEFAULT 'system', -- 'system', 'light', 'dark'
  theme_light JSONB DEFAULT '{
    "primary": "#e73b42",
    "secondary": "#667eea",
    "accent": "#2c3e50",
    "background": "#ffffff",
    "text": "#333333",
    "font": "system-ui, -apple-system, sans-serif"
  }'::jsonb,
  theme_dark JSONB DEFAULT '{
    "primary": "#ff6b72",
    "secondary": "#8b9eff",
    "accent": "#3d5a7f",
    "background": "#1a1a1a",
    "text": "#e5e5e5",
    "font": "system-ui, -apple-system, sans-serif"
  }'::jsonb,
  page_themes JSONB DEFAULT '{}'::jsonb -- per-page-type overrides: { "home": {...}, "search_results": {...}, etc. }
);

-- Only one active configuration at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_config_active 
  ON site_configuration(is_active) 
  WHERE is_active = true;

-- Row Level Security
ALTER TABLE site_configuration ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view only active site configuration
DROP POLICY IF EXISTS "Public can view active site config" ON site_configuration;
CREATE POLICY "Public can view active site config"
  ON site_configuration FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated users can view all configurations
DROP POLICY IF EXISTS "Authenticated users can view all site config" ON site_configuration;
CREATE POLICY "Authenticated users can view all site config"
  ON site_configuration FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create configurations
DROP POLICY IF EXISTS "Authenticated users can create site config" ON site_configuration;
CREATE POLICY "Authenticated users can create site config"
  ON site_configuration FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update configurations
DROP POLICY IF EXISTS "Authenticated users can update site config" ON site_configuration;
CREATE POLICY "Authenticated users can update site config"
  ON site_configuration FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete configurations
DROP POLICY IF EXISTS "Authenticated users can delete site config" ON site_configuration;
CREATE POLICY "Authenticated users can delete site config"
  ON site_configuration FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS site_config_updated_at ON site_configuration;
CREATE TRIGGER site_config_updated_at
  BEFORE UPDATE ON site_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_site_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other configurations
    UPDATE site_configuration
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_config_single_active ON site_configuration;
CREATE TRIGGER site_config_single_active
  BEFORE INSERT OR UPDATE ON site_configuration
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_site_config();

-- Insert default site configuration
INSERT INTO site_configuration (
  header_enabled,
  header_logo_url,
  header_links,
  footer_enabled,
  footer_text,
  footer_links,
  homepage_info_enabled,
  homepage_info_title,
  homepage_info_content,
  homepage_info_links,
  theme_mode,
  theme_light,
  theme_dark,
  page_themes,
  is_active
) VALUES (
  false,
  null,
  '[]'::jsonb,
  false,
  'Powered by Open Library System',
  '[]'::jsonb,
  false,
  'Quick Links',
  'Welcome to our library catalog. Use the search box above to find items by title, author, subject, or ISBN.',
  '[]'::jsonb,
  'system',
  '{
    "primary": "#e73b42",
    "secondary": "#667eea",
    "accent": "#2c3e50",
    "background": "#ffffff",
    "text": "#333333",
    "font": "system-ui, -apple-system, sans-serif"
  }'::jsonb,
  '{
    "primary": "#ff6b72",
    "secondary": "#8b9eff",
    "accent": "#3d5a7f",
    "background": "#1a1a1a",
    "text": "#e5e5e5",
    "font": "system-ui, -apple-system, sans-serif"
  }'::jsonb,
  '{}'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE site_configuration IS 'Single source of truth for public site header, footer, homepage info, and theming';
COMMENT ON COLUMN site_configuration.header_enabled IS 'Whether to show custom header on public pages';
COMMENT ON COLUMN site_configuration.header_links IS 'Array of header navigation links with title, url, and order';
COMMENT ON COLUMN site_configuration.footer_enabled IS 'Whether to show custom footer on public pages';
COMMENT ON COLUMN site_configuration.footer_links IS 'Array of footer links with title, url, and order';
COMMENT ON COLUMN site_configuration.homepage_info_enabled IS 'Whether to show homepage info section';
COMMENT ON COLUMN site_configuration.homepage_info_content IS 'Plain text content for homepage info section';
COMMENT ON COLUMN site_configuration.theme_mode IS 'Theme mode: system, light, or dark';
COMMENT ON COLUMN site_configuration.theme_light IS 'Light theme color tokens and fonts';
COMMENT ON COLUMN site_configuration.theme_dark IS 'Dark theme color tokens and fonts';
COMMENT ON COLUMN site_configuration.page_themes IS 'Per-page-type theme overrides (home, search_results, search_advanced, catalog_browse, record_details, public_default)';
COMMENT ON COLUMN site_configuration.is_active IS 'Whether this is the active site configuration (only one can be active)';
