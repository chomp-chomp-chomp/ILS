-- Migration 007: Cataloging Templates
-- Allows librarians to save common cataloging patterns as reusable templates

CREATE TABLE cataloging_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Template metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- book, dvd, audiobook, serial, etc.
  is_active BOOLEAN DEFAULT true,

  -- Template MARC fields (same structure as marc_records)
  material_type VARCHAR(50),
  leader VARCHAR(24),

  -- MARC content fields (JSONB)
  title_statement JSONB,
  publication_info JSONB,
  physical_description JSONB,
  series_statement JSONB,
  general_note TEXT[],
  subject_topical JSONB[],
  subject_geographic JSONB[],

  -- Full template data
  template_data JSONB,

  -- Created by (references auth.users)
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_cataloging_templates_category ON cataloging_templates(category);
CREATE INDEX idx_cataloging_templates_is_active ON cataloging_templates(is_active);
CREATE INDEX idx_cataloging_templates_created_by ON cataloging_templates(created_by);

-- RLS Policies (if using Row Level Security)
-- ALTER TABLE cataloging_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read templates
-- CREATE POLICY "Allow authenticated users to read templates"
--   ON cataloging_templates FOR SELECT
--   TO authenticated
--   USING (true);

-- Allow authenticated users to create templates
-- CREATE POLICY "Allow authenticated users to create templates"
--   ON cataloging_templates FOR INSERT
--   TO authenticated
--   WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own templates
-- CREATE POLICY "Allow users to update their own templates"
--   ON cataloging_templates FOR UPDATE
--   TO authenticated
--   USING (auth.uid() = created_by);

-- Allow users to delete their own templates
-- CREATE POLICY "Allow users to delete their own templates"
--   ON cataloging_templates FOR DELETE
--   TO authenticated
--   USING (auth.uid() = created_by);
