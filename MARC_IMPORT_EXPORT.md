# MARC Import/Export System

## Overview

The MARC Import/Export system allows library administrators to bulk import and export bibliographic records in MARC21 format, supporting both MARCXML and binary MARC formats.

## MARC Import

**Location**: `/admin/cataloging/marc-import`

### Features

#### Supported Formats

1. **MARCXML (.xml)**
   - ✅ Fully supported
   - XML-based MARC21 format
   - Human-readable structure
   - Recommended for imports

2. **Binary MARC (.mrc)**
   - ⚠️ Partial support
   - Binary MARC21 format
   - Currently shows error message with guidance
   - Full support planned for future release

### Import Process

#### Step 1: File Selection
- Click "Choose File" or drag-and-drop MARCXML file
- File size and name displayed after selection
- Supports `.xml` and `.mrc` extensions

#### Step 2: Import Options

**Duplicate Detection**
- ✅ **Enabled** (Recommended): Checks for existing records by ISBN or Control Number
- ❌ **Disabled**: Imports all records without checking

**Duplicate Action** (when detection enabled):
- **Skip duplicates**: Excludes duplicate records from import (recommended)
- **Import duplicates anyway**: Imports even if duplicates found (creates separate records)

#### Step 3: File Processing
- Click "Process File" to analyze MARCXML
- System parses all records
- Displays preview table with:
  - Record number
  - Title
  - Author
  - ISBN
  - Status badge (New or Duplicate)

#### Step 4: Record Selection
- **Select All Non-Duplicates**: Auto-selects all new records
- **Clear Selection**: Deselects all records
- **Manual Selection**: Click checkboxes for individual records

#### Step 5: Import Execution
- Click "Import N Selected Record(s)"
- Progress indicator shows "Importing..."
- Success message displays count of imported records
- Auto-redirects to catalog page after 2 seconds

### Duplicate Detection Logic

The system checks for duplicates using:

1. **ISBN Match**: Normalized ISBN (hyphens removed)
2. **Control Number Match**: MARC 001 field value

**Query**:
```sql
SELECT isbn, control_number 
FROM marc_records 
WHERE isbn IN (?) OR control_number IN (?);
```

### MARCXML Parsing

The import system maps MARCXML fields to the database schema:

#### Control Fields
- **001** → `control_number`
- **003** → `control_number_identifier`
- **008** → `date_entered`

#### Data Fields
- **020$a** → `isbn` (digits and X only)
- **022$a** → `issn`
- **100** → `main_entry_personal_name` (JSONB)
- **110** → `main_entry_corporate_name` (JSONB)
- **245** → `title_statement` (JSONB)
  - $a: Title
  - $b: Subtitle
  - $c: Statement of responsibility
- **260/264** → `publication_info` (JSONB)
  - $a: Place
  - $b: Publisher
  - $c: Date
- **300** → `physical_description` (JSONB)
- **490** → `series_statement` (JSONB)
- **500** → `general_note[]` (Array)
- **504$a** → `bibliography_note`
- **520$a** → `summary`
- **650** → `subject_topical[]` (Array of JSONB)
- **651** → `subject_geographic[]` (Array of JSONB)
- **700** → `added_entry_personal_name[]` (Array of JSONB)
- **710** → `added_entry_corporate_name[]` (Array of JSONB)

#### Default Values
- `material_type`: "book" (can be changed after import)
- `created_at`, `updated_at`: Current timestamp

### Error Handling

**File Format Errors**:
- Invalid XML: "Invalid XML format"
- Unsupported format: "Unsupported file format"
- Binary MARC: Guidance to use MARCXML

**Import Errors**:
- Database constraint violations: Logged per record
- Network errors: Display error message
- Partial success: Shows count of successful and failed imports

### Example MARCXML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
  <record>
    <leader>00000nam a2200000 a 4500</leader>
    <controlfield tag="001">123456</controlfield>
    <datafield tag="020" ind1=" " ind2=" ">
      <subfield code="a">9780062316097</subfield>
    </datafield>
    <datafield tag="100" ind1="1" ind2=" ">
      <subfield code="a">Harari, Yuval Noah</subfield>
    </datafield>
    <datafield tag="245" ind1="1" ind2="0">
      <subfield code="a">Sapiens :</subfield>
      <subfield code="b">a brief history of humankind</subfield>
      <subfield code="c">Yuval Noah Harari</subfield>
    </datafield>
    <datafield tag="264" ind1=" " ind2="1">
      <subfield code="a">New York :</subfield>
      <subfield code="b">Harper,</subfield>
      <subfield code="c">2015</subfield>
    </datafield>
    <datafield tag="520" ind1=" " ind2=" ">
      <subfield code="a">Surveys the history of humankind from evolution to present day.</subfield>
    </datafield>
    <datafield tag="650" ind1=" " ind2="0">
      <subfield code="a">Human beings</subfield>
      <subfield code="x">History</subfield>
    </datafield>
  </record>
