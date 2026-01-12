# Record Reimport Guide

## Overview

This guide explains how to safely reimport MARC records into your ILS, updating existing records while preserving relationships and audit trails.

## Strategy: Update (Overlay), Don't Delete

### Why Update Instead of Delete?

**CRITICAL**: Always UPDATE existing records rather than deleting and recreating them.

**Reasons:**

1. **Preserves Relationships**:
   - Holdings/items (physical copies)
   - Active checkouts and patron transactions
   - Authority control links
   - Related records (series, editions, translations)
   - Attachments (PDFs, images, supplementary materials)
   - Reading list entries
   - ILL requests
   - Cover images

2. **Maintains Record IDs**:
   - External bookmarks stay valid
   - Short URLs continue working
   - Analytics and usage statistics preserved

3. **Preserves Audit Trail**:
   - `created_at` timestamp remains accurate
   - Shows true age of catalog record
   - Maintains historical data

4. **Automatic Updates**:
   - Search vectors rebuild automatically via trigger
   - No need to manually update indexes
   - Relationships stay intact

### When Deletion Is Acceptable

Only delete records if:
- Record is a duplicate with no holdings
- Record was created in error
- No checkouts, holds, or relationships exist
- You're doing a complete catalog reset (testing only)

---

## Step 1: Apply Database Migration

Before reimporting, ensure all MARC fields are supported.

### New Fields Added in Migration 022

The following fields were **missing** from the original schema and are now added:

- **024** - Other standard identifiers (UPC, EAN, ISMN, DOI, etc.)
- **246** - Variant/alternative titles
- **250** - Edition statement
- **336/337/338** - RDA content/media/carrier types
- **505** - Formatted contents note (table of contents)
- **546** - Language note
- **655** - Genre/form terms
- **050** - Library of Congress call number
- **082** - Dewey Decimal Classification

### Apply the Migration

1. **Open Supabase SQL Editor**:
   - Go to your Supabase project dashboard
   - Click "SQL Editor" in the left sidebar

2. **Run the Migration**:
   ```bash
   # Copy the contents of migrations/022_additional_marc_fields.sql
   # Paste into SQL Editor
   # Click "Run"
   ```

3. **Verify Success**:
   - Check for "Success. No rows returned" message
   - Go to Table Editor → marc_records
   - Verify new columns exist

4. **Test on Sample Record** (optional but recommended):
   ```sql
   -- Test updating a single record
   UPDATE marc_records
   SET
     edition_statement = '{"a": "3rd ed."}'::jsonb,
     lc_call_number = '{"a": "PS3545.I345", "b": "C5 2012"}'::jsonb
   WHERE id = 'YOUR_TEST_RECORD_ID'
   LIMIT 1;

   -- Check that search vector was updated
   SELECT title_statement->>'a', search_vector
   FROM marc_records
   WHERE id = 'YOUR_TEST_RECORD_ID';
   ```

5. **Rebuild Search Vectors** (after confirming migration works):
   ```sql
   -- This updates all records and rebuilds search vectors
   -- May take a few minutes for large catalogs (10k+ records)
   UPDATE marc_records SET updated_at = NOW();
   ```

---

## Step 2: Prepare Your Import Data

### Field Mapping Reference

Here's how MARC21 fields map to database columns:

