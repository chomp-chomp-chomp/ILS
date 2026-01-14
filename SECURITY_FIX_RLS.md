# Database Security Fix - Row Level Security (RLS) Issues

**Status**: 🔴 **CRITICAL** - Immediate action required
**Created**: 2026-01-14
**Migration**: `migrations/030_fix_rls_security_issues.sql`

---

## Executive Summary

The Supabase database linter detected critical security vulnerabilities in the ILS database. Multiple tables have Row Level Security (RLS) policies defined, but **RLS is not actually enabled** on those tables. This means the security policies are not being enforced, potentially allowing unauthorized access to data.

### Impact

**Without this fix:**
- ❌ Public users can read **ALL** marc_records, including archived and staff-only records
- ❌ RLS policies exist but are completely ignored
- ❌ Visibility and status controls are not enforced
- ❌ Data is exposed to PostgREST API without restrictions

**With this fix:**
- ✅ RLS is enabled and policies are enforced
- ✅ Public users can only see active, public records
- ✅ Staff can see all records appropriately
- ✅ Archived and deleted records are hidden from public view

---

## Issues Detected

### 1. marc_records Table (CRITICAL)

**Problem**: RLS policies exist but RLS is not enabled

**Details**:
- Migration `022_archives_and_visibility.sql` created RLS policies
- BUT it never ran `ALTER TABLE marc_records ENABLE ROW LEVEL SECURITY`
- Policies defined but not enforced:
  - "Public read access for active visible records"
  - "Staff read access to all records"
  - "Authenticated users can insert/update/delete"

**Risk**: All bibliographic records are publicly readable regardless of `status` or `visibility` columns.

### 2. facet_configuration Table

**Problem**: RLS policies exist but RLS is not enabled (or was disabled)

**Details**:
- Should have been enabled in migration `018_faceted_search_configuration.sql`
- Linter detected it's not currently enabled in database

**Risk**: Facet configuration could be modified by unauthorized users.

### 3. facet_values / facets Tables

**Problem**: Tables exist in database but RLS is not enabled

**Details**:
- These tables may have been created manually or by older migrations
- No RLS enabled, no policies defined

**Risk**: Facet data could be modified or exposed inappropriately.

### 4. SECURITY DEFINER Views

**Problem**: Six views are defined with `SECURITY DEFINER` property

**Details**:
- Views run with creator's permissions, not querying user's permissions
- Can bypass RLS if not carefully designed
- Views affected:
  - `marc_records_public`
  - `marc_records_archived`
  - `marc_records_trash`
  - `marc_records_staff_only`
  - `marc_attachment_stats`
  - `facet_matching_records`

**Risk**: If views are not carefully written, they could leak data bypassing RLS.

---

## The Fix

Migration `030_fix_rls_security_issues.sql` addresses all these issues:

### What It Does

1. **Enables RLS on marc_records**
   - Most critical fix
   - Makes existing policies actually work
   - Enforces visibility and status controls

2. **Verifies RLS on facet tables**
   - Ensures `facet_configuration` has RLS enabled
   - Ensures `facet_values_cache` has RLS enabled
   - Conditionally enables RLS on `facets` and `facet_values` if they exist

3. **Recreates views without SECURITY DEFINER**
   - Removes SECURITY DEFINER property from marc_records views
   - Relies on underlying table RLS instead
   - More secure approach

4. **Verification queries**
   - Displays RLS status for all affected tables
   - Shows policy counts
   - Helps confirm fix was applied correctly

---

## How to Apply the Fix

### Step 1: Backup (Recommended)

Before applying any database changes, create a backup:

1. Go to Supabase Dashboard → Database → Backups
2. Create a manual backup
3. Wait for confirmation

### Step 2: Apply Migration

