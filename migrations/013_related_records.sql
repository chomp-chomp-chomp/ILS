-- Related Records / "See Also" Links Migration
-- Run this in Supabase SQL Editor
-- This creates functionality for linking related catalog records together

-- 1. Related records table
CREATE TABLE related_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source record (the record this relationship is defined on)
  source_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE NOT NULL,

  -- Target record (the related record being linked to)
  target_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE NOT NULL,

  -- Relationship type
  relationship_type VARCHAR(50) NOT NULL,
  -- Possible values:
  -- 'related_work' - General related work
  -- 'translation' - Translation of the source work
  -- 'original' - Original work (inverse of translation)
  -- 'earlier_edition' - Earlier edition of the same work
  -- 'later_edition' - Later edition of the same work
  -- 'adaptation' - Adaptation (e.g., book to movie)
  -- 'adapted_from' - Source of adaptation
  -- 'companion' - Companion volume
  -- 'part_of' - Part of a larger work
  -- 'has_part' - Contains the linked work as a part
  -- 'supplement' - Supplementary material
  -- 'supplement_to' - Main work being supplemented
  -- 'continues' - Continues the linked serial (for serials)
  -- 'continued_by' - Continued by the linked serial

  -- Optional relationship notes/description
  relationship_note TEXT,

  -- Order for display (lower numbers first)
  display_order INTEGER DEFAULT 0,

  -- Who created this link
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_related_records_source ON related_records(source_record_id);
CREATE INDEX idx_related_records_target ON related_records(target_record_id);
CREATE INDEX idx_related_records_type ON related_records(relationship_type);

-- Composite index for common queries
CREATE INDEX idx_related_source_type ON related_records(source_record_id, relationship_type);

-- Prevent duplicate relationships
CREATE UNIQUE INDEX idx_related_unique
  ON related_records(source_record_id, target_record_id, relationship_type);

-- Row Level Security
ALTER TABLE related_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view all related records
CREATE POLICY "Public can view related records"
  ON related_records FOR SELECT
  TO public
  USING (true);

-- Authenticated users (staff) can manage related records
CREATE POLICY "Authenticated users can manage related records"
  ON related_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE TRIGGER related_records_updated_at
  BEFORE UPDATE ON related_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for getting related records with full record details
CREATE OR REPLACE VIEW related_records_with_details AS
SELECT
  rr.id,
  rr.source_record_id,
  rr.target_record_id,
  rr.relationship_type,
  rr.relationship_note,
  rr.display_order,
  rr.created_at,
  -- Include target record details
  mr.title_statement,
  mr.main_entry_personal_name,
  mr.publication_info,
  mr.material_type,
  mr.isbn,
  mr.issn
FROM related_records rr
JOIN marc_records mr ON rr.target_record_id = mr.id
ORDER BY rr.display_order, rr.created_at;

-- Grant permissions on view
GRANT SELECT ON related_records_with_details TO public;
GRANT SELECT ON related_records_with_details TO authenticated;

-- Function to get relationship label for display
CREATE OR REPLACE FUNCTION get_relationship_label(rel_type VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  RETURN CASE rel_type
    WHEN 'related_work' THEN 'Related Work'
    WHEN 'translation' THEN 'Translation'
    WHEN 'original' THEN 'Original Work'
    WHEN 'earlier_edition' THEN 'Earlier Edition'
    WHEN 'later_edition' THEN 'Later Edition'
    WHEN 'adaptation' THEN 'Adaptation'
    WHEN 'adapted_from' THEN 'Adapted From'
    WHEN 'companion' THEN 'Companion Volume'
    WHEN 'part_of' THEN 'Part Of'
    WHEN 'has_part' THEN 'Contains'
    WHEN 'supplement' THEN 'Supplement'
    WHEN 'supplement_to' THEN 'Supplement To'
    WHEN 'continues' THEN 'Continues'
    WHEN 'continued_by' THEN 'Continued By'
    ELSE initcap(replace(rel_type, '_', ' '))
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE related_records IS 'Links between related catalog records for "See Also" functionality';
COMMENT ON COLUMN related_records.relationship_type IS 'Type of relationship between records';
COMMENT ON COLUMN related_records.relationship_note IS 'Optional description of the relationship';
COMMENT ON COLUMN related_records.display_order IS 'Order to display related records (lower numbers first)';
