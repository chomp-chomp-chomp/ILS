# Database Schema for Library Catalog System

## Overview
This document describes the PostgreSQL database schema for the library catalog system. All tables will be created in your Supabase database.

## Tables

### 1. `marc_records`
Stores bibliographic records in MARC21 format.

```sql
CREATE TABLE marc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Control fields
  leader VARCHAR(24),
  control_number VARCHAR(50) UNIQUE, -- 001
  control_number_identifier VARCHAR(100), -- 003
  date_entered VARCHAR(8), -- 008

  -- ISBN/ISSN
  isbn VARCHAR(20),
  issn VARCHAR(20),

  -- Main entry fields
  main_entry_personal_name JSONB, -- 100
  main_entry_corporate_name JSONB, -- 110

  -- Title
  title_statement JSONB, -- 245 {a: title, b: subtitle, c: statement of responsibility}

  -- Publication info
  publication_info JSONB, -- 260/264 {a: place, b: publisher, c: date}

  -- Physical description
  physical_description JSONB, -- 300 {a: extent, b: other details, c: dimensions}

  -- Series
  series_statement JSONB, -- 490

  -- Notes
  general_note TEXT[], -- 500
  bibliography_note TEXT, -- 504
  summary TEXT, -- 520

  -- Subject headings
  subject_topical JSONB[], -- 650 array of {a: term, v: form, x: general, y: chronological, z: geographic}
  subject_geographic JSONB[], -- 651

  -- Added entries
  added_entry_personal_name JSONB[], -- 700
  added_entry_corporate_name JSONB[], -- 710

  -- Full MARC record (for complete preservation)
  marc_json JSONB,

  -- Material type
  material_type VARCHAR(50), -- book, serial, electronic, etc.

  -- Search optimization
  search_vector TSVECTOR
);

-- Create indexes for search
CREATE INDEX idx_marc_records_isbn ON marc_records(isbn);
CREATE INDEX idx_marc_records_control_number ON marc_records(control_number);
CREATE INDEX idx_marc_records_search_vector ON marc_records USING GIN(search_vector);
CREATE INDEX idx_marc_records_material_type ON marc_records(material_type);

-- Create full-text search trigger
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marc_search_vector_update
  BEFORE INSERT OR UPDATE ON marc_records
  FOR EACH ROW
  EXECUTE FUNCTION update_marc_search_vector();
```

### 2. `holdings`
Tracks physical/electronic copies and locations.

```sql
CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  marc_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE,

  -- Copy information
  barcode VARCHAR(50) UNIQUE,
  call_number VARCHAR(100),
  copy_number INTEGER,
  volume VARCHAR(50),

  -- Location
  location VARCHAR(100), -- e.g., "Main Library", "Reference", "Special Collections"
  sublocation VARCHAR(100), -- shelf, section, etc.

  -- Status
  status VARCHAR(50) DEFAULT 'available', -- available, checked_out, missing, damaged, etc.

  -- For electronic resources
  is_electronic BOOLEAN DEFAULT FALSE,
  url TEXT,
  access_restrictions TEXT
);

CREATE INDEX idx_holdings_marc_record ON holdings(marc_record_id);
CREATE INDEX idx_holdings_barcode ON holdings(barcode);
CREATE INDEX idx_holdings_status ON holdings(status);
```

### 3. `serials`
Manages serial publications (journals, magazines, newsletters).

```sql
CREATE TABLE serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  marc_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE,

  -- Serial information
  title VARCHAR(500) NOT NULL,
  issn VARCHAR(20),

  -- Frequency
  frequency VARCHAR(50), -- daily, weekly, monthly, quarterly, annual, irregular
  frequency_pattern JSONB, -- custom pattern if needed

  -- Format
  format VARCHAR(50), -- print, electronic, email_newsletter

  -- Electronic/email info
  url TEXT,
  email_list VARCHAR(255),

  -- Subscription info
  subscription_start DATE,
  subscription_end DATE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Prediction
  last_predicted_issue JSONB,
  next_expected_date DATE
);

CREATE INDEX idx_serials_marc_record ON serials(marc_record_id);
CREATE INDEX idx_serials_issn ON serials(issn);
CREATE INDEX idx_serials_active ON serials(is_active);
```

### 4. `serial_issues`
Tracks individual issues of serials.

```sql
CREATE TABLE serial_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ,

  serial_id UUID REFERENCES serials(id) ON DELETE CASCADE,

  -- Issue details
  volume VARCHAR(20),
  issue_number VARCHAR(20),
  issue_date DATE,

  -- Check-in
  expected_date DATE,
  checked_in BOOLEAN DEFAULT FALSE,

  -- Notes
  notes TEXT,

  -- For electronic issues
  url TEXT
);

CREATE INDEX idx_serial_issues_serial ON serial_issues(serial_id);
CREATE INDEX idx_serial_issues_date ON serial_issues(issue_date);
CREATE INDEX idx_serial_issues_checked_in ON serial_issues(checked_in);
```

## Row Level Security (RLS)

Enable RLS for all tables and create policies:

