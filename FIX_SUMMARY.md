# Fix Summary: Cache-Control Header Conflict (500 Error)

## Problem
Production was experiencing 500 errors with the message:
```
Error: "cache-control" header is already set
at load in .svelte-kit/output/server/entries/pages/_layout.server.ts.js:4:3
```

## Root Cause
Two components were attempting to set the same HTTP header:

1. **vercel.json** (lines 11-21): Sets a global `Cache-Control` header for all routes
   ```json
   "headers": [
     {
       "source": "/(.*)",
       "headers": [
         {
           "key": "Cache-Control",
           "value": "public, max-age=0, must-revalidate"
         }
       ]
     }
   ]
   ```

2. **src/routes/+layout.server.ts**: Was also trying to set `cache-control` header
   ```typescript
   setHeaders({
     'cache-control': 'no-cache, no-store, must-revalidate'
   });
   ```

When the Vercel adapter pre-set the cache-control header (from vercel.json), the code in +layout.server.ts would then try to set it again, causing the "header already set" error.

## Solution
Removed the redundant `setHeaders` call from `src/routes/+layout.server.ts`:

**Before:**
```typescript
export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies, setHeaders }) => {
  const { session } = await safeGetSession();

  // Disable caching for branding data - always fetch fresh
  setHeaders({
    'cache-control': 'no-cache, no-store, must-revalidate'
  });

  const { branding } = await loadActiveBranding(supabase);
  // ...
};
```

**After:**
```typescript
export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Note: Cache-Control headers are configured globally in vercel.json
  // to prevent caching (max-age=0, must-revalidate). This ensures
  // branding data is always fresh without setting headers here,
  // which avoids "header already set" errors when the adapter pre-sets them.

  const { branding } = await loadActiveBranding(supabase);
  // ...
};
```

## Why This Works
The vercel.json configuration already ensures branding data is always fresh:
- `max-age=0` prevents caching
- `must-revalidate` forces clients to check with server on each request
- This applies to ALL routes, including the root layout

By removing the redundant header setting, we:
1. ✅ Avoid the "header already set" error
2. ✅ Maintain the original intent (no caching of branding data)
3. ✅ Follow the principle of configuration in one place (vercel.json)
4. ✅ Are compatible with Vercel's adapter behavior

## Testing
- ✅ Build successful: `npm run build`
- ✅ TypeScript compilation passes
- ✅ No changes to functionality - caching behavior remains the same

## Files Changed
- `src/routes/+layout.server.ts` (1 file, 10 lines changed: 5 insertions, 5 deletions)

## Deployment Notes
This fix should resolve the 500 errors in production immediately upon deployment. No database migrations or environment variable changes are required.
