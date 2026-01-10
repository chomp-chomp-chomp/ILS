# Fix: Special Character Search Issue

**Problem:** Searching for "Zizek" doesn't return results for "Žižek"

**Solution:** Apply database migration to enable diacritic-insensitive search

---

## Quick Start (3 Steps)

### Step 1: Run Diagnostic Test

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of: `test-diacritic-search.sql`
4. Click **Run**
5. Review the test results

### Step 2: Apply Migration (if needed)

**If tests show the migration is NOT applied:**

1. In **Supabase SQL Editor**, click **New Query**
2. Copy and paste the contents of: `migrations/024_diacritic_insensitive_search.sql`
3. Click **Run**
4. Wait for "Success" message

**If tests show the migration IS applied but search still doesn't work:**

Run this to rebuild search vectors:

```sql
UPDATE marc_records SET updated_at = NOW();
```

### Step 3: Test the Fix

1. Go to your catalog search page
2. Search for "Zizek" (without special characters)
3. You should now see results for "Žižek"

---

## Files Created

1. **test-diacritic-search.sql** - Diagnostic tests (run this first!)
2. **MIGRATION_024_REFERENCE.md** - Complete documentation with examples
3. **DIACRITIC_SEARCH_FIX.md** - This quick start guide

---

## How It Works

The fix works by normalizing text on both sides:

**Database side (indexing):**
- When a record is saved with "Žižek"
- It's indexed as "Zizek" (diacritics removed)

**Application side (searching):**
- When user searches "Zizek"
- It's normalized to "Zizek" (already no diacritics)
- Matches the indexed "Zizek"
- Returns records with original "Žižek"

**Result:** User can type "Zizek" and find "Žižek" ✅

---

## Characters Supported

Works with all common diacritics:

- À Á Â Ã Ä Å → A
- È É Ê Ë → E
- Ì Í Î Ï → I
- Ò Ó Ô Õ Ö → O
- Ù Ú Û Ü → U
- Ñ → N
- Ç → C
- Ž → Z
- Š → S
- And many more...

---

## What If It Still Doesn't Work?

### Option A: Check the diagnostic results

Look at the test output:
- ❌ FAIL results indicate which part needs fixing
- ✅ PASS results confirm that part is working

### Option B: Common issues

**Issue 1: No records with diacritics exist**
- Solution: The search works, you just don't have test data
- Try creating a test record (see MIGRATION_024_REFERENCE.md)

**Issue 2: Search vectors not rebuilt**
- Solution: Run `UPDATE marc_records SET updated_at = NOW();`

**Issue 3: unaccent extension not available**
- Solution: Contact Supabase support or check PostgreSQL version

**Issue 4: Client-side code not deployed**
- Solution: Clear browser cache and refresh
- Check that `/src/lib/utils/text-normalize.ts` exists

---

## Need More Help?

See **MIGRATION_024_REFERENCE.md** for:
- Detailed explanation of how it works
- Troubleshooting guide
- Example SQL queries
- Rollback instructions
- Performance impact analysis

---

## Summary

✅ **Files ready to use:**
- Diagnostic test script
- Migration SQL (if needed)
- Complete documentation

✅ **Next action:**
1. Run `test-diacritic-search.sql` in Supabase SQL Editor
2. Follow the results to determine if migration needs to be applied
3. Test by searching for "Zizek" in your catalog

---

That's it! Once the migration is applied and search vectors are rebuilt, searching for "Zizek" will find "Žižek" automatically.
