-- Migration 018: Interlibrary Loan (ILL) Module
-- Comprehensive ILL system for borrowing and lending materials between libraries
-- Created: 2025-12-30

-- ============================================================================
-- TABLES
-- ============================================================================

-- Partner Libraries Table
-- Stores information about libraries we participate in ILL with
CREATE TABLE ill_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Library identification
  library_name VARCHAR(255) NOT NULL,
  library_code VARCHAR(50) UNIQUE, -- e.g., OCLC symbol
  library_type VARCHAR(50), -- academic, public, special, etc.

  -- Contact information
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',

  -- ILL specific
  ill_email VARCHAR(255), -- Dedicated ILL email
  ill_phone VARCHAR(50),
  shipping_notes TEXT, -- Special shipping instructions

  -- Agreement details
  agreement_type VARCHAR(50), -- reciprocal, fee-based, consortial
  lending_allowed BOOLEAN DEFAULT true,
  borrowing_allowed BOOLEAN DEFAULT true,
  max_loans_per_patron INTEGER DEFAULT 5,
  loan_period_days INTEGER DEFAULT 21,
  renewal_allowed BOOLEAN DEFAULT true,

  -- Statistics
  total_borrowed INTEGER DEFAULT 0,
  total_lent INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ILL Requests Table
-- Tracks both borrowing (we need) and lending (they need) requests
CREATE TABLE ill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Request type
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('borrowing', 'lending')),

  -- For borrowing: our patron who needs it
  -- For lending: their patron (optional, can be anonymous)
  patron_id UUID REFERENCES patrons(id),
  patron_name VARCHAR(255), -- For lending requests from external patrons
  patron_email VARCHAR(255),

  -- Partner library
  partner_library_id UUID REFERENCES ill_partners(id),
  partner_library_name VARCHAR(255), -- Cached for display

  -- Item being requested
  marc_record_id UUID REFERENCES marc_records(id), -- Our catalog record (if exists)
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  isbn VARCHAR(20),
  issn VARCHAR(20),
  publisher VARCHAR(255),
  publication_year VARCHAR(10),
  edition VARCHAR(100),
  material_type VARCHAR(50), -- book, article, dvd, etc.

  -- Request details
  needed_by_date DATE,
  pickup_location VARCHAR(255),
  notes TEXT,
  internal_notes TEXT, -- Staff notes

  -- Status workflow
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Initial state, needs review
    'approved',       -- Approved by staff
    'requested',      -- Request sent to partner library
    'shipped',        -- Item shipped
    'received',       -- Item received at our library
    'available',      -- Ready for patron pickup
    'checked_out',    -- Patron has the item
    'returned',       -- Patron returned, ready to ship back
    'completed',      -- Returned to lending library
    'cancelled',      -- Request cancelled
    'denied'          -- Request denied
  )),

  -- Dates
  requested_date DATE,
  approved_date DATE,
  shipped_date DATE,
  received_date DATE,
  due_date DATE,
  returned_date DATE,
  completed_date DATE,

  -- Fees
  fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  fee_paid BOOLEAN DEFAULT false,
  fee_notes TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ILL Shipments Table
-- Tracks shipping information for ILL requests
CREATE TABLE ill_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Associated request
  ill_request_id UUID NOT NULL REFERENCES ill_requests(id) ON DELETE CASCADE,

  -- Shipment direction
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('outgoing', 'incoming')),

  -- Carrier information
  carrier VARCHAR(100), -- USPS, UPS, FedEx, etc.
  tracking_number VARCHAR(255),
  tracking_url TEXT,
  service_type VARCHAR(100), -- Priority Mail, Ground, etc.

  -- Dates
  shipped_date DATE,
  expected_arrival_date DATE,
  actual_arrival_date DATE,

  -- Package details
  weight_oz DECIMAL(10, 2),
  packaging_type VARCHAR(100), -- box, envelope, tube
  insured_value DECIMAL(10, 2),

  -- Cost
  shipping_cost DECIMAL(10, 2),

  -- Notes
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes
CREATE INDEX idx_ill_requests_patron ON ill_requests(patron_id);
CREATE INDEX idx_ill_requests_partner ON ill_requests(partner_library_id);
CREATE INDEX idx_ill_requests_marc ON ill_requests(marc_record_id);
CREATE INDEX idx_ill_requests_status ON ill_requests(status);
CREATE INDEX idx_ill_requests_type ON ill_requests(request_type);
CREATE INDEX idx_ill_requests_created ON ill_requests(created_at);
CREATE INDEX idx_ill_requests_type_status ON ill_requests(request_type, status);

