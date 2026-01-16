# Advanced Cataloging Features

This document describes the advanced cataloging features added to the ILS system for power users and cataloging staff.

## Table of Contents

1. [Enhanced ISBN Lookup](#enhanced-isbn-lookup)
2. [Bulk ISBN Import](#bulk-isbn-import)
3. [Copy Cataloging](#copy-cataloging)
4. [Batch Editing](#batch-editing)
5. [Cataloging Templates](#cataloging-templates)
6. [MARC Import/Export](#marc-importexport)

---

## Enhanced ISBN Lookup

### Overview
The ISBN Lookup feature has been significantly enhanced to query multiple bibliographic data sources, providing comprehensive metadata, call numbers, digital access links, and table of contents information.

### Location
`/admin/cataloging/isbn-lookup`

### Data Sources

The system now queries **7 major bibliographic sources** in intelligent cascades:

1. **OpenLibrary** - Fast, comprehensive coverage for popular books
   - Cover images
   - Basic bibliographic data
   - Page counts
   - Subjects

2. **Library of Congress (SRU)** - Authoritative MARC records
   - LC Subject Headings (LCSH)
   - LC call numbers
   - Dewey Decimal numbers
   - Publication data

3. **OCLC WorldCat Classify** - Call number classification
   - Dewey Decimal Classification (DDC)
   - Library of Congress Classification (LCC)
   - OCLC numbers
   - VIAF IDs for authority control

4. **HathiTrust** ✨ NEW
   - Digital access links to full-text when available
   - Public domain vs. restricted access indicators
   - LCCN validation
   - Rights information (public domain, in copyright, etc.)

5. **Harvard LibraryCloud** ✨ NEW
   - Academic metadata (MODS format)
   - Enhanced subject coverage
   - Table of contents
   - High-quality call numbers
   - Physical descriptions

6. **Google Books** ✨ NEW (Enhanced)
   - Digital preview links
   - Viewability status (full view, limited preview, snippet)
   - Cover images
   - Categories/subjects

### How to Use

1. Navigate to `/admin/cataloging/isbn-lookup`
2. Enter an ISBN (10 or 13 digits, with or without hyphens)
3. Click "Search" or press Enter
4. Watch the progress log as the system queries each source
5. Review the combined results
6. Click "Import to Catalog" to add the record

### Search Process

The system uses an intelligent cascade strategy:

**If found on OpenLibrary (Step 1):**
- Base record from OpenLibrary
- ✓ Supplement with Library of Congress MARC data
- ✓ Add call numbers from OCLC WorldCat
- ✓ Add digital links from HathiTrust
- ✓ Enhance with Harvard academic metadata
- ✓ Add preview links from Google Books

**If NOT found on OpenLibrary (Fallback):**
- Try Library of Congress → OCLC → HathiTrust → Harvard → Google Books
- Each source supplements or replaces previous data
- System continues until finding usable data

### Features

#### Digital Access Links 🌐

When available, the system displays direct links to digital versions:

- **HathiTrust Full-Text**
  - 🔓 Public domain books (full access)
  - 🔒 Copyrighted books (limited access based on rights)
  - Online reader format

- **Google Books Previews**
  - 👁️ Preview available
  - Full view for public domain
  - Limited preview for recent books
  - Snippet view for restricted content

Each link shows:
- Provider name (HathiTrust, Google Books)
- Access level badge (Full Access, Preview, Restricted)
- View type
- Direct link to open in new tab

#### Table of Contents 📖

When Harvard LibraryCloud provides TOC data:
- Displayed in formatted section
- Scrollable for long contents
- Helps patrons understand book structure
- Aids in collection development decisions

#### Call Numbers 📚

Comprehensive call number coverage:
- **Dewey Decimal Classification** - from OCLC or Harvard
- **Library of Congress Classification** - from LoC or OCLC
- Color-coded display (green background)
- Automatically applied to holdings
- Monospaced font for clarity

#### Enhanced Subjects

Subject headings from multiple sources:
- **LC Subject Headings** (LCSH) - from Library of Congress
- **Harvard subjects** - academic vocabulary
- **OpenLibrary subjects** - community-generated
- Deduplicated and limited to top 10
- Ready for import as MARC 650 fields

### Data Import

When you click "Import to Catalog":

**Stored in MARC record:**
- Title and subtitle (245 $a, $b)
- Author (100 $a)
- Publisher and date (260/264)
- Subjects (650 fields)
- Summary (520)
- Table of contents (505) ✨ NEW
- Physical description (300)

**Stored in marc_json field:**
- Original source attribution
- Digital links array ✨ NEW
- Call numbers (Dewey, LC)
- OCLC number
- VIAF ID
- Complete imported data for reference

**Auto-created holding:**
- Default location: "Main Library"
- Status: "available"
- Call number: Dewey or LC (whichever available)
- Copy number: 1

### Search Log

Real-time progress indicators:
```
1/7 Searching OpenLibrary...
  ✓ Found on OpenLibrary
  → Supplementing with Library of Congress...
  ✓ Added MARC data from Library of Congress
  → Getting call numbers from OCLC WorldCat...
  ✓ Added call numbers from OCLC
  → Checking HathiTrust for digital access...
  ✓ Found 2 digital copy(ies) on HathiTrust
  → Checking Harvard LibraryCloud...
  ✓ Added academic metadata from Harvard
  → Checking Google Books for previews...
  ✓ Found preview on Google Books
```

### Benefits

1. **Comprehensive Coverage** - Queries 7 sources for most complete data
2. **Digital Discovery** - Links to free full-text and previews
3. **Better Call Numbers** - Multiple authoritative sources
4. **Academic Enhancement** - Harvard metadata for scholarly works
5. **TOC Display** - Helps users understand book content
6. **Time Savings** - Automatic merging of best data from each source
7. **Graceful Fallback** - Continues searching until finding data

### Technical Details

- **Timeouts**: 8-10 seconds per source to prevent hanging
- **Parallel Queries**: Some sources queried simultaneously for speed
- **Error Handling**: Individual source failures don't stop the process
- **Data Merging**: Intelligent preference for higher-quality metadata
- **Type Safety**: Full TypeScript types for all API responses

### Future Enhancements

- British Library Z39.50 integration
- LibraryThing extended data
- Multiple call number display options
- Direct MARC download from sources

---

## Bulk ISBN Import

### Overview
The Bulk ISBN Import feature allows you to import multiple books at once by entering a list of ISBNs. Like the single ISBN lookup, it now queries all 7 bibliographic sources for comprehensive metadata.

### Location
`/admin/cataloging/bulk-isbn`

### Data Sources

Queries the **same 7 major bibliographic sources** as single ISBN lookup:

1. **OpenLibrary** - Fast, good coverage
2. **Library of Congress** - Authoritative MARC data
3. **OCLC WorldCat** - Call numbers (integrated in LoC query)
4. **HathiTrust** ✨ NEW - Digital access links
5. **Harvard LibraryCloud** ✨ NEW - Table of contents, academic metadata
6. **Google Books** ✨ NEW - Preview links

### How to Use

1. Navigate to `/admin/cataloging/bulk-isbn`
2. Enter ISBNs in the text area (one per line)
   - Can be ISBN-10 or ISBN-13
   - Hyphens and spaces are automatically removed
   - Example format:
     ```
     9780743273565
     978-0-06-231609-7
     0451524934
     ```
3. Click **"Process ISBNs"**
4. Wait while the system queries each ISBN across all sources (~2-5 seconds per ISBN)
5. Review the results:
   - ✓ Green checkmark = Found
   - ✗ Red X = Not found
   - Source information shown for each result
6. Select the records you want to import (checkboxes)
7. Click **"Import Selected"**

### Features

#### Comprehensive Metadata
Each ISBN is queried across multiple sources and results are intelligently merged:

**From OpenLibrary:**
- Cover images
- Basic bibliographic data
- Page counts

**From Library of Congress:**
- LC Subject Headings (LCSH)
- LC and Dewey call numbers
- Genre/form terms
- Variant titles

**From HathiTrust:**
- Digital full-text links (when available)
- Public domain indicators
- OCLC and LCCN numbers

**From Harvard:**
- Table of contents
- Enhanced abstracts/summaries
- Academic subject headings
- Additional call numbers

**From Google Books:**
- Preview links
- Viewability status

#### Data Merging Strategy

The system intelligently combines data from all sources:
1. Prefers authoritative data (LoC subjects > OpenLibrary)
2. Combines digital links from all sources
3. Deduplicates subjects across sources (max 10 retained)
4. Fills in missing call numbers from any available source
5. Preserves table of contents when available

#### Processing Speed

- **Average**: 2-5 seconds per ISBN
- **Timeout**: 8 seconds per source
- Processes ISBNs sequentially with 300ms delay between each
- Real-time progress display

#### Results Display

Each result shows:
- ISBN
- Status (found/not found/error)
- Source(s) that provided data
- Title preview
- Checkbox for import selection

#### Import Behavior

**New Records:**
- Creates new MARC record
- Creates default holding (location: "Main Library", status: "available")
- Includes:
  - Title, subtitle, variant title
  - Author(s)
  - Publisher, publication date
  - ISBN, ISSN
  - Call numbers (LC and Dewey)
  - Subjects (up to 10)
  - Genre/form terms
  - Edition statement
  - Physical description
  - Language notes
  - Contents notes
  - **Summary** ✨ NEW
  - **Table of Contents** ✨ NEW
  - **Digital Links** ✨ NEW (in marc_json)

**Existing Records:**
- Updates/overlays existing record with same ISBN
- Preserves record ID
- Updates timestamp

### Digital Access Links

Digital links are stored in `marc_json.digital_links` as an array:

```json
{
  "digital_links": [
    {
      "url": "https://catalog.hathitrust.org/Record/...",
      "provider": "HathiTrust",
      "access": "public",
      "type": "Full view",
      "format": "online_reader"
    },
    {
      "url": "https://books.google.com/books?id=...",
      "provider": "Google Books",
      "access": "preview",
      "type": "PARTIAL",
      "format": "online_reader"
    }
  ]
}
```

These links appear on the public OPAC record detail pages, allowing patrons to access:
- **Full-text** for public domain books (HathiTrust)
- **Previews** for in-copyright books (Google Books)

### Performance Considerations

**For large batches** (50+ ISBNs):
- Allow 5-10 minutes for processing
- Page stays responsive during processing
- Can pause/resume by closing and reopening
- Results are saved as processed

**Recommendations:**
- Process in batches of 20-50 ISBNs
- Monitor progress in real-time
- Internet connection must remain stable
- Some timeouts are expected (APIs can be slow)

### Error Handling

**Common errors and solutions:**

1. **"Not found"** - ISBN doesn't exist in any database
   - Verify ISBN is correct
   - Try alternative identifiers (LCCN, OCLC)
   - Manual cataloging may be needed

2. **Timeout errors** - API too slow
   - Normal for some ISBNs
   - Data from other sources still merged
   - Can retry individual ISBNs later

3. **Network errors** - Connection issues
   - Check internet connection
   - Retry when connection is stable

### Use Cases

1. **Processing donation batches**
   - Donor provides list of ISBNs
   - Quick import of entire batch
   - Review and edit records after import

2. **Collection development orders**
   - Import ISBNs from acquisition list
   - Preview metadata before ordering
   - Generate catalog records immediately

3. **Retrospective conversion**
   - Convert legacy card catalog
   - ISBN lists from existing systems
   - Bulk enhancement of existing records

4. **Course reserves**
   - Faculty provides reading list ISBNs
   - Quick setup for new semester
   - Complete metadata with digital links

### Future Enhancements

- CSV import with additional fields
- Progress saving/resuming
- Batch error retry
- Parallel processing for speed
- ISBN validation before processing

---

## Copy Cataloging

### Overview
The Copy Cataloging feature allows catalogers to quickly duplicate existing MARC records, which is useful when cataloging similar items, multiple volumes, or series.

### Location
`/admin/cataloging/edit/[id]`

### How to Use

1. Navigate to any MARC record edit page
2. Click the **"📋 Duplicate Record"** button in the header (next to Delete)
3. Confirm the duplication dialog
4. You'll be redirected to edit the new copy with all fields pre-filled

### Details

**What Gets Copied:**
- All MARC content fields (title, author, subjects, etc.)
- Publication information
- Physical description
- Series statements
- Notes and summaries
- Material type

**What Doesn't Get Copied:**
- `id` (new UUID generated)
- `control_number` (should be unique per record)
- Timestamps (new created_at/updated_at set)

### Use Cases

- Creating records for multiple copies/volumes of the same title
- Cataloging book series with similar metadata
- Starting from an existing record template

---

## Batch Editing

### Overview
Batch Editing allows catalogers to select multiple records and apply bulk updates to common fields, saving time when making systematic changes across the catalog.

### Location
`/admin/cataloging`

### How to Use

#### Selecting Records

1. Navigate to the catalog records list
2. Check the boxes next to records you want to edit
3. Use **"Select All"** button to select all visible records
4. The batch actions toolbar appears when records are selected

#### Applying Bulk Updates

1. Click **"Bulk Edit"** in the batch actions toolbar
2. Check which fields you want to update:
   - **Material Type**: Change all selected records to a specific material type
   - **Add Subject Headings**: Append subjects to existing ones (comma-separated)
   - **Replace Subject Headings**: Replace all subjects (comma-separated)
   - **Add General Note**: Append a note to all selected records
3. Fill in the values for selected fields
4. Click **"Apply Changes"**
5. Confirm the operation

### Features

- **Multi-select**: Choose specific records or select all
- **Field chooser**: Only update the fields you need
- **Add vs Replace**: Choose whether to append or replace subjects
- **Error tracking**: See which records succeeded/failed
- **Confirmation**: Prevents accidental bulk changes

### Use Cases

- Adding genre subjects to a collection of fiction books
- Changing material type for misclassified items
- Adding collection notes to all items in a special collection
- Updating subject headings for reclassification projects

---

## Cataloging Templates

### Overview
Cataloging Templates allow you to save common cataloging patterns as reusable templates, speeding up the cataloging process for frequently-cataloged material types.

### Location
- Template Manager: `/admin/cataloging/templates`
- Template Application: `/admin/cataloging/new` (when creating new records)

### How to Use

#### Creating Templates

1. Navigate to **Templates** from the catalog page
2. Click **"+ Create Template"**
3. Fill in the template form:
   - **Name**: Descriptive name (e.g., "Fiction Book", "Children's DVD")
   - **Description**: When to use this template (optional)
   - **Category**: Organizational category (book, dvd, audiobook, etc.)
   - **Material Type**: Default material type
   - **Publication Info**: Default publisher/location
   - **Default Subjects**: Common subjects for this type
   - **Default Note**: Standard note to include
4. Click **"Create Template"**

#### Using Templates

1. Navigate to **Create New Record**
2. Select a template from the dropdown at the top
3. Click **"Apply Template"**
4. Form fields are pre-filled with template values
5. Fill in record-specific details (title, author, ISBN, etc.)
6. Save the record as normal

#### Managing Templates

- **Edit**: Click the ✏️ icon to modify a template
- **Activate/Deactivate**: Click the 👁️ icon to toggle availability
- **Delete**: Click the 🗑️ icon to remove a template
- **Organize**: Templates are grouped by category

### Database Schema

```sql
cataloging_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  category VARCHAR(50),
  is_active BOOLEAN,
  material_type VARCHAR(50),
  publication_info JSONB,
  subject_topical JSONB[],
  general_note TEXT[],
  template_data JSONB,
  created_by UUID REFERENCES auth.users(id)
)
```

### Use Cases

- Fiction books with standard genre subjects
- Children's materials with age-appropriate cataloging
- DVDs with format-specific fields
- Serials/periodicals with recurring patterns
- Audiobooks with narrator information templates

---

## MARC Import/Export

### Overview
MARC Import/Export enables bulk cataloging operations by importing bibliographic records from MARC files and exporting catalog data for sharing with other library systems.

### Locations
- Import: `/admin/cataloging/marc-import`
- Export: `/admin/cataloging/marc-export`

### MARC Import

#### Supported Formats

- **MARCXML (.xml)**: ✅ Fully supported
- **Binary MARC (.mrc)**: ⚠️ Coming soon (parsing complex)

#### How to Import

1. Navigate to **MARC Import**
2. Select a MARCXML file from your computer
3. Choose import options:
   - **Check for duplicates**: Compares ISBN and control numbers
   - **Duplicate action**: Skip or import duplicates
4. Click **"Process File"**
5. Review the import preview:
   - See all records found in the file
   - Duplicates are highlighted in yellow
   - Select which records to import
6. Click **"Import N Selected Record(s)"**
7. Records are added to your catalog

#### MARCXML Parsing

The import parser handles these MARC fields:

**Control Fields:**
- 001: Control Number
- 003: Control Number Identifier
- 008: Date Entered

**Data Fields:**
- 020: ISBN
- 022: ISSN
- 100: Main Entry - Personal Name
- 110: Main Entry - Corporate Name
- 245: Title Statement
- 260/264: Publication Information
- 300: Physical Description
- 490: Series Statement
- 500: General Note
- 504: Bibliography Note
- 520: Summary
- 650: Subject - Topical
- 651: Subject - Geographic
- 700: Added Entry - Personal Name
- 710: Added Entry - Corporate Name

#### Duplicate Detection

Records are flagged as duplicates if they match existing records by:
- ISBN (normalized, alphanumeric only)
- Control Number (MARC 001 field)

### MARC Export

#### Export Formats

- **MARCXML (.xml)**: ✅ Full support with proper XML escaping
- **Binary MARC (.mrc)**: ⚠️ Coming soon

#### How to Export

1. Navigate to **MARC Export**
2. Choose export options:
   - **Format**: MARCXML (recommended)
   - **Scope**: Selected records or all records
3. If exporting selected records:
   - Use the search bar to filter
   - Check boxes next to records to export
   - Or click **"Select All"**
4. Click **"Export Records"**
5. File downloads automatically with timestamp:
   - Example: `marc_export_2025-12-29.xml`

#### MARCXML Output

The exporter generates valid MARCXML with:
- Proper XML declaration and namespace
- Leader field (or default if missing)
- All control fields (001, 003, 008)
- All data fields with indicators and subfields
- XML entity escaping (&, <, >, ", ')

### Technical Implementation

#### Import Flow
```
1. User uploads MARCXML file
2. Parse XML using DOMParser
3. Extract MARC fields into JSON structure
4. Check database for duplicates (optional)
5. Display preview table with status
6. User selects records
7. Insert selected records into marc_records table
8. Redirect to catalog
```

#### Export Flow
```
1. User selects export scope
2. Load records from marc_records table
3. Convert records to MARCXML format
4. Generate XML string with proper structure
5. Create Blob and trigger download
6. Cleanup and show success message
```

### Use Cases

- **Import**:
  - Migrating from another library system
  - Batch cataloging from vendor MARC records
  - Accepting donated collections with metadata
  - Integrating shared cataloging from consortia

- **Export**:
  - Backing up catalog data
  - Sharing records with partner libraries
  - Submitting to union catalogs
  - Data analysis and reporting
  - System migration preparation

### Best Practices

1. **Before Import**:
   - Always check for duplicates
   - Review preview before importing
   - Start with a small test file
   - Backup your database first

2. **During Import**:
   - Handle duplicates appropriately for your needs
   - Verify record quality in preview
   - Check field mapping accuracy

3. **After Import**:
   - Review imported records
   - Check for missing data
   - Verify subject headings
   - Add holdings/items as needed

4. **For Export**:
   - Use MARCXML for interoperability
   - Include all necessary fields
   - Test exports on small datasets first
   - Verify file opens in MARC viewers

---

## Database Migrations

### Migration 007: Cataloging Templates

Run this migration to create the templates table:

```bash
# File: migrations/007_cataloging_templates.sql
```

Apply to Supabase:
```sql
-- Execute the SQL from the migration file in your Supabase SQL editor
```

---

## Technical Notes

### Technologies Used

- **SvelteKit 5**: Framework with new runes ($state, $effect, $props)
- **Supabase**: PostgreSQL database with real-time capabilities
- **TypeScript**: Type-safe development
- **Native APIs**: DOMParser for XML, Blob for file downloads

### File Structure

```
src/routes/admin/cataloging/
├── +page.svelte                    # Main catalog list (with batch editing)
├── edit/[id]/+page.svelte         # Edit page (with duplicate button)
├── new/+page.svelte               # New record (with template selector)
├── templates/
│   ├── +page.svelte               # Template manager
│   └── +page.ts                   # Data loader
├── marc-import/
│   ├── +page.svelte               # MARC import interface
│   └── +page.ts                   # Data loader
└── marc-export/
    ├── +page.svelte               # MARC export interface
    └── +page.ts                   # Data loader
```

### Design System

All features follow the **Chomp Design System**:
- Primary color: `#e73b42` (red accent)
- Consistent spacing: 8px, 12px, 20px, 30px, 40px
- Border radius: 4px, 8px, 12px
- Button styles: `.btn-primary`, `.btn-secondary`, `.btn-cancel`
- Message styles: `.message.success`, `.message.error`, `.message.info`
- Card-based layouts with subtle shadows

---

## Future Enhancements

### Planned Features

1. **Binary MARC Support**
   - Implement ISO 2709 parser
   - Support .mrc file import/export
   - Handle character encoding (MARC-8, UTF-8)

2. **Enhanced Batch Editing**
   - Change call numbers with prefix patterns
   - Update location/collection
   - Modify publication dates
   - Bulk delete with confirmation

3. **Template Improvements**
   - Share templates between users
   - Import/export templates
   - Template versioning
   - More field coverage

4. **Import Enhancements**
   - Authority control integration
   - Record merging (choose fields from duplicates)
   - Import scheduling/automation
   - Progress tracking for large files

5. **Export Enhancements**
   - Export to other formats (CSV, JSON)
   - Customizable field selection
   - Export holdings with records
   - Batch export by date range

---

## Support and Troubleshooting

### Common Issues

**Import fails with "Invalid XML":**
- Ensure file is valid MARCXML format
- Check file isn't corrupted
- Verify XML declaration is present

**Duplicates not detected:**
- Check if records have ISBN or control numbers
- Verify ISBN format (should be alphanumeric)
- Review duplicate detection logic

**Export file won't download:**
- Check browser pop-up blocker
- Verify sufficient disk space
- Try different browser

**Template not appearing in dropdown:**
- Ensure template is set to "Active"
- Check template was saved successfully
- Refresh the new record page

### Getting Help

For issues or questions:
1. Check this documentation first
2. Review the database schema
3. Inspect browser console for errors
4. Check Supabase logs for database errors

---

## Credits

Developed for the ILS (Integrated Library System) project using SvelteKit 5 and Supabase.

**Features Implemented:**
- Copy Cataloging
- Batch Editing
- Cataloging Templates
- MARC Import/Export

**Date:** December 2025
**Version:** 1.0
