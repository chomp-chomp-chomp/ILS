# MARC21 Field Reference for Record Import

Quick reference guide for MARCXML fields supported by the ILS.

---

## Standard Identifiers

### 020 - ISBN (International Standard Book Number)
**Database**: `isbn` (VARCHAR)
```xml
<datafield tag="020" ind1=" " ind2=" ">
  <subfield code="a">9780062316097</subfield>
  <subfield code="q">(hardcover)</subfield>
</datafield>
```

### 022 - ISSN (International Standard Serial Number)
**Database**: `issn` (VARCHAR)
```xml
<datafield tag="022" ind1=" " ind2=" ">
  <subfield code="a">1234-5678</subfield>
</datafield>
```
**Use for**: Journals, magazines, newspapers

### 024 - Other Standard Identifiers
**Database**: `other_standard_identifier` (JSONB[])
```xml
<datafield tag="024" ind1="1" ind2=" ">
  <subfield code="a">012345678901</subfield>
  <subfield code="2">UPC</subfield>
</datafield>
```
**Types**: UPC, EAN, ISMN, DOI, etc.

---

## Call Numbers

### 050 - Library of Congress Call Number
**Database**: `lc_call_number` (JSONB)
```xml
<datafield tag="050" ind1="0" ind2="0">
  <subfield code="a">GN281</subfield>
  <subfield code="b">.H37 2015</subfield>
</datafield>
```

### 082 - Dewey Decimal Classification
**Database**: `dewey_call_number` (JSONB)
```xml
<datafield tag="082" ind1="0" ind2="0">
  <subfield code="a">813.54</subfield>
  <subfield code="2">23</subfield>
</datafield>
```
**Subfield 2**: Edition number (23 = 23rd edition)

---

## Main Entry (Author/Creator)

### 100 - Main Entry - Personal Name
**Database**: `main_entry_personal_name` (JSONB)
```xml
<datafield tag="100" ind1="1" ind2=" ">
  <subfield code="a">Harari, Yuval Noah</subfield>
  <subfield code="d">1976-</subfield>
  <subfield code="e">author</subfield>
</datafield>
```
**Subfields**:
- `a` = Name
- `d` = Dates
- `e` = Relator term (author, editor, etc.)

### 110 - Main Entry - Corporate Name
**Database**: `main_entry_corporate_name` (JSONB)
```xml
<datafield tag="110" ind1="2" ind2=" ">
  <subfield code="a">United Nations</subfield>
  <subfield code="b">Department of Economic and Social Affairs</subfield>
</datafield>
```
**Use either 100 OR 110, not both**

---

## Title Information

### 245 - Title Statement
**Database**: `title_statement` (JSONB)
```xml
<datafield tag="245" ind1="1" ind2="0">
  <subfield code="a">Sapiens :</subfield>
  <subfield code="b">a brief history of humankind /</subfield>
  <subfield code="c">Yuval Noah Harari.</subfield>
</datafield>
```
**Subfields**:
- `a` = Title proper
- `b` = Remainder of title (subtitle)
- `c` = Statement of responsibility

**Indicators**:
- Ind1: 0 = No title added entry, 1 = Title added entry
- Ind2: Number of characters to skip for filing (0-9)

### 246 - Varying Form of Title
**Database**: `varying_form_title` (JSONB[])
```xml
<datafield tag="246" ind1="3" ind2=" ">
  <subfield code="a">Brief history of humankind</subfield>
</datafield>
```
**Use for**: Alternate titles, spine titles, parallel titles, portions of title

---

## Edition, Publication, Physical Description

### 250 - Edition Statement
**Database**: `edition_statement` (JSONB)
```xml
<datafield tag="250" ind1=" " ind2=" ">
  <subfield code="a">Second edition.</subfield>
  <subfield code="b">revised and updated /</subfield>
</datafield>
```

### 264 - Production, Publication, Distribution
**Database**: `publication_info` (JSONB)
```xml
<datafield tag="264" ind1=" " ind2="1">
  <subfield code="a">New York :</subfield>
  <subfield code="b">Harper,</subfield>
  <subfield code="c">2015.</subfield>
</datafield>
```
**Subfields**:
- `a` = Place
- `b` = Publisher
- `c` = Date

**Ind2**: 1 = Publication, 2 = Distribution, 3 = Manufacture, 4 = Copyright

