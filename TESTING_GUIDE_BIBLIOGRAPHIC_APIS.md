# Testing Guide: Enhanced Bibliographic APIs

This guide provides step-by-step instructions for testing the new bibliographic API integrations.

## Prerequisites

1. Running ILS instance with Supabase configured
2. Admin access to the catalog
3. Internet connection (APIs require external access)

---

## Test Plan Overview

We'll test:
1. Basic ISBN lookup with all 7 sources
2. Digital access links (HathiTrust + Google Books)
3. Table of contents display
4. Call number retrieval
5. Subject heading merging
6. Error handling and fallback behavior

---

## Test Case 1: Public Domain Book with Full Coverage

**Test ISBN**: `9780743273565` (The Great Gatsby, F. Scott Fitzgerald)

### Why This ISBN?
- Published 1925 (public domain in USA)
- Widely held in all libraries
- Available on HathiTrust with full text
- Good MARC records in LoC
- Has preview on Google Books

### Steps:

1. Navigate to `/admin/cataloging/isbn-lookup`
2. Enter ISBN: `9780743273565`
3. Click "Search" or press Enter
4. Wait ~30-60 seconds for all sources to query

### Expected Results:

**Progress Log Should Show:**
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

**Results Card Should Display:**

**Title Section:**
- Title: "The Great Gatsby"
- Subtitle: (may or may not be present)
- Author: "F. Scott Fitzgerald"
- Publisher: Various editions
- Published: 2003 or similar (reprint date)

**Call Numbers Section (Green Box):**
- Dewey: 813.52 or similar
- LC: PS3511.I9 or similar

**Subjects:**
- Multiple subject headings from LC/Harvard
- Example: "Jazz Age", "American fiction", "Long Island", etc.

**Digital Access Section (Blue Box):**
Should show 2-4 digital links:

1. **HathiTrust** link(s)
   - Provider: HathiTrust
   - Badge: 🔓 Full Access (public domain)
   - Link to HathiTrust reader

2. **Google Books** link
   - Provider: Google Books
   - Badge: 👁️ Preview or 🔓 Full Access
   - Link to Google Books preview

**Table of Contents:**
- May or may not appear (depends on Harvard having data for this edition)
- If present: formatted text showing chapter structure

**Cover Image:**
- Should display from OpenLibrary or Google Books

**Source Attribution:**
- Should say "Merged (OpenLibrary, Library of Congress, OCLC WorldCat, HathiTrust, Harvard LibraryCloud, Google Books)"
- Or similar combination

### Import Test:

1. Click "Import to Catalog"
2. Should redirect to `/admin/cataloging`
3. Find the newly imported record
4. Verify:
   - All metadata fields populated
   - Call number in holdings record
   - marc_json contains digital_links array
   - Summary/subjects preserved

---

## Test Case 2: Recent Academic Book

**Test ISBN**: `9780674976382` (Harvard University Press book)

### Why This ISBN?
- Recent publication (better Harvard coverage)
- Academic press (strong Harvard metadata)
- May have TOC in Harvard
- Good for testing fallback (might not be in all sources)

### Steps:

1. Enter ISBN: `9780674976382`
2. Search

### Expected Results:

**Progress Log:**
- May show some ✗ failures (OpenLibrary might not have it)
- Should succeed with Harvard LibraryCloud
- Table of contents likely present

**Key Differences from Test 1:**
- Fewer digital links (recent, in copyright)
- May show 🔒 Restricted on HathiTrust (if found)
- Google Books likely "Limited Preview" or "Snippet View"
- Harvard data should be rich (subjects, TOC, abstract)

---

## Test Case 3: Fallback Behavior Test

**Test ISBN**: `9781234567890` (Invalid/non-existent)

### Purpose:
Test error handling and graceful degradation

### Steps:

1. Enter ISBN: `9781234567890`
2. Search

### Expected Results:

