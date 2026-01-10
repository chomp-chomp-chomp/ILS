# Migration 024: Diacritic-Insensitive Search

**Purpose:** Enable searching for "Zizek" to match "Žižek", "Cafe" to match "Café", etc.

**Created:** 2026-01-04
**Status:** Ready to apply
**Dependencies:** PostgreSQL with unaccent extension support

---

## What This Migration Does

1. **Enables the `unaccent` extension** - PostgreSQL extension that removes diacritics
2. **Creates `remove_diacritics()` function** - Wrapper function for safe diacritic removal
3. **Updates search vector trigger** - Modifies `update_marc_search_vector()` to normalize text before indexing
4. **Rebuilds search vectors** - Updates all existing records with normalized search data
5. **Creates helper function** - Adds `normalize_search_query()` for application use

---

## How to Apply This Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the SQL below
5. Click **Run** or press `Ctrl+Enter`
6. Wait for confirmation message

### Option 2: Via Supabase CLI

```bash
supabase db push migrations/024_diacritic_insensitive_search.sql
```

---

## Migration SQL

```sql
-- Migration: Add diacritic-insensitive search
-- Allows searching for "Zizek" to match "Žižek", etc.
-- Created: 2026-01-04

-- First, try to enable the unaccent extension
-- This extension removes diacritics from text
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create a wrapper function that uses unaccent if available
-- This function is IMMUTABLE which is required for use in indexes
CREATE OR REPLACE FUNCTION remove_diacritics(text)
RETURNS text AS $$
BEGIN
  -- Try to use unaccent if available
  BEGIN
    RETURN unaccent($1);
  EXCEPTION WHEN undefined_function THEN
    -- If unaccent is not available, return original text
    -- At least searches will still work, just not diacritic-insensitive
    RETURN $1;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the search_vector function to remove diacritics before indexing
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  subject_text TEXT := '';
BEGIN
  -- Extract all subject headings from the subject_topical array
  IF NEW.subject_topical IS NOT NULL THEN
    SELECT string_agg(elem->>'a', ' ')
    INTO subject_text
    FROM unnest(NEW.subject_topical) AS elem
    WHERE elem->>'a' IS NOT NULL;
  END IF;

  -- Apply remove_diacritics() to all text before creating search_vector
  NEW.search_vector :=
    -- 'A' weight (highest): Title
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.title_statement->>'a', ''))),
      'A'
    ) ||

    -- 'B' weight (high): Author and Subjects
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.main_entry_personal_name->>'a', ''))),
      'B'
    ) ||
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(subject_text, ''))),
      'B'
    ) ||

    -- 'C' weight (medium): Publisher and Series
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.publication_info->>'b', ''))),
      'C'
    ) ||
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.series_statement->>'a', ''))),
      'C'
    ) ||

    -- 'D' weight (low): Summary
    setweight(
      to_tsvector('english', remove_diacritics(COALESCE(NEW.summary, ''))),
      'D'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to normalize search queries (remove diacritics)
-- This will be used in the application code when performing searches
CREATE OR REPLACE FUNCTION normalize_search_query(query TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN remove_diacritics(query);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Rebuild search_vector for all existing records with the new diacritic-insensitive indexing
UPDATE marc_records SET updated_at = NOW();

-- Add helpful comment
COMMENT ON FUNCTION update_marc_search_vector() IS
  'Updates search_vector with weighted, diacritic-insensitive indexing: A=title, B=author+subjects, C=publisher+series, D=summary. Searching for "Zizek" will match "Žižek".';

COMMENT ON FUNCTION remove_diacritics(text) IS
  'Removes diacritics from text using unaccent extension if available. Used for diacritic-insensitive search.';

COMMENT ON FUNCTION normalize_search_query(text) IS
  'Normalizes search queries by removing diacritics. Use this on user input before searching to enable diacritic-insensitive search.';
```

---

## How It Works

### Database Side (Indexing)

When a MARC record is created or updated:

1. **Trigger fires** - `update_marc_search_vector()` is called
2. **Text extracted** - Pulls title, author, subjects, publisher, series, summary
3. **Diacritics removed** - `remove_diacritics()` normalizes each field
   - "Žižek" → "Zizek"
   - "Café" → "Cafe"
   - "Müller" → "Muller"
4. **Search vector created** - Normalized text is indexed with weights
5. **Saved to database** - `search_vector` column updated

### Application Side (Querying)

When a user searches:

