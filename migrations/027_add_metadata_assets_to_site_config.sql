-- Migration 027: Add Site Metadata Asset URLs to Site Configuration
-- Run this in Supabase SQL Editor
-- This extends site_configuration with site metadata asset URL support

-- Add site metadata asset URL columns
ALTER TABLE site_configuration
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS apple_touch_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS android_chrome_192_url TEXT,
  ADD COLUMN IF NOT EXISTS android_chrome_512_url TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_card_image_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN site_configuration.favicon_url IS 'URL to favicon (overrides branding.favicon_url)';
COMMENT ON COLUMN site_configuration.apple_touch_icon_url IS 'URL to Apple touch icon';
COMMENT ON COLUMN site_configuration.android_chrome_192_url IS 'URL to Android Chrome 192x192 icon';
COMMENT ON COLUMN site_configuration.android_chrome_512_url IS 'URL to Android Chrome 512x512 icon';
COMMENT ON COLUMN site_configuration.og_image_url IS 'URL to Open Graph image';
COMMENT ON COLUMN site_configuration.twitter_card_image_url IS 'URL to Twitter card image (fallback to og_image_url if null)';

-- Note: These URLs are optional and will fallback to branding or static assets if null
-- This maintains backward compatibility with existing systems
