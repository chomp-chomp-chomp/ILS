# Authority Control System

## Overview

The Authority Control system provides comprehensive management of authorized headings for names, subjects, and other controlled vocabulary in the Library Catalog System. It implements industry-standard practices based on Library of Congress Name Authority File (LCNAF) and Library of Congress Subject Headings (LCSH).

**Version**: 1.0
**Status**: Production Ready
**Migration**: `migrations/018_authority_control.sql`

---

## Features

### 1. Authority Record Management

- **Multiple Authority Types**:
  - Personal Names (100) - Authors, contributors
  - Corporate Names (110) - Organizations, companies
  - Meeting Names (111) - Conferences, events
  - Geographic Names (151) - Places, locations
  - Topical Subjects (150) - Subject headings
  - Genre/Form (155) - Material types, genres

- **Authority Sources**:
  - LCNAF - Library of Congress Name Authority File
  - LCSH - Library of Congress Subject Headings
  - Local - Locally created authorities
  - VIAF - Virtual International Authority File
  - FAST - Faceted Application of Subject Terminology

### 2. Library of Congress Integration

- **Search LoC Authorities**: Real-time search of LCNAF and LCSH via LoC Linked Data API
- **Import Authorities**: One-click import from Library of Congress
- **Automatic Mapping**: Extracts LCCN, variant forms, cross-references
- **Scheduled Sync**: Support for periodic updates from LoC (future enhancement)

### 3. Cross-References

- **"See" References**: Non-authorized forms pointing to authorized headings
  - Example: "Clemens, Samuel L." → "Twain, Mark, 1835-1910"

- **"See Also" References**: Related authorized headings
  - Example: "World War (1939-1945)" → "World War (1914-1918)"

- **Variant Forms**: Alternative forms of the heading
  - Stored as arrays for efficient searching
  - Automatically indexed for fuzzy matching

### 4. Authority Matching & Suggestions

- **Fuzzy Matching**: PostgreSQL trigram similarity for finding close matches
- **Confidence Scoring**: 0-1 similarity score for match quality
- **Auto-Suggest**: Real-time suggestions while cataloging
- **Visual Indicators**:
  - Green: High confidence (>80%)
  - Yellow: Medium confidence (60-80%)
  - Red: Low confidence (<60%)

### 5. Batch Heading Correction

- **Unauthorized Headings Report**: Finds MARC records without authority links
- **Suggested Corrections**: Proposes matching authorities with confidence scores
- **Bulk Apply**: Select and apply multiple corrections at once
- **Preview Changes**: Review before applying
- **Audit Trail**: Logs all corrections in `authority_update_log`

### 6. Authority Browse

- **Alphabetical Navigation**: A-Z quick navigation
- **Filter by Type**: Personal names, subjects, etc.
- **Filter by Source**: LCNAF, LCSH, local
- **Usage Statistics**: Shows how many records use each authority

### 7. Reports & Analytics

- **Authority Coverage**: Percentage of headings linked to authorities
- **Unauthorized Headings**: Count and list of headings needing correction
- **Most Used Authorities**: Top authorities by usage
- **Update History**: Audit log of changes

---

## Database Schema

### Tables

#### 1. `authorities`

Main authority records table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| heading | TEXT | Authorized form of the heading |
| type | VARCHAR(50) | Authority type (personal_name, topical_subject, etc.) |
| source | VARCHAR(50) | Source (lcnaf, lcsh, local, viaf, fast) |
| lccn | VARCHAR(50) | Library of Congress Control Number |
| viaf_id | VARCHAR(50) | VIAF identifier |
| fast_id | VARCHAR(50) | FAST identifier |
| note | TEXT | Biographical/scope note |
| birth_date | VARCHAR(20) | Birth date (for personal names) |
| death_date | VARCHAR(20) | Death date (for personal names) |
| variant_forms | TEXT[] | Array of non-authorized forms |
| marc_authority | JSONB | Full MARC authority record |
| last_sync_at | TIMESTAMPTZ | Last sync with external source |
| usage_count | INTEGER | Number of bibliographic records using this authority |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |
| created_by | UUID | User who created the record |
| updated_by | UUID | User who last updated |

**Indexes**:
- B-tree on `heading`, `type`, `source`, `lccn`
- GIN on `variant_forms` (array search)
- GIN on full-text search vector (heading + variants)

#### 2. `authority_cross_refs`

