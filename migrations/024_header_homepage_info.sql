-- Migration 024: Header and Homepage Info Section Configuration
-- Description: Adds configurable header navigation and homepage info section
-- Created: 2026-01-05

-- ================================================================
-- 1. ADD HEADER CONFIGURATION FIELDS
-- ================================================================

-- Add header toggle
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS show_header BOOLEAN DEFAULT false;

-- Add header links (array of {title, url, order})
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS header_links JSONB DEFAULT '[]';

-- ================================================================
-- 2. ADD HOMEPAGE INFO SECTION FIELDS
-- ================================================================

-- Add homepage info section toggle
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS show_homepage_info BOOLEAN DEFAULT false;

-- Add homepage info section title
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS homepage_info_title VARCHAR(255) DEFAULT 'Library Resources';

-- Add homepage info section content (supports HTML)
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS homepage_info_content TEXT;

-- Add homepage info section links (array of {title, url, order})
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS homepage_info_links JSONB DEFAULT '[]';

-- ================================================================
-- 3. ADD COMMENTS
-- ================================================================

COMMENT ON COLUMN branding_configuration.show_header IS 'Toggle site-wide header navigation on/off';
COMMENT ON COLUMN branding_configuration.header_links IS 'Array of header navigation links [{title, url, order}]';
COMMENT ON COLUMN branding_configuration.show_homepage_info IS 'Toggle homepage info section on/off';
COMMENT ON COLUMN branding_configuration.homepage_info_title IS 'Title for homepage info section';
COMMENT ON COLUMN branding_configuration.homepage_info_content IS 'HTML content for homepage info section';
COMMENT ON COLUMN branding_configuration.homepage_info_links IS 'Array of quick links in homepage info section [{title, url, order}]';

-- ================================================================
-- 4. UPDATE EXISTING BRANDING CONFIG WITH SAMPLE DATA
-- ================================================================

-- Add sample header links to existing configuration
UPDATE branding_configuration
SET
  show_header = false,  -- Default to off, user can enable
  header_links = '[
    {"title": "Home", "url": "/", "order": 1},
    {"title": "Advanced Search", "url": "/catalog/search/advanced", "order": 2},
    {"title": "Browse Collection", "url": "/catalog/browse", "order": 3}
  ]'::jsonb,
  show_homepage_info = false,  -- Default to off
  homepage_info_title = 'Quick Links',
  homepage_info_content = '<p>Welcome to our library catalog! Browse our collection or search for specific items.</p>',
  homepage_info_links = '[
    {"title": "Library Hours", "url": "/pages/hours", "order": 1},
    {"title": "Contact Us", "url": "/pages/contact", "order": 2},
    {"title": "Research Guides", "url": "/pages/guides", "order": 3}
  ]'::jsonb
WHERE is_active = true;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

-- Summary of changes:
-- ✓ Added show_header toggle (default: false)
-- ✓ Added header_links JSONB array for navigation links
-- ✓ Added show_homepage_info toggle (default: false)
-- ✓ Added homepage_info_title for section heading
-- ✓ Added homepage_info_content for HTML/text content
-- ✓ Added homepage_info_links JSONB array for quick links
-- ✓ Sample data provided for easy testing
--
-- Next steps:
-- 1. Update branding admin UI to manage header and homepage info
-- 2. Create header component that reads from branding config
-- 3. Update homepage to show info section when enabled