**Progress Log Should Show:**
```
1/7 Searching OpenLibrary...
  ✗ Not found on OpenLibrary
2/7 Trying Library of Congress...
  ✗ Not found on Library of Congress
3/7 Trying OCLC WorldCat...
  ✗ Not found on OCLC WorldCat
4/7 Trying HathiTrust...
  ✗ Not found on HathiTrust
5/7 Trying Harvard LibraryCloud...
  ✗ Not found on Harvard
...
```

**Error Message:**
- Should display: "No results found for this ISBN on any source..."
- Should NOT crash or throw unhandled errors
- Should allow trying another ISBN immediately

---

## Test Case 4: Timeout Behavior

**Test ISBN**: Any valid ISBN during Library of Congress slowness

### Purpose:
Verify timeout handling doesn't hang the system

### Steps:

1. Enter any valid ISBN
2. Watch progress log carefully

### Expected Results:

- Each source should complete within its timeout (5-10 seconds)
- If LoC times out, should show:
  ```
  → Supplementing with Library of Congress...
  ✗ Library of Congress data not available
  ```
- Process continues to next source
- Total time should be reasonable (under 2 minutes)

---

## Visual Verification Checklist

### ISBN Lookup Page

**Layout:**
- [ ] Clean, modern interface
- [ ] Clear input field for ISBN
- [ ] Prominent "Search" button
- [ ] Subtitle explains 7 sources

**Progress Log:**
- [ ] Monospace font
- [ ] Gray background
- [ ] Real-time updates (not all at once)
- [ ] Clear ✓ ✗ → symbols
- [ ] Readable step numbering (1/7, 2/7, etc.)

**Results Card:**
- [ ] Two-column layout (cover + details)
- [ ] Cover image on left
- [ ] Title/author prominent
- [ ] Metadata well-organized

