# Spell Correction Feature

## Overview

The spell correction feature provides intelligent "Did You Mean?" suggestions for search queries using PostgreSQL trigram similarity and fuzzy matching against your catalog data.

## How It Works

### 1. Trigram Similarity Matching

The system uses PostgreSQL's `pg_trgm` extension to calculate similarity scores between search terms and catalog fields:

- **Titles** - From `title_statement->>'a'`
- **Authors** - From `main_entry_personal_name->>'a'`
- **Subjects** - From `subject_headings_topical`
- **Publishers** - From `publication_info->>'b'`

### 2. Multi-Word Query Correction

For multi-word queries, the system:
1. Splits the query into individual words
2. Finds the best correction for each word
3. Combines corrections with confidence scoring
4. Returns the corrected query if different from original

### 3. Smart Triggering

Spell suggestions appear automatically when:
- Search query contains keywords (`q` parameter)
- Results returned are **less than 5**
- A similar term exists in the catalog with **>40% confidence**

## Database Setup

### Step 1: Run Migration

1. Go to your Supabase project
2. Click **SQL Editor** in the left sidebar
3. Open `migrations/010_spell_correction.sql`
4. Copy and paste the entire SQL into the editor
5. Click **Run**

This migration:
- ✅ Enables `pg_trgm` extension
- ✅ Creates `suggest_spell_correction()` function
- ✅ Creates `suggest_query_correction()` function
- ✅ Adds GIN trigram indexes for performance

### Step 2: Verify Installation

Run this test query in SQL Editor:

```sql
SELECT * FROM suggest_spell_correction('shakspere', 0.3);
```

If configured correctly and you have Shakespeare books, you should see suggestions for "shakespeare".

## Usage

### For End Users

When searching returns few results, users will see:

```
ℹ️ Did you mean: [corrected query] (85% match)
```

Clicking the suggestion performs a new search with the corrected term.

### For Developers

The spell suggestion is handled in:

**Backend:** `src/routes/catalog/search/results/+page.server.ts:86-95`
```typescript
if (params.q && results.total < 5) {
  const suggestion = await getSpellSuggestion(supabase, params.q);
  if (suggestion) {
    spellSuggestion = suggestion;
  }
}
```

**Frontend:** `src/routes/catalog/search/results/+page.svelte:367-385`
```svelte
{#if data.spellSuggestion}
  <div class="spell-suggestion">
    <span>Did you mean:</span>
    <button onclick={() => searchWithSuggestion(...)}>
      {data.spellSuggestion.suggested_query}
    </button>
  </div>
{/if}
```

## Configuration

### Adjust Similarity Threshold

To make suggestions more/less aggressive, edit the threshold in:

**File:** `src/routes/catalog/search/results/+page.server.ts:629`

```typescript
// Higher = stricter (fewer suggestions)
// Lower = more lenient (more suggestions)
if (suggestion.confidence >= 0.4) {  // Default: 40%
  return {...}
}
```

### Change Trigger Condition

To show suggestions at different result counts:

**File:** `src/routes/catalog/search/results/+page.server.ts:90`

```typescript
// Current: Show if < 5 results
if (params.q && results.total < 5) {

// Change to: Show if < 10 results
if (params.q && results.total < 10) {

// Change to: Always show suggestions
if (params.q) {
```

### Customize Suggestion Sources

To search additional fields, edit the database function:

**File:** `migrations/010_spell_correction.sql:16-47`

Add UNION blocks for new fields:
```sql
UNION
-- Extract series titles
SELECT DISTINCT
  series_statement->>'a' AS term,
  'series' AS source
FROM marc_records
WHERE series_statement->>'a' IS NOT NULL
```

Then re-run the migration.

## Performance

### Index Strategy

The migration creates GIN trigram indexes on commonly searched fields:

```sql
CREATE INDEX idx_title_trgm ON marc_records
  USING gin ((title_statement->>'a') gin_trgm_ops);

CREATE INDEX idx_author_trgm ON marc_records
  USING gin ((main_entry_personal_name->>'a') gin_trgm_ops);

CREATE INDEX idx_publisher_trgm ON marc_records
  USING gin ((publication_info->>'b') gin_trgm_ops);
```

These indexes make similarity searches fast even with thousands of records.

### Query Performance

Expected query times:
- **Small catalogs** (< 10K records): < 50ms
- **Medium catalogs** (10K-100K): < 200ms
- **Large catalogs** (> 100K): < 500ms

The `LIMIT 5` in the function ensures only top suggestions are returned.

## Examples

### Example 1: Simple Typo
```
User searches: "hemingway"
System suggests: "Hemingway" (92% match)
```

### Example 2: Complex Misspelling
```
User searches: "tolstoy war and pece"
System suggests: "tolstoy war and peace" (78% match)
```

### Example 3: Author Name Variation
```
User searches: "j k rowling"
System suggests: "J.K. Rowling" (85% match)
```

## Troubleshooting

### No suggestions appearing

**Check 1:** Verify migration ran successfully
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'suggest%';
```
Should return: `suggest_spell_correction` and `suggest_query_correction`

**Check 2:** Verify pg_trgm is enabled
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```
Should return one row.

**Check 3:** Check confidence threshold
Lower the threshold temporarily to test:
```typescript
if (suggestion.confidence >= 0.2) {  // Very lenient
```

**Check 4:** Verify catalog has data
```sql
SELECT COUNT(*) FROM marc_records
WHERE title_statement->>'a' IS NOT NULL;
```
Should return > 0.

### Suggestions are wrong

**Solution 1:** Increase similarity threshold
```typescript
if (suggestion.confidence >= 0.6) {  // Stricter: 60%
```

**Solution 2:** Filter by source type
Modify the function to prioritize certain fields (titles over publishers).

### Performance is slow

**Check indexes:**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'marc_records'
AND indexname LIKE '%trgm%';
```

**Rebuild indexes if needed:**
```sql
REINDEX INDEX idx_title_trgm;
REINDEX INDEX idx_author_trgm;
REINDEX INDEX idx_publisher_trgm;
```

## Future Enhancements

Potential improvements:
- [ ] Language-specific fuzzy matching (Spanish, French, etc.)
- [ ] Learning from successful searches (clickthrough data)
- [ ] Suggest multiple alternatives instead of just one
- [ ] Show suggestions for advanced search fields too
- [ ] Add phonetic matching (Soundex, Metaphone)

## Technical Details

### Database Functions

**suggest_spell_correction(search_term, threshold)**
- Returns: suggestion, similarity_score, source_type
- Threshold: Default 0.3 (30% similarity)
- Limit: Top 5 suggestions

**suggest_query_correction(search_query)**
- Returns: suggested_query, confidence
- Handles multi-word queries
- Skips words <= 2 characters
- Default threshold: 0.4 (40%)

### TypeScript Interfaces

```typescript
export interface SpellSuggestion {
  suggested_query: string;
  confidence: number;
}
```

### Svelte 5 Runes Used
- `$props()` - Component data binding
- `$derived()` - Computed suggestion display logic
- Event handlers for suggestion clicks

---

Made with ❤️ for Chomp Library System