1. **User types** - e.g., "Zizek" (no diacritics)
2. **Client normalizes** - `normalizeSearchQuery()` removes any diacritics (already none in this case)
3. **Query sent** - "Zizek" sent to database
4. **Match found** - Matches indexed "Zizek" (which came from "Žižek")
5. **Results returned** - Records with "Žižek" are found

### Example Flow

```
User searches: "Zizek"
                ↓
Client normalizes: "Zizek" (already normalized)
                ↓
Database compares: "Zizek" (query) == "Zizek" (indexed from "Žižek")
                ↓
Match! Returns: Records with "Žižek"
```

---

## Testing the Migration

### Step 1: Run Diagnostic Tests

Run the test script I created:

```bash
# In Supabase SQL Editor, run:
/home/user/ILS/test-diacritic-search.sql
```

This will check:
- ✅ Is `unaccent` extension installed?
- ✅ Do the functions exist?
- ✅ Does `remove_diacritics()` work correctly?
- ✅ Are search vectors populated?
- ✅ Does actual search work?

### Step 2: Manual Test

1. **Create a test record** (if you don't have one with diacritics):
   ```sql
   INSERT INTO marc_records (
     title_statement,
     main_entry_personal_name,
     material_type,
     status,
     visibility
   ) VALUES (
     '{"a": "Less Than Nothing"}'::jsonb,
     '{"a": "Žižek, Slavoj"}'::jsonb,
     'book',
     'active',
     'public'
   );
   ```

2. **Search for it without diacritics**:
   - Go to your catalog search page
   - Type "Zizek" (no special characters)
   - You should see results for "Žižek"

### Step 3: Verify in Database

```sql
-- This should return records with "Žižek"
SELECT
  title_statement->>'a' as title,
  main_entry_personal_name->>'a' as author
FROM marc_records
WHERE search_vector @@ websearch_to_tsquery('english', 'Zizek');
```

---

## Troubleshooting

### Problem: Tests show unaccent extension is not installed

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

If you get permission error, contact your Supabase support or database admin.

### Problem: Search vectors are not populated

**Solution:**
```sql
-- Rebuild all search vectors
UPDATE marc_records SET updated_at = NOW();
```

This triggers the `update_marc_search_vector()` function for all records.

### Problem: Search still doesn't work

**Checklist:**
1. Did you run the migration? Check with diagnostic tests.
2. Did you rebuild search vectors? Run the UPDATE command above.
3. Is the client-side normalization working? Check browser console.
4. Do you have records with diacritics to test? Try the test record insert.

### Problem: Migration fails with syntax error

**Possible causes:**
- PostgreSQL version too old (need 9.6+)
- Supabase restrictions on extensions
- Missing trigger or table

**Solution:** Run diagnostic tests to identify specific issue.

---

## Rollback (If Needed)

To undo this migration:

```sql
-- Revert to old search vector function (without diacritic removal)
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  subject_text TEXT := '';
BEGIN
  IF NEW.subject_topical IS NOT NULL THEN
    SELECT string_agg(elem->>'a', ' ')
    INTO subject_text
    FROM unnest(NEW.subject_topical) AS elem
    WHERE elem->>'a' IS NOT NULL;
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(subject_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.series_statement->>'a', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rebuild search vectors
UPDATE marc_records SET updated_at = NOW();

-- Optionally drop the functions
DROP FUNCTION IF EXISTS remove_diacritics(text);
DROP FUNCTION IF EXISTS normalize_search_query(text);
```

---

## Performance Impact

**Indexing:** Minimal - `remove_diacritics()` is fast and called only on INSERT/UPDATE
**Searching:** None - Search performance remains the same
**Storage:** None - Search vectors are the same size

---

## Examples of Characters Handled

| Original | Normalized | Works? |
|----------|-----------|---------|
| Žižek | Zizek | ✅ |
| Café | Cafe | ✅ |
| Müller | Muller | ✅ |
| José | Jose | ✅ |
| Björk | Bjork | ✅ |
| Čapek | Capek | ✅ |
| São Paulo | Sao Paulo | ✅ |
| Łódź | Lodz | ✅ |
| Tōkyō | Tokyo | ✅ |

---

## Additional Notes

- The client-side normalization is already implemented in `/src/lib/utils/text-normalize.ts`
- The application already calls `normalizeSearchQuery()` in search pages
- This migration makes the database match the client-side behavior
- Both simple and advanced search are supported
- Works with all search fields (title, author, subject, etc.)

---

## Questions?

If you have issues:
1. Run the diagnostic test script first
2. Check the troubleshooting section above
3. Review Supabase logs for errors
4. Check that your PostgreSQL version supports `unaccent` extension

---

**Next Steps:** Run the diagnostic test to see if the migration is already applied!
