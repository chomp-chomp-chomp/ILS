-- Migration: Simple Site Settings Table
-- Description: Creates a singleton table for admin-editable site settings (header/footer/hero)
-- This replaces the more complex site_configuration approach with a simpler, more robust system

-- Drop existing table if it exists (for clean re-creation)
DROP TABLE IF EXISTS public.site_settings CASCADE;

-- Create site_settings table (singleton approach)
CREATE TABLE public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Header Navigation (JSONB array of {title, url})
  header_links JSONB DEFAULT '[]'::jsonb,
  
  -- Footer Configuration
  footer_text TEXT DEFAULT 'Powered by Chomp Chomp',
  footer_link TEXT DEFAULT 'https://chompchomp.cc',
  
  -- Hero Section (Homepage)
  hero_title TEXT DEFAULT 'Welcome to the Chomp Chomp Library',
  hero_subhead TEXT DEFAULT 'Explore our collection',
  hero_image_url TEXT DEFAULT 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516',
  
  -- Audit fields
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraint: Only allow single row with id='default'
  CONSTRAINT singleton_check CHECK (id = 'default')
);

-- Create trigger to prevent multiple rows (singleton enforcement)
CREATE OR REPLACE FUNCTION enforce_site_settings_singleton()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != 'default' THEN
    RAISE EXCEPTION 'Only one site_settings row is allowed with id=default';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_settings_singleton_trigger
  BEFORE INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_site_settings_singleton();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_settings_updated_at_trigger
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();

-- Insert default row
INSERT INTO public.site_settings (
  id,
  header_links,
  footer_text,
  footer_link,
  hero_title,
  hero_subhead,
  hero_image_url
) VALUES (
  'default',
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
  'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516'
);

-- Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone can read, only authenticated users can modify
CREATE POLICY "Public read access for site_settings"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated write access for site_settings"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update access for site_settings"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated delete access for site_settings"
  ON public.site_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups (though with singleton, this is minimal benefit)
CREATE INDEX idx_site_settings_id ON public.site_settings(id);

-- Add helpful comment
COMMENT ON TABLE public.site_settings IS 'Singleton table storing site-wide settings for header, footer, and hero. Only one row with id=default allowed.';
COMMENT ON COLUMN public.site_settings.header_links IS 'JSONB array of navigation links: [{"title": "...", "url": "..."}]';
COMMENT ON COLUMN public.site_settings.footer_text IS 'Footer text displayed at bottom of public pages';
COMMENT ON COLUMN public.site_settings.footer_link IS 'URL linked from footer text';
COMMENT ON COLUMN public.site_settings.hero_title IS 'Main title on homepage hero banner';
COMMENT ON COLUMN public.site_settings.hero_subhead IS 'Subtitle/tagline on homepage hero banner';
COMMENT ON COLUMN public.site_settings.hero_image_url IS 'Background image URL for homepage hero';
