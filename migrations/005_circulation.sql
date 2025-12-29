-- Circulation System Migration
-- Run this in Supabase SQL Editor
-- This creates tables for patrons, checkouts, and holds

-- 1. Patron Types table (defines borrowing limits and loan periods)
CREATE TABLE patron_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Type Information
  name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'student', 'faculty', 'staff', 'public'
  description TEXT,

  -- Borrowing Limits
  max_checkouts INTEGER DEFAULT 5,
  max_renewals INTEGER DEFAULT 2,
  max_holds INTEGER DEFAULT 5,

  -- Loan Periods (in days)
  default_loan_period_days INTEGER DEFAULT 14,

  -- Status
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert default patron types
INSERT INTO patron_types (name, description, max_checkouts, max_renewals, max_holds, default_loan_period_days) VALUES
  ('student', 'Student patrons', 5, 2, 5, 14),
  ('faculty', 'Faculty members', 20, 3, 10, 90),
  ('staff', 'Staff members', 10, 3, 8, 30),
  ('public', 'General public', 3, 1, 3, 7);

-- 2. Patrons table
CREATE TABLE patrons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Library Card
  barcode VARCHAR(50) UNIQUE NOT NULL,

  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),

  -- Patron Type
  patron_type_id UUID REFERENCES patron_types(id) NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  -- Possible values: active, expired, blocked, suspended

  -- Dates
  registration_date DATE DEFAULT CURRENT_DATE,
  expiration_date DATE,

  -- Notes
  notes TEXT,
  staff_notes TEXT, -- Internal only

  -- Authentication (for patron self-service)
  user_id UUID REFERENCES auth.users(id), -- Links to Supabase auth

  -- Fine/Fee balance
  balance DECIMAL(10,2) DEFAULT 0.00
);

-- Indexes
CREATE INDEX idx_patrons_barcode ON patrons(barcode);
CREATE INDEX idx_patrons_email ON patrons(email);
CREATE INDEX idx_patrons_status ON patrons(status);
CREATE INDEX idx_patrons_type ON patrons(patron_type_id);
CREATE INDEX idx_patrons_user_id ON patrons(user_id);
CREATE INDEX idx_patrons_name ON patrons(last_name, first_name);

-- 3. Checkouts table
CREATE TABLE checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- References
  item_id UUID REFERENCES items(id) NOT NULL,
  patron_id UUID REFERENCES patrons(id) NOT NULL,

  -- Dates
  checkout_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,

  -- Renewal tracking
  renewal_count INTEGER DEFAULT 0,
  last_renewal_date TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) DEFAULT 'checked_out' NOT NULL,
  -- Possible values: checked_out, returned, overdue, lost, claimed_returned

  -- Staff tracking
  checkout_staff_id UUID REFERENCES auth.users(id),
  checkin_staff_id UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT
);

-- Indexes
CREATE INDEX idx_checkouts_item ON checkouts(item_id);
CREATE INDEX idx_checkouts_patron ON checkouts(patron_id);
CREATE INDEX idx_checkouts_status ON checkouts(status);
CREATE INDEX idx_checkouts_due_date ON checkouts(due_date);
CREATE INDEX idx_checkouts_checkout_date ON checkouts(checkout_date);

-- Composite indexes for common queries
CREATE INDEX idx_checkouts_patron_status ON checkouts(patron_id, status);
CREATE INDEX idx_checkouts_item_status ON checkouts(item_id, status);

-- 4. Holds table
CREATE TABLE holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- References
  marc_record_id UUID REFERENCES marc_records(id) NOT NULL,
  patron_id UUID REFERENCES patrons(id) NOT NULL,
  item_id UUID REFERENCES items(id), -- Filled when item is trapped for this hold

  -- Dates
  hold_date TIMESTAMPTZ DEFAULT NOW(),
  expiration_date TIMESTAMPTZ, -- When hold expires if not picked up
  pickup_date TIMESTAMPTZ,
  cancellation_date TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) DEFAULT 'placed' NOT NULL,
  -- Possible values: placed, in_transit, available, picked_up, expired, cancelled

  -- Queue position (for FIFO)
  queue_position INTEGER,

  -- Pickup location
  pickup_location VARCHAR(100),

  -- Notes
  notes TEXT,
  staff_notes TEXT
);

-- Indexes
CREATE INDEX idx_holds_marc_record ON holds(marc_record_id);
CREATE INDEX idx_holds_patron ON holds(patron_id);
CREATE INDEX idx_holds_item ON holds(item_id);
CREATE INDEX idx_holds_status ON holds(status);
CREATE INDEX idx_holds_hold_date ON holds(hold_date);
CREATE INDEX idx_holds_queue_position ON holds(queue_position);

