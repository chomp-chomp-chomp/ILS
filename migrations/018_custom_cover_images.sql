-- Migration: Custom Cover Image Upload
-- Adds ability to upload and manage custom cover images for catalog records
-- Created: 2025-12-30

-- Add cover_image_url field to marc_records table
ALTER TABLE marc_records
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add comment
COMMENT ON COLUMN marc_records.cover_image_url IS 'URL to custom uploaded cover image. Takes priority over API-fetched covers.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_marc_records_cover_url ON marc_records(cover_image_url) WHERE cover_image_url IS NOT NULL;

-- Create storage bucket for cover images (run this in Supabase Dashboard > Storage)
-- This is informational - you'll need to create this bucket manually in Supabase
/*
MANUAL SETUP REQUIRED IN SUPABASE DASHBOARD:

1. Go to Storage > Create Bucket
2. Name: "cover-images"
3. Public bucket: YES (so covers can be displayed)
4. File size limit: 5MB
5. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

Or run this SQL in Supabase SQL Editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cover-images',
  'cover-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public can view cover images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cover-images');

CREATE POLICY "Authenticated users can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-images');

CREATE POLICY "Authenticated users can update covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cover-images');

CREATE POLICY "Authenticated users can delete covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cover-images');
*/
