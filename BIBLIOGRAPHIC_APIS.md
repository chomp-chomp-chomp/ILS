# Bibliographic Data APIs

This document describes the external bibliographic data sources integrated into the ILS for enhanced metadata retrieval, digital access, and cataloging support.

## Overview

The ILS integrates with multiple free bibliographic APIs to provide comprehensive metadata for cataloging. The system queries these sources intelligently, merging data to create the most complete record possible.

---

## Integrated APIs

### 1. OpenLibrary API

**Provider**: Internet Archive  
**Type**: REST JSON API  
**Authentication**: None required  
**Documentation**: https://openlibrary.org/developers/api

**What We Get:**
- Title and subtitle
- Authors
- Publishers
- Publication dates
- Page counts
- Cover images (high resolution)
- Subjects (community-generated)
- ISBNs, ISSNs

**API Endpoints Used:**
```
GET https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data
GET https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg
```

**Rate Limits**: Fair use policy, no hard limits  
**Reliability**: High (99%+ uptime)  
**Coverage**: Excellent for popular books, weaker for academic titles

---

### 2. Library of Congress (SRU)

**Provider**: Library of Congress  
**Type**: SRU (Search/Retrieve via URL) - Returns MARCXML  
**Authentication**: None required  
**Documentation**: https://www.loc.gov/standards/sru/

**What We Get:**
- Full MARC21 records
- Authoritative LC Subject Headings (LCSH)
- LC Classification numbers (050 field)
- Dewey Decimal numbers (082 field)
- Notes and summaries
- Publication information

**API Endpoints Used:**
```
GET https://lx2.loc.gov:210/lcdb?operation=searchRetrieve&version=1.1&query=bath.isbn={isbn}&maximumRecords=1&recordSchema=marcxml
```

**Rate Limits**: None specified, reasonable use expected  
**Reliability**: Very high (government service)  
**Coverage**: Best for U.S. published materials, authoritative MARC records

**Timeout**: 5 seconds (LoC can be slow)

---

### 3. OCLC WorldCat Classify

**Provider**: OCLC (Online Computer Library Center)  
**Type**: REST XML API  
**Authentication**: None required for basic usage  
**Documentation**: https://www.oclc.org/developer/api/oclc-apis/worldcat-search-api.en.html

**What We Get:**
- Dewey Decimal Classification (DDC)
- Library of Congress Classification (LCC)
- Most popular vs. most recent classifications
- OCLC numbers (for WorldCat lookup)
- VIAF IDs (Virtual International Authority File)
- Language codes
- Basic bibliographic data

**API Endpoints Used:**
```
GET https://classify.oclc.org/classify2/Classify?isbn={isbn}&summary=true
```

**Response Codes:**
- `0` = Single work match (best)
- `2` = Multiple works (we use first)
- `4` = Single edition match
- Other = No useful match

**Rate Limits**: Fair use (no published limits)  
**Reliability**: Very high  
**Coverage**: Excellent (largest bibliographic database in the world)

---

### 4. HathiTrust Bibliographic API ✨

**Provider**: HathiTrust Digital Library  
**Type**: REST JSON API  
**Authentication**: None required for bibliographic data  
**Documentation**: https://www.hathitrust.org/bib_api

**What We Get:**
- Digital access links to full-text
- Rights information (public domain vs. in copyright)
- Access level (full view, limited view)
- OCLC numbers
- LCCNs
- Digitized copy locations

**API Endpoints Used:**
```
GET https://catalog.hathitrust.org/api/volumes/brief/isbn/{isbn}.json
GET https://catalog.hathitrust.org/api/volumes/brief/oclc/{oclc}.json
GET https://catalog.hathitrust.org/api/volumes/brief/lccn/{lccn}.json
```

**Response Format:**
```json
{
  "items": [
    {
      "htid": "unique_id",
      "itemURL": "https://...",
      "rights": "pd",
      "usRightsString": "Full view"
    }
  ],
  "records": {
    "record_id": {
      "titles": ["Title"],
      "isbns": ["isbn"],
      "oclcs": ["oclc"]
    }
  }
}
```

**Rights Codes:**
- `pd` = Public domain (full access)
- `ic` = In copyright (limited access)
- `und` = Undetermined

**Rate Limits**: None specified  
**Reliability**: High  
**Coverage**: 17+ million volumes, emphasis on older academic works  
**Timeout**: 8 seconds

**Benefits:**
- Free access to public domain books
- Links to digitized content
- Validates ISBN existence in major collections

---

### 5. Harvard LibraryCloud API ✨

**Provider**: Harvard Library  
**Type**: REST JSON API (MODS format)  
**Authentication**: None required  
**Documentation**: https://library.harvard.edu/services-tools/librarycloud