</collection>
```

---

## MARC Export

**Location**: `/admin/cataloging/marc-export`

### Features

#### Export Formats

1. **MARCXML** (.xml)
   - ✅ Fully supported
   - XML-based MARC21 format
   - Compatible with most ILS systems
   - Human-readable

2. **Binary MARC** (.mrc)
   - 🚧 Planned for future release
   - Binary MARC21 format
   - Compact file size

3. **Plain Text** (.txt)
   - 🚧 Planned for future release
   - Human-readable format
   - For documentation/review

### Export Process

#### Step 1: Load Catalog Records
- Automatically loads all MARC records
- Displays in searchable table
- Shows: Title, Author, ISBN, Material Type

#### Step 2: Search and Filter
- **Search Box**: Filter by title, author, or ISBN
- Real-time filtering as you type
- Case-insensitive search

#### Step 3: Record Selection
- **Select All**: Selects all filtered records
- **Clear Selection**: Deselects all records
- **Manual Selection**: Click checkboxes for specific records
- Selection count displayed prominently

#### Step 4: Export Configuration
- **Format**: Choose MARCXML, MARC, or Text (currently MARCXML only)
- **Scope**: 
  - Selected records (default)
  - All records (exports entire catalog)

#### Step 5: Export Execution
- Click "Export Selected Records"
- Browser downloads file automatically
- Filename: `marc_export_YYYYMMDD_HHMMSS.xml`

### MARCXML Generation

The export system generates valid MARCXML:

#### XML Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
  <record>
    <!-- Leader -->
    <leader>00000nam a2200000 a 4500</leader>
    
    <!-- Control fields -->
    <controlfield tag="001">...</controlfield>
    <controlfield tag="003">...</controlfield>
    <controlfield tag="008">...</controlfield>
    
    <!-- Data fields -->
    <datafield tag="020" ind1=" " ind2=" ">
      <subfield code="a">ISBN</subfield>
    </datafield>
    <!-- ... more fields ... -->
  </record>
  <!-- ... more records ... -->
</collection>
```

#### Field Mapping
Database schema → MARCXML:

- `leader` → `<leader>` (or default if missing)
- `control_number` → `<controlfield tag="001">`
- `control_number_identifier` → `<controlfield tag="003">`
- `date_entered` → `<controlfield tag="008">`
- `isbn` → `<datafield tag="020">`
- `issn` → `<datafield tag="022">`
- `main_entry_personal_name` → `<datafield tag="100">`
- `main_entry_corporate_name` → `<datafield tag="110">`
- `title_statement` → `<datafield tag="245">`
- `publication_info` → `<datafield tag="264">`
- `physical_description` → `<datafield tag="300">`
- `series_statement` → `<datafield tag="490">`
- `general_note[]` → Multiple `<datafield tag="500">`
- `summary` → `<datafield tag="520">`
- `subject_topical[]` → Multiple `<datafield tag="650">`
- `subject_geographic[]` → Multiple `<datafield tag="651">`
- `added_entry_personal_name[]` → Multiple `<datafield tag="700">`
- `added_entry_corporate_name[]` → Multiple `<datafield tag="710">`

#### XML Escaping
Special characters properly escaped:
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- `"` → `&quot;`
- `'` → `&apos;`

### Use Cases

#### 1. Backup Creation
```
Export Format: MARCXML
Scope: All records
Schedule: Weekly/monthly
```

#### 2. Data Migration
```
Export Format: MARCXML
Scope: Selected records (filtered by material type, date, etc.)
Use: Transfer to another ILS
```

#### 3. Catalog Sharing
```
Export Format: MARCXML
Scope: Selected records (public domain, specific collection)
Use: Share with other libraries
```

#### 4. Quality Review
```
Export Format: Plain Text (future)
Scope: Selected records
Use: Human review of cataloging quality
```

---

## Best Practices

### Import Best Practices

1. **Test with Small Files First**
   - Import 5-10 records initially
   - Verify mapping is correct
   - Check for any errors

2. **Enable Duplicate Detection**
   - Always check for duplicates unless intentionally creating copies
   - Review duplicate warnings before skipping

3. **Review Before Import**
   - Check the preview table carefully
   - Verify titles and authors are correct
   - Ensure proper record selection

