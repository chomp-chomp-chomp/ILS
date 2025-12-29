-- WYSIWYG Pages Migration
-- Run this in Supabase SQL Editor
-- This creates functionality for editable content pages (homepage, about, help, etc.)

-- 1. Pages table
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Page identification
  slug VARCHAR(100) UNIQUE NOT NULL, -- 'homepage', 'about', 'help', 'contact', etc.
  title VARCHAR(255) NOT NULL,

  -- Content
  content TEXT, -- HTML from WYSIWYG editor
  excerpt TEXT, -- Optional short description for meta/previews

  -- Publication status
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,

  -- SEO
  meta_description TEXT,
  meta_keywords TEXT,

  -- Display options
  show_in_menu BOOLEAN DEFAULT false,
  menu_order INTEGER DEFAULT 0,
  menu_label VARCHAR(100), -- Override title in menu

  -- Template/layout
  layout VARCHAR(50) DEFAULT 'default', -- 'default', 'full-width', 'sidebar', etc.

  -- Tracking
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  view_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_published ON pages(is_published);
CREATE INDEX idx_pages_menu ON pages(show_in_menu, menu_order);

-- Row Level Security
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view published pages
CREATE POLICY "Public can view published pages"
  ON pages FOR SELECT
  TO public
  USING (is_published = true);

-- Authenticated users (staff) can view all pages
CREATE POLICY "Authenticated users can view all pages"
  ON pages FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create pages
CREATE POLICY "Authenticated users can create pages"
  ON pages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update pages
CREATE POLICY "Authenticated users can update pages"
  ON pages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete pages
CREATE POLICY "Authenticated users can delete pages"
  ON pages FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at
CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to set published_at when is_published changes to true
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_published = true AND OLD.is_published = false THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_set_published_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION set_published_at();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_page_views(page_slug VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE pages
  SET view_count = view_count + 1
  WHERE slug = page_slug AND is_published = true;
END;
$$ LANGUAGE plpgsql;

-- Insert default pages
INSERT INTO pages (slug, title, content, is_published, show_in_menu, menu_order, menu_label) VALUES
  ('homepage', 'Welcome to Our Library',
   '<h1>Welcome to Our Library</h1><p>Explore our catalog of books, journals, and digital resources.</p><p>Use the search box above to find materials, or browse by subject.</p>',
   true, false, 0, NULL),

  ('about', 'About Us',
   '<h1>About Our Library</h1><p>This is your library''s about page. Edit this content to tell visitors about your library, its history, mission, and services.</p><h2>Our Mission</h2><p>Add your mission statement here.</p><h2>Hours</h2><p>Add your hours of operation here.</p>',
   true, true, 1, 'About'),

  ('help', 'Help & FAQs',
   '<h1>Help & Frequently Asked Questions</h1><h2>How do I search the catalog?</h2><p>Use the search box at the top of any page. You can search by title, author, subject, or keyword.</p><h2>How do I place a hold?</h2><p>Add information about your hold/reservation process here.</p>',
   true, true, 2, 'Help'),

  ('contact', 'Contact Us',
   '<h1>Contact Us</h1><p>Add your library''s contact information here.</p><p><strong>Address:</strong><br>123 Library Street<br>Your City, State 00000</p><p><strong>Phone:</strong> (555) 123-4567<br><strong>Email:</strong> info@yourlibrary.org</p>',
   true, true, 3, 'Contact');

COMMENT ON TABLE pages IS 'Editable content pages with WYSIWYG editor support';
COMMENT ON COLUMN pages.slug IS 'URL-friendly identifier for the page';
COMMENT ON COLUMN pages.content IS 'HTML content from WYSIWYG editor';
COMMENT ON COLUMN pages.is_published IS 'Whether the page is visible to the public';
COMMENT ON COLUMN pages.show_in_menu IS 'Whether to show this page in navigation menus';
COMMENT ON COLUMN pages.layout IS 'Template layout to use for rendering';