```sql
-- Enable RLS
ALTER TABLE marc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_issues ENABLE ROW LEVEL SECURITY;

-- Public read access for catalog
CREATE POLICY "Public read access for marc_records"
  ON marc_records FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read access for holdings"
  ON holdings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read access for serials"
  ON serials FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read access for serial_issues"
  ON serial_issues FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write access (authenticated users only)
-- Note: You'll want to add role-based access control later
CREATE POLICY "Authenticated users can insert marc_records"
  ON marc_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update marc_records"
  ON marc_records FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete marc_records"
  ON marc_records FOR DELETE
  TO authenticated
  USING (true);

-- Similar policies for other tables
CREATE POLICY "Authenticated users can manage holdings"
  ON holdings FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage serials"
  ON serials FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage serial_issues"
  ON serial_issues FOR ALL
  TO authenticated
  USING (true);
```

## Authority Control

Authority control tables track authorized headings, cross-references, and links to MARC bibliographic records.

### `authorities`
- `id` UUID primary key with timestamps
- `heading` authorized form of the name/subject
- `type` ENUM-like string: `personal_name`, `corporate_name`, `geographic_name`, `topical_subject`
- `source` (`lcnaf`, `lcsh`, `local`) plus identifiers `lccn`, `viaf_id`, `fast_id`
- `variant_forms` TEXT[] for non-authorized headings
- `marc_authority` JSONB for the raw LC record
- `usage_count` cached count of linked bibliographic records
- `search_vector` TSVECTOR for full-text/fuzzy matching

### `authority_cross_refs`
- Cross-reference rows tied to an `authority_id`
- `ref_type`: `see`, `see_also`, `see_from`
- `reference_text` free-text heading, optional `related_authority_id`, `note`

### `marc_authority_links`
- Joins MARC bib records to authorities
- `marc_record_id`, `authority_id`, `marc_field` (`100`, `650`, etc.), and `field_index` for repeatable fields
- `confidence` (0–1) and `is_automatic` to track automated matches
- Unique constraint on `marc_record_id`, `marc_field`, `field_index` prevents duplicate links

### `authority_update_log`
- Audit table capturing `action` (`created`, `updated`, `merged`, `deleted`, `synced_from_loc`, `heading_corrected`)
- Stores `old_value`, `new_value`, `records_affected`, `performed_by`, and notes for traceability

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy and paste the SQL above
4. Run each section in order
5. Verify tables are created in "Table Editor"

## Future Enhancements

- User roles (admin, cataloger, viewer)
- Circulation/checkout tracking
- Acquisition records
- Budget tracking
- Patron management

## Patron Self-Service Additions

The self-service portal extends the circulation schema with PIN authentication, preferences, notifications, fines, and saved searches.

### Patrons (extended)

```sql
ALTER TABLE patrons
  ADD COLUMN pin_hash TEXT,
  ADD COLUMN pin_updated_at TIMESTAMPTZ,
  ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
```

`pin_hash` stores a bcrypt hash of the patron's PIN (set via `set_patron_pin`). `email_verified` tracks whether the patron confirmed their email address.

### Patron Preferences

```sql
CREATE TABLE patron_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  notification_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patron_id)
);
```

Stores delivery and privacy preferences and whether the patron consents to checkout history tracking.

### Saved Searches

```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_result_count INTEGER,
  send_email_alerts BOOLEAN DEFAULT FALSE,
  alert_frequency VARCHAR(50) DEFAULT 'weekly',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_saved_searches_patron ON saved_searches(patron_id);
```

Allows patrons to save catalog queries and request alert emails on a daily/weekly/monthly cadence.

### Patron Notifications

```sql
CREATE TABLE patron_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) DEFAULT 'email',
  status VARCHAR(50) DEFAULT 'queued',
  title VARCHAR(255),
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_patron_notifications_patron ON patron_notifications(patron_id);
CREATE INDEX idx_patron_notifications_status ON patron_notifications(status);
```

Stores overdue, courtesy, hold-ready, and receipt notifications with delivery channel metadata.

### Fines & Payments

```sql
CREATE TABLE patron_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  checkout_id UUID REFERENCES checkouts(id),
  reason TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  balance NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'outstanding',
  fine_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patron_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  fine_id UUID REFERENCES patron_fines(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(50) DEFAULT 'online',
  provider_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tracks itemized fines and payment records, including online or in-person methods.

### Hold Suspension & Notification Preferences

`holds` gains `suspended_until`, `suspension_reason`, and `notification_channels` (email/SMS) to pause holds and control pickup alerts.

### Helper Functions

* `set_patron_pin(target_patron UUID, new_pin TEXT)` — sets a bcrypt PIN hash for a patron (security definer with caller ownership check).
* `patron_card_login(card_number TEXT, provided_pin TEXT)` — validates a card+PIN pairing and returns the patron/user identifiers for downstream authentication flows.

### Policies

RLS policies allow authenticated patrons to manage their preferences, saved searches, notifications, fines, payments, and to renew their own checkouts, while preserving staff-level management for broader access.
