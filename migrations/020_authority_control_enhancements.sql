-- Migration 020: Authority control enhancements
-- Ensures legacy function signatures are removed, then recreates the helper with field_index support

-- Cleanup any prior signatures to prevent return type conflicts
DROP FUNCTION IF EXISTS find_unauthorized_headings(VARCHAR);
DROP FUNCTION IF EXISTS find_unauthorized_headings();

-- Refresh the unauthorized headings helper to return field_index
CREATE OR REPLACE FUNCTION find_unauthorized_headings(
  field_type VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE (
  marc_record_id UUID,
  field VARCHAR(10),
  field_index INTEGER,
  heading TEXT,
  suggested_authority_id UUID,
  suggested_heading TEXT,
  confidence REAL
) AS $$
BEGIN
  RETURN QUERY
  -- Personal names (100, 600, 700, 800)
  SELECT
    m.id as marc_record_id,
    '100' as field,
    0 as field_index,
    m.main_entry_personal_name->>'a' as heading,
    a.id as suggested_authority_id,
    a.heading as suggested_heading,
    similarity(m.main_entry_personal_name->>'a', a.heading) as confidence
  FROM marc_records m
  LEFT JOIN marc_authority_links mal ON m.id = mal.marc_record_id AND mal.marc_field = '100'
  CROSS JOIN LATERAL (
    SELECT id, heading FROM authorities
    WHERE type = 'personal_name'
      AND similarity(m.main_entry_personal_name->>'a', heading) > 0.6
    ORDER BY similarity(m.main_entry_personal_name->>'a', heading) DESC
    LIMIT 1
  ) a
  WHERE
    m.main_entry_personal_name IS NOT NULL
    AND mal.id IS NULL  -- No authority link exists
    AND (field_type IS NULL OR field_type = '100')
    AND m.main_entry_personal_name->>'a' != a.heading  -- Heading doesn't match exactly

  UNION ALL

  -- Subjects (650)
  SELECT
    m.id as marc_record_id,
    '650' as field,
    (t.idx - 1) as field_index,
    subj->>'a' as heading,
    a.id as suggested_authority_id,
    a.heading as suggested_heading,
    similarity(subj->>'a', a.heading) as confidence
  FROM marc_records m,
       jsonb_array_elements(COALESCE(m.subject_topical, '[]'::jsonb)) WITH ORDINALITY AS t(subj, idx)
  LEFT JOIN marc_authority_links mal
    ON m.id = mal.marc_record_id
    AND mal.marc_field = '650'
    AND mal.field_index = (t.idx - 1)
  CROSS JOIN LATERAL (
    SELECT id, heading FROM authorities
    WHERE type = 'topical_subject'
      AND similarity(subj->>'a', heading) > 0.6
    ORDER BY similarity(subj->>'a', heading) DESC
    LIMIT 1
  ) a
  WHERE
    subj->>'a' IS NOT NULL
    AND mal.id IS NULL
    AND (field_type IS NULL OR field_type = '650')
    AND subj->>'a' != a.heading

  ORDER BY confidence DESC;
END;
$$ LANGUAGE plpgsql;
