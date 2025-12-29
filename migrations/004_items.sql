-- Item-Level Holdings Migration
-- Run this in Supabase SQL Editor
-- This creates the items table to track individual physical copies of catalog records

-- 1. Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Link to MARC record
  marc_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE NOT NULL,

  -- Identification
  barcode VARCHAR(50) UNIQUE NOT NULL,
  copy_number VARCHAR(20), -- e.g., "c.1", "c.2"

  -- Classification
  call_number VARCHAR(100), -- Can override MARC record call number

  -- Location
  location VARCHAR(100), -- e.g., "Main Stacks", "Reference", "Children's"
  collection VARCHAR(100), -- e.g., "General", "Reserve", "Special Collections"
  shelving_location VARCHAR(100), -- Specific shelf/area

  -- Status
  status VARCHAR(50) DEFAULT 'available' NOT NULL,
  -- Possible values: available, checked_out, on_hold, in_transit, lost,
  -- damaged, missing, on_order, in_processing, withdrawn, bindery

  -- Condition
  condition VARCHAR(50) DEFAULT 'good',
  -- Possible values: new, good, fair, poor, damaged
  condition_notes TEXT,

  -- Financial
  price DECIMAL(10,2),
  replacement_cost DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',

  -- Acquisition
  acquisition_date DATE,
  acquisition_source VARCHAR(255),
  vendor_id UUID REFERENCES vendors(id),

  -- Physical details
  material_type VARCHAR(50) DEFAULT 'book',
  -- Possible values: book, dvd, cd, audiobook, magazine, map, etc.

  -- Circulation restrictions
  circulation_status VARCHAR(50) DEFAULT 'circulating',
  -- Possible values: circulating, non-circulating, reference_only, library_use_only
  loan_period_days INTEGER, -- Override default loan period

  -- Notes
  public_notes TEXT, -- Visible to patrons
  staff_notes TEXT, -- Internal only

  -- Tracking
  last_inventory_date DATE,
  last_checkout_date TIMESTAMPTZ,
  checkout_count INTEGER DEFAULT 0,

  -- Withdrawn/deleted tracking
  withdrawn_date DATE,
  withdrawn_reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_items_marc_record ON items(marc_record_id);
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_location ON items(location);
CREATE INDEX idx_items_call_number ON items(call_number);
CREATE INDEX idx_items_collection ON items(collection);
CREATE INDEX idx_items_material_type ON items(material_type);
CREATE INDEX idx_items_circulation_status ON items(circulation_status);

-- Composite indexes for common queries
CREATE INDEX idx_items_status_location ON items(status, location);
CREATE INDEX idx_items_marc_status ON items(marc_record_id, status);

-- Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view available items
CREATE POLICY "Public can view available items"
  ON items FOR SELECT
  TO public
  USING (status IN ('available', 'checked_out', 'on_hold'));

-- Authenticated users (staff) can manage all items
CREATE POLICY "Authenticated users can manage items"
  ON items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to auto-generate barcodes if needed
CREATE OR REPLACE FUNCTION generate_barcode()
RETURNS VARCHAR AS $$
DECLARE
  new_barcode VARCHAR;
  barcode_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 14-digit barcode
    new_barcode := LPAD(FLOOR(RANDOM() * 99999999999999)::TEXT, 14, '0');

    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM items WHERE barcode = new_barcode) INTO barcode_exists;

    -- If it doesn't exist, return it
    IF NOT barcode_exists THEN
      RETURN new_barcode;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for item availability summary
CREATE OR REPLACE VIEW item_availability AS
SELECT
  marc_record_id,
  COUNT(*) as total_copies,
  COUNT(*) FILTER (WHERE status = 'available') as available_copies,
  COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out_copies,
  COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_copies,
  COUNT(*) FILTER (WHERE status IN ('lost', 'damaged', 'missing', 'withdrawn')) as unavailable_copies
FROM items
GROUP BY marc_record_id;

-- Grant permissions on view
GRANT SELECT ON item_availability TO public;
GRANT SELECT ON item_availability TO authenticated;