| MARC Field | Database Column | Data Type | Example |
|------------|-----------------|-----------|---------|
| 020 | `isbn` | VARCHAR | `"9780062316097"` |
| 022 | `issn` | VARCHAR | `"1234-5678"` |
| 024 | `other_standard_identifier` | JSONB[] | `[{"type": "UPC", "value": "012345678901"}]` |
| 050 | `lc_call_number` | JSONB | `{"a": "PS3545.I345", "b": "C5 2012"}` |
| 082 | `dewey_call_number` | JSONB | `{"a": "813.54", "2": "23"}` |
| 100 | `main_entry_personal_name` | JSONB | `{"a": "Harari, Yuval Noah"}` |
| 110 | `main_entry_corporate_name` | JSONB | `{"a": "United Nations"}` |
| 245 | `title_statement` | JSONB | `{"a": "Sapiens", "b": "a brief history of humankind", "c": "Yuval Noah Harari"}` |
| 246 | `varying_form_title` | JSONB[] | `[{"type": "Parallel", "title": "Homme"}]` |
| 250 | `edition_statement` | JSONB | `{"a": "3rd ed.", "b": "revised and updated"}` |
| 260/264 | `publication_info` | JSONB | `{"a": "New York", "b": "Harper", "c": "2015"}` |
| 300 | `physical_description` | JSONB | `{"a": "464 pages", "b": "illustrations", "c": "24 cm"}` |
| 336 | `content_type` | JSONB[] | `[{"a": "text", "b": "txt", "2": "rdacontent"}]` |
| 337 | `media_type` | JSONB[] | `[{"a": "unmediated", "b": "n", "2": "rdamedia"}]` |
| 338 | `carrier_type` | JSONB[] | `[{"a": "volume", "b": "nc", "2": "rdacarrier"}]` |
| 490 | `series_statement` | JSONB | `{"a": "Oxford World's Classics"}` |
| 500 | `general_note` | TEXT[] | `["Includes index", "Translation of: L'homme"]` |
| 504 | `bibliography_note` | TEXT | `"Includes bibliographical references (pages 421-456) and index."` |
| 505 | `formatted_contents_note` | TEXT[] | `["Part 1. The cognitive revolution", "Part 2. The agricultural revolution"]` |
| 520 | `summary` | TEXT | `"The book surveys the history of humankind..."` |
| 546 | `language_note` | TEXT | `"Text in English; translated from Hebrew."` |
| 650 | `subject_topical` | JSONB[] | `[{"a": "Human evolution", "x": "History"}]` |
| 651 | `subject_geographic` | JSONB[] | `[{"a": "United States", "x": "Politics and government"}]` |
| 655 | `genre_form_term` | JSONB[] | `[{"a": "Biographies", "2": "lcgft"}]` |
| 700 | `added_entry_personal_name` | JSONB[] | `[{"a": "Smith, John", "d": "1950-"}]` |
| 710 | `added_entry_corporate_name` | JSONB[] | `[{"a": "Library of Congress"}]` |

### Complete MARC Record Storage

Always populate the `marc_json` field with the complete MARC record in JSON format. This preserves all fields, even those not explicitly mapped to columns.

```json
{
  "leader": "00000cam a2200000 i 4500",
  "001": "12345678",
  "008": "150203s2015    nyu           000 0 eng  ",
  "020": [{"a": "9780062316097"}],
  "100": {"a": "Harari, Yuval Noah", "ind1": "1", "ind2": " "},
  "245": {"a": "Sapiens", "b": "a brief history of humankind", "c": "Yuval Noah Harari", "ind1": "1", "ind2": "0"},
  ... (all other fields)
}
```

---

## Step 3: Implement Overlay Logic

### Basic Overlay Pattern (TypeScript)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

interface MARCRecord {
  isbn?: string;
  issn?: string;
  control_number?: string;
  title_statement: any;
  // ... other fields
  marc_json: any;
}

