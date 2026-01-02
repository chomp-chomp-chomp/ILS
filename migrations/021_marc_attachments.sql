-- Migration 021: MARC Attachments
-- Adds attachment metadata table for external file links with access control and analytics

CREATE TABLE IF NOT EXISTS marc_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    marc_record_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,
    filename_original TEXT,
    external_url TEXT NOT NULL,
    external_expires_at TIMESTAMPTZ,
    title TEXT,
    description TEXT,
    file_type VARCHAR(100),
    file_size INTEGER,
    access_level VARCHAR(20) NOT NULL DEFAULT 'public', -- public, authenticated, staff-only
    uploaded_by UUID REFERENCES auth.users(id),
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    sort_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,

    CONSTRAINT marc_attachment_access_level_valid CHECK (access_level IN ('public', 'authenticated', 'staff-only'))
);

-- Indexes for performance and ordering
CREATE INDEX IF NOT EXISTS idx_marc_attachments_record_order
    ON marc_attachments(marc_record_id, sort_order, upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_marc_attachments_access_level
    ON marc_attachments(access_level);
CREATE INDEX IF NOT EXISTS idx_marc_attachments_expiration
    ON marc_attachments(external_expires_at);

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION update_marc_attachment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marc_attachment_updated_at
    BEFORE UPDATE ON marc_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_marc_attachment_updated_at();

-- Row Level Security
ALTER TABLE marc_attachments ENABLE ROW LEVEL SECURITY;

-- Staff helper predicate reused across policies
CREATE OR REPLACE FUNCTION is_staff_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM patrons p
        JOIN patron_types pt ON p.patron_type_id = pt.id
        WHERE p.user_id = auth.uid()
          AND LOWER(pt.name) IN ('staff', 'faculty', 'librarian', 'admin')
    );
END;
$$ LANGUAGE plpgsql;

-- Allow public read of public attachments
CREATE POLICY "Public can read public attachments"
    ON marc_attachments FOR SELECT
    TO anon
    USING (access_level = 'public');

-- Allow authenticated users to read public and authenticated attachments (or their own uploads)
CREATE POLICY "Authenticated can read permitted attachments"
    ON marc_attachments FOR SELECT
    TO authenticated
    USING (
        access_level IN ('public', 'authenticated')
        OR uploaded_by = auth.uid()
        OR is_staff_user()
    );

-- Staff can read everything
CREATE POLICY "Staff can read all attachments"
    ON marc_attachments FOR SELECT
    TO authenticated
    USING (is_staff_user());

-- Only staff can insert/update/delete
CREATE POLICY "Staff can manage attachments"
    ON marc_attachments FOR ALL
    TO authenticated
    USING (is_staff_user())
    WITH CHECK (is_staff_user());

-- RPC helpers for analytics
CREATE OR REPLACE FUNCTION increment_attachment_views(p_attachment_ids UUID[])
RETURNS VOID AS $$
BEGIN
    IF p_attachment_ids IS NULL OR array_length(p_attachment_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    UPDATE marc_attachments
    SET view_count = view_count + 1
    WHERE id = ANY(p_attachment_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_attachment_download(p_attachment_id UUID)
RETURNS marc_attachments AS $$
DECLARE
    updated_record marc_attachments;
BEGIN
    UPDATE marc_attachments
    SET download_count = download_count + 1
    WHERE id = p_attachment_id
    RETURNING * INTO updated_record;

    RETURN updated_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION increment_attachment_views(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_attachment_download(UUID) TO anon, authenticated;

-- Attachment statistics per record
CREATE OR REPLACE VIEW marc_attachment_stats AS
SELECT
    marc_record_id,
    COUNT(*) AS attachment_count,
    COALESCE(SUM(file_size), 0) AS total_size_bytes,
    COALESCE(SUM(CASE WHEN external_expires_at IS NOT NULL AND external_expires_at < NOW() THEN 1 ELSE 0 END), 0) AS expired_count,
    COALESCE(SUM(CASE WHEN external_expires_at IS NOT NULL AND external_expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days' THEN 1 ELSE 0 END), 0) AS expiring_soon_count
FROM marc_attachments
GROUP BY marc_record_id;

GRANT SELECT ON marc_attachment_stats TO anon, authenticated;

COMMENT ON TABLE marc_attachments IS 'External file attachments linked to MARC records';
COMMENT ON COLUMN marc_attachments.external_url IS 'Expiring share link to external storage provider';
COMMENT ON FUNCTION increment_attachment_views IS 'Increment view counters for a set of attachment IDs';
COMMENT ON FUNCTION increment_attachment_download IS 'Increment download counter and return updated attachment record';
