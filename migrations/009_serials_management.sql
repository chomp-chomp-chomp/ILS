-- Serials Management System Migration
-- Comprehensive serials tracking with prediction patterns, check-in, claiming, and binding
-- This migration safely updates existing tables and adds new tables

-- 1. Update or Create Serials Table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'serials') THEN
        CREATE TABLE serials (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            title VARCHAR(500) NOT NULL,
            issn VARCHAR(20),
            frequency VARCHAR(50) DEFAULT 'monthly',
            format VARCHAR(50) DEFAULT 'print',
            url TEXT,
            email_list VARCHAR(255),
            vendor_id UUID REFERENCES vendors(id),
            budget_id UUID REFERENCES budgets(id),
            subscription_start DATE,
            subscription_end DATE,
            status VARCHAR(50) DEFAULT 'active',
            is_active BOOLEAN DEFAULT TRUE,
            public_display BOOLEAN DEFAULT TRUE,
            public_notes TEXT,
            notes TEXT
        );
    END IF;

    -- Add missing columns to existing serials table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'vendor_id') THEN
        ALTER TABLE serials ADD COLUMN vendor_id UUID REFERENCES vendors(id);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'budget_id') THEN
        ALTER TABLE serials ADD COLUMN budget_id UUID REFERENCES budgets(id);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'status') THEN
        ALTER TABLE serials ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'public_display') THEN
        ALTER TABLE serials ADD COLUMN public_display BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'public_notes') THEN
        ALTER TABLE serials ADD COLUMN public_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'notes') THEN
        ALTER TABLE serials ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'created_at') THEN
        ALTER TABLE serials ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serials' AND column_name = 'updated_at') THEN
        ALTER TABLE serials ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for serials
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_serials_title') THEN
        CREATE INDEX idx_serials_title ON serials(title);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_serials_issn') THEN
        CREATE INDEX idx_serials_issn ON serials(issn);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_serials_status') THEN
        CREATE INDEX idx_serials_status ON serials(status);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_serials_vendor') THEN
        CREATE INDEX idx_serials_vendor ON serials(vendor_id);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_serials_budget') THEN
        CREATE INDEX idx_serials_budget ON serials(budget_id);
    END IF;
END $$;

-- 2. Create Prediction Patterns Table
CREATE TABLE IF NOT EXISTS serial_prediction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES serials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  frequency VARCHAR(50) NOT NULL,
  issues_per_year INTEGER,
  enum_type VARCHAR(50),
  volume_start INTEGER DEFAULT 1,
  volume_increment INTEGER DEFAULT 1,
  issue_start INTEGER DEFAULT 1,
  issue_increment INTEGER DEFAULT 1,
  reset_issue_on_volume_change BOOLEAN DEFAULT TRUE,
  chron_type VARCHAR(50),
  use_publication_date BOOLEAN DEFAULT TRUE,
  season_pattern VARCHAR(50),
  allow_combined_issues BOOLEAN DEFAULT FALSE,
  combined_months TEXT[],
  irregular_schedule JSONB,
  start_date DATE NOT NULL,
  end_date DATE,
  generate_ahead_months INTEGER DEFAULT 12,
  display_template VARCHAR(500),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prediction_patterns_serial ON serial_prediction_patterns(serial_id);
CREATE INDEX IF NOT EXISTS idx_prediction_patterns_active ON serial_prediction_patterns(is_active);

-- 3. Create or Update Serial Issues Table
CREATE TABLE IF NOT EXISTS serial_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES serials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  volume INTEGER,
  issue INTEGER,
  year INTEGER,
  month INTEGER,
  season VARCHAR(50),
  display_text VARCHAR(500),
  expected_date DATE,
  is_combined BOOLEAN DEFAULT FALSE,
  combined_with TEXT,
  status VARCHAR(50) DEFAULT 'expected',
  received_date DATE,
  received_by TEXT,
  condition VARCHAR(50),
  condition_notes TEXT,
  notes TEXT,
  is_supplement BOOLEAN DEFAULT FALSE,
  is_special_issue BOOLEAN DEFAULT FALSE,
  supplement_description TEXT,
  claim_count INTEGER DEFAULT 0,
  last_claim_date DATE,
  binding_status VARCHAR(50) DEFAULT 'unbound',
  bound_volume_id UUID
);

