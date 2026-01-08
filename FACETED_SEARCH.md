# Faceted Search Configuration System

## Overview

The Faceted Search Configuration System enables library administrators to create and manage dynamic search facets without writing code. Facets provide filtered navigation to help users refine search results by categories like material type, language, publication date, and more.

**Key Features**:
- Admin-configurable facets via UI
- Database-driven configuration
- Multiple source types (MARC fields, database columns, computed values)
- Flexible display options
- Performance optimization with caching

---

## Architecture

### Database Tables

#### 1. `facet_configuration`
Stores facet definitions and behavior settings.

**Key Fields**:
```sql
- id: UUID (Primary key)
- facet_key: VARCHAR(50) (Unique identifier, e.g., "material_types")
- facet_label: VARCHAR(100) (Display name, e.g., "Material Type")
- source_type: VARCHAR(50) (Where data comes from)
- source_field: VARCHAR(100) (Field/column name)
- display_type: VARCHAR(50) (How to display: checkbox_list, date_range, etc.)
- display_order: INTEGER (Order in sidebar)
- is_enabled: BOOLEAN (Show/hide facet)
- max_items: INTEGER (Limit displayed values)
- sort_by: VARCHAR(50) (Sort order for facet values)
```

**Full Schema**: See `migrations/018_faceted_search_configuration.sql`

#### 2. `facet_values_cache`
Stores computed facet values for performance optimization.

**Key Fields**:
```sql
- facet_key: VARCHAR(50) (References facet_configuration)
- value: TEXT (Facet value)
- label: TEXT (Display label)
- count: INTEGER (Number of matching records)
- filter_context: JSONB (Active filters when cached)
- expires_at: TIMESTAMPTZ (Cache expiration)
```

### Code Structure

#### Server-Side
- **`src/lib/utils/facets.ts`**: Core facet computation logic
  - `loadFacetConfigs()`: Load enabled facets from database
  - `computeDynamicFacets()`: Calculate all facet values
  - `computeSingleFacet()`: Calculate individual facet
  - Format and sort facet values

- **`src/routes/catalog/search/results/+page.server.ts`**: Search results with facets
  - Load facet configurations
  - Compute facets based on search parameters
  - Return facets with search results

#### Client-Side
- **`src/routes/catalog/search/results/FacetSidebar.svelte`**: Facet display component
  - Render facets based on configuration
  - Handle user interactions (checkbox toggles)
  - Update URL parameters on filter changes

#### API Endpoints
- **`src/routes/api/facet-config/+server.ts`**: CRUD operations for facet configs
  - GET: Fetch configurations
  - PUT: Update configuration
  - POST: Create new configuration
  - DELETE: Soft-delete configuration

- **`src/routes/api/facet-config/reorder/+server.ts`**: Change display order
- **`src/routes/api/facet-config/refresh-cache/+server.ts`**: Clear facet cache

---

## Facet Source Types

### 1. `database_column`
Direct database column from `marc_records` table.

**Example**: `material_type` column
```typescript
{
  source_type: 'database_column',
  source_field: 'material_type',
  aggregation_method: 'distinct_values'
}
```

**Use Cases**:
- Material types
- Language codes
- Publication status

### 2. `marc_field`
JSONB field from MARC record structure.

**Example**: Subject headings (650$a)
```typescript
{
  source_type: 'marc_field',
  source_field: 'subject_topical',
  source_subfield: 'a',
  aggregation_method: 'distinct_values'
}
```

**Use Cases**:
- Subject headings (650, 651)
- Publishers (260/264$b)
- Series (490$a)
- Languages (041$a)

### 3. `items_field`
Field from related `items` table.

**Example**: Item location
```typescript
{
  source_type: 'items_field',
  source_field: 'location',
  aggregation_method: 'distinct_values'
}
```

**Special Handling**:
- Availability: Checks item status (available, checked_out, etc.)
- Location: Aggregates from all items
- Call number ranges

**Use Cases**:
- Physical location
- Availability status
- Collection names

### 4. `computed`
Custom calculated values (requires code implementation).

**Example**: Publication decade
```typescript
{
  source_type: 'computed',
  facet_key: 'publication_decades',
  // Custom logic in computeComputedFacet()
}
```

**Use Cases**:
- Publication decades (2020s, 2010s, etc.)
- Age categories (New, Recent, Older)
- Custom groupings

---

## Display Types

### 1. `checkbox_list` (Default)
Standard checkboxes for multi-select filtering.

**Best For**:
- Material types
- Languages
- Subjects
- Locations

