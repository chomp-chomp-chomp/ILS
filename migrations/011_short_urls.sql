-- Create short_urls table for URL shortening
CREATE TABLE IF NOT EXISTS short_urls (
    code VARCHAR(10) PRIMARY KEY,
    full_url TEXT NOT NULL,
    resource_type VARCHAR(50), -- 'record', 'search', 'other'
    resource_id UUID, -- Optional: link to marc_records.id
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed_at TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_short_urls_resource ON short_urls(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_created ON short_urls(created_at DESC);

-- Function to generate unique short code
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS VARCHAR(10) AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result VARCHAR(10) := '';
    i INTEGER;
BEGIN
    -- Generate 6-character code
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create or get short URL
CREATE OR REPLACE FUNCTION create_short_url(
    p_full_url TEXT,
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL
)
RETURNS VARCHAR(10) AS $$
DECLARE
    v_code VARCHAR(10);
    v_exists BOOLEAN;
    v_attempts INTEGER := 0;
BEGIN
    -- Check if URL already exists
    SELECT code INTO v_code
    FROM short_urls
    WHERE full_url = p_full_url
    LIMIT 1;

    IF v_code IS NOT NULL THEN
        RETURN v_code;
    END IF;

    -- Generate new code with collision detection
    LOOP
        v_code := generate_short_code();
        v_attempts := v_attempts + 1;

        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM short_urls WHERE code = v_code) INTO v_exists;

        -- If unique, insert and return
        IF NOT v_exists THEN
            INSERT INTO short_urls (code, full_url, resource_type, resource_id)
            VALUES (v_code, p_full_url, p_resource_type, p_resource_id);

            RETURN v_code;
        END IF;

        -- Safety: max 10 attempts
        IF v_attempts >= 10 THEN
            RAISE EXCEPTION 'Failed to generate unique short code after 10 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to track access
CREATE OR REPLACE FUNCTION track_short_url_access(p_code VARCHAR(10))
RETURNS TEXT AS $$
DECLARE
    v_url TEXT;
BEGIN
    UPDATE short_urls
    SET
        last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE code = p_code
    RETURNING full_url INTO v_url;

    RETURN v_url;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for redirects)
CREATE POLICY "Public can read short URLs"
    ON short_urls
    FOR SELECT
    TO public
    USING (true);

-- Allow authenticated users to create short URLs
CREATE POLICY "Authenticated users can create short URLs"
    ON short_urls
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow anon users to create short URLs (for public catalog)
CREATE POLICY "Anon users can create short URLs"
    ON short_urls
    FOR INSERT
    TO anon
    WITH CHECK (true);

COMMENT ON TABLE short_urls IS 'Short URL mappings for email sharing and mobile access';
COMMENT ON FUNCTION create_short_url IS 'Create or retrieve short URL code for a given full URL';
COMMENT ON FUNCTION track_short_url_access IS 'Track access and return full URL for a short code';
