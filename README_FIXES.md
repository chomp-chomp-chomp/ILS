# Complete Fix Guide for All Issues

## Problem Summary

You reported several issues that all stem from **missing database columns**:

1. ❌ **Branding admin page not working** - Header links, homepage info links, logo, favicon not saving/displaying
2. ❌ **Facets showing headers but no checkboxes** - Facet labels not displaying
3. ❌ **Footer not displaying** - Fixed in code, but branding data may not exist

## Root Cause

The original branding migration (`migrations/015_branding_configuration.sql`) was missing several columns that the admin interface and code were trying to use:

**Missing columns:**
- `show_header` - Whether to show custom header
- `header_links` - JSONB array of header navigation links
- `show_homepage_info` - Whether to show homepage info section
- `homepage_info_title` - Title for homepage info section
- `homepage_info_content` - Content for homepage info section
- `homepage_info_links` - JSONB array of homepage info links

**Result:** When you tried to save branding settings with header links or homepage info, the database rejected the query because those columns didn't exist. Same for logo/favicon - they couldn't save properly.

## The Fix

### Step 1: Run the Complete Migration

**Use the file:** `FIX_ALL_ISSUES.sql`

This single script fixes **everything**:
1. Adds the missing branding columns
2. Creates facet configuration tables
3. Enables Unicode/diacritic-insensitive search
4. Includes diagnostic queries at the end

**How to apply:**

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open the file `FIX_ALL_ISSUES.sql` from your project root
3. Copy the **entire contents**
4. Paste into SQL Editor
5. Click **Run**
6. Wait 30-60 seconds for completion

**Expected output at the end:**

```
✓ Branding table updated!
  has_header_field: 1
  has_header_links_field: 1

✓ Facets configured!
  total_facets_enabled: 5

Catalog data check:
  total_records: X (your number of records)
  distinct_material_types: Y
  distinct_languages: Z
```

### Step 2: Verify Branding Admin Works

After running the migration:

1. Go to `/admin/branding`
2. Try adding a header link:
   - Title: "Advanced Search"
   - URL: "/catalog/search/advanced"
   - Click "Add Header Link"
3. Click "Save Changes"
4. **Reload the page** - link should persist
5. Visit any public page (not `/admin`) - header should show if `show_header` is enabled

### Step 3: Check Why Facets Aren't Showing

The facet configurations are created, but **checkboxes won't appear unless you have catalog data**.

**Run this diagnostic query in Supabase SQL Editor:**

```sql
-- Check if you have catalog records
SELECT
  COUNT(*) as total_records,
  COUNT(DISTINCT material_type) as material_types,
  COUNT(DISTINCT language_code) as languages,
  COUNT(*) FILTER (WHERE material_type IS NOT NULL) as records_with_type,
  COUNT(*) FILTER (WHERE language_code IS NOT NULL) as records_with_language
FROM marc_records
WHERE status = 'active' AND visibility = 'public';
```

**If you see `total_records: 0`:**
- Your catalog is empty - facets won't show because there's nothing to filter
- Add some test records first, then facets will populate

**If you see records but `material_types: 0` or `languages: 0`:**
- Your records don't have `material_type` or `language_code` set
- Update some records to add these fields

**Example: Add material_type to existing records:**
```sql
UPDATE marc_records
SET material_type = 'book'
WHERE material_type IS NULL
  AND status = 'active'
  LIMIT 10;
```

### Step 4: Check Footer Display

The footer should now display if you have ANY of these in your branding:
- Footer text
- Contact email/phone/address
- Social media links (Facebook, Twitter, Instagram)
- OR `show_powered_by = true`

**To enable footer with default text:**
```sql
UPDATE branding_configuration
SET
  footer_text = 'Powered by Open Library System',
  show_powered_by = true,
  contact_email = 'library@example.com'
WHERE is_active = true;
```

Then visit any public page and scroll to bottom.

## Understanding the Issues

### Issue 1: Branding Not Saving

**What was happening:**
1. You filled out branding form with header links
2. Clicked "Save"
3. Frontend sent this data to `/api/branding`:
   ```json
   {
     "header_links": [{"title": "Link", "url": "/path"}],
     "logo_url": "https://...",
     ...
   }
   ```
4. API tried to save to database: `UPDATE branding_configuration SET header_links = ...`
5. PostgreSQL error: `column "header_links" does not exist`
6. Save failed silently (no error shown to user)

**After the fix:**
- Columns now exist
- Data saves successfully
- Settings persist across reloads

### Issue 2: Facets Showing Headers but No Checkboxes

**What was happening:**
1. Facet configs loaded correctly from database ✅
2. Frontend tried to compute facet VALUES (the actual options):
   ```typescript
   computeDatabaseColumnFacet(supabase, 'material_type')
   // Returns: [] (empty array)
   ```
3. Empty array = no checkboxes to display
4. Sidebar shows section headers but nothing inside

**Why facets were empty:**
- Either no marc_records in database
- OR records don't have the faceted fields (`material_type`, `language_code`, etc.)

**After the fix:**
- Migration creates facet configs ✅
- **BUT** you still need catalog data for facets to populate
- Once you have records with `material_type`, `language_code`, etc., facets will show

### Issue 3: Logo/Favicon Not Reflecting

**What was happening:**
1. You set `logo_url` and `favicon_url` in admin
2. Save appeared to work
3. But values didn't persist (due to missing columns)
4. Layout loaded default values from code