**Features**:
- Multi-select enabled by default
- Count badges per option
- Collapsible sections
- "Show more" for long lists

**Example**:
```
☑ Books (1,234)
☐ E-Books (567)
☐ DVDs (89)
☐ Audiobooks (45)
```

### 2. `date_range`
Date range slider or input fields.

**Best For**:
- Publication dates
- Acquisition dates
- Last updated dates

**Features**:
- From/to date pickers
- Decade buckets
- Year buckets

**Example** (Future Implementation):
```
Publication Date
[1990] ———●———————— [2024]
```

### 3. `numeric_range`
Numeric range slider.

**Best For**:
- Page counts
- Ratings
- Price ranges

**Example** (Future Implementation):
```
Pages
[0] ———●————●———— [1000]
    100        500
```

### 4. `tag_cloud`
Visual tag cloud with size-weighted labels.

**Best For**:
- Popular subjects
- Trending topics
- Author popularity

**Example** (Future Implementation):
```
HISTORY      Fiction    science
    BIOGRAPHY    Poetry
 Art        RELIGION
```

---

## Aggregation Methods

### 1. `distinct_values`
Count unique values as-is.

**Example**: Material types
```typescript
material_type: 'book' → Count all 'book' records
material_type: 'ebook' → Count all 'ebook' records
```

### 2. `decade_buckets`
Group years into decades.

**Example**: Publication dates
```typescript
'2023' → '2020s'
'2015' → '2010s'
'1999' → '1990s'
```

**Configuration**:
```typescript
{
  aggregation_method: 'decade_buckets',
  bucket_size: 10
}
```

### 3. `year_buckets`
Group by individual years.

**Example**: Exact publication years
```typescript
'2023-03-15' → '2023'
'2022-11-20' → '2022'
```

### 4. `custom_ranges`
User-defined ranges with labels.

**Example**: Page count ranges
```typescript
{
  custom_ranges: [
    { min: 0, max: 100, label: "Short (0-100 pages)" },
    { min: 101, max: 300, label: "Medium (101-300 pages)" },
    { min: 301, max: null, label: "Long (300+ pages)" }
  ]
}
```

---

## Sorting Options

### `count_desc` (Default)
Most common values first.

**Example**:
```
Books (1,234)
E-Books (567)
DVDs (89)
```

### `count_asc`
Least common values first.

**Example**:
```
DVDs (89)
E-Books (567)
Books (1,234)
```

### `label_asc`
Alphabetical A-Z.

**Example**:
```
Audiobooks (45)
Books (1,234)
DVDs (89)
E-Books (567)
```

### `label_desc`
Alphabetical Z-A.

### `custom`
Manual ordering using `custom_sort_order` array.

**Example**:
```typescript
{
  sort_by: 'custom',
  custom_sort_order: ['book', 'ebook', 'audiobook', 'dvd']
}
```

---

## Value Formatting

### Built-in Formatters

#### `material_type`
Maps internal codes to friendly names.

```typescript
'book' → 'Books'
'ebook' → 'E-Books'
'serial' → 'Serials/Journals'
'audiobook' → 'Audiobooks'
'dvd' → 'DVDs'
```

#### `language_code`
Maps ISO 639-2 codes to language names.

```typescript
'eng' → 'English'
'spa' → 'Spanish'
'fre' → 'French'
'ger' → 'German'
```

#### `year`
Displays year as-is (no formatting).

### Custom Format Mapping

Override specific values with custom labels.

**Example**:
```typescript
{
  value_formatter: null,
  value_format_mapping: {
    'special_collections': 'Special Collections',
    'reference_only': 'Reference Only (Non-Circulating)',
    'storage': 'Off-Site Storage'
  }
}
```

---

## Creating Facets

### Via Admin UI (Future Feature)

Navigate to `/admin/search-config` or `/admin/facet-config`:

1. Click "Add New Facet"
2. Fill in basic info:
   - Facet Key (unique ID)
   - Display Label
   - Description
3. Configure data source:
   - Source Type
   - Source Field
   - Subfield (if MARC)
4. Set display options:
   - Display Type
   - Max Items
   - Show Count
5. Configure aggregation:
   - Aggregation Method
   - Bucket Size
6. Set sort order
7. Add formatters/mappings
8. Enable and save

### Via Database

Insert directly into `facet_configuration` table:

```sql
INSERT INTO facet_configuration (
  facet_key, facet_label, source_type, source_field,
  display_type, aggregation_method, sort_by, max_items,
  filter_param_name, is_enabled, is_active
) VALUES (
  'material_types',
  'Material Type',
  'database_column',
  'material_type',
  'checkbox_list',
  'distinct_values',
  'count_desc',
  10,
  'material_types',
  true,
  true
);
```