-- Add missing columns to existing serial_issues table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'prediction_pattern_id') THEN
        ALTER TABLE serial_issues ADD COLUMN prediction_pattern_id UUID;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'binding_batch_id') THEN
        ALTER TABLE serial_issues ADD COLUMN binding_batch_id UUID;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'claim_count') THEN
        ALTER TABLE serial_issues ADD COLUMN claim_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'last_claim_date') THEN
        ALTER TABLE serial_issues ADD COLUMN last_claim_date DATE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'binding_status') THEN
        ALTER TABLE serial_issues ADD COLUMN binding_status VARCHAR(50) DEFAULT 'unbound';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'bound_volume_id') THEN
        ALTER TABLE serial_issues ADD COLUMN bound_volume_id UUID;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'condition') THEN
        ALTER TABLE serial_issues ADD COLUMN condition VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'condition_notes') THEN
        ALTER TABLE serial_issues ADD COLUMN condition_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'is_supplement') THEN
        ALTER TABLE serial_issues ADD COLUMN is_supplement BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'is_special_issue') THEN
        ALTER TABLE serial_issues ADD COLUMN is_special_issue BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'supplement_description') THEN
        ALTER TABLE serial_issues ADD COLUMN supplement_description TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'is_combined') THEN
        ALTER TABLE serial_issues ADD COLUMN is_combined BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'combined_with') THEN
        ALTER TABLE serial_issues ADD COLUMN combined_with TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'serial_issues' AND column_name = 'received_by') THEN
        ALTER TABLE serial_issues ADD COLUMN received_by TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_serial_issues_serial ON serial_issues(serial_id);
CREATE INDEX IF NOT EXISTS idx_serial_issues_pattern ON serial_issues(prediction_pattern_id);
CREATE INDEX IF NOT EXISTS idx_serial_issues_status ON serial_issues(status);
CREATE INDEX IF NOT EXISTS idx_serial_issues_expected_date ON serial_issues(expected_date);
CREATE INDEX IF NOT EXISTS idx_serial_issues_received_date ON serial_issues(received_date);
CREATE INDEX IF NOT EXISTS idx_serial_issues_binding_status ON serial_issues(binding_status);
CREATE INDEX IF NOT EXISTS idx_serial_issues_binding_batch ON serial_issues(binding_batch_id);

-- 4. Create Serial Claims Table
CREATE TABLE IF NOT EXISTS serial_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES serials(id) ON DELETE CASCADE,
  serial_issue_id UUID NOT NULL REFERENCES serial_issues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  claim_number INTEGER NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_type VARCHAR(50) DEFAULT 'missing',
  claim_method VARCHAR(50),
  claimed_by TEXT NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  vendor_response TEXT,
  response_date DATE,
  expected_resolution_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  resolution VARCHAR(50),
  escalation_level INTEGER DEFAULT 1,
  escalate_date DATE,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_serial_claims_serial ON serial_claims(serial_id);
CREATE INDEX IF NOT EXISTS idx_serial_claims_issue ON serial_claims(serial_issue_id);
CREATE INDEX IF NOT EXISTS idx_serial_claims_status ON serial_claims(status);
CREATE INDEX IF NOT EXISTS idx_serial_claims_date ON serial_claims(claim_date);
CREATE INDEX IF NOT EXISTS idx_serial_claims_vendor ON serial_claims(vendor_id);

-- 5. Create Binding Batches Table
CREATE TABLE IF NOT EXISTS serial_binding_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  batch_number VARCHAR(100) UNIQUE NOT NULL,
  batch_name VARCHAR(255),
  bindery_vendor_id UUID REFERENCES vendors(id),
  sent_date DATE,
  expected_return_date DATE,
  returned_date DATE,
  status VARCHAR(50) DEFAULT 'preparing',
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  budget_id UUID REFERENCES budgets(id),
  sent_by TEXT,
  received_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_binding_batches_status ON serial_binding_batches(status);
CREATE INDEX IF NOT EXISTS idx_binding_batches_bindery ON serial_binding_batches(bindery_vendor_id);
CREATE INDEX IF NOT EXISTS idx_binding_batches_sent_date ON serial_binding_batches(sent_date);

-- 6. Create Binding Items Table
CREATE TABLE IF NOT EXISTS serial_binding_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_batch_id UUID NOT NULL REFERENCES serial_binding_batches(id) ON DELETE CASCADE,
  serial_id UUID NOT NULL REFERENCES serials(id) ON DELETE CASCADE,
  serial_issue_id UUID NOT NULL REFERENCES serial_issues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  volume_number VARCHAR(100),
  volume_year INTEGER,
  spine_label TEXT,
  marc_record_id UUID,
  call_number VARCHAR(255),
  status VARCHAR(50) DEFAULT 'included',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_binding_items_batch ON serial_binding_items(binding_batch_id);
