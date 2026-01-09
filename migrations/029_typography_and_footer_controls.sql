-- Typography and Footer Controls Migration
-- Adds configurable font sizes for typography and enhanced footer styling

-- Add typography control columns to branding_configuration
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS font_size_h1 VARCHAR(50) DEFAULT '2.5rem',
ADD COLUMN IF NOT EXISTS font_size_h2 VARCHAR(50) DEFAULT '2rem',
ADD COLUMN IF NOT EXISTS font_size_h3 VARCHAR(50) DEFAULT '1.5rem',
ADD COLUMN IF NOT EXISTS font_size_h4 VARCHAR(50) DEFAULT '1.25rem',
ADD COLUMN IF NOT EXISTS font_size_p VARCHAR(50) DEFAULT '1rem',
ADD COLUMN IF NOT EXISTS font_size_small VARCHAR(50) DEFAULT '0.875rem';

-- Add footer styling columns to branding_configuration
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS footer_background_color VARCHAR(50) DEFAULT '#2c3e50',
ADD COLUMN IF NOT EXISTS footer_text_color VARCHAR(50) DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS footer_link_color VARCHAR(50) DEFAULT '#ff6b72',
ADD COLUMN IF NOT EXISTS footer_padding VARCHAR(50) DEFAULT '2rem 0',
ADD COLUMN IF NOT EXISTS footer_content TEXT DEFAULT NULL; -- Rich content for footer (can contain links)

-- Add helpful comments
COMMENT ON COLUMN branding_configuration.font_size_h1 IS 'Font size for h1 elements (supports any CSS unit: rem, px, em, %, vw, clamp(), etc.)';
COMMENT ON COLUMN branding_configuration.font_size_h2 IS 'Font size for h2 elements (supports any CSS unit: rem, px, em, %, vw, clamp(), etc.)';
COMMENT ON COLUMN branding_configuration.font_size_h3 IS 'Font size for h3 elements (supports any CSS unit: rem, px, em, %, vw, clamp(), etc.)';
COMMENT ON COLUMN branding_configuration.font_size_h4 IS 'Font size for h4 elements (supports any CSS unit: rem, px, em, %, vw, clamp(), etc.)';
COMMENT ON COLUMN branding_configuration.font_size_p IS 'Font size for paragraph/body text (supports any CSS unit: rem, px, em, %, vw, clamp(), etc.)';
COMMENT ON COLUMN branding_configuration.font_size_small IS 'Font size for small text (supports any CSS unit: rem, px, em, %, vw, clamp(), etc.)';
COMMENT ON COLUMN branding_configuration.footer_background_color IS 'Footer background color (supports hex, rgb, rgba, hsl, hsla, CSS color names)';
COMMENT ON COLUMN branding_configuration.footer_text_color IS 'Footer text color (supports hex, rgb, rgba, hsl, hsla, CSS color names)';
COMMENT ON COLUMN branding_configuration.footer_link_color IS 'Footer link color (supports hex, rgb, rgba, hsl, hsla, CSS color names)';
COMMENT ON COLUMN branding_configuration.footer_padding IS 'Footer padding (CSS format, e.g., 2rem 0, 1rem 2rem 3rem 4rem)';
COMMENT ON COLUMN branding_configuration.footer_content IS 'Footer content with links. Use format: Text [Link Text](url) for links. HTML is escaped for security.';
