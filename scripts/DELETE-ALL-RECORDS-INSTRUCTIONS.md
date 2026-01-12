# Complete Catalog Wipe - Instructions

## ⚠️ EXTREME WARNING ⚠️

This will **permanently delete**:
- ✅ All MARC bibliographic records
- ✅ All holdings and items
- ✅ All checkout history
- ✅ All authority control links
- ✅ All related record links (series, editions)
- ✅ All cover images
- ✅ All record attachments
- ✅ All public reading lists

**This action CANNOT be undone!**

---

## Before You Proceed

### ✓ Checklist

- [ ] I have backed up the database (or I don't need a backup)
- [ ] I understand this deletes ALL catalog data
- [ ] I am prepared to reimport all records from scratch
- [ ] I have verified this is the correct environment (not production if you have users)

---

## Option 1: Safe Method (Recommended)

### Step 1: Preview What Will Be Deleted

1. Open **Supabase SQL Editor**
2. Copy and run this query:

```sql
SELECT
  'marc_records' as table_name,
  COUNT(*) as records_to_delete
FROM marc_records
UNION ALL
SELECT 'holdings', COUNT(*) FROM holdings
UNION ALL
SELECT 'checkouts', COUNT(*) FROM checkouts
UNION ALL
SELECT 'authority_references', COUNT(*) FROM authority_references
UNION ALL
SELECT 'related_records', COUNT(*) FROM related_records
UNION ALL
SELECT 'cover_images', COUNT(*) FROM cover_images
UNION ALL
SELECT 'marc_attachments', COUNT(*) FROM marc_attachments
UNION ALL
SELECT 'reading_lists', COUNT(*) FROM reading_lists;
```

**Review the counts.** This is what will be deleted.

### Step 2: Execute the Wipe

If you're **absolutely sure**, run this:

```sql
BEGIN;

-- Delete in correct order (respecting foreign key constraints)
DELETE FROM checkouts;
DELETE FROM holdings;
DELETE FROM authority_references;
DELETE FROM related_records;
DELETE FROM cover_images;
DELETE FROM marc_attachments;
DELETE FROM reading_lists;
DELETE FROM marc_records;

COMMIT;
```

### Step 3: Verify Deletion

Run this to confirm everything is gone:

```sql
SELECT COUNT(*) as remaining_records FROM marc_records;
SELECT COUNT(*) as remaining_holdings FROM holdings;
```

**Expected result**: Both should return `0`.

---

## Option 2: Quick Method (For Experts)

If you're **100% certain** and want to do it in one command:

```sql
TRUNCATE TABLE
  checkouts,
  holdings,
  authority_references,
  related_records,
  cover_images,
  marc_attachments,
  reading_lists,
  marc_records
CASCADE;
```

⚠️ **Warning**: `CASCADE` will delete from any other tables that reference these tables.

---

## Option 3: Via Supabase Dashboard

If you prefer a GUI:

1. Go to **Supabase Dashboard** → **Table Editor**
2. For each table in this order:
   - `checkouts` → Click **Delete all rows**
   - `holdings` → Click **Delete all rows**
   - `authority_references` → Click **Delete all rows**
   - `related_records` → Click **Delete all rows**
   - `cover_images` → Click **Delete all rows**
   - `marc_attachments` → Click **Delete all rows**
   - `reading_lists` → Click **Delete all rows**
   - `marc_records` → Click **Delete all rows**

---

## What About Other Data?

### These tables will NOT be deleted:

- ✅ **Patrons** - Safe (circulation users)
- ✅ **Authorities** - Safe (name/subject authority records)
- ✅ **Vendors** - Safe (acquisitions)
- ✅ **Orders/Invoices** - Safe (acquisitions)
- ✅ **Serials** - Safe (but serial holdings will be deleted)
- ✅ **ILL Requests** - Safe (but references to records will break)
- ✅ **Pages** - Safe (WYSIWYG content)
- ✅ **Configuration** - Safe (branding, search, display settings)
- ✅ **Auth Users** - Safe (admin accounts)

### If You Also Want to Delete These:

**Delete Authorities:**
```sql
DELETE FROM authority_references;
DELETE FROM authorities;
```

**Delete Acquisitions:**
```sql
DELETE FROM order_line_items;
DELETE FROM orders;
DELETE FROM invoices;
DELETE FROM vendors;
```

**Delete Serials:**
```sql
DELETE FROM serial_issues;
DELETE FROM serials;
```

**Delete ILL:**
```sql
DELETE FROM ill_requests;
DELETE FROM ill_partners;
```

**Delete Patrons:**
```sql
DELETE FROM holds;
DELETE FROM checkouts;
DELETE FROM patrons;
```

---

## After Wiping the Catalog

### Next Steps:

1. **Apply Migration 022** (if not already done):
   - Run `migrations/022_additional_marc_fields.sql`
   - This ensures all new fields are available

2. **Import Fresh Data**:
   - Use `/admin/cataloging/bulk-isbn` for ISBN lists
   - Use `/admin/cataloging/marc-import` for MARCXML files
   - Use `/admin/cataloging/import-csv` for CSV data

3. **Verify Search Works**:
   ```sql
   -- Check that search vectors are being created
   SELECT
     title_statement->>'a' as title,
     length(search_vector::text) as vector_length
   FROM marc_records
   LIMIT 5;
   ```

4. **Test Public Catalog**:
   - Go to `/catalog`
   - Try searching
   - Check that results display correctly

---

## Rollback (If Something Goes Wrong)

### If you haven't committed yet:
```sql
ROLLBACK;
```

### If you already committed:
1. **Restore from Supabase backup**:
   - Dashboard → Database → Backups
   - Select "Point in Time Recovery"
   - Choose a timestamp before the wipe
   - Restore

2. **Or restore from your own backup**:
   - If you exported data before wiping
   - Reimport via SQL or MARCXML

---

## FAQ

**Q: Will this affect my admin accounts?**
A: No, user accounts are stored in `auth.users` and won't be touched.

**Q: Will this reset my library's branding/configuration?**
A: No, branding, search config, and display settings are separate tables.

**Q: Can I undo this?**
A: Only if you have a backup. Supabase keeps automatic backups, but check your plan.

**Q: What if I just want to delete duplicates?**
A: Don't use this script! Use `/admin/cataloging/duplicates` instead.

**Q: Will search still work after deletion?**
A: Yes, once you reimport records the search vectors will rebuild automatically.

**Q: Do I need to run migration 022 again?**
A: No, migrations only need to run once. The table structure is permanent.

---

## Safety Script

A safe version is available at:
```
scripts/wipe-catalog.sql
```

This script:
- Shows preview of what will be deleted
- Requires manual uncommenting to execute
- Includes verification queries
- Has built-in rollback protection

---

## Final Warning

**This is irreversible without a backup.**

Make absolutely sure you:
1. Have a backup (or don't need one)
2. Are in the correct environment
3. Understand you'll need to reimport everything

When you're ready, run the SQL commands in **Supabase SQL Editor**.

Good luck with your fresh start! 🚀
