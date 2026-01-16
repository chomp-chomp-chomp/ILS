# Bulk Cover Upload Fix - Issue #213

## Problem Summary
All bulk cover operations (Fetch Missing Covers, Re-fetch from Open Library, Upload Local Files) were failing with the error:
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

The operations would run endlessly without completing, processing far more records than existed in the catalog.

## Root Cause
The issue was caused by incorrect Supabase query syntax in `src/routes/api/covers/bulk-migrate/+server.ts`. The `.not('id', 'in', ...)` syntax was invalid and caused PostgreSQL errors. When these errors occurred, Supabase/PostgreSQL returned HTML error pages instead of JSON responses, leading to the JSON parsing error on the client side.

## Technical Details

### Incorrect Query Syntax (Before)
```typescript
const quotedIds = processedIds.map(id => `"${id}"`).join(',');
query = query.not('id', 'in', `(${quotedIds})`);
```

**Issues**:
1. `.not('id', 'in', ...)` is not valid Supabase syntax
2. Manually quoting UUIDs with double quotes is unnecessary and caused errors
3. Database errors were thrown as exceptions, not returned as JSON

### Correct Query Syntax (After)
```typescript
query = query.filter('id', 'not.in', processedIds);
```

**Improvements**:
1. Uses proper Supabase `.filter()` method with `'not.in'` operator
2. Passes the array directly to the filter (Supabase handles the conversion)
3. All database errors now return proper JSON responses with status 500

## Changes Made

### File: `src/routes/api/covers/bulk-migrate/+server.ts`

1. **Line 144**: Fixed migrate operation query (NOT IN for excluding processed records)
2. **Line 206**: Fixed refetch operation query (NOT IN for excluding manually uploaded covers)
3. **Line 385**: Fixed migrate remaining count query
4. **Line 410**: Fixed refetch remaining count query
5. **Lines 149-160, 173-185, 213-225**: Added proper error handling that returns JSON instead of throwing

### Error Response Format
All database errors now return:
```json
{
  "error": "Database error: <error message>",
  "success": false,
  "processed": 0,
  "succeeded": 0,
  "failed": 0,
  "remaining": 0,
  "results": [],
  "debug": [] // Only included in some operations
}
```

## Testing Instructions

### Prerequisites
1. Access to the admin panel at `/admin/cataloging/covers/bulk`
2. At least a few MARC records with ISBNs in the database
3. Valid ImageKit configuration

### Test Cases

#### 1. Test Fetch Missing Covers
1. Navigate to `/admin/cataloging/covers/bulk`
2. Click "Start Fetch Missing" button
3. **Expected**: 
   - Progress displays correctly
   - Logs show success/failure for each record
   - Operation completes when all records are processed
   - No JSON parsing errors in browser console
   - No infinite loops

#### 2. Test Re-fetch from Open Library
1. Navigate to `/admin/cataloging/covers/bulk`
2. Click "Start Re-fetch" button
3. **Expected**:
   - Progress displays correctly
   - Only non-manually-uploaded covers are processed
   - Operation completes normally
   - Debug logs show correct filtering

#### 3. Test Migration to ImageKit
1. Navigate to `/admin/cataloging/covers/bulk`
2. Click "Start Migration" button
3. **Expected**:
   - Existing covers are uploaded to ImageKit
   - Progress updates correctly
   - Operation completes when all records are migrated

#### 4. Test Local File Upload
1. Navigate to `/admin/cataloging/covers/bulk`
2. Select image files named with ISBNs (e.g., `9780062316097.jpg`)
3. Click "Upload Files"
4. **Expected**:
   - Files match to records by ISBN
   - Upload succeeds
   - Database and ImageKit are updated

### Verification Checklist
- [ ] No "Unexpected token '<'" errors appear
- [ ] Operations complete successfully
- [ ] "Remaining" count decreases to 0
- [ ] Browser console shows no errors
- [ ] Server logs show successful queries (no PostgreSQL errors)
- [ ] Database records are updated correctly

## Browser Console Debugging

If issues persist, check browser console for:
```javascript
// Should see successful responses like:
{
  success: true,
  processed: 10,
  succeeded: 8,
  failed: 2,
  remaining: 100,
  results: [...]
}

// Should NOT see errors like:
"Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
"Database error: ..."
```

## Server-Side Debugging

Check server logs for:
```
Database query error (migrate): [error message]
Database query error (refetch): [error message]
Database query error (fetch-missing): [error message]
```

If these appear, the fix is working (errors are being caught and logged). If you see PostgreSQL syntax errors, the queries may need further adjustment.

## Related Files
- `src/routes/(admin)/admin/cataloging/covers/bulk/+page.svelte` - Client-side UI (already had error handling)
- `src/routes/api/covers/bulk-upload/+server.ts` - Local file upload endpoint (not modified)
- `src/routes/api/covers/fetch/+server.ts` - Individual cover fetch (not modified)

## Future Improvements
1. Add retry logic for transient network errors
2. Implement rate limiting to avoid overwhelming external APIs
3. Add progress persistence to resume interrupted operations
4. Implement better error categorization (network vs. database vs. validation)

## References
- Issue: https://github.com/chomp-chomp-chomp/ILS/issues/213
- Supabase Filters Documentation: https://supabase.com/docs/reference/javascript/using-filters
- Fix Commit: [commit hash will be added when PR is merged]
