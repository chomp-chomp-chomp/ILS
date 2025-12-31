-- Patron Self-Service Portal enhancements
-- Adds PIN support, preferences, notifications, fines, and saved searches

-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extend patrons table with PIN storage and email verification tracking
ALTER TABLE patrons
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN patrons.pin_hash IS 'Hashed PIN for card authentication (bcrypt via pgcrypto)';
COMMENT ON COLUMN patrons.pin_updated_at IS 'Timestamp when PIN was last changed';
COMMENT ON COLUMN patrons.email_verified IS 'Flag indicating patron has verified their email address';

-- Add suspension and notification preferences to holds
ALTER TABLE holds
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT ARRAY['email'];

COMMENT ON COLUMN holds.suspended_until IS 'Date until which the hold is paused/suspended';
COMMENT ON COLUMN holds.notification_channels IS 'Preferred channels for hold notifications (email, sms)';

-- Patron preferences table
CREATE TABLE IF NOT EXISTS patron_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  email_opt_in BOOLEAN DEFAULT TRUE,
  sms_opt_in BOOLEAN DEFAULT FALSE,
  sms_number VARCHAR(50),
  preferred_language VARCHAR(10) DEFAULT 'en',
  default_pickup_location VARCHAR(255),
  checkout_history_opt_in BOOLEAN DEFAULT FALSE,
  digital_receipts BOOLEAN DEFAULT TRUE,
  privacy_level VARCHAR(50) DEFAULT 'standard',
  marketing_opt_out BOOLEAN DEFAULT TRUE,
  notice_lead_time_days INTEGER DEFAULT 3,
  notification_preferences JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patron_preferences_unique ON patron_preferences(patron_id);

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_result_count INTEGER,
  send_email_alerts BOOLEAN DEFAULT FALSE,
  alert_frequency VARCHAR(50) DEFAULT 'weekly',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_patron ON saved_searches(patron_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_active ON saved_searches(is_active);

-- Patron notifications table
CREATE TABLE IF NOT EXISTS patron_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) DEFAULT 'email',
  status VARCHAR(50) DEFAULT 'queued',
  title VARCHAR(255),
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patron_notifications_patron ON patron_notifications(patron_id);
CREATE INDEX IF NOT EXISTS idx_patron_notifications_status ON patron_notifications(status);

-- Patron fines and payments
CREATE TABLE IF NOT EXISTS patron_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  checkout_id UUID REFERENCES checkouts(id),
  reason TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  balance NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'outstanding',
  fine_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_patron_fines_patron ON patron_fines(patron_id);
CREATE INDEX IF NOT EXISTS idx_patron_fines_status ON patron_fines(status);

CREATE TABLE IF NOT EXISTS patron_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  fine_id UUID REFERENCES patron_fines(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(50) DEFAULT 'online',
  provider_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_patron_payments_patron ON patron_payments(patron_id);
CREATE INDEX IF NOT EXISTS idx_patron_payments_fine ON patron_payments(fine_id);

-- Utility function to refresh updated_at
CREATE OR REPLACE FUNCTION refresh_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER patron_preferences_updated_at
  BEFORE UPDATE ON patron_preferences
  FOR EACH ROW
  EXECUTE FUNCTION refresh_updated_at();

CREATE TRIGGER saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION refresh_updated_at();

CREATE TRIGGER patron_notifications_updated_at
  BEFORE UPDATE ON patron_notifications
  FOR EACH ROW
  EXECUTE FUNCTION refresh_updated_at();

CREATE TRIGGER patron_fines_updated_at
  BEFORE UPDATE ON patron_fines
  FOR EACH ROW
  EXECUTE FUNCTION refresh_updated_at();

CREATE TRIGGER patron_payments_updated_at
  BEFORE UPDATE ON patron_payments
  FOR EACH ROW
  EXECUTE FUNCTION refresh_updated_at();

-- Security policies
ALTER TABLE patron_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE patron_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patron_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE patron_payments ENABLE ROW LEVEL SECURITY;

-- Patron preferences policies
CREATE POLICY "Patrons manage their preferences" ON patron_preferences
  FOR ALL TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

-- Saved searches policies
CREATE POLICY "Patrons manage saved searches" ON saved_searches
  FOR ALL TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

-- Notifications policies
CREATE POLICY "Patrons view their notifications" ON patron_notifications
  FOR SELECT TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "System inserts notifications" ON patron_notifications
  FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons update notification read status" ON patron_notifications
  FOR UPDATE TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

-- Fines and payments policies
CREATE POLICY "Patrons view their fines" ON patron_fines
  FOR SELECT TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons update their fines status" ON patron_fines
  FOR UPDATE TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons view their payments" ON patron_payments
  FOR SELECT TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons insert their payments" ON patron_payments
  FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

-- Allow patrons to renew their own checkouts
CREATE POLICY "Patrons can renew their own checkouts" ON checkouts
  FOR UPDATE TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

-- Allow patrons to manage their circulation history when opt-in is enabled
CREATE POLICY "Patrons view their circulation history" ON circulation_history
  FOR SELECT TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

CREATE POLICY "Patrons delete their circulation history" ON circulation_history
  FOR DELETE TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));

-- Helper functions for PIN workflows
CREATE OR REPLACE FUNCTION set_patron_pin(target_patron UUID, new_pin TEXT)
RETURNS TEXT AS $$
DECLARE
  hashed TEXT;
  caller UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM patrons WHERE id = target_patron AND user_id = caller) THEN
    RAISE EXCEPTION 'Caller may only update their own PIN';
  END IF;

  hashed := crypt(new_pin, gen_salt('bf'));
  UPDATE patrons
    SET pin_hash = hashed,
        pin_updated_at = NOW()
    WHERE id = target_patron
    RETURNING pin_hash INTO hashed;
  RETURN hashed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION patron_card_login(card_number TEXT, provided_pin TEXT)
RETURNS TABLE(patron_id UUID, user_id UUID, email TEXT) AS $$
DECLARE
  patron_record patrons%ROWTYPE;
BEGIN
  SELECT * INTO patron_record FROM patrons WHERE barcode = card_number;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF patron_record.pin_hash IS NULL THEN
    RETURN;
  END IF;

  IF patron_record.pin_hash = crypt(provided_pin, patron_record.pin_hash) THEN
    RETURN QUERY SELECT patron_record.id, patron_record.user_id, patron_record.email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION set_patron_pin TO authenticated;
GRANT EXECUTE ON FUNCTION patron_card_login TO anon, authenticated;

-- Seed preferences for existing patrons
INSERT INTO patron_preferences (patron_id)
SELECT id FROM patrons
ON CONFLICT (patron_id) DO NOTHING;

-- Ensure balances default to amount when missing
UPDATE patron_fines SET balance = amount WHERE balance = 0;