4. **Batch Large Imports**
   - For catalogs >1000 records, import in batches of 500-1000
   - Reduces memory usage
   - Easier to troubleshoot errors

5. **Clean Data Before Import**
   - Validate MARCXML with external tools
   - Ensure proper encoding (UTF-8)
   - Remove invalid characters

### Export Best Practices

1. **Regular Backups**
   - Export entire catalog monthly
   - Store in multiple locations
   - Test restore process periodically

2. **Document Exports**
   - Note date and purpose
   - Document any filters applied
   - Keep export logs

3. **Verify Exports**
   - Open exported MARCXML in validator
   - Spot-check random records
   - Compare record counts

4. **Optimize Large Exports**
   - Use filters to reduce export size
   - Export in batches if needed
   - Consider compression for storage

---

## Troubleshooting

### Import Issues

**"Invalid XML format"**
- Cause: Malformed MARCXML
- Solution: Validate XML with external tool, check for encoding issues

**"Unsupported file format"**
- Cause: File extension not .xml or .mrc
- Solution: Ensure file is MARCXML format, rename if needed

**"Error importing record N"**
- Cause: Database constraint violation (e.g., missing required field)
- Solution: Check record structure, ensure all required fields present

**"Failed to check for duplicates"**
- Cause: Database connection issue
- Solution: Refresh page, check Supabase connection

### Export Issues

**"No records selected"**
- Cause: No checkboxes selected
- Solution: Select records or change scope to "All records"

**"Export failed"**
- Cause: Browser security settings, large file size
- Solution: Check browser console, try smaller batch

**"Invalid MARCXML generated"**
- Cause: Data corruption in database
- Solution: Check specific record data, fix and re-export

---

## Performance Optimization

### Import Performance

**For Small Files (<100 records)**:
- Process entire file at once
- Memory usage: Low
- Time: <10 seconds

**For Medium Files (100-1000 records)**:
- Process entire file
- Memory usage: Moderate
- Time: 10-60 seconds

**For Large Files (>1000 records)**:
- Consider splitting into multiple files
- Process in batches of 500-1000
- Memory usage: High
- Time: Variable

### Export Performance

**For Small Catalogs (<1000 records)**:
- Export all records at once
- File size: <1 MB
- Time: <5 seconds

**For Large Catalogs (>10,000 records)**:
- Use filters to export subsets
- Consider batch exports
- File size: May exceed 10 MB
- Time: Variable

---

## Future Enhancements

### Planned Features

1. **Binary MARC Support**
   - Import .mrc files directly
   - Export to .mrc format
   - Binary MARC parser/generator

2. **Advanced Mapping**
   - Custom field mapping configuration
   - Template-based imports
   - Field transformation rules

3. **Validation Tools**
   - Pre-import validation
   - MARC21 standard compliance checking
   - Data quality reports

4. **Batch Processing**
   - Background job queue
   - Progress indicators
   - Email notifications

5. **Import History**
   - Track all imports
   - Rollback capability
   - Audit trail

6. **Advanced Export Options**
   - Export profiles (saved filters)
   - Scheduled exports
   - Multiple format export

7. **Integration**
   - Z39.50 import
   - SRU/SRW support
   - OCLC WorldCat integration

---

## API Endpoints

### Import
**POST** `/admin/cataloging/marc-import` (Form submission)
- Handles file upload and processing
- Returns preview data

**POST** `/api/marc/import` (Future enhancement)
- API endpoint for programmatic import
- Returns import results

### Export
**GET** `/admin/cataloging/marc-export` (Page load)
- Loads catalog records for selection

**POST** `/api/marc/export` (Future enhancement)
- API endpoint for programmatic export
- Returns MARCXML file

---

## Related Documentation

- [CATALOGING_FEATURES.md](./CATALOGING_FEATURES.md) - General cataloging documentation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database schema details
- [ADMIN_MAINTENANCE.md](./ADMIN_MAINTENANCE.md) - System maintenance tools
- [MARC21 Format](https://www.loc.gov/marc/bibliographic/) - Official MARC21 specification

---

## Support

For assistance with MARC import/export:

1. **Validation**: Use online MARCXML validators
2. **Testing**: Start with small sample files
3. **Documentation**: Refer to MARC21 specification
4. **Issues**: Check browser console for detailed error messages

## Example Files

Sample MARCXML files for testing available at:
- Library of Congress: https://www.loc.gov/standards/marcxml/
- OCLC: https://www.oclc.org/developer/develop/web-services/worldcat-search-api/bibliographic-resource.en.html
