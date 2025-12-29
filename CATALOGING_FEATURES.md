# Advanced Cataloging Features

This document describes the advanced cataloging features added to the ILS system for power users and cataloging staff.

## Table of Contents

1. [Copy Cataloging](#copy-cataloging)
2. [Batch Editing](#batch-editing)
3. [Cataloging Templates](#cataloging-templates)
4. [MARC Import/Export](#marc-importexport)

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