**Note**: 260 field also maps to `publication_info` (older format)

### 300 - Physical Description
**Database**: `physical_description` (JSONB)
```xml
<datafield tag="300" ind1=" " ind2=" ">
  <subfield code="a">464 pages :</subfield>
  <subfield code="b">illustrations, maps ;</subfield>
  <subfield code="c">24 cm</subfield>
</datafield>
```
**Subfields**:
- `a` = Extent (pages, volumes)
- `b` = Other physical details (illustrations, color)
- `c` = Dimensions (height in cm)

---

## RDA Content/Media/Carrier Types

### 336 - Content Type
**Database**: `content_type` (JSONB[])
```xml
<datafield tag="336" ind1=" " ind2=" ">
  <subfield code="a">text</subfield>
  <subfield code="b">txt</subfield>
  <subfield code="2">rdacontent</subfield>
</datafield>
```
**Common values**: text, cartographic image, still image, moving image, spoken word

### 337 - Media Type
**Database**: `media_type` (JSONB[])
```xml
<datafield tag="337" ind1=" " ind2=" ">
  <subfield code="a">unmediated</subfield>
  <subfield code="b">n</subfield>
  <subfield code="2">rdamedia</subfield>
</datafield>
```
**Common values**: unmediated, computer, audio, video, microform

### 338 - Carrier Type
**Database**: `carrier_type` (JSONB[])
```xml
<datafield tag="338" ind1=" " ind2=" ">
  <subfield code="a">volume</subfield>
  <subfield code="b">nc</subfield>
  <subfield code="2">rdacarrier</subfield>
</datafield>
```
**Common values**: volume, online resource, audio disc, videodisc, sheet

---

## Notes

### 500 - General Note
**Database**: `general_note` (TEXT[])
```xml
<datafield tag="500" ind1=" " ind2=" ">
  <subfield code="a">Translated from the Hebrew.</subfield>
</datafield>
```
**Use for**: Any general information that doesn't fit elsewhere

### 504 - Bibliography Note
**Database**: `bibliography_note` (TEXT)
```xml
<datafield tag="504" ind1=" " ind2=" ">
  <subfield code="a">Includes bibliographical references (pages 421-456) and index.</subfield>
</datafield>
```

### 505 - Formatted Contents Note
**Database**: `formatted_contents_note` (TEXT[])
```xml
<datafield tag="505" ind1="0" ind2=" ">
  <subfield code="a">Chapter 1. Introduction -- Chapter 2. Methods -- Chapter 3. Results.</subfield>
</datafield>
```
**Use for**: Table of contents

### 520 - Summary
**Database**: `summary` (TEXT)
```xml
<datafield tag="520" ind1=" " ind2=" ">
  <subfield code="a">The book surveys the history of humankind...</subfield>
</datafield>
```

### 546 - Language Note
**Database**: `language_note` (TEXT)
```xml
<datafield tag="546" ind1=" " ind2=" ">
  <subfield code="a">Text in English; translated from Hebrew.</subfield>
</datafield>
```

---

## Subject Access

### 650 - Subject Added Entry - Topical Term
**Database**: `subject_topical` (JSONB[])
```xml
<datafield tag="650" ind1=" " ind2="0">
  <subfield code="a">Human evolution</subfield>
  <subfield code="x">History</subfield>
  <subfield code="v">Handbooks</subfield>
  <subfield code="y">20th century</subfield>
  <subfield code="z">United States</subfield>
</datafield>
```
**Subfields**:
- `a` = Topical term
- `v` = Form subdivision
- `x` = General subdivision
- `y` = Chronological subdivision
- `z` = Geographic subdivision

**Ind2**: 0 = LCSH, 7 = Source specified in $2

### 651 - Subject Added Entry - Geographic Name
**Database**: `subject_geographic` (JSONB[])
```xml
<datafield tag="651" ind1=" " ind2="0">
  <subfield code="a">United States</subfield>
  <subfield code="x">Politics and government</subfield>
</datafield>
```

### 655 - Index Term - Genre/Form
**Database**: `genre_form_term` (JSONB[])
```xml
<datafield tag="655" ind1=" " ind2="7">
  <subfield code="a">Biographies.</subfield>
  <subfield code="2">lcgft</subfield>
</datafield>
```
**Subfield 2**: Source (lcgft = LC Genre/Form Terms, fast = FAST)