CREATE INDEX IF NOT EXISTS idx_binding_items_serial ON serial_binding_items(serial_id);
CREATE INDEX IF NOT EXISTS idx_binding_items_issue ON serial_binding_items(serial_issue_id);

-- Add foreign key constraints
DO $$
BEGIN
    -- Add FK for prediction_pattern_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_serial_issues_prediction_pattern'
        AND table_name = 'serial_issues'
    ) THEN
        ALTER TABLE serial_issues
        ADD CONSTRAINT fk_serial_issues_prediction_pattern
        FOREIGN KEY (prediction_pattern_id) REFERENCES serial_prediction_patterns(id) ON DELETE SET NULL;
    END IF;

    -- Add FK for binding_batch_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_serial_issues_binding_batch'
        AND table_name = 'serial_issues'
    ) THEN
        ALTER TABLE serial_issues
        ADD CONSTRAINT fk_serial_issues_binding_batch
        FOREIGN KEY (binding_batch_id) REFERENCES serial_binding_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Row Level Security
ALTER TABLE serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_prediction_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_binding_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_binding_items ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Authenticated users can manage serials" ON serials;
CREATE POLICY "Authenticated users can manage serials"
  ON serials FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage prediction patterns" ON serial_prediction_patterns;
CREATE POLICY "Authenticated users can manage prediction patterns"
  ON serial_prediction_patterns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage issues" ON serial_issues;
CREATE POLICY "Authenticated users can manage issues"
  ON serial_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage claims" ON serial_claims;
CREATE POLICY "Authenticated users can manage claims"
  ON serial_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage binding batches" ON serial_binding_batches;
CREATE POLICY "Authenticated users can manage binding batches"
  ON serial_binding_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage binding items" ON serial_binding_items;
CREATE POLICY "Authenticated users can manage binding items"
  ON serial_binding_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public access policies
DROP POLICY IF EXISTS "Public can view active serials" ON serials;
CREATE POLICY "Public can view active serials"
  ON serials FOR SELECT TO anon
  USING (public_display = true AND is_active = true);

DROP POLICY IF EXISTS "Public can view received issues" ON serial_issues;
CREATE POLICY "Public can view received issues"
  ON serial_issues FOR SELECT TO anon
  USING (
    status = 'received'
    AND EXISTS (
      SELECT 1 FROM serials
      WHERE serials.id = serial_issues.serial_id
      AND serials.public_display = true
      AND serials.is_active = true
    )
  );

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_serials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_serials_updated_at ON serials;
CREATE TRIGGER trigger_serials_updated_at
  BEFORE UPDATE ON serials FOR EACH ROW
  EXECUTE FUNCTION update_serials_updated_at();

DROP TRIGGER IF EXISTS trigger_prediction_patterns_updated_at ON serial_prediction_patterns;
CREATE TRIGGER trigger_prediction_patterns_updated_at
  BEFORE UPDATE ON serial_prediction_patterns FOR EACH ROW
  EXECUTE FUNCTION update_serials_updated_at();

DROP TRIGGER IF EXISTS trigger_serial_issues_updated_at ON serial_issues;
CREATE TRIGGER trigger_serial_issues_updated_at
  BEFORE UPDATE ON serial_issues FOR EACH ROW
  EXECUTE FUNCTION update_serials_updated_at();

DROP TRIGGER IF EXISTS trigger_serial_claims_updated_at ON serial_claims;
CREATE TRIGGER trigger_serial_claims_updated_at
  BEFORE UPDATE ON serial_claims FOR EACH ROW
  EXECUTE FUNCTION update_serials_updated_at();

DROP TRIGGER IF EXISTS trigger_binding_batches_updated_at ON serial_binding_batches;
CREATE TRIGGER trigger_binding_batches_updated_at
  BEFORE UPDATE ON serial_binding_batches FOR EACH ROW
  EXECUTE FUNCTION update_serials_updated_at();

-- Check late issues function
CREATE OR REPLACE FUNCTION check_late_serial_issues()
RETURNS void AS $$
BEGIN
  UPDATE serial_issues
  SET status = 'late'
  WHERE status = 'expected'
    AND expected_date < CURRENT_DATE - INTERVAL '7 days'
    AND expected_date IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Generate predicted issues function
CREATE OR REPLACE FUNCTION generate_predicted_issues(
  p_pattern_id UUID,
  p_months_ahead INTEGER DEFAULT 12
)
RETURNS INTEGER AS $$
DECLARE
  v_pattern RECORD;
  v_issues_generated INTEGER := 0;
  v_current_date DATE;
  v_end_date DATE;
  v_volume INTEGER;
  v_issue INTEGER;
  v_year INTEGER;
  v_month INTEGER;
  v_display_text TEXT;
  v_last_issue RECORD;
