-- Migration: Typography Configuration and Enhanced Footer Styling
-- Description: Adds configurable typography sizes and enhanced footer styling options
-- This extends site_settings with typography controls and footer color/padding options

-- Add typography columns to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS typography_h1_size TEXT DEFAULT '2.5rem',
ADD COLUMN IF NOT EXISTS typography_h2_size TEXT DEFAULT '2rem',
ADD COLUMN IF NOT EXISTS typography_h3_size TEXT DEFAULT '1.75rem',
ADD COLUMN IF NOT EXISTS typography_h4_size TEXT DEFAULT '1.5rem',
ADD COLUMN IF NOT EXISTS typography_h5_size TEXT DEFAULT '1.25rem',
ADD COLUMN IF NOT EXISTS typography_h6_size TEXT DEFAULT '1rem',
ADD COLUMN IF NOT EXISTS typography_p_size TEXT DEFAULT '1rem',
ADD COLUMN IF NOT EXISTS typography_small_size TEXT DEFAULT '0.875rem',
ADD COLUMN IF NOT EXISTS typography_line_height TEXT DEFAULT '1.6';

-- Add footer styling columns to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS footer_background_color TEXT DEFAULT '#2c3e50',
ADD COLUMN IF NOT EXISTS footer_text_color TEXT DEFAULT 'rgba(255, 255, 255, 0.9)',
ADD COLUMN IF NOT EXISTS footer_link_color TEXT DEFAULT 'rgba(255, 255, 255, 0.9)',
ADD COLUMN IF NOT EXISTS footer_link_hover_color TEXT DEFAULT '#e73b42',
ADD COLUMN IF NOT EXISTS footer_padding TEXT DEFAULT '2rem 0';

-- Add footer links as JSONB array (structured links)
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS footer_links JSONB DEFAULT '[]'::jsonb;

-- Add hero height configuration
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS hero_min_height TEXT DEFAULT '250px',
ADD COLUMN IF NOT EXISTS hero_mobile_min_height TEXT DEFAULT '200px';

-- Update the default row with sensible defaults if it exists
UPDATE public.site_settings
SET 
  typography_h1_size = COALESCE(typography_h1_size, '2.5rem'),
  typography_h2_size = COALESCE(typography_h2_size, '2rem'),
  typography_h3_size = COALESCE(typography_h3_size, '1.75rem'),
  typography_h4_size = COALESCE(typography_h4_size, '1.5rem'),
  typography_h5_size = COALESCE(typography_h5_size, '1.25rem'),
  typography_h6_size = COALESCE(typography_h6_size, '1rem'),
  typography_p_size = COALESCE(typography_p_size, '1rem'),
  typography_small_size = COALESCE(typography_small_size, '0.875rem'),
  typography_line_height = COALESCE(typography_line_height, '1.6'),
  footer_background_color = COALESCE(footer_background_color, '#2c3e50'),
  footer_text_color = COALESCE(footer_text_color, 'rgba(255, 255, 255, 0.9)'),
  footer_link_color = COALESCE(footer_link_color, 'rgba(255, 255, 255, 0.9)'),
  footer_link_hover_color = COALESCE(footer_link_hover_color, '#e73b42'),
  footer_padding = COALESCE(footer_padding, '2rem 0'),
  footer_links = COALESCE(footer_links, '[]'::jsonb),
  hero_min_height = COALESCE(hero_min_height, '250px'),
  hero_mobile_min_height = COALESCE(hero_mobile_min_height, '200px')
WHERE id = 'default';

-- Add helpful comments
COMMENT ON COLUMN public.site_settings.typography_h1_size IS 'Font size for h1 headings (e.g., "2.5rem", "36px")';
COMMENT ON COLUMN public.site_settings.typography_h2_size IS 'Font size for h2 headings';
COMMENT ON COLUMN public.site_settings.typography_h3_size IS 'Font size for h3 headings';
COMMENT ON COLUMN public.site_settings.typography_h4_size IS 'Font size for h4 headings';
COMMENT ON COLUMN public.site_settings.typography_h5_size IS 'Font size for h5 headings';
COMMENT ON COLUMN public.site_settings.typography_h6_size IS 'Font size for h6 headings';
COMMENT ON COLUMN public.site_settings.typography_p_size IS 'Font size for paragraph text';
COMMENT ON COLUMN public.site_settings.typography_small_size IS 'Font size for small text';
COMMENT ON COLUMN public.site_settings.typography_line_height IS 'Line height for body text (unitless, e.g., "1.6")';
COMMENT ON COLUMN public.site_settings.footer_background_color IS 'Footer background color (CSS color value)';
COMMENT ON COLUMN public.site_settings.footer_text_color IS 'Footer text color (CSS color value)';
COMMENT ON COLUMN public.site_settings.footer_link_color IS 'Footer link color (CSS color value)';
COMMENT ON COLUMN public.site_settings.footer_link_hover_color IS 'Footer link hover color (CSS color value)';
COMMENT ON COLUMN public.site_settings.footer_padding IS 'Footer padding (CSS padding value, e.g., "2rem 0")';
COMMENT ON COLUMN public.site_settings.footer_links IS 'JSONB array of footer links: [{"title": "...", "url": "...", "order": 1}]';
COMMENT ON COLUMN public.site_settings.hero_min_height IS 'Minimum height for hero section on desktop (CSS height value)';
COMMENT ON COLUMN public.site_settings.hero_mobile_min_height IS 'Minimum height for hero section on mobile (CSS height value)';