1. Go to Supabase Dashboard → SQL Editor
2. Open the file `migrations/030_fix_rls_security_issues.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 3: Verify Results

The migration includes verification queries that will display:

```
============================================
RLS STATUS VERIFICATION
============================================
Table: facet_configuration - RLS: ✅ ENABLED
Table: facet_values_cache - RLS: ✅ ENABLED
Table: marc_records - RLS: ✅ ENABLED
============================================
RLS POLICY COUNTS
============================================
Table: facet_configuration - Policies: 2
Table: facet_values_cache - Policies: 2
Table: marc_records - Policies: 5
============================================
```

**Expected output:**
- All tables should show "✅ ENABLED"
- Policy counts should be > 0
- No errors or warnings

### Step 4: Test the Application

After applying the migration, test the following:

#### Test 1: Public Catalog Access
1. Log out or open incognito window
2. Go to `/catalog/search`
3. Search for records
4. ✅ Should see active, public records
5. ❌ Should NOT see archived or staff-only records

#### Test 2: Admin Access
1. Log in as admin
2. Go to `/admin/cataloging`
3. ✅ Should see all records (active, archived, staff-only)
4. Try editing a record
5. ✅ Should work normally

#### Test 3: Archive Functionality
1. As admin, archive a record
2. Check public catalog
3. ✅ Archived record should NOT appear in public search
4. Check admin archives
5. ✅ Should appear in `/admin/cataloging/archives`

#### Test 4: Faceted Search
1. Go to `/catalog/search`
2. Use facets to filter results
3. ✅ Facets should display and filter correctly

---

## Rollback Plan

If anything goes wrong, you can rollback the changes:

### Rollback Script

```sql
-- ROLLBACK: Disable RLS (not recommended - only for emergency)
ALTER TABLE marc_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE facet_configuration DISABLE ROW LEVEL SECURITY;
ALTER TABLE facet_values_cache DISABLE ROW LEVEL SECURITY;

-- Or restore from backup in Supabase Dashboard
```

**Note**: Disabling RLS is **not recommended** as it removes security protections. Better to restore from backup if issues occur.

---

## Technical Details

### Why RLS Policies Without RLS Enabled Don't Work

In PostgreSQL/Supabase:
1. `CREATE POLICY` defines **what the rules are**
2. `ENABLE ROW LEVEL SECURITY` turns **on the enforcement**

If you create policies but don't enable RLS, the policies exist but are completely ignored. It's like writing laws but never enforcing them.

### How RLS Works

```
User Request → PostgREST → PostgreSQL
                              ↓
                        Is RLS enabled?
                              ↓
                    Yes → Check policies → Filter rows
                    No  → Return all rows (INSECURE!)
```

### The marc_records Table Policies

After this fix, these policies are enforced:

1. **Public read access for active visible records**
   ```sql
   TO anon, authenticated
   USING (status = 'active' AND visibility = 'public')
   ```
   Anonymous users can only see active, public records.

2. **Staff read access to all records**
   ```sql
   TO authenticated
   USING (status IN ('active', 'archived') OR ...)
   ```
   Authenticated (staff) users can see everything.

3. **Write policies**
   - Only authenticated users can INSERT/UPDATE/DELETE
   - All operations allowed (staff has full access)

---

## FAQ

### Q: Why wasn't RLS enabled in the first place?

**A**: Migration `022_archives_and_visibility.sql` created the policies but forgot to include `ENABLE ROW LEVEL SECURITY`. This is a common oversight when writing database migrations.

### Q: Was our data exposed?

**A**: Potentially yes, if the database is accessible via PostgREST API (which Supabase provides by default). Anyone with API access could have read all records regardless of status/visibility. This fix closes that gap.

### Q: Will this break anything?

**A**: No, this fix makes the database **work as intended**. The policies were already written assuming RLS was enabled. We're just turning on the enforcement mechanism.

### Q: Do I need to update my application code?

**A**: No code changes required. The application code already assumes these security policies are in place. This fix makes the database match that assumption.

### Q: What about the SECURITY DEFINER views?

**A**: The fix recreates them without SECURITY DEFINER. This is safer because they'll now rely on the underlying table's RLS policies rather than running with elevated permissions.

---

## Verification Checklist

After applying the fix, verify the following:

- [ ] Migration ran without errors
- [ ] Verification queries show RLS enabled on all tables
- [ ] Public catalog shows only active, public records
- [ ] Admin panel shows all records
- [ ] Archived records hidden from public, visible to staff
- [ ] Faceted search works correctly
- [ ] No errors in Supabase logs
- [ ] Application performance is normal

---

## Related Files

- **Migration**: `migrations/030_fix_rls_security_issues.sql`
- **Original Archive Migration**: `migrations/022_archives_and_visibility.sql`
- **Facet Migration**: `migrations/018_faceted_search_configuration.sql`
- **Database Schema**: `DATABASE_SCHEMA.md`

---

## Contact

If you encounter any issues applying this fix:

1. Check Supabase logs for error messages
2. Review the verification queries output
3. Test with the checklist above
4. If problems persist, restore from backup and investigate

---

**Last Updated**: 2026-01-14
**Migration Version**: 030
**Status**: Ready to apply ✅
