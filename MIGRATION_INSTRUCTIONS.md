# Database Migration Instructions

## Required Migrations to Fix Current Issues

You need to apply the following migrations to fix the reported issues:

### 1. Faceted Search Configuration (Fix: Facet labels not displaying)

**Migration File**: `migrations/018_faceted_search_configuration.sql`

**What it does**:
- Creates the `facet_configuration` table that stores facet settings
- Creates the `facet_values_cache` table for performance
- Inserts default facet configurations:
  - Material Type facet
  - Language facet
  - Publication Decade facet
  - Availability facet
  - Location facet

**How to apply**:
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open a new query
4. Copy the entire contents of `migrations/018_faceted_search_configuration.sql`
5. Paste and click **Run**
6. Verify success - you should see "Success. No rows returned"

### 2. Diacritic-Insensitive Search (Fix: Unicode character search)

**Migration File**: `migrations/024_diacritic_insensitive_search.sql`

**What it does**:
- Enables the PostgreSQL `unaccent` extension to remove diacritics
- Creates a `remove_diacritics()` function
- Updates the `update_marc_search_vector()` trigger to normalize text before indexing
- Rebuilds all existing search vectors with diacritic-insensitive indexing
- Creates a `normalize_search_query()` helper function

**Impact**: After applying this migration, searches like:
- "Zizek" will match "Žižek"
- "Muller" will match "Müller"
- "susse" will match "süsse"
- "Cafe" will match "Café"

**How to apply**:
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open a new query
4. Copy the entire contents of `migrations/024_diacritic_insensitive_search.sql`
5. Paste and click **Run**
6. **Note**: This migration will take a few moments to complete as it rebuilds all search vectors
7. Verify success - you should see "UPDATE X" where X is the number of records updated

## Verification Steps

### Verify Facet Configuration

Run this query in Supabase SQL Editor:

```sql
SELECT facet_key, facet_label, is_enabled, display_order
FROM facet_configuration
WHERE is_enabled = true
ORDER BY display_order;
```

**Expected result**: You should see 4-5 facets listed:
- material_type
- language
- publication_decade
- availability
- location

### Verify Diacritic Search

Run this query in Supabase SQL Editor:

```sql
-- Check if unaccent extension is enabled
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') AS unaccent_enabled;

-- Check if the function exists
SELECT EXISTS (
  SELECT 1 FROM pg_proc
  WHERE proname = 'remove_diacritics'
) AS function_exists;

-- Test the function
SELECT remove_diacritics('Žižek') AS normalized;
```

**Expected results**:
- `unaccent_enabled`: true
- `function_exists`: true
- `normalized`: "Zizek"

## Testing After Migration

### Test Facets

1. Go to `/catalog/search/results?q=test` (or any search)
2. Check the left sidebar - you should see facet sections with:
   - **Material Type** - with checkboxes and labels (Books, E-Books, etc.)
   - **Language** - with checkboxes and labels (English, Spanish, etc.)
   - **Publication Decade** - with checkboxes and labels (2020s, 2010s, etc.)
   - **Availability** - with checkboxes and labels (Available, Checked Out, etc.)
3. Click checkboxes to filter - results should update

### Test Unicode Search

1. Add a test record with Unicode characters (or find one in your catalog):
   - Title: "Žižek's Philosophy" or "Süsse Träume"
2. Search for the non-accented version:
   - Search "Zizek" - should find "Žižek"
   - Search "Susse Traume" - should find "Süsse Träume"
3. Both accented and non-accented searches should work

### Test Footer

1. Visit any public page (not /admin)
2. Scroll to the bottom
3. You should see the footer if:
   - `show_powered_by` is enabled in branding, OR
   - There's a `footer_text`, OR
   - There's any contact information or social links

## Troubleshooting

### Facets Still Not Showing

**Possible causes**:
1. **No data in catalog**: Facets only show when there are values to display
   - Add some test records with material_type, language_code, etc.
2. **Facet configuration not loaded**: Check browser console for errors
3. **RLS policies blocking access**: Verify you can read from `facet_configuration` table

**Debug query**:
```sql
-- Check if facets have data sources
SELECT
  fc.facet_key,
  fc.facet_label,
  COUNT(DISTINCT mr.material_type) as distinct_values
FROM facet_configuration fc
CROSS JOIN marc_records mr
WHERE fc.facet_key = 'material_type'
  AND fc.is_enabled = true
GROUP BY fc.facet_key, fc.facet_label;
```

### Unicode Search Not Working

**Possible causes**:
1. **Extension not enabled**: Run `CREATE EXTENSION IF NOT EXISTS unaccent;` manually
2. **Search vectors not rebuilt**: Run `UPDATE marc_records SET updated_at = NOW();`
3. **Old search code cached**: Clear browser cache and restart dev server

**Debug query**:
```sql
-- Test search vector for a record with diacritics
SELECT
  title_statement->>'a' as title,
  ts_rank(search_vector, websearch_to_tsquery('english', 'zizek')) as rank
FROM marc_records
WHERE title_statement->>'a' ILIKE '%Žižek%'
LIMIT 5;
```

If rank > 0, search vectors are working correctly.

### Footer Still Not Showing

**Possible causes**:
1. **No branding data**: Check if branding table has data
2. **Only on admin pages**: Footer is hidden on `/admin` routes by design
3. **Default branding values**: If no custom branding, footer won't show unless you set footer_text

**Quick fix**: Set a footer text in branding configuration:
```sql
UPDATE branding_configuration
SET footer_text = 'Powered by Open Library System',
    show_powered_by = true
WHERE is_active = true;
```

## Migration Order

If applying multiple migrations, use this order:

1. ✅ `018_faceted_search_configuration.sql` - Facet system
2. ✅ `024_diacritic_insensitive_search.sql` - Unicode search

## Rollback (If Needed)

If something goes wrong, you can rollback:

### Rollback Facet Configuration

```sql
DROP TABLE IF EXISTS facet_values_cache CASCADE;
DROP TABLE IF EXISTS facet_configuration CASCADE;
DROP FUNCTION IF EXISTS update_facet_config_timestamp() CASCADE;
DROP FUNCTION IF EXISTS invalidate_facet_cache() CASCADE;
```

### Rollback Diacritic Search

```sql
-- Restore old search vector function (without diacritics)
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

-- Rebuild search vectors
UPDATE marc_records SET updated_at = NOW();

-- Optionally remove extension
DROP FUNCTION IF EXISTS remove_diacritics(text) CASCADE;
DROP FUNCTION IF EXISTS normalize_search_query(text) CASCADE;
-- DROP EXTENSION IF EXISTS unaccent; -- Only if not used elsewhere
```

## Need Help?

If you encounter issues:

1. Check Supabase logs for SQL errors
2. Check browser console for JavaScript errors
3. Verify table permissions (RLS policies)
4. Ensure you're using the latest code from the repository

## Code Changes Already Made

The following code changes have already been applied to fix the footer:

**File**: `src/routes/+layout.svelte` (line 59)

**Before**:
```typescript
let showFooter = $derived(branding.show_powered_by === true && !$page.url.pathname.startsWith('/admin'));
```

**After**:
```typescript
let showFooter = $derived(
  !$page.url.pathname.startsWith('/admin') &&
  (branding.show_powered_by === true ||
   branding.footer_text ||
   branding.contact_email ||
   branding.contact_phone ||
   branding.contact_address ||
   branding.facebook_url ||
   branding.twitter_url ||
   branding.instagram_url)
);
```

This change makes the footer display whenever there's any footer content, not just when `show_powered_by` is enabled.