---

## Example Facet Configurations

### 1. Material Types
```typescript
{
  facet_key: 'material_types',
  facet_label: 'Material Type',
  source_type: 'database_column',
  source_field: 'material_type',
  display_type: 'checkbox_list',
  aggregation_method: 'distinct_values',
  sort_by: 'count_desc',
  max_items: 10,
  value_formatter: 'material_type',
  filter_param_name: 'material_types'
}
```

### 2. Languages
```typescript
{
  facet_key: 'languages',
  facet_label: 'Language',
  source_type: 'database_column',
  source_field: 'language_code',
  display_type: 'checkbox_list',
  aggregation_method: 'distinct_values',
  sort_by: 'label_asc',
  max_items: 15,
  value_formatter: 'language_code',
  filter_param_name: 'languages'
}
```

### 3. Publication Decades
```typescript
{
  facet_key: 'publication_decades',
  facet_label: 'Publication Date',
  source_type: 'marc_field',
  source_field: 'publication_info',
  source_subfield: 'c',
  display_type: 'checkbox_list',
  aggregation_method: 'decade_buckets',
  sort_by: 'label_desc',
  max_items: 10,
  filter_param_name: 'decades'
}
```

### 4. Subjects
```typescript
{
  facet_key: 'subjects',
  facet_label: 'Subject',
  source_type: 'marc_field',
  source_field: 'subject_topical',
  source_subfield: 'a',
  display_type: 'checkbox_list',
  aggregation_method: 'distinct_values',
  sort_by: 'count_desc',
  max_items: 20,
  filter_param_name: 'subjects'
}
```

### 5. Availability
```typescript
{
  facet_key: 'availability',
  facet_label: 'Availability',
  source_type: 'items_field',
  source_field: 'status',
  display_type: 'checkbox_list',
  aggregation_method: 'distinct_values',
  sort_by: 'custom',
  custom_sort_order: ['available', 'checked_out', 'on_hold', 'unavailable'],
  max_items: 5,
  filter_param_name: 'availability',
  value_format_mapping: {
    'available': 'Available Now',
    'checked_out': 'Checked Out',
    'on_hold': 'On Hold',
    'unavailable': 'Unavailable'
  }
}
```

### 6. Location
```typescript
{
  facet_key: 'locations',
  facet_label: 'Location',
  source_type: 'items_field',
  source_field: 'location',
  display_type: 'checkbox_list',
  aggregation_method: 'distinct_values',
  sort_by: 'label_asc',
  max_items: 15,
  filter_param_name: 'locations'
}
```

---

## Performance Optimization

### Caching Strategy

**When to Cache**:
- Facet computation is expensive (>1 second)
- Catalog has >10,000 records
- Facets don't change frequently

**Cache Invalidation**:
- After bulk imports
- After catalog updates
- Manual refresh via maintenance panel
- Automatic expiration (configurable TTL)

**Cache Configuration**:
```typescript
{
  cache_enabled: true,
  cache_ttl: 3600  // 1 hour in seconds
}
```

### Database Indexes

Ensure indexes exist for facet source fields:

```sql
-- Material type facet
CREATE INDEX idx_marc_material_type ON marc_records(material_type);

-- Language facet
CREATE INDEX idx_marc_language ON marc_records(language_code);

-- Publication date facet (JSONB field)
CREATE INDEX idx_marc_pub_date ON marc_records((publication_info->>'c'));

-- Item location facet
CREATE INDEX idx_items_location ON items(location);

-- Item status facet
CREATE INDEX idx_items_status ON items(status);
```

### Query Optimization

**For Large Catalogs (>100K records)**:

1. **Limit Facet Calculation**: Only compute facets for filtered results
2. **Parallel Queries**: Use `Promise.all()` to compute facets simultaneously
3. **Materialized Views**: Pre-compute common facet combinations
4. **Connection Pooling**: Use Supabase connection pooling

**Example Materialized View**:
```sql
CREATE MATERIALIZED VIEW facet_material_types AS
SELECT material_type, COUNT(*) as count
FROM marc_records
GROUP BY material_type
ORDER BY count DESC;

-- Refresh periodically
REFRESH MATERIALIZED VIEW facet_material_types;
```

---

## Troubleshooting

### Facets Not Appearing

**Check**:
1. Is facet `is_enabled = true`?
2. Is facet `is_active = true`?
3. Are there matching records for the facet?
4. Check browser console for errors

**Solution**:
```sql
-- Verify facet configuration
SELECT facet_key, is_enabled, is_active, display_order
FROM facet_configuration
ORDER BY display_order;
```

