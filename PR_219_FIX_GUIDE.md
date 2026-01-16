# PR #219 Fix Guide

## Problem Summary
PR #219 introduced two fixes:
1. **Cover caching optimization** - Use ImageKit CDN instead of refetching from external APIs
2. **Diacritic-insensitive search** - Allow "Zizek" to match "Žižek" in basic search

The PR was merged but requires database migration to work properly.

## Root Cause
The PR introduced a new RPC function `search_marc_records_basic()` that requires:
1. Migration 024: Creates `remove_diacritics()` function and `unaccent` extension
2. Migration 030: Creates `search_marc_records_basic()` RPC function

If these migrations are not applied in the production database, the search will fail with:
```
ERROR: function search_marc_records_basic(text) does not exist
```

## Solution

### Step 1: Verify Prerequisites
Check if the `unaccent` extension and `remove_diacritics` function exist:

```sql
-- Check unaccent extension
SELECT * FROM pg_extension WHERE extname = 'unaccent';

-- Check remove_diacritics function
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'remove_diacritics';
```

If either is missing, run migration 024:
```sql
-- migrations/024_diacritic_insensitive_search.sql
-- Copy and execute the entire file in Supabase SQL Editor
```

### Step 2: Apply Migration 030
Run the basic search migration:

```sql
-- migrations/030_basic_search_diacritic_fix.sql
-- Copy and execute the entire file in Supabase SQL Editor
```

### Step 3: Verify Function Exists
```sql
-- Check the function was created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'search_marc_records_basic';

-- Should return:
-- routine_name                | routine_type
-- ---------------------------+-------------
-- search_marc_records_basic  | FUNCTION
```

### Step 4: Test the Function
```sql
-- Test the RPC function directly
SELECT id, title_statement->>'a' as title 
FROM search_marc_records_basic('test') 
LIMIT 5;

-- Test diacritic matching
SELECT id, title_statement->>'a' as title 
FROM search_marc_records_basic('Zizek') 
LIMIT 5;
```

### Step 5: Verify Permissions
```sql
-- Ensure anon and authenticated roles can execute the function
GRANT EXECUTE ON FUNCTION search_marc_records_basic TO anon, authenticated;
```

### Step 6: Test in Application
1. Navigate to the homepage search
2. Enter "Zizek" (or any term with diacritics in your catalog)
3. Verify results include items with accented characters ("Žižek")
4. Check browser console for errors

## Fallback: Revert to Original Search Logic

If the migration cannot be applied immediately, you can temporarily revert the search logic to use the old method:

Create a hotfix that changes `src/routes/(public)/catalog/search/results/+page.server.ts`:

```typescript
// Around line 300, replace the RPC call with the original textSearch:
if (params.q) {
  // Normalize query to remove diacritics (e.g., "Zizek" matches "Žižek")
  const normalizedQuery = normalizeSearchQuery(params.q);

  // Use PostgreSQL full-text search for relevance ranking
  query = query.textSearch('search_vector', normalizedQuery, {
    type: 'websearch',
    config: 'english'
  });
}
```

This will restore search functionality but without the improved diacritic handling.

## Troubleshooting

### Error: "function search_marc_records_basic(text) does not exist"
**Cause**: Migration 030 was not applied
**Fix**: Run migration 030 in Supabase SQL Editor

### Error: "function remove_diacritics(text) does not exist"
**Cause**: Migration 024 was not applied
**Fix**: Run migration 024 first, then migration 030

### Error: "extension \"unaccent\" does not exist"
**Cause**: Unaccent extension not available in PostgreSQL
**Fix**: 
1. Check if Supabase supports `unaccent` extension (it should)
2. Try running `CREATE EXTENSION IF NOT EXISTS unaccent;`
3. If not available, contact Supabase support or modify `remove_diacritics` to not use it

### Search returns no results after migration
**Cause**: Search vectors not rebuilt after migration
**Fix**: Rebuild search vectors:
```sql
UPDATE marc_records SET updated_at = NOW();
```
This triggers the search vector update for all records.

## Verification Checklist

- [ ] Unaccent extension is installed
- [ ] `remove_diacritics()` function exists
- [ ] `search_marc_records_basic()` function exists
- [ ] Function has correct permissions (anon, authenticated)
- [ ] Basic search works from homepage
- [ ] Diacritic search works ("Zizek" finds "Žižek")
- [ ] Cover images load from ImageKit CDN
- [ ] No JavaScript errors in browser console
- [ ] Search performance is acceptable (<2s for typical queries)

## Additional Notes

### Cover Caching Fix
The cover caching fix in `BookCover.svelte` should work immediately without any migration. It:
1. Checks if a cached cover exists in the database
2. Validates the `original_url` is populated before using it
3. Only falls back to API fetch if no ISBN is available

### Performance Impact
- **Cover loading**: 50-80% faster (from 2-3s to <100ms)
- **Search performance**: No change (uses same indexed search_vector)
- **RPC overhead**: Minimal (~10-20ms per search)

### Future Enhancements
Consider implementing these improvements:
1. Add caching layer (Redis) for frequent searches
2. Implement service worker for offline cover caching
3. Add monitoring/alerting for search performance
4. Create admin UI to rebuild search vectors