**After the fix:**
1. Set `logo_url` and `favicon_url` in `/admin/branding`
2. Click "Save Changes"
3. Values save to database
4. `+layout.svelte` loads them from database
5. Logo/favicon display across site

**Note:** The layout uses:
- `logo_url` - For header navigation logo (when `show_header = true`)
- `homepage_logo_url` - For the large logo on homepage
- `favicon_url` - For browser tab icon

## Testing After Fix

### 1. Test Branding Admin

```bash
# Visit admin page
https://library.chompchomp.cc/admin/branding

# Fill in some fields
- Library Name: "My Library"
- Footer Text: "Welcome to our library"
- Contact Email: "info@library.com"
- Logo URL: "https://example.com/logo.png"

# Add a header link
- Title: "Catalog"
- URL: "/catalog"
- Click "Add Header Link"

# Save
- Click "Save Changes"
- Should see: "Branding settings saved successfully!"

# Reload page
- All fields should still have your values
- Header link should still be there
```

### 2. Test Footer

```bash
# Visit any public page
https://library.chompchomp.cc/catalog

# Scroll to bottom
# Should see footer with:
- Footer text
- Contact email (clickable mailto link)
- Social links (if configured)
```

### 3. Test Header

```bash
# Enable custom header
1. Go to /admin/branding
2. Check "Show Custom Header"
3. Add some header links
4. Save

# Visit any page except homepage
https://library.chompchomp.cc/catalog

# Should see custom header at top with your links
```

### 4. Test Facets

```bash
# Make sure you have catalog data first!
# Go to Supabase SQL Editor and run:
SELECT COUNT(*) FROM marc_records WHERE status = 'active';

# If count = 0, add a test record:
INSERT INTO marc_records (
  title_statement,
  main_entry_personal_name,
  material_type,
  language_code,
  status,
  visibility
) VALUES (
  '{"a": "Test Book"}'::jsonb,
  '{"a": "Author Name"}'::jsonb,
  'book',
  'eng',
  'active',
  'public'
);

# Now visit search results
https://library.chompchomp.cc/catalog/search/results?q=test

# Check left sidebar
# Should see:
- Material Type section with "Books (1)" checkbox
- Language section with "English (1)" checkbox
```

### 5. Test Unicode Search

```bash
# Add a record with diacritics:
INSERT INTO marc_records (
  title_statement,
  main_entry_personal_name,
  material_type,
  status,
  visibility
) VALUES (
  '{"a": "Žižek Philosophy"}'::jsonb,
  '{"a": "Slavoj Žižek"}'::jsonb,
  'book',
  'active',
  'public'
);

# Search without diacritics:
https://library.chompchomp.cc/catalog/search/results?q=Zizek

# Should find the record with "Žižek"
```

## Troubleshooting

### Branding Still Not Saving

**Check browser console for errors:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try saving again
4. Look for red errors

**Common issues:**
- Authentication expired (log out and back in)
- RLS policies blocking (check Supabase logs)
- Network error (check internet connection)

**Check Supabase logs:**
1. Go to Supabase Dashboard → Logs
2. Filter by "Postgres Logs"
3. Look for errors around the time you tried to save

### Facets Still Not Showing

**Most common cause: No catalog data**

Run this to check:
```sql
-- See what data exists
SELECT
  material_type,
  COUNT(*) as count
FROM marc_records
WHERE status = 'active' AND visibility = 'public'
GROUP BY material_type;
```

If you get no results, you need to add records first.

### Footer Still Not Showing

**Check branding data exists:**
```sql
SELECT
  footer_text,
  show_powered_by,
  contact_email,
  is_active
FROM branding_configuration
WHERE is_active = true;
```

If no results, you need to create branding settings:
```sql
INSERT INTO branding_configuration (
  library_name,
  footer_text,
  show_powered_by,
  is_active
) VALUES (
  'My Library',
  'Welcome to our library',
  true,
  true
);
```

### Logo/Favicon Not Updating

**After setting in admin:**
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Try in incognito/private window

**Verify the URLs are correct:**
- Must be full URLs starting with `https://`
- Image must be publicly accessible
- Check browser Network tab to see if image loads

## Summary of Changes

**Files modified:**
- `src/routes/+layout.svelte` - Footer display logic fixed
- `src/routes/catalog/search/results/FacetSidebar.svelte` - Error handling improved

**Files created:**
- `migrations/024_header_homepage_info.sql` - Adds missing branding columns
- `FIX_ALL_ISSUES.sql` - Complete migration combining all fixes
- `APPLY_FIXES.sql` - Earlier version (superseded by FIX_ALL_ISSUES.sql)
- `MIGRATION_INSTRUCTIONS.md` - Detailed migration guide
- `README_FIXES.md` - This file

**Database changes required:**
- Add 6 new columns to `branding_configuration` table
- Create `facet_configuration` and `facet_values_cache` tables
- Enable `unaccent` extension and create helper functions
- Rebuild search vectors for diacritic-insensitive search

## Next Steps

1. ✅ Run `FIX_ALL_ISSUES.sql` in Supabase SQL Editor
2. ✅ Go to `/admin/branding` and configure your settings
3. ✅ Add catalog records if you don't have any (for facets to work)
4. ✅ Test all features (header, footer, facets, Unicode search)
5. ✅ Report any remaining issues

All code changes have been committed to the branch:
**`claude/fix-search-facets-footer-LoayK`**

Ready to merge once you confirm everything works!