**What We Get:**
- Academic metadata (high quality)
- MODS (Metadata Object Description Schema) records
- Table of contents
- Detailed abstracts
- Call numbers (DDC and LCC)
- Subject headings
- Physical descriptions

**API Endpoints Used:**
```
GET https://api.lib.harvard.edu/v2/items.json?identifier={isbn}&limit=1
GET https://api.lib.harvard.edu/v2/items.json?title={title}&name={author}&limit=1
```

**Response Format**: MODS/JSON hybrid
```json
{
  "items": {
    "mods": [
      {
        "titleInfo": {"title": "...", "subTitle": "..."},
        "name": [{"namePart": "..."}],
        "subject": [{"topic": "..."}],
        "classification": [{"#text": "...", "@authority": "lcc"}],
        "tableOfContents": "...",
        "abstract": "..."
      }
    ]
  }
}
```

**Classification Authorities:**
- `lcc` = Library of Congress Classification
- `ddc` = Dewey Decimal Classification

**Rate Limits**: None specified, fair use  
**Reliability**: High  
**Coverage**: Strong for academic works, Harvard collections  
**Timeout**: 8 seconds

**Benefits:**
- High-quality academic metadata
- Table of contents (rare in APIs)
- Enhanced abstracts
- Authoritative call numbers

---

### 6. Google Books API ✨

**Provider**: Google  
**Type**: REST JSON API  
**Authentication**: Optional (API key for higher limits)  
**Documentation**: https://developers.google.com/books/docs/v1/using

**What We Get:**
- Digital preview links
- Viewability status
- Cover images
- Descriptions
- Categories
- Publisher information
- Page counts

**API Endpoints Used:**
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
```

**Viewability Levels:**
- `ALL_PAGES` = Full view (public domain)
- `PARTIAL` = Limited preview
- `SNIPPET` = Snippet view only
- `NO_PAGES` = Metadata only

**Response Format:**
```json
{
  "items": [
    {
      "volumeInfo": {
        "title": "...",
        "authors": ["..."],
        "imageLinks": {"thumbnail": "..."},
        "previewLink": "https://books.google.com/books?id=..."
      },
      "accessInfo": {
        "viewability": "PARTIAL",
        "webReaderLink": "..."
      }
    }
  ]
}
```

**Rate Limits**: 
- Without API key: 1000 requests/day
- With API key: 1000-100,000 requests/day (configurable)

**Reliability**: Very high  
**Coverage**: Extensive (40+ million books)  
**Timeout**: Standard (10 seconds)

**Benefits:**
- Preview links for patrons
- Excellent cover images
- Helps users evaluate books before requesting

---

## API Integration Architecture

### Service Module

**Location**: `/src/lib/server/bibliographic-api.ts`

The centralized service provides:
- Type-safe interfaces for all APIs
- Unified error handling
- Timeout management
- Response normalization
- Intelligent data merging

### Type Definitions

```typescript
interface BibliographicRecord {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publishers?: string[];
  publish_date?: string;
  
  // Identifiers
  isbn?: string;
  lccn?: string;
  oclc_number?: string;
  
  // Call numbers
  dewey_call_number?: string;
  lcc_call_number?: string;
  
  // Content
  subjects?: string[];
  summary?: string;
  table_of_contents?: string;
  
  // Digital access
  digital_links?: DigitalLink[];
  
  // Metadata
  source: string;
  metadata_quality?: 'high' | 'medium' | 'low';
}

