-- Reading Lists Migration
-- Allows patrons to create personal reading/research lists

-- Reading Lists Table
CREATE TABLE reading_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reading List Items Table
CREATE TABLE reading_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    marc_record_id UUID NOT NULL REFERENCES marc_records(id) ON DELETE CASCADE,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_reading_lists_patron ON reading_lists(patron_id);
CREATE INDEX idx_reading_lists_public ON reading_lists(is_public) WHERE is_public = true;
CREATE INDEX idx_reading_list_items_list ON reading_list_items(list_id);
CREATE INDEX idx_reading_list_items_record ON reading_list_items(marc_record_id);
CREATE INDEX idx_reading_list_items_sort ON reading_list_items(list_id, sort_order);

-- Composite unique constraint to prevent duplicate items in a list
CREATE UNIQUE INDEX idx_unique_list_item ON reading_list_items(list_id, marc_record_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reading_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reading_list_updated_at
    BEFORE UPDATE ON reading_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_reading_list_timestamp();

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE reading_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_list_items ENABLE ROW LEVEL SECURITY;

-- Reading Lists Policies
-- Patrons can view their own lists
CREATE POLICY "Patrons can view own lists"
    ON reading_lists FOR SELECT
    USING (auth.uid() = patron_id);

-- Patrons can view public lists
CREATE POLICY "Anyone can view public lists"
    ON reading_lists FOR SELECT
    USING (is_public = true);

-- Patrons can create their own lists
CREATE POLICY "Patrons can create own lists"
    ON reading_lists FOR INSERT
    WITH CHECK (auth.uid() = patron_id);

-- Patrons can update their own lists
CREATE POLICY "Patrons can update own lists"
    ON reading_lists FOR UPDATE
    USING (auth.uid() = patron_id)
    WITH CHECK (auth.uid() = patron_id);

-- Patrons can delete their own lists
CREATE POLICY "Patrons can delete own lists"
    ON reading_lists FOR DELETE
    USING (auth.uid() = patron_id);

-- Staff can view all lists
CREATE POLICY "Staff can view all lists"
    ON reading_lists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM patrons
            WHERE id = auth.uid()
            AND patron_type IN ('staff', 'admin')
        )
    );

-- Reading List Items Policies
-- Patrons can view items in their own lists
CREATE POLICY "Patrons can view own list items"
    ON reading_list_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reading_lists
            WHERE id = reading_list_items.list_id
            AND patron_id = auth.uid()
        )
    );

-- Anyone can view items in public lists
CREATE POLICY "Anyone can view public list items"
    ON reading_list_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reading_lists
            WHERE id = reading_list_items.list_id
            AND is_public = true
        )
    );

-- Patrons can add items to their own lists
CREATE POLICY "Patrons can add to own lists"
    ON reading_list_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reading_lists
            WHERE id = reading_list_items.list_id
            AND patron_id = auth.uid()
        )
    );

-- Patrons can update items in their own lists
CREATE POLICY "Patrons can update own list items"
    ON reading_list_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM reading_lists
            WHERE id = reading_list_items.list_id
            AND patron_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reading_lists
            WHERE id = reading_list_items.list_id
            AND patron_id = auth.uid()
        )
    );

-- Patrons can delete items from their own lists
CREATE POLICY "Patrons can delete own list items"
    ON reading_list_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM reading_lists
            WHERE id = reading_list_items.list_id
            AND patron_id = auth.uid()
        )
    );

-- Staff can view all list items
CREATE POLICY "Staff can view all list items"
    ON reading_list_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM patrons
            WHERE id = auth.uid()
            AND patron_type IN ('staff', 'admin')
        )
    );

-- View for list statistics
CREATE OR REPLACE VIEW reading_list_stats AS
SELECT
    rl.id as list_id,
    rl.name,
    rl.description,
    rl.is_public,
    rl.patron_id,
    rl.created_at,
    rl.updated_at,
    COUNT(rli.id) as item_count,
    p.first_name || ' ' || p.last_name as patron_name
FROM reading_lists rl
LEFT JOIN reading_list_items rli ON rl.id = rli.list_id
LEFT JOIN patrons p ON rl.patron_id = p.id
GROUP BY rl.id, rl.name, rl.description, rl.is_public, rl.patron_id,
         rl.created_at, rl.updated_at, p.first_name, p.last_name;

-- Grant permissions
GRANT SELECT ON reading_list_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reading_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reading_list_items TO authenticated;

-- Comments for documentation
COMMENT ON TABLE reading_lists IS 'Patron-created reading and research lists';
COMMENT ON TABLE reading_list_items IS 'Items in reading lists';
COMMENT ON COLUMN reading_lists.is_public IS 'Whether the list is publicly viewable via permalink';
COMMENT ON COLUMN reading_list_items.sort_order IS 'Custom sort order within the list';
COMMENT ON VIEW reading_list_stats IS 'Aggregated statistics for reading lists';
