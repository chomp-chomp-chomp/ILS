# Series Statements and Linking Features

This document describes the series statement and linking enhancements added to the ILS system.

## Overview

Added comprehensive support for series statements and clickable linking between catalog records through authors, series, and subjects.

## Features Implemented

### 1. Series Statement Display

**MARC Field**: 490 (series_statement)

Series information is now displayed on:
- **Search Results** - Shows series name and volume number with clickable link
- **Browse Page** - Shows series name and volume number with clickable link
- **Record Detail Page** - Shows series name and volume number with clickable link

**Format**:
```
Series: [Series Title] ; [Volume/Number]
```

**Example**:
```
Series: Harry Potter ; Book 1
```

### 2. Clickable Author Links

Authors are now clickable links that perform an author search:
- **Search Results** - Author name links to author search
- **Browse Page** - Author name links to author search
- **Record Detail Page** - Author name links to author search

**Behavior**: Clicking an author name searches for all records by that author using the advanced search `?author=` parameter.

### 3. Clickable Subject Links

Subject headings are now clickable badges that search for related records:
- **Record Detail Page** - Each subject badge links to subject search

**Behavior**: Clicking a subject performs a subject search using the advanced search `?subject=` parameter.

### 4. Related Records ("See Also" Links)

Records can now be linked to related works with specific relationship types:

**Relationship Types Supported**:
- **Related Work** - General related work
- **Translation** - Translation of the source work
- **Original Work** - Original work (inverse of translation)
- **Earlier Edition** / **Later Edition** - Different editions of the same work
- **Adaptation** - Adaptation (e.g., book to movie)
- **Adapted From** - Source of adaptation
- **Companion Volume** - Companion work
- **Part Of** / **Contains** - Part/whole relationships
- **Supplement** / **Supplement To** - Supplementary materials
- **Continues** / **Continued By** - Serial continuation

**Public Display** (Record Detail Page):
- "Related Records" section shows all linked records
- Each link shows relationship type, title, author, year
- Optional relationship notes provide context
- Links are clickable to navigate to related record

**Admin Management** (`/admin/cataloging/[id]/related`):
- Search and select records to link
- Choose relationship type from dropdown
- Add optional relationship notes
- Set display order
- View and delete existing links

### 5. Electronic Resource Display

Electronic resources (e-books, online journals, etc.) now display access links:

**In Search Results**:
- Shows globe icon with "Electronic Resource" link
- Opens in new tab with `target="_blank"`

**In Record Detail Holdings Section**:
- Shows globe icon with "Access Online" link
- Displays access restrictions if present
- Opens in new tab

**Data Requirements**:
- Item must have `is_electronic = true`
- Item must have `url` field populated
- Optional: `access_restrictions` field for authentication notes

### 6. Browse Page Layout Update

Changed browse page from grid layout to list layout to match search results:

**Before**: Grid of cards (250px columns)
**After**: Vertical list with full-width cards

**Benefits**:
- Consistent UX across browse and search
- Better readability for longer titles
- More metadata visible per item

## Database Changes

### Migration 012: Electronic Resources

**File**: `migrations/012_electronic_resources.sql`

Adds electronic resource support to the `items` table:

```sql
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_electronic BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS access_restrictions TEXT;
```

### Migration 013: Related Records

**File**: `migrations/013_related_records.sql`

Creates table for linking related catalog records:

```sql
CREATE TABLE related_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE,
  target_record_id UUID REFERENCES marc_records(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  relationship_note TEXT,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id)
);
```

**Features**:
- Supports 14 relationship types
- Optional relationship notes for context
- Display order control
- Unique constraint prevents duplicates
- Helper function `get_relationship_label()` for display
- View `related_records_with_details` for easy querying

**To Apply Both Migrations**:
1. Open Supabase SQL Editor
2. Copy and run `migrations/012_electronic_resources.sql`
3. Copy and run `migrations/013_related_records.sql`
4. Verify tables and columns in Table Editor

### Query Updates

**Search Results** (`src/routes/catalog/search/results/+page.server.ts`):
- Updated items query to include `is_electronic`, `url`, `access_restrictions`

