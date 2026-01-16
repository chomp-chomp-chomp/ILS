# Diacritic-Insensitive Search Fix - Comprehensive Guide

## Problem
Searching for "Zizek" from the homepage search box did **not** return results for "Žižek", but searching from advanced search **did** work correctly. This inconsistency was confusing for users.

## Root Cause
The system had two different search implementations:

1. **Basic keyword search** (from homepage):
   - Used Supabase's `textSearch()` method
   - Applied client-side JavaScript normalization via `normalizeSearchQuery()`
   - JavaScript's NFD normalization doesn't perfectly match PostgreSQL's `unaccent` function
   - The `websearch_to_tsquery()` function inside `textSearch()` was not applying normalization correctly

2. **Advanced search** (from advanced search page):
   - Used custom RPC function `search_marc_records_advanced()`
   - Applied server-side normalization using PostgreSQL's `remove_diacritics()` function
   - Worked correctly because normalization was consistent on both sides

## Solution

Created a matching RPC function for basic keyword search to ensure consistency.

### New Migration: `migrations/030_basic_search_diacritic_fix.sql`

```sql
CREATE OR REPLACE FUNCTION search_marc_records_basic(
  search_query TEXT
)
RETURNS TABLE (
  -- Returns all marc_records columns
) AS $$
BEGIN
  -- Normalize the search query to remove diacritics
  search_query := remove_diacritics(search_query);
  
  -- Search against the pre-normalized search_vector
  RETURN QUERY
  SELECT m.*
  FROM marc_records m
  WHERE m.status = 'active'
    AND m.visibility = 'public'
    AND m.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) DESC;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Updated Search Logic

**Before** (`src/routes/(public)/catalog/search/results/+page.server.ts`):
```typescript
// Basic keyword search
if (params.q) {
  const normalizedQuery = normalizeSearchQuery(params.q); // JavaScript normalization
  query = query.textSearch('search_vector', normalizedQuery, {
    type: 'websearch',
    config: 'english'
  });
}
```

**After**:
```typescript
// Basic keyword search using RPC function
if (params.q) {
  const { data: searchResults, error: searchError } = await supabase.rpc(
    'search_marc_records_basic',
    { search_query: params.q }
  );
  
  // Apply filters and pagination to results
  // ... (filtering logic)
}
```

## How It Works

### The Complete Flow

1. **User enters "Zizek" in homepage search**
2. **RPC function receives query**: `search_query = "Zizek"`
3. **PostgreSQL normalizes query**: `remove_diacritics("Zizek")` → `"Zizek"`
4. **Search against normalized index**:
   - The `search_vector` column was created with `remove_diacritics()` in the trigger
   - So "Žižek" in the database is indexed as "Zizek"
5. **Match found**: "Zizek" query matches "Zizek" index entry (which came from "Žižek" record)
6. **Result returned**: Record with "Žižek" is included in results

### Normalization Consistency

Both the **index creation** (via trigger) and **query processing** (via RPC) use the same PostgreSQL `remove_diacritics()` function, which wraps the `unaccent` extension:

```sql
-- Trigger creates normalized index
CREATE TRIGGER trigger_marc_search_vector
  BEFORE INSERT OR UPDATE ON marc_records
  FOR EACH ROW
  EXECUTE FUNCTION update_marc_search_vector();

-- Function applies remove_diacritics() to all text fields
CREATE FUNCTION update_marc_search_vector() ...
  setweight(
    to_tsvector('english', remove_diacritics(COALESCE(title, ''))),
    'A'
  )
```

```sql
-- RPC normalizes search query with same function
CREATE FUNCTION search_marc_records_basic(search_query TEXT) ...
  search_query := remove_diacritics(search_query);
```

## Benefits

1. **Consistent behavior**: Homepage and advanced search now both handle diacritics correctly
2. **Better UX**: Users can search without worrying about proper accent marks
3. **Multilingual support**: Works for any language with diacritics (French, Spanish, German, etc.)
4. **No performance impact**: Uses existing normalized index, no additional overhead

## Testing

### Manual Testing

**Test searches that should all return the same results:**
- "Zizek" → finds "Žižek"
- "Žižek" → finds "Žižek"
- "zizek" → finds "Žižek" (case-insensitive)
- "ŽIŽEK" → finds "Žižek" (case-insensitive)

**Other examples:**
- "Muller" → finds "Müller"
- "cafe" → finds "café"
- "naive" → finds "naïve"
- "Borges" → finds "Borges" and "Borgês"

### Database Testing

```sql
-- Test the remove_diacritics function directly
SELECT remove_diacritics('Žižek'); -- Returns: 'Zizek'
SELECT remove_diacritics('Café'); -- Returns: 'Cafe'
SELECT remove_diacritics('Müller'); -- Returns: 'Muller'