Cross-references between authorities.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| authority_id | UUID | FK to authorities |
| ref_type | VARCHAR(20) | 'see', 'see_also', 'see_from' |
| reference_text | TEXT | The reference heading |
| related_authority_id | UUID | Optional FK to related authority |
| note | TEXT | Note about the relationship |

#### 3. `marc_authority_links`

Links bibliographic records to authority records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| marc_record_id | UUID | FK to marc_records |
| authority_id | UUID | FK to authorities |
| marc_field | VARCHAR(10) | MARC field (100, 650, etc.) |
| field_index | INTEGER | Array index for repeatable fields |
| confidence | REAL | Confidence score (0-1) |
| is_automatic | BOOLEAN | Was link created automatically? |
| created_by | UUID | User who created the link |

**Unique Constraint**: One authority per MARC field per record.

#### 4. `authority_update_log`

Audit trail of authority changes.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| authority_id | UUID | FK to authorities |
| action | VARCHAR(50) | 'created', 'updated', 'merged', 'deleted', 'synced_from_loc', 'heading_corrected' |
| old_value | JSONB | Old record state |
| new_value | JSONB | New record state |
| records_affected | INTEGER | Number of MARC records affected |
| performed_by | UUID | User who performed the action |
| note | TEXT | Additional notes |
| created_at | TIMESTAMPTZ | When the action occurred |

---

## API Endpoints

### GET `/api/authorities`

Search and list authorities.

**Query Parameters**:
- `q` - Search query (searches heading, variants, LCCN)
- `type` - Filter by authority type
- `source` - Filter by source
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Response**:
```json
{
  "authorities": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### POST `/api/authorities`

Create new authority record.

**Body**:
```json
{
  "heading": "Twain, Mark, 1835-1910",
  "type": "personal_name",
  "source": "local",
  "birth_date": "1835",
  "death_date": "1910",
  "variant_forms": ["Clemens, Samuel L.", "Clemens, Samuel Langhorne"],
  "note": "American author and humorist",
  "cross_references": [
    {
      "ref_type": "see_also",
      "reference_text": "Harte, Bret, 1836-1902"
    }
  ]
}
```

### PUT `/api/authorities`

Update authority record.

**Body**:
```json
{
  "id": "uuid",
  "heading": "Updated heading",
  ...
}
```

### DELETE `/api/authorities?id=uuid`

Delete authority record. Fails if authority is in use.

### GET `/api/authorities/suggest`

Get authority suggestions for cataloging.

**Query Parameters**:
- `heading` - Heading to match
- `type` - Authority type
- `limit` - Max suggestions (default: 10)

**Response**:
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "heading": "Shakespeare, William, 1564-1616",
      "type": "personal_name",
      "source": "lcnaf",
      "lccn": "n78095332",
      "similarity_score": 0.95,
      "variant_forms": ["Shakspeare, William"],
      "authority_cross_refs": [...]
    }
  ],
  "count": 1
}
```

### POST `/api/authorities/suggest`

Link heading to authority in MARC record.

**Body**:
```json
{
  "marc_record_id": "uuid",
  "authority_id": "uuid",
  "marc_field": "100",
  "field_index": 0
}
```

### GET `/api/authorities/loc`

Search Library of Congress authorities.

**Query Parameters**:
- `q` - Search query
- `type` - 'names' or 'subjects'
- `limit` - Max results (default: 10)

**Response**:
```json
{
  "authorities": [
    {
      "uri": "https://id.loc.gov/authorities/names/n79021164",
      "label": "Twain, Mark, 1835-1910",
      "lccn": "n79021164",
      "variants": ["Clemens, Samuel Langhorne"],
      "note": "American author"
    }
  ],
  "count": 1,
  "source": "loc"
}
```

### POST `/api/authorities/loc`

Import authority from Library of Congress.

**Body**:
```json
{
  "uri": "https://id.loc.gov/authorities/names/n79021164"
}
```

### GET `/api/authorities/unauthorized`

Find unauthorized headings in MARC records.

**Query Parameters**:
- `field` - Filter by MARC field (100, 650, etc.)
- `limit` - Max results (default: 100)

**Response**:
```json
{
  "unauthorized": [
    {
      "marc_record_id": "uuid",
      "field": "100",
      "heading": "Smith, John",
      "suggested_authority_id": "uuid",
      "suggested_heading": "Smith, John, 1950-",
      "confidence": 0.85
    }
  ],
  "summary": {
    "total_unauthorized": 45,
    "unique_headings": 32,
    "top_headings": [...]
  }
}
```