-- Composite indexes
CREATE INDEX idx_holds_marc_status ON holds(marc_record_id, status);
CREATE INDEX idx_holds_patron_status ON holds(patron_id, status);

-- 5. Circulation History (for audit trail)
CREATE TABLE circulation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- References
  checkout_id UUID REFERENCES checkouts(id),
  item_id UUID REFERENCES items(id) NOT NULL,
  patron_id UUID REFERENCES patrons(id) NOT NULL,

  -- Action
  action VARCHAR(50) NOT NULL,
  -- Possible values: checkout, checkin, renew, overdue, lost, claimed_returned

  -- Details
  action_date TIMESTAMPTZ DEFAULT NOW(),
  staff_id UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_circ_history_checkout ON circulation_history(checkout_id);
CREATE INDEX idx_circ_history_item ON circulation_history(item_id);
CREATE INDEX idx_circ_history_patron ON circulation_history(patron_id);
CREATE INDEX idx_circ_history_action_date ON circulation_history(action_date);

-- Row Level Security
ALTER TABLE patron_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrons ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE circulation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Patron Types: Public can view, authenticated can manage
CREATE POLICY "Public can view patron types"
  ON patron_types FOR SELECT
  TO public
  USING (is_active = TRUE);

CREATE POLICY "Authenticated users can manage patron types"
  ON patron_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Patrons: Patrons can view their own record, staff can manage all
CREATE POLICY "Patrons can view their own record"
  ON patrons FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view all patrons"
  ON patrons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage patrons"
  ON patrons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Checkouts: Patrons can view their own, staff can manage all
CREATE POLICY "Patrons can view their own checkouts"
  ON checkouts FOR SELECT
  TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage checkouts"
  ON checkouts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Holds: Patrons can view their own, staff can manage all
CREATE POLICY "Patrons can view their own holds"
  ON holds FOR SELECT
  TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons can place holds"
  ON holds FOR INSERT
  TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons can cancel their own holds"
  ON holds FOR UPDATE
  TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage holds"
  ON holds FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Circulation History: Staff only
CREATE POLICY "Staff can view circulation history"
  ON circulation_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can add to circulation history"
  ON circulation_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER patron_types_updated_at
  BEFORE UPDATE ON patron_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER patrons_updated_at
  BEFORE UPDATE ON patrons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER checkouts_updated_at
  BEFORE UPDATE ON checkouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER holds_updated_at
  BEFORE UPDATE ON holds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate library card barcodes
CREATE OR REPLACE FUNCTION generate_patron_barcode()
RETURNS VARCHAR AS $$
DECLARE
  new_barcode VARCHAR;
  barcode_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 14-digit barcode starting with '2' for patrons
    new_barcode := '2' || LPAD(FLOOR(RANDOM() * 9999999999999)::TEXT, 13, '0');

    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM patrons WHERE barcode = new_barcode) INTO barcode_exists;

    -- If it doesn't exist, return it
    IF NOT barcode_exists THEN
      RETURN new_barcode;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update item status when checked out
