-- Migration 026: Add Homepage Hero to Site Configuration
-- Run this in Supabase SQL Editor
-- This extends site_configuration with homepage hero section support

-- Add homepage hero columns
ALTER TABLE site_configuration
  ADD COLUMN IF NOT EXISTS homepage_hero_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS homepage_hero_title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS homepage_hero_tagline TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS homepage_hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS homepage_hero_links JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN site_configuration.homepage_hero_enabled IS 'Whether to show hero section on homepage';
COMMENT ON COLUMN site_configuration.homepage_hero_title IS 'Main title for hero section';
COMMENT ON COLUMN site_configuration.homepage_hero_tagline IS 'Tagline/subtitle for hero section';
COMMENT ON COLUMN site_configuration.homepage_hero_image_url IS 'URL to hero background image';
COMMENT ON COLUMN site_configuration.homepage_hero_links IS 'Array of hero links with title, url, and order';

-- Note: Existing data will get default values automatically
-- No need to update existing records as they'll use defaults