### POST `/api/authorities/unauthorized`

Batch correct unauthorized headings.

**Body**:
```json
{
  "corrections": [
    {
      "marc_record_id": "uuid",
      "field": "100",
      "field_index": 0,
      "authority_id": "uuid",
      "old_heading": "Smith, John",
      "new_heading": "Smith, John, 1950-"
    }
  ]
}
```

**Response**:
```json
{
  "success": 42,
  "failed": 3,
  "errors": [...]
}
```

---

## Database Functions

### `search_authorities(search_term, authority_type, limit_count)`

Searches authorities with fuzzy matching and similarity scoring.

**Returns**: Table with authority records + similarity scores.

### `find_unauthorized_headings(field_type)`

Finds MARC records with headings not linked to authorities.

**Returns**: Table with unauthorized headings + suggested corrections.

### `get_authority_stats()`

Gets statistics about authority records.

**Returns**: JSON with counts by type, source, total links, etc.

---

## Admin Interfaces

### 1. Authority Management (`/admin/cataloging/authorities`)

Main authority management interface.

**Features**:
- Search authorities by heading, LCCN, variant
- Filter by type and source
- View statistics (total, by type, by source)
- Create, edit, delete authorities
- View cross-references
- See usage count

### 2. Browse Authorities (`/admin/cataloging/authorities/browse`)

Alphabetical browse interface.

**Features**:
- A-Z navigation
- Filter by type
- View headings starting with selected letter
- Quick access to authority records

### 3. Import from LoC (`/admin/cataloging/authorities/import`)

Library of Congress import interface.

**Features**:
- Search LCNAF and LCSH
- Preview authority details
- One-click import
- Automatic mapping of variants and cross-references

### 4. Batch Corrections (`/admin/cataloging/authorities/corrections`)

Batch heading correction tool.

**Features**:
- Find unauthorized headings
- Filter by MARC field
- View suggested corrections with confidence scores
- Select multiple corrections
- Preview changes
- Bulk apply corrections
- Audit trail

### 5. Reports (`/admin/cataloging/authorities/reports`)

Authority statistics and reports.

**Features**:
- Authority coverage percentage
- Unauthorized headings count
- Top unauthorized headings
- Most used authorities
- Quick action links

---

## Components

### `AuthoritySuggestion.svelte`

Reusable component for authority suggestions during cataloging.

**Props**:
- `heading` - The heading to match
- `type` - Authority type
- `marcRecordId` - MARC record ID (optional)
- `marcField` - MARC field (100, 650, etc.)
- `fieldIndex` - Field index for repeatable fields
- `onAuthoritySelected` - Callback when authority is selected

**Usage**:
```svelte
<AuthoritySuggestion
  heading={authorName}
  type="personal_name"
  marcRecordId={recordId}
  marcField="100"
  onAuthoritySelected={(authority) => {
    // Update form with authorized heading
    authorName = authority.heading;
  }}
/>
```

**Features**:
- Real-time suggestions as user types
- Debounced search (500ms)
- Confidence scoring (high/medium/low)
- Display variants and cross-references
- One-click selection
- Auto-link to MARC record
- Fallback to LoC search if no match

### `AuthorityReferences.svelte`

Displays cross-references in OPAC search results.

**Props**:
- `searchTerm` - The search term
- `type` - Authority type (optional)

**Usage**:
```svelte
<AuthorityReferences searchTerm={query} type="personal_name" />
```

**Features**:
- Shows "See" references for variant forms
- Shows "See also" references for related headings
- Clickable links to search authorized forms
- Automatically detects if search term is a variant

---

## Integration with Cataloging Workflow

### Manual Cataloging

When creating or editing a MARC record:

1. User enters name or subject in cataloging form
2. `AuthoritySuggestion` component automatically searches for matches
3. Component displays suggestions with confidence scores
4. User can:
   - Select suggested authority (updates heading to authorized form)
   - Search Library of Congress
   - Create local authority
   - Ignore and use heading as-is

### Automatic Linking

The system can automatically link headings to authorities:

```typescript
// In cataloging form submission
const response = await fetch('/api/authorities/suggest', {
  method: 'POST',
  body: JSON.stringify({
    marc_record_id: recordId,
    heading: authorName,
    marc_field: '100',
    type: 'personal_name'
  })
});

// System will auto-link if high confidence match (>90%) exists
```

### Batch Processing

For existing records without authority links:

