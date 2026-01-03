-- Migration 022: ImageKit Integration for Cover Storage
-- Adds ImageKit file ID tracking for uploaded covers
-- Created: 2026-01-03

-- Add imagekit_file_id column to covers table
ALTER TABLE covers
ADD COLUMN IF NOT EXISTS imagekit_file_id VARCHAR(255);

-- Create index for faster lookups by ImageKit file ID
CREATE INDEX IF NOT EXISTS idx_covers_imagekit_file_id
ON covers(imagekit_file_id)
WHERE imagekit_file_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN covers.imagekit_file_id IS 'ImageKit file ID for uploaded covers. Used for deletion and management of files in ImageKit CDN.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment to verify after running migration:

-- SELECT 'Migration 022 completed successfully' as status;
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'covers' AND column_name = 'imagekit_file_id';
