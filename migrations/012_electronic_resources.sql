-- Add electronic resource support to items table
-- Run this in Supabase SQL Editor

-- Add fields for electronic resources to items table
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_electronic BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS access_restrictions TEXT;

-- Create index for electronic resources
CREATE INDEX IF NOT EXISTS idx_items_is_electronic ON items(is_electronic) WHERE is_electronic = TRUE;

-- Update RLS policy to allow public to see electronic resource URLs
-- (The existing policy already allows viewing, so no changes needed)

COMMENT ON COLUMN items.is_electronic IS 'Whether this is an electronic resource (e-book, online journal, etc.)';
COMMENT ON COLUMN items.url IS 'URL for accessing electronic resources';
COMMENT ON COLUMN items.access_restrictions IS 'Access restrictions or authentication requirements for electronic resources';