BEGIN
  SELECT * INTO v_pattern FROM serial_prediction_patterns WHERE id = p_pattern_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prediction pattern not found';
  END IF;

  SELECT * INTO v_last_issue
  FROM serial_issues
  WHERE serial_id = v_pattern.serial_id AND prediction_pattern_id = p_pattern_id
  ORDER BY expected_date DESC NULLS LAST, volume DESC NULLS LAST, issue DESC NULLS LAST
  LIMIT 1;

  IF v_last_issue IS NOT NULL THEN
    v_volume := COALESCE(v_last_issue.volume, v_pattern.volume_start);
    v_issue := COALESCE(v_last_issue.issue, v_pattern.issue_start - v_pattern.issue_increment);
    v_current_date := COALESCE(v_last_issue.expected_date, v_pattern.start_date);
  ELSE
    v_volume := v_pattern.volume_start;
    v_issue := v_pattern.issue_start - v_pattern.issue_increment;
    v_current_date := v_pattern.start_date;
  END IF;

  v_end_date := CURRENT_DATE + (p_months_ahead || ' months')::INTERVAL;

  WHILE v_current_date <= v_end_date LOOP
    v_issue := v_issue + v_pattern.issue_increment;

    IF v_pattern.reset_issue_on_volume_change THEN
      IF (v_pattern.frequency = 'monthly' AND v_issue > 12) OR
         (v_pattern.frequency = 'quarterly' AND v_issue > 4) OR
         (v_pattern.frequency = 'weekly' AND v_issue > 52) THEN
        v_volume := v_volume + v_pattern.volume_increment;
        v_issue := v_pattern.issue_start;
      END IF;
    END IF;

    v_year := EXTRACT(YEAR FROM v_current_date);
    v_month := EXTRACT(MONTH FROM v_current_date);

    v_display_text := COALESCE(
      v_pattern.display_template,
      'Vol. ' || v_volume || ' No. ' || v_issue || ' (' || TO_CHAR(v_current_date, 'Month YYYY') || ')'
    );
    v_display_text := REPLACE(v_display_text, '{volume}', v_volume::TEXT);
    v_display_text := REPLACE(v_display_text, '{issue}', v_issue::TEXT);
    v_display_text := REPLACE(v_display_text, '{year}', v_year::TEXT);
    v_display_text := REPLACE(v_display_text, '{month}', TO_CHAR(v_current_date, 'Month'));

    INSERT INTO serial_issues (
      serial_id, prediction_pattern_id, volume, issue, year, month,
      display_text, expected_date, status
    )
    SELECT
      v_pattern.serial_id, p_pattern_id, v_volume, v_issue, v_year, v_month,
      v_display_text, v_current_date, 'expected'
    WHERE NOT EXISTS (
      SELECT 1 FROM serial_issues
      WHERE serial_id = v_pattern.serial_id AND volume = v_volume AND issue = v_issue
    );

    IF FOUND THEN
      v_issues_generated := v_issues_generated + 1;
    END IF;

    CASE v_pattern.frequency
      WHEN 'daily' THEN v_current_date := v_current_date + INTERVAL '1 day';
      WHEN 'weekly' THEN v_current_date := v_current_date + INTERVAL '1 week';
      WHEN 'monthly' THEN v_current_date := v_current_date + INTERVAL '1 month';
      WHEN 'quarterly' THEN v_current_date := v_current_date + INTERVAL '3 months';
      WHEN 'annual' THEN v_current_date := v_current_date + INTERVAL '1 year';
      ELSE EXIT;
    END CASE;
  END LOOP;

  RETURN v_issues_generated;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE serials IS 'Serial publication titles (journals, magazines, newspapers)';
COMMENT ON TABLE serial_prediction_patterns IS 'Patterns for generating expected serial issues';
COMMENT ON TABLE serial_issues IS 'Expected and received serial issues';
COMMENT ON TABLE serial_claims IS 'Claims for missing or late serial issues';
COMMENT ON TABLE serial_binding_batches IS 'Batches of issues sent for binding';
COMMENT ON TABLE serial_binding_items IS 'Individual issues included in binding batches';
COMMENT ON FUNCTION generate_predicted_issues IS 'Generates predicted issues based on a pattern';
COMMENT ON FUNCTION check_late_serial_issues IS 'Updates issue status to late when expected date passes';