**Record Detail** (`src/routes/catalog/record/[id]/+page.server.ts`):
- Changed from `holdings` table to `items` table (holdings table doesn't exist in migrations)
- Now queries all item fields including electronic resource fields

## Files Modified

### Frontend Components

1. **src/routes/catalog/search/results/+page.svelte**
   - Added clickable author links
   - Added series statement display with links
   - Added electronic resource display with URL
   - Added CSS for `.author-link`, `.series-link`, `.series`, `.electronic-access`, `.url-link`

2. **src/routes/catalog/browse/+page.svelte**
   - Changed from grid to list layout
   - Added clickable author links
   - Added series statement display with links
   - Updated CSS from `.records-grid` to `.records-list`
   - Added consistent styling with search results

3. **src/routes/catalog/record/[id]/+page.svelte**
   - Made author field clickable
   - Added series statement field with link
   - Made subject tags clickable
   - Added electronic resource display in holdings
   - Added CSS for `.link-value`, updated `.subject-tag`, `.electronic-access`, `.electronic-link`, `.access-note`

### Backend Data Loading

4. **src/routes/catalog/search/results/+page.server.ts**
   - Added `is_electronic`, `url`, `access_restrictions` to items select query

5. **src/routes/catalog/record/[id]/+page.server.ts**
   - Changed query from `holdings` table to `items` table
   - Added query for related records with full target record details

### Admin Interface

6. **src/routes/admin/cataloging/[id]/related/+page.svelte** (NEW)
   - Admin interface for managing related record links
   - Search and select records to link
   - Choose relationship type and add notes
   - View and delete existing links

7. **src/routes/admin/cataloging/[id]/related/+page.server.ts** (NEW)
   - Server loader for related records admin page

### API Endpoints

8. **src/routes/api/related-records/+server.ts** (NEW)
   - POST endpoint to create related record links
   - Validates fields, prevents self-links and duplicates

9. **src/routes/api/related-records/[id]/+server.ts** (NEW)
   - DELETE endpoint to remove related record links

10. **src/routes/api/records/search/+server.ts** (NEW)
    - GET endpoint for searching records
    - Used by admin interface for finding records to link

### Database Migrations

11. **migrations/012_electronic_resources.sql** (NEW)
    - Adds electronic resource fields to items table

12. **migrations/013_related_records.sql** (NEW)
    - Creates related_records table and supporting functions

### Documentation

13. **SERIES_AND_LINKING.md** (NEW)
    - This document

## Usage Examples

### Adding Series Information to a Record

When cataloging a record with a series:

1. In MARC editor, add series statement (490 field):
   - `$a` - Series title (e.g., "The Chronicles of Narnia")
   - `$v` - Volume number (e.g., "Book 2")

2. The series will automatically appear in search results, browse, and detail pages with a clickable link.

### Adding Electronic Resources

To add an electronic resource:

1. Create an item record for the MARC record
2. Set `is_electronic = true`
3. Add the URL in the `url` field
4. Optionally add access restrictions (e.g., "Requires library login")
5. The resource will show with an "Access Online" link

### Linking Related Records

To link related records (admin only):

1. Navigate to the record detail page in admin
2. Click "Manage Related Records" or go to `/admin/cataloging/[id]/related`
3. Search for the record you want to link
4. Select the record from search results
5. Choose the relationship type (e.g., "Translation", "Earlier Edition")
6. Optionally add a relationship note
7. Set display order if needed
8. Click "Add Related Record"
9. The link will appear on the public record detail page

**Examples**:
- Link "Harry Potter and the Philosopher's Stone" to "Harry Potter and the Sorcerer's Stone" (relationship: "Related Work", note: "US edition")
- Link a movie adaptation to the original book (relationship: "Adapted From")
- Link an audiobook to the print edition (relationship: "Related Work")
- Link a sequel to its predecessor (relationship: "Continues")

### Discovering Related Content

Users can now discover related content by clicking:
- **Author names** - Find all works by the same author
- **Series titles** - Find all books in the same series
- **Subject headings** - Find all books on the same topic
- **Related Records** - View translations, editions, adaptations, and related works

## Technical Details

### Link Generation

All links use URL encoding to handle special characters:

```javascript
href="/catalog/search/results?author={encodeURIComponent(author)}"
```

### Search Parameters

- **Author search**: `?author=Author%20Name`
- **Subject search**: `?subject=Subject%20Term`
- **Series search**: `?q=Series%20Title` (uses keyword search)

### CSS Styling

**Link Colors**:
- Primary links: `#667eea` (purple-blue)
- Hover: `#5568d3`
- Electronic resource: `#2e7d32` (green)

**Interaction**:
- All links have smooth transitions
- Subject badges have hover lift effect
- Electronic links open in new tab

## Testing Checklist

### Database Setup
- [ ] Apply migration 012_electronic_resources.sql in Supabase
- [ ] Apply migration 013_related_records.sql in Supabase
- [ ] Verify `items` table has is_electronic, url, access_restrictions columns
- [ ] Verify `related_records` table exists with proper constraints

### Series Statements
- [ ] Create test record with series statement
- [ ] Verify series appears in search results with clickable link
- [ ] Verify series appears in browse page with clickable link
- [ ] Verify series appears on record detail page with clickable link

### Clickable Links
- [ ] Click author name and verify it searches by author
- [ ] Click subject tag and verify it searches by subject
- [ ] Click series title and verify it searches by series

### Electronic Resources
- [ ] Create test item with is_electronic=true and URL
- [ ] Verify electronic resource link appears in search results
- [ ] Verify electronic resource link appears in record detail holdings
- [ ] Verify link opens in new tab
- [ ] Test with access restrictions note

### Related Records
- [ ] Access `/admin/cataloging/[record-id]/related` page
- [ ] Search for a record using the search box
- [ ] Select a record from search results
- [ ] Choose a relationship type
- [ ] Add a relationship note
- [ ] Successfully create a related record link
- [ ] Verify link appears in "Current Related Records" table
- [ ] View public record detail page and verify "Related Records" section appears
- [ ] Click related record link and verify it navigates correctly
- [ ] Delete a related record link
- [ ] Verify deletion removes it from both admin and public pages
- [ ] Test duplicate prevention (try adding same link twice)
- [ ] Test self-link prevention (try linking record to itself)

### Layout and Responsive
- [ ] Test on mobile devices for responsive layout
- [ ] Verify browse page uses list layout (not grid)
- [ ] Verify all links are keyboard accessible

## Future Enhancements

### Series Browse
- Add dedicated series browse page (alphabetical list)
- Show series with all volumes listed
- Sort by series order

### Authority Control
- Link to authority records for authors
- Suggest related authors
- Author disambiguation

### Enhanced Related Records
- Bidirectional links (auto-create inverse relationships)
- Relationship history/audit trail
- Bulk relationship management
- Visual relationship graph
- MARC 76X-78X field integration for automatic relationship detection

### Enhanced Electronic Access
- Proxy server integration
- Usage statistics tracking
- Link checking/validation
- OpenURL resolver integration

## Troubleshooting

**Series not appearing**:
- Check that `series_statement` field is populated in marc_records
- Verify field has `a` subfield (series title)
- Inspect browser console for errors

**Author/subject links not working**:
- Check URL encoding in browser dev tools
- Verify search parameters are correct
- Test advanced search manually

**Electronic resource links not showing**:
- Ensure migration 012 has been applied
- Check `is_electronic` is set to `true`
- Verify `url` field is not null or empty
- Check browser console for query errors

**Browse page still showing grid**:
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check CSS is loaded correctly

**Related records not appearing**:
- Ensure migration 013 has been applied
- Check `related_records` table exists
- Verify relationship was created successfully (check admin page)
- Check browser console for API errors

**Cannot add related record**:
- Ensure you're authenticated as admin
- Check that target record exists and is different from source
- Verify relationship doesn't already exist
- Check network tab for API response errors

**Search not working in admin interface**:
- Ensure `/api/records/search` endpoint is accessible
- Check that records have search_vector populated
- Verify search query has at least one character

---

**Version**: 2.0
**Date**: 2025-12-29
**Implemented**: Features #1 and #2 from enhancement roadmap, including full "See Also" / Related Records functionality