1. Go to **Admin → Cataloging → Authorities → Batch Corrections**
2. Click "Find Unauthorized Headings"
3. Review suggestions (green = high confidence, safe to auto-apply)
4. Select corrections to apply
5. Click "Apply Corrections"
6. System updates MARC records and creates authority links

---

## Best Practices

### 1. Import from Library of Congress First

Before creating local authorities, always search Library of Congress:
- More authoritative
- Includes dates and disambiguation
- Has established cross-references
- Recognized by other libraries

### 2. Use Consistent Authority Forms

- Personal names: "Last, First, dates"
  - Example: "Twain, Mark, 1835-1910"
- Corporate names: "Organization. Department"
  - Example: "United States. Congress"
- Subjects: Follow LCSH format
  - Example: "World War (1939-1945)"

### 3. Add Variant Forms

Include common variants to improve matching:
- Alternate spellings
- Abbreviations
- Different name orders
- Pen names / pseudonyms

### 4. Link New Records During Cataloging

Don't wait to link authorities - do it while cataloging:
- Use `AuthoritySuggestion` component in cataloging forms
- Review suggestions before saving
- Create authority if needed

### 5. Run Batch Corrections Regularly

Schedule periodic batch corrections:
- Weekly or monthly
- Focus on high-confidence matches (>80%)
- Review low-confidence manually

### 6. Monitor Authority Coverage

Check reports regularly:
- Target 80%+ authority coverage
- Prioritize frequently-used headings
- Address unauthorized headings promptly

---

## Troubleshooting

### Issue: "No suggestions found"

**Causes**:
- Heading is very unique
- Typo in heading
- Authority doesn't exist in system

**Solutions**:
1. Search Library of Congress
2. Create local authority
3. Check spelling

### Issue: "Low confidence matches"

**Causes**:
- Heading is ambiguous
- Multiple similar authorities exist
- Missing disambiguation (dates, etc.)

**Solutions**:
1. Add more context to heading (dates, titles)
2. Search LoC for correct form
3. Manually select correct authority

### Issue: "Cannot delete authority - in use"

**Cause**: Authority is linked to MARC records

**Solution**:
1. Find records using this authority
2. Link records to different authority
3. Then delete original authority

### Issue: "Batch corrections not applying"

**Causes**:
- MARC record locked by another user
- Invalid authority ID
- Insufficient permissions

**Solutions**:
1. Check error log for specific failures
2. Retry failed corrections individually
3. Verify user has cataloging permissions

---

## Performance Considerations

### Indexing

The migration creates these indexes for optimal performance:
- B-tree indexes on `heading`, `type`, `source`
- GIN index on `variant_forms` array
- Full-text search index on heading + variants
- Indexes on foreign keys

### Caching Recommendations

For high-traffic sites, consider caching:
- Authority suggestions (5-minute TTL)
- Authority browse lists (10-minute TTL)
- Statistics (1-hour TTL)

### Scaling

For catalogs with >100K authorities:
- Consider materialized views for statistics
- Implement pagination for browse
- Add dedicated search server (Elasticsearch)

---

## Future Enhancements

### Planned Features

1. **Binary MARC Authority Import**: Import .mrc files
2. **Scheduled LoC Sync**: Automatic weekly updates from LoC
3. **Authority Merging**: Combine duplicate authorities
4. **VIAF Integration**: Import from Virtual International Authority File
5. **Authority Reciprocal Links**: Automatic "see also" suggestions
6. **Multilingual Authorities**: Support for non-English headings
7. **Authority Validation**: Real-time validation against LoC
8. **Authority Export**: Export authorities as MARCXML

### Technical Debt

- Add comprehensive test suite
- Implement rate limiting for LoC API
- Add monitoring/logging
- Optimize batch processing for large datasets

---

## References

- [Library of Congress Authorities](https://authorities.loc.gov/)
- [MARC 21 Authority Format](https://www.loc.gov/marc/authority/)
- [LoC Linked Data Service](https://id.loc.gov/)
- [LCNAF Documentation](https://www.loc.gov/aba/cataloging/subject/lcnaf.html)
- [LCSH Documentation](https://www.loc.gov/aba/cataloging/subject/)

---

## Support

For issues or questions:
- Check this documentation first
- Review error logs in `authority_update_log`
- Check Supabase logs for database errors
- Consult MARC 21 Authority documentation

**Last Updated**: 2025-12-30
**Version**: 1.0
**Maintained By**: Development Team
