# Implementation Notes: Branding Defaults Centralization Fix

## Problem Statement

PR #163 introduced improvements to branding management but caused a production 500 error on Vercel. The error was:
```
Error: "cache-control" header is already set
```

This occurred because `setHeaders({ 'cache-control': ... })` was called in the root layout, which conflicts with Vercel's automatic cache header management.

## Solution Overview

This PR re-introduces the beneficial changes from PR #163 while removing the problematic cache-control header setting.

## Changes Made

### 1. Centralized Branding Defaults

**File**: `src/lib/server/branding.ts`

**Before**: Each file that needed branding had its own default object
**After**: Single `defaultBranding` constant exported from server module

```typescript
export const defaultBranding = {
  library_name: 'Chomp Chomp Library Catalog',
  library_tagline: '',
  logo_url: null,
  // ... all other defaults
  show_facets: true, // Kept for backward compatibility
};
```

### 2. Always Return Merged Branding

**File**: `src/lib/server/branding.ts`

**Before**: 
```typescript
return {
  branding: data || null,
  error
};
```

**After**:
```typescript
return {
  branding: {
    ...defaultBranding,
    ...(data || {})
  },
  error
};
```

This ensures `branding` is never null and always has all required fields.

### 3. Removed Cache-Control Header (CRITICAL FIX)

**File**: `src/routes/+layout.server.ts`

**Before**:
```typescript
export const load: LayoutServerLoad = async ({ 
  locals: { safeGetSession, supabase }, 
  cookies, 
  setHeaders 
}) => {
  const { session } = await safeGetSession();

  // This line caused the 500 error on Vercel
  setHeaders({
    'cache-control': 'no-cache, no-store, must-revalidate'
  });

  const { branding } = await loadActiveBranding(supabase);
  return {
    session,
    cookies: cookies.getAll(),
    branding: branding || null
  };
};
```

**After**:
```typescript
export const load: LayoutServerLoad = async ({ 
  locals: { safeGetSession, supabase }, 
  cookies
}) => {
  const { session } = await safeGetSession();

  const { branding } = await loadActiveBranding(supabase);
  return {
    session,
    cookies: cookies.getAll(),
    branding
  };
};
```

### 4. Removed Duplicate Defaults Merging

**Files**: `src/routes/+layout.svelte`, `src/routes/+page.svelte`

**Before**: Both files maintained their own defaults and merged them:
```typescript
const defaultBranding = { /* ... */ };
const branding = $derived({
  ...defaultBranding,
  ...((data as any).branding || {})
});
```

**After**: Both files use branding directly from data:
```typescript
const branding = $derived((data as any).branding);
```

### 5. Moved Facet Control to Search Configuration

**Why**: Facet visibility is a search feature, not a branding feature.

**Files Changed**:
- `src/routes/admin/branding/+page.svelte` - Removed `show_facets` checkbox, added note pointing to `/admin/search-config`
- `src/routes/api/branding/+server.ts` - Removed `show_facets` from both UPDATE and INSERT operations
- `src/routes/catalog/search/results/+page.server.ts` - Added `loadSearchConfig()` function
- `src/routes/catalog/search/results/+page.svelte` - Changed from `branding.show_facets` to `searchConfig.enable_facets`

**Before** (in results page):
```typescript
let showFacets = $derived((data as any)?.branding?.show_facets !== false);
```

**After**:
```typescript
let showFacets = $derived((data as any)?.searchConfig?.enable_facets !== false);
```

### 6. Safe Search Configuration Loading

**File**: `src/routes/catalog/search/results/+page.server.ts`

Added new function with proper error handling:

```typescript
async function loadSearchConfig(
  supabase: SupabaseClient
): Promise<SearchConfiguration> {
  try {
    const { data, error } = await supabase
      .from('search_configuration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('Search configuration not found, using defaults:', error);
    }

    return data || {
      enable_facets: true,
      enable_spell_correction: true,
      enable_advanced_search: true,
      results_per_page: 20
    };
  } catch (error) {
    console.error('Error loading search configuration:', error);
    return { /* safe defaults */ };
  }
}
```

This ensures that:
- Missing `search_configuration` table won't crash the app
- Missing active row won't crash the app  
- Database errors are handled gracefully
- Default values are always available

### 7. Added Type Safety

Created `SearchConfiguration` interface:

```typescript
export interface SearchConfiguration {
  enable_facets: boolean;
  enable_spell_correction: boolean;
  enable_advanced_search: boolean;
  results_per_page: number;
  enable_boolean_operators?: boolean;
  default_sort?: string;
  [key: string]: any;
}
```

## Testing

### Automated Tests

Created verification script that checks:
1. ✓ `defaultBranding` is exported
2. ✓ `loadActiveBranding` merges defaults
3. ✓ `setHeaders` removed from layout
4. ✓ `show_facets` removed from API
5. ✓ `searchConfig.enable_facets` is used
6. ✓ `loadSearchConfig` is non-fatal

All tests passed.

### Build Test

```bash
npm run build
```

Result: ✓ Built successfully in 16.91s

## Migration Path

### For Existing Databases

No migration needed! The changes are backward compatible:

1. If `search_configuration` table exists → uses it
2. If `search_configuration` table missing → uses defaults (facets enabled)
3. If `branding_configuration` has `show_facets` → ignored (deprecated but won't break)
4. Branding always has all required fields due to defaults merge

### For New Deployments

1. Branding works out of the box with defaults
2. Search works out of the box with defaults
3. No database setup required to get started

## Benefits

1. **Production Stability**: Removes the cache-control 500 error
2. **Code Quality**: Single source of truth for branding defaults
3. **Maintainability**: Easier to update defaults in one place
4. **Type Safety**: Proper interfaces for configuration objects
5. **Error Resilience**: Missing configuration doesn't crash the app
6. **Separation of Concerns**: Search config separate from branding

## Risks Mitigated

1. ✅ Cache-control header conflict on Vercel
2. ✅ Null branding causing undefined property errors
3. ✅ Missing search configuration causing 500 errors
4. ✅ Inconsistent defaults across components
5. ✅ Breaking changes for existing databases (backward compatible)

## Files Changed

- `src/lib/server/branding.ts` - Added defaults, updated return type
- `src/routes/+layout.server.ts` - Removed cache-control, simplified
- `src/routes/+layout.svelte` - Removed duplicate defaults
- `src/routes/+page.svelte` - Removed duplicate defaults
- `src/routes/admin/branding/+page.server.ts` - Use centralized defaults
- `src/routes/admin/branding/+page.svelte` - Removed show_facets UI
- `src/routes/api/branding/+server.ts` - Removed show_facets writes
- `src/routes/catalog/search/results/+page.server.ts` - Added safe config loading
- `src/routes/catalog/search/results/+page.svelte` - Use searchConfig

Total: 9 files changed, ~120 lines added, ~130 lines removed

## Deployment Checklist

- [x] Build passes
- [x] Type checking passes
- [x] Code review completed
- [x] Backward compatibility verified
- [x] Error handling tested
- [x] No breaking changes
- [ ] Deploy to staging
- [ ] Verify in staging
- [ ] Deploy to production

## Rollback Plan

If issues occur:
1. Revert this PR (merges cleanly with main)
2. Previous state restored
3. Branding continues to work with inline defaults
4. No data loss (only code changes)
