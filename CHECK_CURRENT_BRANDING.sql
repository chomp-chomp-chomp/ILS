-- Check what's ACTUALLY saved in the database right now
SELECT
  'Current branding data' as info,
  footer_text,
  show_powered_by,
  show_header,
  jsonb_array_length(COALESCE(header_links, '[]'::jsonb)) as header_links_count,
  updated_at
FROM branding_configuration
WHERE is_active = true;

-- Show the actual header links
SELECT
  'Header links in database' as info,
  jsonb_pretty(header_links) as links
FROM branding_configuration
WHERE is_active = true;

-- Show when it was last updated
SELECT
  'Last update time' as info,
  updated_at,
  NOW() - updated_at as time_since_update
FROM branding_configuration
WHERE is_active = true;
