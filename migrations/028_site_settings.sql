-- Site Settings Table Migration
-- This creates a simplified site_settings table to replace site_configuration
-- for managing header/footer/hero/metadata assets

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,

  -- Header navigation links (stored as JSONB array)
  header_links JSONB DEFAULT '[
    {"title": "Home", "url": "https://library.chompchomp.cc/"},
    {"title": "Advanced Search", "url": "https://library.chompchomp.cc/catalog/search/advanced"},
    {"title": "Chomp Chomp Tools", "url": "https://chompchomp.cc/tools/"},
    {"title": "Chomp Chomp Recipes", "url": "https://chompchomp.cc/"}
  ]'::jsonb,

  -- Footer configuration
  footer_text TEXT DEFAULT 'Powered by Chomp Chomp',
  footer_link_url TEXT DEFAULT 'https://chompchomp.cc',

  -- Hero section
  hero_title TEXT DEFAULT 'Welcome to the Chomp Chomp Library',
  hero_subhead TEXT DEFAULT 'Explore our collection',
  hero_image_url TEXT DEFAULT 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516',

  -- Metadata/favicon paths or URLs
  metadata_favicon TEXT DEFAULT '/favicon.ico',
  metadata_favicon_16 TEXT DEFAULT '/favicon-16x16.png',
  metadata_favicon_32 TEXT DEFAULT '/favicon-32x32.png',
  metadata_apple_touch_icon TEXT DEFAULT '/apple-touch-icon.png',
  metadata_android_chrome_192 TEXT DEFAULT '/android-chrome-192x192.png',
  metadata_android_chrome_512 TEXT DEFAULT '/android-chrome-512x512.png'
);

-- Only one active configuration at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_settings_active 
  ON site_settings(is_active) 
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public (anon) can view active site settings
DROP POLICY IF EXISTS "Public can view active site settings" ON site_settings;
CREATE POLICY "Public can view active site settings"
  ON site_settings FOR SELECT
  TO anon, public
  USING (is_active = true);

-- Authenticated users can view all site settings
DROP POLICY IF EXISTS "Authenticated users can view all site settings" ON site_settings;
CREATE POLICY "Authenticated users can view all site settings"
  ON site_settings FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create site settings
DROP POLICY IF EXISTS "Authenticated users can create site settings" ON site_settings;
CREATE POLICY "Authenticated users can create site settings"
  ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update site settings
DROP POLICY IF EXISTS "Authenticated users can update site settings" ON site_settings;
CREATE POLICY "Authenticated users can update site settings"
  ON site_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete site settings
DROP POLICY IF EXISTS "Authenticated users can delete site settings" ON site_settings;
CREATE POLICY "Authenticated users can delete site settings"
  ON site_settings FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS site_settings_updated_at ON site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_site_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other configurations
    UPDATE site_settings
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_settings_single_active ON site_settings;
CREATE TRIGGER site_settings_single_active
  BEFORE INSERT OR UPDATE ON site_settings
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_site_settings();

-- Insert default site settings (only if table is empty)
INSERT INTO site_settings (
  header_links,
  footer_text,
  footer_link_url,
  hero_title,
  hero_subhead,
  hero_image_url,
  metadata_favicon,
  metadata_favicon_16,
  metadata_favicon_32,
  metadata_apple_touch_icon,
  metadata_android_chrome_192,
  metadata_android_chrome_512,
  is_active
) 
SELECT
  '[
    {"title": "Home", "url": "https://library.chompchomp.cc/"},
    {"title": "Advanced Search", "url": "https://library.chompchomp.cc/catalog/search/advanced"},
    {"title": "Chomp Chomp Tools", "url": "https://chompchomp.cc/tools/"},
    {"title": "Chomp Chomp Recipes", "url": "https://chompchomp.cc/"}
  ]'::jsonb,
  'Powered by Chomp Chomp',
  'https://chompchomp.cc',
  'Welcome to the Chomp Chomp Library',
  'Explore our collection',
  'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  true
WHERE NOT EXISTS (SELECT 1 FROM site_settings);

-- Add helpful comments
COMMENT ON TABLE site_settings IS 'Simple storage for site header, footer, hero, and metadata configuration';
COMMENT ON COLUMN site_settings.header_links IS 'Array of header navigation links with title and url';
COMMENT ON COLUMN site_settings.footer_text IS 'Text displayed in footer';
COMMENT ON COLUMN site_settings.footer_link_url IS 'URL for footer link';
COMMENT ON COLUMN site_settings.hero_title IS 'Homepage hero title';
COMMENT ON COLUMN site_settings.hero_subhead IS 'Homepage hero subheading';
COMMENT ON COLUMN site_settings.hero_image_url IS 'Homepage hero background image URL';
COMMENT ON COLUMN site_settings.is_active IS 'Whether this is the active site settings (only one can be active)';