async function upsertMARCRecord(
  supabase: SupabaseClient,
  record: MARCRecord,
  matchField: 'isbn' | 'issn' | 'control_number' = 'isbn'
) {
  // Normalize match value
  const matchValue = record[matchField];
  if (!matchValue) {
    throw new Error(`Match field ${matchField} is missing`);
  }

  // Check if record exists
  const { data: existing, error: searchError } = await supabase
    .from('marc_records')
    .select('id')
    .eq(matchField, matchValue)
    .maybeSingle();

  if (searchError) throw searchError;

  if (existing) {
    // UPDATE existing record
    console.log(`Updating record ${existing.id} (${matchField}: ${matchValue})`);

    const { data, error } = await supabase
      .from('marc_records')
      .update({
        ...record,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return { action: 'updated', record: data };
  } else {
    // INSERT new record
    console.log(`Inserting new record (${matchField}: ${matchValue})`);

    const { data, error } = await supabase
      .from('marc_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return { action: 'inserted', record: data };
  }
}

// Usage example
async function importRecords(supabase: SupabaseClient, records: MARCRecord[]) {
  const results = {
    inserted: 0,
    updated: 0,
    errors: 0
  };

  for (const record of records) {
    try {
      const result = await upsertMARCRecord(supabase, record, 'isbn');

      if (result.action === 'inserted') {
        results.inserted++;
      } else {
        results.updated++;
      }
    } catch (error) {
      console.error(`Error importing record:`, error);
      results.errors++;
    }
  }

  return results;
}
```

### Advanced: Batch Import with Transaction Safety

```typescript
async function batchUpsertRecords(
  supabase: SupabaseClient,
  records: MARCRecord[],
  batchSize: number = 100
) {
  const results = {
    inserted: 0,
    updated: 0,
    errors: 0,
    skipped: 0
  };

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)}`);

    for (const record of batch) {
      try {
        const result = await upsertMARCRecord(supabase, record, 'isbn');

        if (result.action === 'inserted') {
          results.inserted++;
        } else {
          results.updated++;
        }
      } catch (error) {
        console.error(`Error importing record:`, error);
        results.errors++;
      }
    }

    // Progress report
    console.log(`Progress: ${i + batch.length}/${records.length} records processed`);
    console.log(`Inserted: ${results.inserted}, Updated: ${results.updated}, Errors: ${results.errors}`);
  }

  return results;
}
```

---

## Step 4: Matching Strategies

### Strategy 1: Match by ISBN (Recommended for Books)

**Pros**: Most reliable for books, widely available
**Cons**: Not available for all materials, multiple ISBNs per title (print/ebook)

```typescript
// Normalize ISBN (remove hyphens, spaces)
function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase();
}

// Match on normalized ISBN
const { data: existing } = await supabase
  .from('marc_records')
  .select('id')
  .eq('isbn', normalizeISBN(record.isbn))
  .maybeSingle();
```

### Strategy 2: Match by Control Number (OCLC, LCCN)

**Pros**: Unique, stable across systems
**Cons**: May not be present in all records

```typescript
const { data: existing } = await supabase
  .from('marc_records')
  .select('id')
  .eq('control_number', record.control_number)
  .maybeSingle();
```

### Strategy 3: Match by ISSN (For Serials)

**Pros**: Standard for journals/magazines
**Cons**: Only applicable to serials

```typescript
const { data: existing } = await supabase
  .from('marc_records')
  .select('id')
  .eq('issn', record.issn)
  .maybeSingle();
```

### Strategy 4: Fuzzy Title/Author Match (Last Resort)

**Pros**: Works when identifiers missing
**Cons**: Risk of false matches, slower

```typescript
// Only use if no identifier available
if (!record.isbn && !record.control_number) {
  const { data: existing } = await supabase
    .from('marc_records')
    .select('id, title_statement, main_entry_personal_name')
    .ilike('title_statement->>a', `%${record.title_statement.a}%`)
    .ilike('main_entry_personal_name->>a', `%${record.main_entry_personal_name?.a || ''}%`)
    .limit(5);

  // Manual review recommended for fuzzy matches
}
```

---

## Step 5: Handling Special Cases

### Case 1: Multiple ISBNs (Print + Ebook)

If a record has multiple ISBNs, store them in the `marc_json` field and use the primary ISBN for matching.

```typescript
// Store all ISBNs in marc_json
record.marc_json = {
  ...record.marc_json,
  "020": [
    {"a": "9780062316097", "q": "(hardcover)"},
    {"a": "9780062316110", "q": "(ebook)"}
  ]
};

// Use primary ISBN for matching
record.isbn = "9780062316097";
```

### Case 2: No Identifier Available

Create a local control number:

```typescript
if (!record.isbn && !record.issn && !record.control_number) {
  // Generate local control number
  record.control_number = `LOCAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### Case 3: Duplicate Detection

Before inserting, check for potential duplicates:

```typescript
async function checkDuplicates(supabase: SupabaseClient, record: MARCRecord) {
  // Check by ISBN
  if (record.isbn) {
    const { data } = await supabase
      .from('marc_records')
      .select('id, title_statement')
      .eq('isbn', record.isbn);

    if (data && data.length > 0) {
      console.warn(`Duplicate ISBN found: ${record.isbn}`);
      return data;
    }
  }

  // Check by control number
  if (record.control_number) {
    const { data } = await supabase
      .from('marc_records')
      .select('id, title_statement')
      .eq('control_number', record.control_number);

    if (data && data.length > 0) {
      console.warn(`Duplicate control number found: ${record.control_number}`);
      return data;
    }
  }

  return null;
}
```

---

## Step 6: Testing Your Import

### Test on Small Sample First

```typescript
// Test with 10 records first
const testRecords = allRecords.slice(0, 10);
const results = await batchUpsertRecords(supabase, testRecords);

console.log('Test import results:', results);

// Verify in Supabase Table Editor
// Check that records look correct before proceeding
```

### Validation Checklist

Before running full import:

- ✅ Migration 022 applied successfully
- ✅ Test records imported correctly
- ✅ Search vectors generated (check `search_vector` column)
- ✅ Relationships preserved (check holdings, checkouts)
- ✅ JSONB fields properly formatted
- ✅ Match logic working as expected
- ✅ Error handling in place

### Rollback Plan

If something goes wrong:

```sql
-- Restore from Supabase automatic backup
-- Go to Dashboard → Database → Backups
-- Select "Point in Time Recovery"
-- Choose timestamp before import

-- Or manually undo recent changes
-- (if you kept track of updated IDs)
UPDATE marc_records
SET updated_at = original_timestamp
WHERE id IN (list_of_updated_ids);
```

---

## Step 7: Full Import Process

### Recommended Workflow

1. **Backup Database** (Supabase does this automatically, but verify)
   - Dashboard → Database → Backups
   - Ensure latest backup exists

2. **Run Migration 022** (add new fields)

3. **Test Import** (10-50 records)
   - Verify data quality
   - Check search functionality
   - Inspect sample records in Table Editor

4. **Run Full Import in Batches**
   - Process 100-500 records per batch
   - Log results for each batch
   - Pause between batches to check for errors

5. **Verify Results**
   - Check total record count
   - Run sample searches
   - Verify updated records still have holdings
   - Check for errors in logs

6. **Rebuild Search Vectors** (if needed)
   ```sql
   UPDATE marc_records SET updated_at = NOW();
   ```

7. **Test Catalog Functionality**
   - Public OPAC search
   - Advanced search
   - Faceted navigation
   - Record detail pages
   - Holdings display

---

## Troubleshooting

### Issue: "duplicate key value violates unique constraint"

**Cause**: Trying to insert a record with ISBN/control number that already exists

**Solution**: Use the overlay logic above to UPDATE instead of INSERT

### Issue: Search not finding updated records

**Cause**: Search vector not rebuilding

**Solution**:
```sql
-- Rebuild search vector for specific record
UPDATE marc_records SET updated_at = NOW() WHERE id = 'record-id';

-- Or rebuild all
UPDATE marc_records SET updated_at = NOW();
```

### Issue: JSONB fields not saving correctly

**Cause**: Incorrect JSON format

**Solution**: Validate JSON before inserting
```typescript
// Ensure proper JSONB format
const title = {
  a: "Title",
  b: "Subtitle",
  c: "Statement of responsibility"
};

// Not a string!
record.title_statement = title; // ✅ Correct
record.title_statement = JSON.stringify(title); // ❌ Wrong (double-encoded)
```

### Issue: Import very slow

**Cause**: Processing one record at a time, no batching

**Solution**: Use batch processing (see Step 3 above)

---

## Best Practices

1. **Always test on a small sample first**
2. **Use control numbers or ISBNs for matching** (not title/author)
3. **Preserve the `marc_json` field** with complete MARC data
4. **Log all import actions** for audit trail
5. **Monitor error rates** during import
6. **Don't delete records** unless absolutely necessary
7. **Backup before major imports** (Supabase does this, but verify)
8. **Validate data quality** before importing
9. **Use transactions** for critical operations
10. **Keep original MARC files** as source of truth

---

## Summary

### ✅ DO:
- Update existing records via overlay/upsert
- Match on unique identifiers (ISBN, ISSN, control number)
- Apply migration 022 before importing
- Test on sample data first
- Preserve the `marc_json` field
- Log import results

### ❌ DON'T:
- Delete records before reimporting
- Skip the migration step
- Import without testing first
- Ignore duplicate detection
- Forget to rebuild search vectors
- Import without a backup

---

## Questions?

If you encounter issues:
1. Check Supabase logs (Dashboard → Logs)
2. Verify migration applied successfully
3. Test with a single record
4. Review error messages
5. Check database constraints

The overlay approach ensures your catalog data stays intact while benefiting from updated/corrected MARC records.
