-- Typography and Footer Controls Migration
-- Adds configurable font sizes for typography and enhanced footer styling

-- Add typography control columns to branding_configuration
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS font_size_h1 VARCHAR(10) DEFAULT '2.5rem',
ADD COLUMN IF NOT EXISTS font_size_h2 VARCHAR(10) DEFAULT '2rem',
ADD COLUMN IF NOT EXISTS font_size_h3 VARCHAR(10) DEFAULT '1.5rem',
ADD COLUMN IF NOT EXISTS font_size_h4 VARCHAR(10) DEFAULT '1.25rem',
ADD COLUMN IF NOT EXISTS font_size_p VARCHAR(10) DEFAULT '1rem',
ADD COLUMN IF NOT EXISTS font_size_small VARCHAR(10) DEFAULT '0.875rem';

-- Add footer styling columns to branding_configuration
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS footer_background_color VARCHAR(7) DEFAULT '#2c3e50',
ADD COLUMN IF NOT EXISTS footer_text_color VARCHAR(7) DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS footer_link_color VARCHAR(7) DEFAULT '#ff6b72',
ADD COLUMN IF NOT EXISTS footer_padding VARCHAR(20) DEFAULT '2rem 0',
ADD COLUMN IF NOT EXISTS footer_content TEXT DEFAULT NULL; -- Rich content for footer (can contain links)

-- Add helpful comments
COMMENT ON COLUMN branding_configuration.font_size_h1 IS 'Font size for h1 elements (e.g., 2.5rem, 40px)';
COMMENT ON COLUMN branding_configuration.font_size_h2 IS 'Font size for h2 elements (e.g., 2rem, 32px)';
COMMENT ON COLUMN branding_configuration.font_size_h3 IS 'Font size for h3 elements (e.g., 1.5rem, 24px)';
COMMENT ON COLUMN branding_configuration.font_size_h4 IS 'Font size for h4 elements (e.g., 1.25rem, 20px)';
COMMENT ON COLUMN branding_configuration.font_size_p IS 'Font size for paragraph/body text (e.g., 1rem, 16px)';
COMMENT ON COLUMN branding_configuration.font_size_small IS 'Font size for small text (e.g., 0.875rem, 14px)';
COMMENT ON COLUMN branding_configuration.footer_background_color IS 'Footer background color (hex format)';
COMMENT ON COLUMN branding_configuration.footer_text_color IS 'Footer text color (hex format)';
COMMENT ON COLUMN branding_configuration.footer_link_color IS 'Footer link color (hex format)';
COMMENT ON COLUMN branding_configuration.footer_padding IS 'Footer padding (CSS format, e.g., 2rem 0)';
COMMENT ON COLUMN branding_configuration.footer_content IS 'Footer content with links. Use format: Text [Link Text](url) for links.';
