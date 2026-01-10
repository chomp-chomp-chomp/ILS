-- Migration: Consolidate Site Settings
-- Description: Adds branding fields to site_settings table to consolidate
--              branding_configuration and site_configuration into one table
-- Date: 2026-01-10

-- Add branding fields to site_settings
ALTER TABLE public.site_settings

  -- Library Identity
  ADD COLUMN IF NOT EXISTS library_name VARCHAR(255) DEFAULT 'Chomp Chomp Library Catalog',
  ADD COLUMN IF NOT EXISTS library_tagline VARCHAR(255) DEFAULT 'Explore our collection',

  -- Logos
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS homepage_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,

  -- Color Scheme (hex format)
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#e73b42',
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#667eea',
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#2c3e50',
  ADD COLUMN IF NOT EXISTS background_color VARCHAR(7) DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) DEFAULT '#333333',

  -- Typography
  ADD COLUMN IF NOT EXISTS font_family VARCHAR(100) DEFAULT 'system-ui, -apple-system, sans-serif',
  ADD COLUMN IF NOT EXISTS heading_font VARCHAR(100),

  -- Custom Styling
  ADD COLUMN IF NOT EXISTS custom_css TEXT,
  ADD COLUMN IF NOT EXISTS custom_head_html TEXT,

  -- Footer Configuration
  ADD COLUMN IF NOT EXISTS show_powered_by BOOLEAN DEFAULT true,

  -- Contact Information
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_address TEXT,

  -- Social Media
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,

  -- Feature Toggles
  ADD COLUMN IF NOT EXISTS show_covers BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_facets BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS items_per_page INTEGER DEFAULT 20;

-- Update existing default row with branding values if branding_configuration exists
DO $$
DECLARE
  v_branding_exists BOOLEAN;
  v_branding_record RECORD;
BEGIN
  -- Check if branding_configuration table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'branding_configuration'
  ) INTO v_branding_exists;

  -- If branding table exists, migrate active branding to site_settings
  IF v_branding_exists THEN
    -- Get active branding configuration
    SELECT * INTO v_branding_record
    FROM public.branding_configuration
    WHERE is_active = true
    LIMIT 1;

    -- If an active branding record exists, update site_settings
    IF FOUND THEN
      UPDATE public.site_settings
      SET
        library_name = COALESCE(v_branding_record.library_name, library_name),
        library_tagline = COALESCE(v_branding_record.library_tagline, library_tagline),
        logo_url = COALESCE(v_branding_record.logo_url, logo_url),
        homepage_logo_url = COALESCE(v_branding_record.homepage_logo_url, homepage_logo_url),
        favicon_url = COALESCE(v_branding_record.favicon_url, favicon_url),
        primary_color = COALESCE(v_branding_record.primary_color, primary_color),
        secondary_color = COALESCE(v_branding_record.secondary_color, secondary_color),
        accent_color = COALESCE(v_branding_record.accent_color, accent_color),
        background_color = COALESCE(v_branding_record.background_color, background_color),
        text_color = COALESCE(v_branding_record.text_color, text_color),
        font_family = COALESCE(v_branding_record.font_family, font_family),
        heading_font = COALESCE(v_branding_record.heading_font, heading_font),
        custom_css = COALESCE(v_branding_record.custom_css, custom_css),
        custom_head_html = COALESCE(v_branding_record.custom_head_html, custom_head_html),
        show_powered_by = COALESCE(v_branding_record.show_powered_by, show_powered_by),
        contact_email = COALESCE(v_branding_record.contact_email, contact_email),
        contact_phone = COALESCE(v_branding_record.contact_phone, contact_phone),
        contact_address = COALESCE(v_branding_record.contact_address, contact_address),
        facebook_url = COALESCE(v_branding_record.facebook_url, facebook_url),
        twitter_url = COALESCE(v_branding_record.twitter_url, twitter_url),
        instagram_url = COALESCE(v_branding_record.instagram_url, instagram_url),
        show_covers = COALESCE(v_branding_record.show_covers, show_covers),
        show_facets = COALESCE(v_branding_record.show_facets, show_facets),
        items_per_page = COALESCE(v_branding_record.items_per_page, items_per_page),
        -- Update footer_text if branding had it
        footer_text = COALESCE(v_branding_record.footer_text, footer_text),
        updated_at = NOW()
      WHERE id = 'default';

      RAISE NOTICE 'Migrated branding_configuration data to site_settings';
    ELSE
      RAISE NOTICE 'No active branding_configuration found to migrate';
    END IF;
  ELSE
    RAISE NOTICE 'branding_configuration table does not exist, skipping migration';
  END IF;
END $$;

-- Add helpful comments for new columns
COMMENT ON COLUMN public.site_settings.library_name IS 'Name of the library displayed throughout the site';
COMMENT ON COLUMN public.site_settings.library_tagline IS 'Tagline or subtitle for the library';
COMMENT ON COLUMN public.site_settings.logo_url IS 'URL for navigation/header logo';
COMMENT ON COLUMN public.site_settings.homepage_logo_url IS 'URL for homepage hero logo (separate from navigation)';
COMMENT ON COLUMN public.site_settings.favicon_url IS 'URL for browser favicon';
COMMENT ON COLUMN public.site_settings.primary_color IS 'Primary brand color (hex format, e.g., #e73b42)';
COMMENT ON COLUMN public.site_settings.secondary_color IS 'Secondary brand color (hex format)';
COMMENT ON COLUMN public.site_settings.accent_color IS 'Accent color for links and highlights (hex format)';
COMMENT ON COLUMN public.site_settings.background_color IS 'Background color (hex format)';
COMMENT ON COLUMN public.site_settings.text_color IS 'Text color (hex format)';
COMMENT ON COLUMN public.site_settings.font_family IS 'CSS font-family for body text';
COMMENT ON COLUMN public.site_settings.heading_font IS 'CSS font-family for headings (optional)';
COMMENT ON COLUMN public.site_settings.custom_css IS 'Custom CSS to inject into pages';
COMMENT ON COLUMN public.site_settings.custom_head_html IS 'Custom HTML to inject into <head> (for analytics, fonts, etc.)';
COMMENT ON COLUMN public.site_settings.show_powered_by IS 'Whether to show "Powered by" attribution in footer';
COMMENT ON COLUMN public.site_settings.contact_email IS 'Library contact email address';
COMMENT ON COLUMN public.site_settings.contact_phone IS 'Library contact phone number';
COMMENT ON COLUMN public.site_settings.contact_address IS 'Library physical address';
COMMENT ON COLUMN public.site_settings.facebook_url IS 'Library Facebook page URL';
COMMENT ON COLUMN public.site_settings.twitter_url IS 'Library Twitter/X profile URL';
COMMENT ON COLUMN public.site_settings.instagram_url IS 'Library Instagram profile URL';
COMMENT ON COLUMN public.site_settings.show_covers IS 'Whether to display book covers in search results';
COMMENT ON COLUMN public.site_settings.show_facets IS 'Whether to display faceted search filters';
COMMENT ON COLUMN public.site_settings.items_per_page IS 'Number of search results to display per page';

-- Update table comment
COMMENT ON TABLE public.site_settings IS 'Unified singleton table storing all site-wide settings including header, footer, hero, branding, colors, and contact information. Only one row with id=default allowed.';