**Call Numbers (Green Box):**
- [ ] Light green background (#e8f5e9)
- [ ] Green left border
- [ ] 📚 emoji in title
- [ ] Monospace font for call numbers
- [ ] White background on call number values

**Digital Links (Blue Box):**
- [ ] Light blue background (#e3f2fd)
- [ ] Blue left border
- [ ] 🌐 emoji in title
- [ ] Each link in white card
- [ ] Hover effect on links
- [ ] Provider name bold
- [ ] Access badges colored correctly:
  - Green for public/full access
  - Orange for preview
  - Gray for restricted

**Table of Contents (Blue Box):**
- [ ] Light blue/purple background (#f0f4ff)
- [ ] Purple left border
- [ ] 📖 emoji in title
- [ ] Scrollable if long (max-height: 300px)
- [ ] Pre-formatted text with line breaks
- [ ] Readable font size

**Import Button:**
- [ ] Blue/purple background (#667eea)
- [ ] White text
- [ ] Hover effect (darker blue)
- [ ] Disabled state works while searching

---

## API Integration Verification

### Check API Responses (Browser Console)

1. Open browser DevTools (F12)
2. Go to Network tab
3. Perform search
4. Look for API calls to:
   - `openlibrary.org`
   - `lx2.loc.gov` (Library of Congress)
   - `classify.oclc.org`
   - `catalog.hathitrust.org`
   - `api.lib.harvard.edu`
   - `googleapis.com/books`

### Verify Each API:

**OpenLibrary:**
- URL: `/api/books?bibkeys=ISBN:...`
- Status: 200 OK
- Response: JSON with book data

**Library of Congress:**
- URL: `lx2.loc.gov:210/lcdb?...`
- Status: 200 OK
- Response: MARCXML (large XML document)

**OCLC:**
- URL: `classify.oclc.org/classify2/Classify?isbn=...`
- Status: 200 OK
- Response: XML with classifications

**HathiTrust:**
- URL: `catalog.hathitrust.org/api/volumes/brief/isbn/...`
- Status: 200 OK or 404 (if not found)
- Response: JSON with items/records

**Harvard:**
- URL: `api.lib.harvard.edu/v2/items.json?identifier=...`
- Status: 200 OK
- Response: JSON with MODS data

**Google Books:**
- URL: `googleapis.com/books/v1/volumes?q=isbn:...`
- Status: 200 OK
- Response: JSON with volumeInfo

---

## Performance Benchmarks

### Target Response Times:

- **OpenLibrary**: < 2 seconds
- **Library of Congress**: 2-5 seconds (can be slow)
- **OCLC**: < 2 seconds
- **HathiTrust**: < 3 seconds
- **Harvard**: < 3 seconds
- **Google Books**: < 2 seconds

**Total Search Time** (if all sources found):
- Target: 30-45 seconds
- Maximum acceptable: 90 seconds (with timeouts)

### If Experiencing Slowness:

1. Check which API is slow (progress log shows)
2. Verify network connection
3. Try again (some APIs have variable latency)
4. Consider increasing timeout in `bibliographic-api.ts` if consistently slow

---

## Data Quality Checks

### Call Numbers:

**Good Quality Indicators:**
- Dewey: 3 digits + decimals (e.g., "813.52")
- LC: Letter + numbers (e.g., "PS3511.I9")
- Both present when available

**Warning Signs:**
- Empty call numbers (acceptable if rare/new book)
- Malformed numbers (report as bug)

### Subjects:

**Good Quality:**
- 5-10 relevant subjects
- Mix of broad and specific
- No duplicates
- LC Subject Headings format (capitalized, specific)

**Warning Signs:**
- No subjects at all (acceptable for some books)
- Duplicate subjects (check deduplication logic)
- Irrelevant subjects (report for investigation)

### Digital Links:

**Verification:**
1. Click each digital link
2. Should open in new tab
3. Should go to valid page (not 404)
4. Access level should match (public domain = full access, etc.)

---

## Common Issues & Solutions

### Issue: All Sources Returning "Not Found"

**Possible Causes:**
- Invalid ISBN
- Very obscure book
- Network issues

**Solutions:**
1. Verify ISBN is correct (checksum valid)
2. Try well-known ISBN (like Great Gatsby above)
3. Check browser console for network errors

### Issue: Slow Performance

**Possible Causes:**
- Library of Congress SRU is slow (known issue)
- Network latency
- Multiple timeouts

**Solutions:**
1. Wait for all timeouts to complete
2. Results appear as soon as ANY source succeeds
3. Consider using during off-peak hours

### Issue: Missing Digital Links

**Possible Causes:**
- Book not digitized
- In copyright (no full text available)
- HathiTrust/Google don't have it

**Solutions:**
1. This is expected behavior for many books
2. Try older books for public domain full text
3. Check HathiTrust directly to confirm

### Issue: No Table of Contents

**Possible Causes:**
- Harvard doesn't have this edition
- TOC not included in metadata
- Book too old/new

**Solutions:**
1. This is expected for many books
2. Only Harvard provides TOC via API
3. Most books won't have TOC

---

## Regression Testing

After any code changes, re-test:

1. **Basic functionality**: Test Case 1 (Great Gatsby)
2. **Error handling**: Test Case 3 (invalid ISBN)
3. **UI rendering**: Visual checklist
4. **Import function**: Verify data saves correctly

---

## Load Testing (Optional)

For production readiness:

1. Test 10 consecutive searches
2. Verify no memory leaks
3. Check API rate limits not exceeded
4. Monitor server resources

---

## Bug Reporting Template

If issues found:

```
**Bug Title**: [Brief description]

**ISBN Tested**: [ISBN]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happened]

**Progress Log Output**:
[Paste complete log]

**Browser Console Errors**:
[Paste any errors]

**Screenshots**:
[Attach if relevant]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
...
```

---

## Success Criteria

Implementation is successful if:

1. ✅ All 7 APIs query successfully for common ISBNs
2. ✅ Digital links display and work correctly
3. ✅ Table of contents appears when available
4. ✅ Call numbers retrieved from multiple sources
5. ✅ Subject headings merge without duplicates
6. ✅ Graceful failure on invalid ISBN
7. ✅ Reasonable performance (under 90 seconds)
8. ✅ Import function preserves all data
9. ✅ UI is clean, professional, and intuitive
10. ✅ No JavaScript errors in console

---

**Last Updated**: 2026-01-16  
**Version**: 1.0  
**Test Environment**: Development (localhost)
