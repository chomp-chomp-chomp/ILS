-- Acquisitions Module Migration
-- Run this in Supabase SQL Editor

-- 1. Vendors table
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Basic Information
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',

  -- Contact Information
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  fax VARCHAR(50),
  website TEXT,

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),

  -- Business Details
  tax_id VARCHAR(50),
  payment_terms VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'USD',
  discount_percent DECIMAL(5,2),

  -- Notes
  notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_vendors_code ON vendors(code);
CREATE INDEX idx_vendors_status ON vendors(status);

-- 2. Budgets table
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Budget Information
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  fiscal_year INTEGER NOT NULL,

  -- Amounts
  allocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  spent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  encumbered_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Categorization
  category VARCHAR(100),
  department VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  -- Notes
  notes TEXT
);

CREATE INDEX idx_budgets_fiscal_year ON budgets(fiscal_year);
CREATE INDEX idx_budgets_status ON budgets(status);

-- 3. Acquisition Orders table
CREATE TABLE acquisition_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Order Information
  order_number VARCHAR(100) UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  budget_id UUID REFERENCES budgets(id),

  -- Dates
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  received_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',

  -- Financial
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  shipping_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,

  -- Shipping
  shipping_address TEXT,
  shipping_method VARCHAR(100),

  -- Reference
  vendor_order_number VARCHAR(100),

  -- Notes
  notes TEXT,

  -- User tracking
  ordered_by VARCHAR(255)
);

CREATE INDEX idx_orders_vendor ON acquisition_orders(vendor_id);
CREATE INDEX idx_orders_budget ON acquisition_orders(budget_id);
CREATE INDEX idx_orders_status ON acquisition_orders(status);
CREATE INDEX idx_orders_order_date ON acquisition_orders(order_date);

-- 4. Order Items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  acquisition_order_id UUID REFERENCES acquisition_orders(id) ON DELETE CASCADE,
  marc_record_id UUID REFERENCES marc_records(id),

  -- Item Details
  title VARCHAR(500),
  author VARCHAR(255),
  isbn VARCHAR(20),
  publisher VARCHAR(255),
  publication_year VARCHAR(10),

  -- Order Details
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(10,2),

  -- Status
  status VARCHAR(50) DEFAULT 'ordered',
  quantity_received INTEGER DEFAULT 0,
  received_date DATE,

  -- Fund Allocation
  budget_id UUID REFERENCES budgets(id),
  encumbered_amount DECIMAL(10,2),

  -- Notes
  notes TEXT
);

CREATE INDEX idx_order_items_order ON order_items(acquisition_order_id);
CREATE INDEX idx_order_items_marc ON order_items(marc_record_id);
CREATE INDEX idx_order_items_budget ON order_items(budget_id);

-- 5. Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Invoice Information
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  acquisition_order_id UUID REFERENCES acquisition_orders(id),

  -- Dates
  invoice_date DATE NOT NULL,
  due_date DATE,
  paid_date DATE,

  -- Amounts
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  shipping_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',

  -- Notes
  notes TEXT
);

CREATE INDEX idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX idx_invoices_order ON invoices(acquisition_order_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);

-- 6. Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  invoice_id UUID REFERENCES invoices(id),
  budget_id UUID REFERENCES budgets(id),

  -- Payment Details
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Payment Method
  payment_method VARCHAR(100),
  reference_number VARCHAR(100),

  -- Notes
  notes TEXT
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_budget ON payments(budget_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- 7. Contracts table
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contract Information
  contract_number VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  budget_id UUID REFERENCES budgets(id),

  -- Type
  contract_type VARCHAR(100),
  resource_type VARCHAR(100),

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  renewal_date DATE,
  notice_period_days INTEGER,

  -- Financial
  contract_value DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'USD',
  payment_frequency VARCHAR(50),
  auto_renew BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  -- Terms
  terms TEXT,
  notes TEXT,

  -- Alerts
  alert_before_renewal_days INTEGER DEFAULT 90,
  last_alert_sent DATE
);

CREATE INDEX idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX idx_contracts_budget ON contracts(budget_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);
CREATE INDEX idx_contracts_renewal_date ON contracts(renewal_date);

-- Row Level Security
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can manage vendors"
  ON vendors FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage budgets"
  ON budgets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage orders"
  ON acquisition_orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage order_items"
  ON order_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage payments"
  ON payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage contracts"
  ON contracts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Triggers for Budget Tracking
CREATE OR REPLACE FUNCTION update_budget_amounts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Recalculate encumbered for the budget
    UPDATE budgets
    SET encumbered_amount = (
      SELECT COALESCE(SUM(encumbered_amount), 0)
      FROM order_items
      WHERE budget_id = NEW.budget_id
        AND status IN ('ordered', 'backordered')
    )
    WHERE id = NEW.budget_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    -- Recalculate for old budget if it changed
    IF OLD.budget_id IS NOT NULL THEN
      UPDATE budgets
      SET encumbered_amount = (
        SELECT COALESCE(SUM(encumbered_amount), 0)
        FROM order_items
        WHERE budget_id = OLD.budget_id
          AND status IN ('ordered', 'backordered')
      )
      WHERE id = OLD.budget_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_budget_update
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_amounts();

-- Update budget spent when payments are made
CREATE OR REPLACE FUNCTION update_budget_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE budgets
    SET spent_amount = spent_amount + NEW.amount
    WHERE id = NEW.budget_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_budget_update
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_spent();
