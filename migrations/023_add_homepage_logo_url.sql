-- Migration 023: Add homepage_logo_url to branding_configuration
-- Description: Adds homepage_logo_url field for separate homepage/navigation logos
-- Created: 2026-01-05

-- Add homepage_logo_url column to branding_configuration table
ALTER TABLE branding_configuration
ADD COLUMN IF NOT EXISTS homepage_logo_url TEXT;

-- Update the existing active branding config with the current logo
UPDATE branding_configuration
SET homepage_logo_url = 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library'
WHERE is_active = true AND homepage_logo_url IS NULL;

-- Add comment
COMMENT ON COLUMN branding_configuration.homepage_logo_url IS 'Homepage hero logo URL (separate from navigation logo)';

-- Migration complete
-- This allows separate logos for homepage hero vs navigation/header
