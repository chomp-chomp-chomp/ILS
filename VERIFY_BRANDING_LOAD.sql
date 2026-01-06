-- Force check what's being loaded by the layout
-- This shows EXACTLY what data the page should see

SELECT
  id,
  library_name,
  footer_text,
  show_powered_by,
  show_header,
  jsonb_pretty(header_links) as header_links,
  is_active,
  updated_at
FROM branding_configuration
WHERE is_active = true;