interface DigitalLink {
  url: string;
  provider: string;
  type: 'full_view' | 'limited_preview' | 'snippet_view' | 'metadata_only';
  access: 'public' | 'restricted' | 'subscription';
  format?: string;
}
```

### Lookup Strategy

**Primary Strategy (Best Result First):**
1. Query OpenLibrary (fastest, good coverage)
2. If found, supplement with LoC → OCLC → HathiTrust → Harvard → Google
3. Merge results, preferring higher quality data

**Fallback Strategy:**
1. Try LoC → OCLC → HathiTrust → Harvard → Google in sequence
2. Stop when finding usable data
3. Still attempt to supplement from remaining sources

**Data Merging Priority:**
1. **Subjects**: Prefer LC Subject Headings (LCSH) > Harvard > OpenLibrary
2. **Call Numbers**: Prefer LoC > OCLC > Harvard
3. **Summaries**: Prefer Harvard > OpenLibrary > Google
4. **TOC**: Use Harvard (only source providing this)
5. **Digital Links**: Combine all sources (HathiTrust + Google)
6. **Covers**: Prefer OpenLibrary > Google Books

---

## Error Handling

### Timeouts

Each API has configured timeouts to prevent hanging:
- OpenLibrary: 10 seconds
- Library of Congress: 5 seconds (can be slow)
- OCLC: 10 seconds
- HathiTrust: 8 seconds
- Harvard: 8 seconds
- Google Books: 10 seconds

### Graceful Degradation

- Individual API failures don't stop the lookup process
- System continues to next source
- Returns partial data if at least one source succeeds
- All errors logged but not displayed to user (unless all fail)

### User Feedback

Real-time progress log shows:
- ✓ Success indicators
- ✗ Failure indicators
- → Progress indicators
- Source-specific messages

---

## Performance Considerations

### Parallel Queries

Where possible, APIs are queried in parallel:
- HathiTrust + Google Books (both for digital links)
- No dependencies between these sources

### Caching

Currently: No caching (fresh data every time)  
Future: Consider caching successful lookups for 24 hours

### Query Optimization

- ISBNs normalized (hyphens removed) before queries
- Minimum required fields requested
- Limit=1 on all APIs that support it

---

## Future Enhancements

### Planned APIs

1. **British Library Z39.50**
   - Requires authentication (free registration)
   - MARC21 records for UK publications
   - British National Bibliography

2. **LibraryThing**
   - Requires API key (free)
   - Community-driven classifications
   - Extensive cover images
   - Recommendations and similar books

3. **MARC.org Sources**
   - Additional national libraries
   - Specialized collections

### Planned Features

1. **API Key Management**
   - UI for entering optional API keys
   - Google Books API key for higher limits
   - LibraryThing developer key

2. **Source Preferences**
   - Allow librarians to configure source priority
   - Enable/disable specific sources
   - Preferred call number type (DDC vs. LCC)

3. **Enhanced Caching**
   - Redis cache for repeated lookups
   - Configurable TTL
   - Cache invalidation

4. **Batch Lookups**
   - Process multiple ISBNs at once
   - Background job processing
   - Import from CSV

---

## Troubleshooting

### No Results Found

**Possible Causes:**
- Invalid ISBN
- Book not in any of the databases
- Network connectivity issues
- API temporarily unavailable

**Solutions:**
- Verify ISBN is correct (10 or 13 digits)
- Try alternative identifier (OCLC number, LCCN)
- Check network connection
- Try again later

### Slow Performance

**Possible Causes:**
- Library of Congress SRU is slow
- Network latency
- Multiple sources timing out

**Solutions:**
- Wait for timeout (8-10 seconds per source)
- Results will display as soon as any source succeeds
- Consider increasing timeouts in bibliographic-api.ts

### Missing Data

**Possible Causes:**
- Source doesn't have that data field
- Data not exposed via API
- Parsing error

**Solutions:**
- Check multiple sources (some have TOC, others don't)
- Review raw response in browser console
- File issue if consistent problem

---

## API Status Monitoring

### Health Checks

No automated health checks currently implemented.

### Manual Testing

Test URL for each API:
- OpenLibrary: `https://openlibrary.org/api/books?bibkeys=ISBN:9780743273565&format=json&jscmd=data`
- LoC: `https://lx2.loc.gov:210/lcdb?operation=searchRetrieve&version=1.1&query=bath.isbn=9780743273565`
- OCLC: `https://classify.oclc.org/classify2/Classify?isbn=9780743273565&summary=true`
- HathiTrust: `https://catalog.hathitrust.org/api/volumes/brief/isbn/9780743273565.json`
- Harvard: `https://api.lib.harvard.edu/v2/items.json?identifier=9780743273565&limit=1`
- Google: `https://www.googleapis.com/books/v1/volumes?q=isbn:9780743273565`

Test with ISBN: **9780743273565** (The Great Gatsby - widely available)

---

## License & Terms

### OpenLibrary
- License: Open Data Commons
- Terms: Fair use, attribution appreciated

### Library of Congress
- License: Public domain (U.S. government work)
- Terms: Free access, reasonable use

### OCLC WorldCat
- License: Free for non-commercial use
- Terms: OCLC API Terms of Service

### HathiTrust
- License: Creative Commons for metadata
- Terms: Non-commercial use permitted

### Harvard LibraryCloud
- License: Open data
- Terms: Academic and library use encouraged

### Google Books
- License: Google API Terms of Service
- Terms: API key recommended for production use

---

## Contact & Support

### For API Issues:
- OpenLibrary: https://openlibrary.org/contact
- Library of Congress: Ask a Librarian
- OCLC: Developer Support
- HathiTrust: https://www.hathitrust.org/help
- Harvard: liblab@hulmail.harvard.edu
- Google: API Console Support

### For ILS Integration Issues:
- File issue on GitHub repository
- Include ISBN tested and error messages
- Check browser console for API responses

---

**Last Updated**: 2026-01-16  
**Version**: 1.0  
**Maintained By**: Development team