CREATE OR REPLACE FUNCTION update_item_status_on_checkout()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update item status to checked_out
    UPDATE items
    SET status = 'checked_out',
        last_checkout_date = NEW.checkout_date,
        checkout_count = checkout_count + 1
    WHERE id = NEW.item_id;

    -- Log to circulation history
    INSERT INTO circulation_history (checkout_id, item_id, patron_id, action, staff_id)
    VALUES (NEW.id, NEW.item_id, NEW.patron_id, 'checkout', NEW.checkout_staff_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checkout_updates_item_status
  AFTER INSERT ON checkouts
  FOR EACH ROW
  EXECUTE FUNCTION update_item_status_on_checkout();

-- Function to update item status when checked in
CREATE OR REPLACE FUNCTION update_item_status_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  next_hold RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.return_date IS NULL AND NEW.return_date IS NOT NULL THEN
    -- Check if there's a hold on this item's MARC record
    SELECT h.* INTO next_hold
    FROM holds h
    JOIN items i ON h.marc_record_id = i.marc_record_id
    WHERE i.id = NEW.item_id
      AND h.status = 'placed'
    ORDER BY h.queue_position, h.hold_date
    LIMIT 1;

    IF FOUND THEN
      -- Update item to on_hold and assign to hold
      UPDATE items SET status = 'on_hold' WHERE id = NEW.item_id;
      UPDATE holds SET status = 'available', item_id = NEW.item_id WHERE id = next_hold.id;
    ELSE
      -- No holds, set to available
      UPDATE items SET status = 'available' WHERE id = NEW.item_id;
    END IF;

    -- Log to circulation history
    INSERT INTO circulation_history (checkout_id, item_id, patron_id, action, staff_id)
    VALUES (NEW.id, NEW.item_id, NEW.patron_id, 'checkin', NEW.checkin_staff_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checkin_updates_item_status
  AFTER UPDATE ON checkouts
  FOR EACH ROW
  EXECUTE FUNCTION update_item_status_on_checkin();

-- Function to update checkout status to overdue
CREATE OR REPLACE FUNCTION check_overdue_items()
RETURNS void AS $$
BEGIN
  UPDATE checkouts
  SET status = 'overdue'
  WHERE status = 'checked_out'
    AND due_date < NOW()
    AND return_date IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to manage hold queue positions
CREATE OR REPLACE FUNCTION update_hold_queue_position()
RETURNS TRIGGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the max queue position for this MARC record
    SELECT COALESCE(MAX(queue_position), 0) INTO max_position
    FROM holds
    WHERE marc_record_id = NEW.marc_record_id
      AND status IN ('placed', 'in_transit', 'available');

    -- Set new hold's queue position
    NEW.queue_position := max_position + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hold_queue_position
  BEFORE INSERT ON holds
  FOR EACH ROW
  EXECUTE FUNCTION update_hold_queue_position();

-- Function to log renewals
CREATE OR REPLACE FUNCTION log_renewal()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.renewal_count > OLD.renewal_count THEN
    INSERT INTO circulation_history (checkout_id, item_id, patron_id, action, notes)
    VALUES (NEW.id, NEW.item_id, NEW.patron_id, 'renew',
            'Renewed. New due date: ' || NEW.due_date);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER renewal_logging
  AFTER UPDATE ON checkouts
  FOR EACH ROW
  EXECUTE FUNCTION log_renewal();

-- Views for common queries

-- View for current checkouts with patron and item details
CREATE OR REPLACE VIEW current_checkouts AS
SELECT
  c.id,
  c.checkout_date,
  c.due_date,
  c.renewal_count,
  c.status,
  CASE
    WHEN c.due_date < NOW() AND c.status = 'checked_out' THEN 'overdue'
    WHEN c.due_date < NOW() + INTERVAL '3 days' AND c.status = 'checked_out' THEN 'due_soon'
    ELSE 'ok'
  END as urgency,
  p.id as patron_id,
  p.barcode as patron_barcode,
  p.first_name,
  p.last_name,
  p.email,
  i.id as item_id,
  i.barcode as item_barcode,
  i.call_number,
  m.title_statement,
  m.main_entry_personal_name
FROM checkouts c
JOIN patrons p ON c.patron_id = p.id
JOIN items i ON c.item_id = i.id
JOIN marc_records m ON i.marc_record_id = m.id
WHERE c.status IN ('checked_out', 'overdue');

-- View for active holds with patron and title details
CREATE OR REPLACE VIEW active_holds AS
SELECT
  h.id,
  h.hold_date,
  h.status,
  h.queue_position,
  h.pickup_location,
  p.id as patron_id,
  p.barcode as patron_barcode,
  p.first_name,
  p.last_name,
  p.email,
  m.id as marc_record_id,
  m.title_statement,
  m.main_entry_personal_name,
  i.id as item_id,
  i.barcode as item_barcode
FROM holds h
JOIN patrons p ON h.patron_id = p.id
JOIN marc_records m ON h.marc_record_id = m.id
LEFT JOIN items i ON h.item_id = i.id
WHERE h.status IN ('placed', 'in_transit', 'available');

-- View for patron account summary
CREATE OR REPLACE VIEW patron_account_summary AS
SELECT
  p.id,
  p.barcode,
  p.first_name,
  p.last_name,
  p.email,
  p.status,
  pt.name as patron_type,
  pt.max_checkouts,
  pt.max_holds,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('checked_out', 'overdue')) as current_checkouts,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'overdue') as overdue_count,
  COUNT(DISTINCT h.id) FILTER (WHERE h.status IN ('placed', 'in_transit', 'available')) as active_holds,
  p.balance
FROM patrons p
JOIN patron_types pt ON p.patron_type_id = pt.id
LEFT JOIN checkouts c ON p.id = c.patron_id
LEFT JOIN holds h ON p.id = h.patron_id
GROUP BY p.id, pt.name, pt.max_checkouts, pt.max_holds;

-- Grant permissions on views
GRANT SELECT ON current_checkouts TO authenticated;
GRANT SELECT ON active_holds TO authenticated;
GRANT SELECT ON patron_account_summary TO authenticated;