---

## Added Entries (Contributors)

### 700 - Added Entry - Personal Name
**Database**: `added_entry_personal_name` (JSONB[])
```xml
<datafield tag="700" ind1="1" ind2=" ">
  <subfield code="a">Johnson, Robert</subfield>
  <subfield code="d">1950-</subfield>
  <subfield code="e">editor</subfield>
</datafield>
```
**Use for**: Editors, translators, illustrators, contributors

### 710 - Added Entry - Corporate Name
**Database**: `added_entry_corporate_name` (JSONB[])
```xml
<datafield tag="710" ind1="2" ind2=" ">
  <subfield code="a">Library of Congress</subfield>
  <subfield code="b">Cataloging Distribution Service</subfield>
</datafield>
```

---

## Holdings and Electronic Access

### 852 - Location
**Database**: `holdings` table (separate from bib record)
```xml
<datafield tag="852" ind1=" " ind2=" ">
  <subfield code="a">Main Library</subfield>
  <subfield code="b">General Collection</subfield>
  <subfield code="c">GN281 .H37 2015</subfield>
</datafield>
```
**Note**: This is typically stored in the holdings table, not the marc_records table

### 856 - Electronic Location and Access
**Database**: holdings table with `is_electronic = true`
```xml
<datafield tag="856" ind1="4" ind2="0">
  <subfield code="u">https://example.com/ebook</subfield>
  <subfield code="z">Access online version</subfield>
</datafield>
```

---

## How Fields Map to Database

### Single Value Fields (JSONB)
These store subfields as JSON keys:
```
title_statement: {
  "a": "Main title",
  "b": "Subtitle",
  "c": "Statement of responsibility"
}
```

### Array Fields (JSONB[])
Multiple instances stored as array of JSONB objects:
```
subject_topical: [
  {"a": "Human evolution", "x": "History"},
  {"a": "Civilization", "x": "History"}
]
```

### Text Array Fields (TEXT[])
Simple text arrays:
```
general_note: [
  "Translated from the Hebrew.",
  "First published in Israel in 2011."
]
```

---

## Import Tips

### 1. Required Fields
At minimum, include:
- 245 (Title)
- 020 or 022 (ISBN/ISSN for matching)
- 264 or 260 (Publication info)

### 2. Recommended Fields
For quality records:
- 100 or 110 (Author/Creator)
- 300 (Physical description)
- 520 (Summary)
- 650 (Subject headings)
- 336/337/338 (RDA types)

### 3. Multiple Values
These fields can repeat (use arrays):
- 020 (multiple ISBNs)
- 246 (alternate titles)
- 500 (multiple notes)
- 505 (multiple contents)
- 650, 651, 655 (multiple subjects)
- 700, 710 (multiple contributors)

### 4. MARC Subfield Order
Standard order: $a $b $c $d $e ... $v $x $y $z
But any order works for parsing.

---

## Testing Your Import

1. **Validate XML**:
   ```bash
   xmllint --noout example-marc-record.xml
   ```

2. **Test with One Record**:
   - Import the simple example first
   - Verify all fields populate correctly
   - Check search functionality

3. **Check Field Mapping**:
   ```sql
   SELECT
     title_statement,
     isbn,
     lc_call_number,
     subject_topical
   FROM marc_records
   WHERE isbn = '9781234567890';
   ```

4. **Verify Search Vector**:
   ```sql
   SELECT
     title_statement->>'a' as title,
     length(search_vector::text) as vector_length
   FROM marc_records
   WHERE isbn = '9781234567890';
   ```

---

## Common Issues

### Issue: Empty JSONB Arrays
**Problem**: `subject_topical = NULL` instead of `[]`
**Solution**: Use `COALESCE(subject_topical, ARRAY[]::jsonb[])` in queries

### Issue: Missing Subfield
**Problem**: `title_statement->>'b'` returns NULL
**Solution**: Check MARCXML has the subfield; use COALESCE for defaults

### Issue: Search Not Working
**Problem**: Records not appearing in search
**Solution**: Rebuild search vector:
```sql
UPDATE marc_records SET updated_at = NOW();
```

---

## Example File Locations

- **Comprehensive Example**: `/home/user/ILS/example-marc-record.xml`
- **Simple Test Example**: `/home/user/ILS/example-marc-simple.xml`

Both files are ready to use for import testing!
