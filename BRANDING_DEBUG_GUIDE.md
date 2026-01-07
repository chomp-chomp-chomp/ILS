# Branding Debug and Cache Invalidation Guide

## Overview
This document explains the debug logging and cache invalidation features added to fix branding update issues in the ILS.

## Problem Statement
Previously, when updating branding settings in `/admin/branding`, the changes would not immediately reflect on the frontend pages. Users would need to perform a hard refresh (Ctrl+F5) or clear their browser cache to see the updates.

## Solution Implemented

### 1. Debug Logging in `loadActiveBranding()`
**Location**: `src/lib/server/branding.ts`

Added comprehensive console logging at every stage of the branding data loading process:

#### Logging Points:
- **Query initiation**: When starting to query the database
- **Query results**: Whether a record was found or not
- **Database fields**: Key fields from the database record (ID, updated_at, library_name, colors, toggles)
- **Merged configuration**: Final branding object after merging defaults with database values
- **Error details**: Full error information including code, message, and stack traces

#### Example Console Output:
```
[loadActiveBranding] Starting branding load operation
[loadActiveBranding] Querying database for active branding configuration
[loadActiveBranding] Database record found
[loadActiveBranding] Record ID: abc123-def456-...
[loadActiveBranding] Record updated_at: 2026-01-07T21:45:30.123Z
[loadActiveBranding] Library name: My Library
[loadActiveBranding] Primary color: #e73b42
[loadActiveBranding] Show header: true
[loadActiveBranding] Show powered by: true
[loadActiveBranding] Footer text: Powered by Open Library System
[loadActiveBranding] Merged branding configuration:
[loadActiveBranding] - Library name: My Library
[loadActiveBranding] - Primary color: #e73b42
[loadActiveBranding] - Show header: true
[loadActiveBranding] - Show powered by: true
[loadActiveBranding] - Footer text: Powered by Open Library System
[loadActiveBranding] - Show covers: true
```

### 2. Cache Invalidation After Save
**Location**: `src/routes/admin/branding/+page.svelte`

Added SvelteKit cache invalidation after successful branding save:

#### Implementation:
1. Import `invalidateAll` from `$app/navigation`
2. Call `invalidateAll()` after API success response
3. Force page reload with `location.reload()` after 500ms delay

#### Code Flow:
```javascript
// After successful API response
await invalidateAll();  // Invalidate SvelteKit's cached data
message = 'Branding settings saved successfully!';

// Force reload for immediate visual update
setTimeout(() => {
  location.reload();
}, 500);
```

#### Console Output:
```
[Branding UI] Starting save operation...
[Branding UI] Current branding state (sanitized): {...}
[Branding UI] Validation passed
[Branding UI] Authenticated, making API request...
[Branding UI] API response status: 200
[Branding UI] API success response - status: true
[Branding UI] Invalidating SvelteKit cache...
[Branding UI] Cache invalidated successfully
[Branding UI] Triggering page reload for immediate visual update...
```

## Testing the Fix

### Prerequisites
- Admin access to the ILS
- Browser developer tools open (F12)
- Console tab visible

### Test Steps:

1. **Open Admin Branding Page**
   - Navigate to `/admin/branding`
   - Open browser console (F12 → Console)

2. **Make a Branding Change**
   - Change library name or primary color
   - Click "Save Changes"
   - Observe console logs

3. **Verify Immediate Update**
   - Page should reload automatically after save
   - Check homepage `/` or any public page
   - New branding should be immediately visible

4. **Check Console Logs**
   - Look for `[Branding UI]` logs during save
   - Look for `[loadActiveBranding]` logs on page load
   - Verify database values match what you saved

### Expected Console Output:

#### During Save:
```
[Branding UI] Starting save operation...
[Branding UI] Validation passed
[Branding UI] Authenticated, making API request...
[Branding UI] API response status: 200
[Branding UI] API success response - status: true
[Branding UI] Invalidating SvelteKit cache...
[Branding UI] Cache invalidated successfully
[Branding UI] Triggering page reload for immediate visual update...
```

#### After Reload (on any page):
```
[loadActiveBranding] Starting branding load operation
[loadActiveBranding] Querying database for active branding configuration
[loadActiveBranding] Database record found
[loadActiveBranding] Record ID: [uuid]
[loadActiveBranding] Library name: [your updated name]
[loadActiveBranding] Primary color: [your updated color]
[loadActiveBranding] Merged branding configuration:
[loadActiveBranding] - Library name: [your updated name]
[loadActiveBranding] - Primary color: [your updated color]
...
```

## Troubleshooting

### Issue: No logs appearing in console
**Solution**: Ensure you're looking at the right console (server logs for `[loadActiveBranding]`, browser console for `[Branding UI]`)

### Issue: Branding still not updating
**Check**:
1. Are there any error logs in console?
2. Did the API request succeed (status 200)?
3. Is `invalidateAll()` being called?
4. Did the page reload?
5. Check database directly - was the record updated?

### Issue: Page reloads but changes not visible
**Possible causes**:
1. Database update failed (check API logs)
2. RLS policies preventing read
3. Browser caching CSS variables (do hard refresh Ctrl+F5)

## Technical Details

### Why `invalidateAll()`?
SvelteKit caches data loaded via `load` functions for performance. When data changes server-side, the cache must be explicitly invalidated to force a refetch.

### Why `location.reload()`?
While `invalidateAll()` refreshes data, CSS variables and some DOM elements may not update without a full page reload. The reload ensures immediate visual feedback.

### Alternative Approaches Considered:
1. **Only `invalidateAll()`**: Requires navigation away and back to see changes
2. **Only `location.reload()`**: Might show old data if cache not invalidated
3. **Both (implemented)**: Ensures both data and UI update immediately

## Files Modified

1. `src/lib/server/branding.ts`
   - Added debug logging in `loadActiveBranding()` function
   - Logs at query, result, merge, and error stages

2. `src/routes/admin/branding/+page.svelte`
   - Import `invalidateAll` from `$app/navigation`
   - Call `invalidateAll()` after successful save
   - Add `location.reload()` with 500ms delay

## Related Documentation
- [SvelteKit Data Invalidation](https://kit.svelte.dev/docs/load#invalidation)
- [CLAUDE.md - Branding Customization](./CLAUDE.md#branding-customization)
- [DATABASE_SCHEMA.md - branding_configuration table](./DATABASE_SCHEMA.md)

## Future Improvements
- Real-time preview without save (WebSocket/SSE)
- Granular invalidation (`invalidate('/api/branding')`)
- Remove page reload requirement (reactive updates only)
- Add loading spinner during reload
- Cache warming strategy for first load