### Incorrect Counts

**Causes**:
- Stale cache
- Filter interactions
- Data inconsistencies

**Solutions**:
1. Clear facet cache via maintenance panel
2. Check filter logic in `applyBaseFilters()`
3. Verify data integrity in database

### Slow Performance

**Causes**:
- Missing indexes
- Large result sets
- Complex JSONB queries

**Solutions**:
1. Add indexes (see Database Indexes section)
2. Enable facet caching
3. Limit max_items per facet
4. Use materialized views for expensive facets

### Formatting Issues

**Problem**: Values display as codes instead of labels

**Solution**: Configure value formatter or custom mapping
```typescript
{
  value_formatter: 'material_type',  // Use built-in
  // OR
  value_format_mapping: {             // Use custom
    'book': 'Books',
    'ebook': 'E-Books'
  }
}
```

---

## Best Practices

### 1. Facet Design

**Do**:
- Limit to 5-8 facets maximum
- Put most important facets first
- Use clear, concise labels
- Show item counts
- Enable multi-select for broad categories

**Don't**:
- Create facets for fields with too many unique values (>100)
- Use technical jargon in labels
- Hide counts (confuses users)
- Create overlapping facets

### 2. Performance

**Do**:
- Enable caching for stable facets
- Add database indexes
- Limit max_items to 10-20
- Use computed facets sparingly

**Don't**:
- Cache rapidly changing data
- Allow unlimited facet values
- Compute all facets when not displayed

### 3. User Experience

**Do**:
- Sort by count (most common first)
- Group related facets
- Provide "Show more" for long lists
- Clear visual indicators for active filters

**Don't**:
- Mix incompatible filters
- Use complex range inputs unless necessary
- Hide zero-count facets without indication

---

## Future Enhancements

### Planned Features

1. **Admin UI for Facet Configuration**
   - Visual facet builder
   - Drag-and-drop ordering
   - Live preview
   - Template library

2. **Advanced Display Types**
   - Date range pickers with calendar
   - Numeric sliders with histograms
   - Tag clouds with size weighting
   - Hierarchical facets (drill-down)

3. **Smart Facets**
   - Auto-enable relevant facets based on results
   - AI-suggested facets
   - User preference learning

4. **Performance Enhancements**
   - Background cache warming
   - Predictive caching
   - Query result caching
   - CDN integration for static facets

5. **Analytics**
   - Facet usage tracking
   - Popular filter combinations
   - User journey analysis
   - A/B testing support

---

## Related Documentation

- [Admin Maintenance Panel](./ADMIN_MAINTENANCE.md) - Cache management
- [Search Configuration](./migrations/016_search_configuration.sql) - Search settings
- [Database Schema](./DATABASE_SCHEMA.md) - Complete database structure
- [Site Configuration](./SITE_CONFIGURATION.md) - General site settings

---

## API Reference

### GET `/api/facet-config`
Fetch all facet configurations.

**Query Parameters**:
- `include_inactive=true` (admin only): Include disabled facets

**Response**:
```json
{
  "facets": [
    {
      "id": "uuid",
      "facet_key": "material_types",
      "facet_label": "Material Type",
      "source_type": "database_column",
      // ... full configuration
    }
  ]
}
```

### PUT `/api/facet-config`
Update facet configuration (admin only).

**Body**:
```json
{
  "id": "uuid",
  "facet_label": "Updated Label",
  "max_items": 15
}
```

### POST `/api/facet-config`
Create new facet configuration (admin only).

**Body**:
```json
{
  "facet_key": "new_facet",
  "facet_label": "New Facet",
  "source_type": "database_column",
  "source_field": "field_name",
  // ... required fields
}
```

### DELETE `/api/facet-config`
Soft-delete facet configuration (admin only).

**Body**:
```json
{
  "id": "uuid"
}
```

### POST `/api/facet-config/refresh-cache`
Clear all cached facet values (admin only).

**Response**:
```json
{
  "success": true,
  "message": "Facet cache cleared successfully"
}
```

### PUT `/api/facet-config/reorder`
Change facet display order (admin only).

**Body**:
```json
{
  "facets": [
    { "id": "uuid1", "display_order": 0 },
    { "id": "uuid2", "display_order": 1 }
  ]
}
```

---

## Support

For questions or issues with faceted search:

1. Check this documentation
2. Review browser console for errors
3. Verify database queries in Supabase logs
4. Test with small result sets
5. Clear cache and retry

---

**Last Updated**: 2026-01-08
**Version**: 1.0