CREATE INDEX idx_ill_shipments_request ON ill_shipments(ill_request_id);
CREATE INDEX idx_ill_shipments_tracking ON ill_shipments(tracking_number);

CREATE INDEX idx_ill_partners_active ON ill_partners(is_active);
CREATE INDEX idx_ill_partners_code ON ill_partners(library_code);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE ill_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE ill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ill_shipments ENABLE ROW LEVEL SECURITY;

-- Partner libraries policies
CREATE POLICY "Public read access to active partners"
  ON ill_partners FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage partners"
  ON ill_partners FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ILL requests policies
-- Patrons can view their own requests
CREATE POLICY "Patrons can view own ILL requests"
  ON ill_requests FOR SELECT
  TO authenticated
  USING (patron_id = auth.uid() OR patron_email = auth.jwt() ->> 'email');

-- Patrons can create borrowing requests
CREATE POLICY "Patrons can create borrowing requests"
  ON ill_requests FOR INSERT
  TO authenticated
  WITH CHECK (request_type = 'borrowing' AND patron_id = auth.uid());

-- Staff can manage all requests
CREATE POLICY "Authenticated users can manage all ILL requests"
  ON ill_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Shipments policies
CREATE POLICY "Authenticated users can view all shipments"
  ON ill_shipments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage shipments"
  ON ill_shipments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update partner statistics
CREATE OR REPLACE FUNCTION update_partner_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.request_type = 'borrowing' THEN
      UPDATE ill_partners
      SET total_borrowed = total_borrowed + 1
      WHERE id = NEW.partner_library_id;
    ELSIF NEW.request_type = 'lending' THEN
      UPDATE ill_partners
      SET total_lent = total_lent + 1
      WHERE id = NEW.partner_library_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update partner statistics
CREATE TRIGGER trigger_update_partner_statistics
  AFTER UPDATE ON ill_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_statistics();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_ill_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamp updates
CREATE TRIGGER trigger_ill_partners_timestamp
  BEFORE UPDATE ON ill_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_ill_timestamp();

CREATE TRIGGER trigger_ill_requests_timestamp
  BEFORE UPDATE ON ill_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_ill_timestamp();

CREATE TRIGGER trigger_ill_shipments_timestamp
  BEFORE UPDATE ON ill_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_ill_timestamp();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert sample partner libraries
INSERT INTO ill_partners (
  library_name,
  library_code,
  library_type,
  contact_name,
  contact_email,
  ill_email,
  city,
  state,
  agreement_type,
  is_active
) VALUES
  (
    'State University Library',
    'STU',
    'academic',
    'ILL Department',
    'ill@stateuniversity.edu',
    'ill@stateuniversity.edu',
    'University City',
    'CA',
    'reciprocal',
    true
  ),
  (
    'City Public Library System',
    'CPL',
    'public',
    'Reference Desk',
    'reference@citylibrary.org',
    'ill@citylibrary.org',
    'Metro City',
    'NY',
    'consortial',
    true
  ),
  (
    'County Library Network',
    'CLN',
    'public',
    'ILL Coordinator',
    'ill@countylib.gov',
    'ill@countylib.gov',
    'County Seat',
    'TX',
    'reciprocal',
    true
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ill_partners IS 'Partner libraries participating in interlibrary loan agreements';
COMMENT ON TABLE ill_requests IS 'ILL requests for borrowing and lending materials between libraries';
COMMENT ON TABLE ill_shipments IS 'Shipping tracking information for ILL requests';

COMMENT ON COLUMN ill_requests.request_type IS 'Type: borrowing (we need from them) or lending (they need from us)';
COMMENT ON COLUMN ill_requests.status IS 'Request workflow status from pending to completed';
COMMENT ON COLUMN ill_shipments.direction IS 'Direction: outgoing (we ship) or incoming (we receive)';
