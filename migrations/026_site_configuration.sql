-- Site Configuration Migration
-- Run this in Supabase SQL Editor
-- This creates the site_configuration system for public-site content and theming

-- 1. Site configuration table (single active row enforced)
CREATE TABLE IF NOT EXISTS public.site_configuration (
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

  -- Homepage info section
  homepage_info_enabled BOOLEAN DEFAULT false,
  homepage_info_title TEXT DEFAULT '',
  homepage_info_content TEXT DEFAULT '', -- plain text
  homepage_info_links JSONB DEFAULT '[]'::jsonb, -- array of { title, url, order }

  -- Theme configuration
  theme_mode TEXT DEFAULT 'system' CHECK (theme_mode IN ('system', 'light', 'dark')),
  theme_light JSONB DEFAULT '{}'::jsonb, -- light theme CSS variables
  theme_dark JSONB DEFAULT '{}'::jsonb,  -- dark theme CSS variables
  page_themes JSONB DEFAULT '{}'::jsonb  -- per-page-type overrides
);

-- 2. Create unique partial index to enforce single active row
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_configuration_single_active 
  ON public.site_configuration (is_active) 
  WHERE is_active = true;

-- 3. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_site_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_site_configuration_updated_at ON public.site_configuration;
CREATE TRIGGER trigger_update_site_configuration_updated_at
  BEFORE UPDATE ON public.site_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_site_configuration_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.site_configuration ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Public can SELECT only active configuration
DROP POLICY IF EXISTS "Public can view active site configuration" ON public.site_configuration;
CREATE POLICY "Public can view active site configuration"
  ON public.site_configuration
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Authenticated users can SELECT all configurations
DROP POLICY IF EXISTS "Authenticated can view all site configurations" ON public.site_configuration;
CREATE POLICY "Authenticated can view all site configurations"
  ON public.site_configuration
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can UPDATE configurations
DROP POLICY IF EXISTS "Authenticated can update site configuration" ON public.site_configuration;
CREATE POLICY "Authenticated can update site configuration"
  ON public.site_configuration
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can INSERT configurations
DROP POLICY IF EXISTS "Authenticated can insert site configuration" ON public.site_configuration;
CREATE POLICY "Authenticated can insert site configuration"
  ON public.site_configuration
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Seed default active configuration with sensible theme tokens
INSERT INTO public.site_configuration (
  is_active,
  header_enabled,
  footer_enabled,
  homepage_info_enabled,
  theme_mode,
  theme_light,
  theme_dark,
  page_themes
) VALUES (
  true,
  false,
  false,
  false,
  'system',
  -- Light theme defaults
  '{
    "primary": "#e73b42",
    "secondary": "#667eea",
    "accent": "#2c3e50",
    "background": "#ffffff",
    "surface": "#f5f5f5",
    "text": "#333333",
    "text-muted": "#666666",
    "border": "#e0e0e0"
  }'::jsonb,
  -- Dark theme defaults
  '{
    "primary": "#ff5a61",
    "secondary": "#7c8ffa",
    "accent": "#4a5f7f",
    "background": "#1a1a1a",
    "surface": "#2d2d2d",
    "text": "#e0e0e0",
    "text-muted": "#a0a0a0",
    "border": "#404040"
  }'::jsonb,
  -- Page-specific theme overrides (empty by default)
  '{
    "home": {},
    "search_results": {},
    "search_advanced": {},
    "catalog_browse": {},
    "record_details": {},
    "public_default": {}
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- 7. Add helpful comment
COMMENT ON TABLE public.site_configuration IS 'Site-wide configuration for public-facing pages including header, footer, homepage info, and theming system. Only one row can be active at a time.';
COMMENT ON COLUMN public.site_configuration.theme_mode IS 'Default theme mode: system (respects prefers-color-scheme), light, or dark';
COMMENT ON COLUMN public.site_configuration.theme_light IS 'Light theme CSS variable tokens (JSON object with keys like primary, background, text, etc.)';
COMMENT ON COLUMN public.site_configuration.theme_dark IS 'Dark theme CSS variable tokens (JSON object with keys like primary, background, text, etc.)';
COMMENT ON COLUMN public.site_configuration.page_themes IS 'Per-page-type theme overrides (JSON object with keys: home, search_results, search_advanced, catalog_browse, record_details, public_default)';