-- Test the search function
SELECT id, title_statement->>'a' as title
FROM search_marc_records_basic('Zizek')
LIMIT 5;
```

### Network Testing

Check browser console:
```javascript
// Before fix: Uses textSearch (inconsistent)
// After fix: Uses RPC call
fetch('/rest/v1/rpc/search_marc_records_basic', {
  method: 'POST',
  body: JSON.stringify({ search_query: 'Zizek' })
})
```

## Installation Steps

### Step 1: Apply Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy the contents of `migrations/030_basic_search_diacritic_fix.sql`
4. Click **Run**
5. Wait for "Success. No rows returned" message

### Step 2: Verify Function Exists

```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'search_marc_records_basic';
```

Should return:
```
routine_name                | routine_type
---------------------------+-------------
search_marc_records_basic  | FUNCTION
```

### Step 3: Test the Function

```sql
-- Should return records (if you have any matching data)
SELECT 
  id,
  title_statement->>'a' as title,
  main_entry_personal_name->>'a' as author
FROM search_marc_records_basic('test')
LIMIT 5;
```

### Step 4: Deploy Application Code

The application code changes are already in place:
- `src/routes/(public)/catalog/search/results/+page.server.ts`
- `src/lib/components/BookCover.svelte`

Deploy via Vercel/your hosting platform.

### Step 5: Test End-to-End

1. Navigate to homepage search
2. Enter "Zizek" (or any author/title with diacritics)
3. Verify results include records with accented characters
4. Compare with advanced search results (should be identical)

## Related Files

- `migrations/024_diacritic_insensitive_search.sql` - Original diacritic support (trigger)
- `migrations/025_fix_advanced_search_diacritics.sql` - Advanced search RPC
- `migrations/030_basic_search_diacritic_fix.sql` - Basic search RPC (this fix)
- `src/routes/(public)/catalog/search/results/+page.server.ts` - Search implementation
- `src/lib/utils/text-normalize.ts` - Client-side normalization (now only used for display)

## Technical Details

### Why Client-Side Normalization Wasn't Enough

JavaScript's `String.normalize('NFD')` and PostgreSQL's `unaccent` extension can produce different results:

```javascript
// JavaScript NFD
"Žižek".normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// Result: "Zizek"

// But for some characters:
"ø".normalize('NFD') 
// Result: "ø" (no decomposition available)

// PostgreSQL unaccent
SELECT unaccent('ø');
// Result: 'o' (uses character mapping table)
```

The `unaccent` extension has more comprehensive character mappings, so using it consistently on both sides ensures reliable matching.

### Performance Considerations

- **Indexing overhead**: Already done via trigger, no additional cost
- **Query performance**: RPC function uses same optimized index as before
- **Result set**: Same relevance ranking via `ts_rank()`
- **Network**: Minimal increase (one RPC call vs one REST query)

## Troubleshooting

### Issue: Function not found error

**Error**: `function search_marc_records_basic(text) does not exist`

**Solution**: Run the migration again, ensure it completes without errors

### Issue: Still not finding diacritic results

**Problem**: Search still doesn't work after applying migration

**Solutions**:

1. **Rebuild search vectors**:
   ```sql
   UPDATE marc_records SET updated_at = NOW();
   ```

2. **Check unaccent extension**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'unaccent';
   ```
   
   If not installed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS unaccent;
   ```

3. **Verify trigger is active**:
   ```sql
   SELECT 
     trigger_name,
     event_manipulation,
     action_statement
   FROM information_schema.triggers
   WHERE trigger_name = 'trigger_marc_search_vector';
   ```

### Issue: Performance degradation

**Problem**: Search is slower after applying fix

**Solutions**:

1. **Check index exists**:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'marc_records' 
   AND indexname LIKE '%search_vector%';
   ```

2. **Analyze table**:
   ```sql
   ANALYZE marc_records;
   ```

3. **Check query plan**:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM search_marc_records_basic('test');
   ```

## Future Enhancements

Consider:
1. Adding support for alternative spellings (British vs American)
2. Implementing fuzzy matching for typos (using pg_trgm)
3. Adding language-specific analyzers (beyond English)
4. Supporting transliteration (e.g., Cyrillic → Latin)
5. Caching frequent searches in Redis
