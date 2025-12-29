-- Migration: Enhanced Receiving Workflow
-- Adds support for detailed receiving tracking, item creation, and automatic status updates

-- Add receiving tracking fields to order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS receiving_notes TEXT,
ADD COLUMN IF NOT EXISTS received_by TEXT,
ADD COLUMN IF NOT EXISTS last_received_at TIMESTAMPTZ;

-- Create receiving history table to track all receiving actions
CREATE TABLE IF NOT EXISTS receiving_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    acquisition_order_id UUID NOT NULL REFERENCES acquisition_orders(id) ON DELETE CASCADE,
    quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'received', 'backordered', 'cancelled'
    notes TEXT,
    items_created INTEGER DEFAULT 0, -- Number of item records created
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receiving_history_order_item ON receiving_history(order_item_id);
CREATE INDEX idx_receiving_history_order ON receiving_history(acquisition_order_id);
CREATE INDEX idx_receiving_history_date ON receiving_history(received_date);

-- Create claims table for tracking overdue orders
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acquisition_order_id UUID NOT NULL REFERENCES acquisition_orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    claim_type VARCHAR(50) NOT NULL, -- 'overdue', 'missing', 'damaged'
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    days_overdue INTEGER,
    claim_method VARCHAR(50), -- 'email', 'phone', 'letter'
    claimed_by TEXT NOT NULL,
    vendor_response TEXT,
    response_date DATE,
    resolution VARCHAR(50), -- 'received', 'refunded', 'cancelled', 'pending'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_order ON claims(acquisition_order_id);
CREATE INDEX idx_claims_order_item ON claims(order_item_id);
CREATE INDEX idx_claims_resolution ON claims(resolution);
CREATE INDEX idx_claims_date ON claims(claim_date);

-- Function to generate unique barcodes for items
CREATE OR REPLACE FUNCTION generate_barcode()
RETURNS TEXT AS $$
DECLARE
    new_barcode TEXT;
    barcode_exists BOOLEAN;
BEGIN
    LOOP
        -- Format: ILS-YYYYMMDD-XXXX (e.g., ILS-20250115-0001)
        new_barcode := 'ILS-' ||
                      TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

        -- Check if barcode already exists
        SELECT EXISTS(SELECT 1 FROM items WHERE barcode = new_barcode) INTO barcode_exists;

        -- If unique, return it
        IF NOT barcode_exists THEN
            RETURN new_barcode;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update order status based on item statuses
CREATE OR REPLACE FUNCTION update_order_status_on_receive()
RETURNS TRIGGER AS $$
DECLARE
    order_id UUID;
    total_items INTEGER;
    received_items INTEGER;
    cancelled_items INTEGER;
    backordered_items INTEGER;
    new_status VARCHAR(50);
BEGIN
    -- Get the order ID
    order_id := NEW.acquisition_order_id;

    -- Count items by status
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'received') as received,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'backordered') as backordered
    INTO total_items, received_items, cancelled_items, backordered_items
    FROM order_items
    WHERE acquisition_order_id = order_id;

    -- Determine new order status
    IF received_items = total_items THEN
        new_status := 'received';
    ELSIF cancelled_items = total_items THEN
        new_status := 'cancelled';
    ELSIF received_items > 0 OR cancelled_items > 0 THEN
        new_status := 'partial';
    ELSE
        new_status := 'ordered';
    END IF;

    -- Update order status
    UPDATE acquisition_orders
    SET status = new_status,
        received_date = CASE
            WHEN new_status = 'received' THEN CURRENT_DATE
            ELSE received_date
        END
    WHERE id = order_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update order status when items are received
DROP TRIGGER IF EXISTS trigger_update_order_status ON order_items;
CREATE TRIGGER trigger_update_order_status
    AFTER UPDATE OF status, quantity_received ON order_items
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.quantity_received IS DISTINCT FROM NEW.quantity_received)
    EXECUTE FUNCTION update_order_status_on_receive();

-- Function to update claims updated_at timestamp
CREATE OR REPLACE FUNCTION update_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update claims updated_at
CREATE TRIGGER trigger_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_claims_updated_at();

-- Add invoice line items table for invoice matching
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    isbn VARCHAR(20),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percent DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0),
    matched BOOLEAN DEFAULT FALSE,
    discrepancy_type VARCHAR(50), -- 'price_difference', 'quantity_difference', 'not_ordered', 'duplicate', null if no discrepancy
    discrepancy_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_order_item ON invoice_line_items(order_item_id);
CREATE INDEX idx_invoice_line_items_matched ON invoice_line_items(matched);

-- Add approval fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS approved_for_payment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'approved', 'paid', 'disputed'

-- Function to calculate invoice line total
CREATE OR REPLACE FUNCTION calculate_invoice_line_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.line_total := (NEW.quantity * NEW.unit_price) * (1 - NEW.discount_percent / 100.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate invoice line totals
CREATE TRIGGER trigger_calculate_invoice_line_total
    BEFORE INSERT OR UPDATE OF quantity, unit_price, discount_percent ON invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_line_total();

COMMENT ON TABLE receiving_history IS 'Tracks all receiving actions for audit and history';
COMMENT ON TABLE claims IS 'Tracks claims for overdue, missing, or damaged orders';
COMMENT ON TABLE invoice_line_items IS 'Line items for invoices to enable order matching and discrepancy detection';
COMMENT ON FUNCTION generate_barcode() IS 'Generates unique barcodes for physical items';
COMMENT ON FUNCTION update_order_status_on_receive() IS 'Automatically updates order status based on item receiving status';
