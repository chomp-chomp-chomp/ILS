# ISBN Lookup Fix - Supplement Strategy

## Problem
The bulk ISBN lookup was trying Library of Congress (LoC) API first, which:
- Has a 10-second timeout per ISBN
- Port 210 may be blocked by firewalls
- Can be slow or unreliable
- Caused long waits before falling back to OpenLibrary

User reported: "bulk isbn search seems to be trying for a while to pull in the records...it is skipping to OpenLibrary"

## Solution: Supplement Strategy

Instead of choosing one API OR the other, we now **supplement** data from multiple sources:

### New Flow (Both Single & Bulk Lookup)

1. **Try OpenLibrary first** (fast, 8s timeout)
   - Good for: Popular books, cover images, descriptions, page counts
   - Reliable and fast response times
   
2. **If OpenLibrary succeeds:**
   - **Also query LoC** (5s timeout, non-blocking)
   - **Merge the data** to get best of both:
     - Keep: OpenLibrary's cover, pages, basic metadata
     - Add: LoC's MARC fields, call numbers, LCSH subject headings
   - Display as: "OpenLibrary + Library of Congress"

3. **If OpenLibrary fails:**
   - **Try LoC as fallback** (complete replacement)
   - **Then try OCLC** (last resort)

### Key Improvements

✅ **No more waiting**: OpenLibrary responds in 1-2 seconds typically
✅ **Still get MARC data**: LoC supplements when available (doesn't block if unavailable)
✅ **Better subject headings**: LCSH controlled vocabulary from LoC
✅ **Better call numbers**: LC Classification from LoC (preferred over OCLC)
✅ **Reduced timeout**: LoC timeout reduced from 10s → 5s
✅ **Consistent**: Both single and bulk lookup use same strategy

## Data Merging Priority

When merging OpenLibrary + LoC data:

| Field | Source Priority |
|-------|----------------|
| Title, Subtitle, Authors | OpenLibrary (keep original) |
| Cover Image | OpenLibrary only |
| Page Count | OpenLibrary only |
| **Subject Headings** | **LoC preferred** (LCSH) |
| **LC Call Number** | **LoC preferred** |
| **Dewey Call Number** | **LoC preferred** |
| Variant Title | LoC if available |
| Edition Statement | LoC if available |
| Language Note | LoC if available |
| Contents Note | LoC if available |
| ISSN | LoC if available |

## Code Changes

### Files Modified
- `/src/routes/(admin)/admin/cataloging/bulk-isbn/+page.svelte`
- `/src/routes/(admin)/admin/cataloging/isbn-lookup/+page.svelte`

### Key Changes
1. Reordered API calls: OpenLibrary first, LoC second
2. Added data merging logic when both APIs succeed
3. Reduced LoC timeout: 10s → 5s
4. Changed console.error → console.warn for LoC failures (not critical)
5. Updated UI descriptions to explain the strategy

## Example Output

### Before (Single Source)
```
Source: OpenLibrary
```
or
```
Source: Library of Congress
```

### After (Merged)
```
Source: OpenLibrary + Library of Congress
```

## Testing

To test the fix with real ISBNs:

1. Navigate to `/admin/cataloging/bulk-isbn`
2. Paste ISBNs (one per line):
   ```
   9780062316097
   9780385490818
   9780547928210
   ```
3. Click "Lookup All ISBNs"
4. Observe:
   - Fast responses (1-3 seconds per ISBN instead of 10+)
   - Source shows "OpenLibrary + Library of Congress" when both succeed
   - LoC data supplements OpenLibrary (better subjects, call numbers)

## Why This Works

**OpenLibrary:**
- ✅ Fast and reliable
- ✅ Good for popular books
- ✅ Has cover images
- ❌ Limited MARC data
- ❌ No controlled vocabulary

**Library of Congress:**
- ✅ Complete MARC records
- ✅ LCSH subject headings (controlled vocabulary)
- ✅ Authoritative call numbers
- ❌ Can be slow (port 210)
- ❌ May be blocked by firewalls
- ❌ No cover images

**The Supplement Strategy:**
- ✅ Gets speed of OpenLibrary
- ✅ Gets quality of LoC
- ✅ Non-blocking (LoC failure doesn't delay import)
- ✅ Best of both worlds

## Future Enhancements

Possible improvements:
1. Server-side proxy endpoint for LoC API (avoid client-side port 210)
2. Caching of LoC responses (reduce repeated queries)
3. Background job to supplement existing records with LoC data
4. Configuration option to skip LoC supplementing if not needed
5. Retry logic with exponential backoff for LoC failures

## Related Issues

This fix addresses the reported issue:
> "For some reason the bulk isbn search seems to be trying for a while to pull in the records. i uploaded 5 valid isbns that i can't imagine at least one wouldn't be in the loc database, but it is skipping to OpenLibrary. is there still an issue with connecting to the LoC api?"

**Root cause**: LoC was tried first with 10s timeout, causing delays before OpenLibrary fallback.

**Solution**: OpenLibrary first (fast), then supplement with LoC (non-blocking) = best of both.
