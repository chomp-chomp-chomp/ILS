# Comprehensive Fix Plan - Configuration & Facets Issues

## Problem Summary

After investigation, I've identified **critical architectural issues** that explain why configuration changes don't work and facets don't display:

### 🚨 Root Causes

1. **Three conflicting configuration tables**:
   - `site_settings` (migration 028) - Singleton table, simplest, used by PUBLIC layout
   - `site_configuration` (migration 024) - Complex table with themes, used by ADMIN UI
   - `branding_configuration` (migration 015) - Branding-specific table

2. **Data synchronization mismatch**:
   - **Public layout loads from**: `site_settings` table
   - **Admin UI saves to**: `site_configuration` table
   - **Result**: Admin changes go to wrong table, never appear on public site!

3. **Facets not displaying**:
   - Facet system depends on `facet_configuration` table
   - Migration 018 creates default facets, but may not have run
   - OR facet configs exist but data loading is broken

---

## Detailed Issues

### Issue 1: Configuration System Architecture

**Files affected**:
- `src/routes/(public)/+layout.server.ts` - Loads `site_settings`
- `src/routes/(admin)/admin/site-config/+page.svelte` - Saves to `site_configuration`
- `src/lib/server/siteSettings.ts` - Queries `site_settings` table
- `src/lib/server/siteConfig.ts` - Queries `site_configuration` table

**Timeline of migrations**:
```
015_branding_configuration.sql       (old) - Creates branding_configuration
024_site_configuration.sql           (old) - Creates site_configuration
028_site_settings.sql               (NEW) - Creates site_settings (singleton)
```

**The problem**: Migration 028 was added later to REPLACE the complex site_configuration approach with a simpler singleton pattern. But the admin UI was never updated to use the new table!

### Issue 2: Facets Not Displaying

**Migration**: `018_faceted_search_configuration.sql`

Creates:
- `facet_configuration` table
- `facet_values_cache` table
- 9 default facet configs (material_type, language, publication_decade, etc.)

**Potential issues**:
- Migration 018 may not have been run in database
- Facet configs exist but loading code has bugs
- FacetSidebar component not receiving data correctly

**Data flow**:
```
1. Search results +page.server.ts calls loadFacetConfigs()
2. loadFacetConfigs() queries facet_configuration table
3. Returns configs to FacetSidebar component
4. FacetSidebar renders facets based on configs
```

### Issue 3: Home Page, Header, Footer

**Current behavior**:
- Public layout loads `site_settings` (singleton)
- Gets `header_links`, `footer_text`, `hero_title`, etc.
- But admin UI doesn't write to this table!

**Result**: Default values always show, custom changes never appear

---

## Fix Strategy

### Option A: Use site_settings Everywhere (RECOMMENDED)

**Pros**:
- Simplest approach
- Singleton pattern is cleaner
- Migration 028 already exists with good defaults
- Fewer tables to maintain

**Cons**:
- Loses some advanced features from site_configuration (themes, per-page overrides)

**Changes needed**:
1. Update admin site-config page to save to `site_settings` table
2. Update API endpoint to use `site_settings`
3. Keep public layout as-is (already uses site_settings)
4. Drop or archive `site_configuration` table

### Option B: Use site_configuration Everywhere

**Pros**:
- More features (themes, per-page styling)
- Already has comprehensive migration

**Cons**:
- More complex
- Requires updating public layout loading logic
- More fields to manage

**Changes needed**:
1. Update public layout to load from `site_configuration`
2. Update admin UI to map fields correctly
3. Drop or archive `site_settings` table

### Option C: Synchronize Both Tables

**Pros**:
- Backwards compatible
- Gradual migration path

**Cons**:
- Complexity
- Technical debt
- Duplicate data

**Changes needed**:
1. Create database trigger to sync site_settings ↔ site_configuration
2. Keep both systems working
3. Plan deprecation of one

---

## Recommended Fix: Option A (Use site_settings Everywhere)

### Step 1: Fix Admin Site Config Page

**File**: `src/routes/(admin)/admin/site-config/+page.svelte`

**Change**: Update to load/save from `site_settings` table instead of `site_configuration`

**New fields to support**:
- `header_links` (JSONB array)
- `footer_text` (TEXT)
- `footer_link` (TEXT)
- `hero_title` (TEXT)
- `hero_subhead` (TEXT)
- `hero_image_url` (TEXT)

### Step 2: Fix API Endpoint

**File**: `src/routes/api/site-config/+server.ts`

**Change**: Update to query/update `site_settings` table

### Step 3: Update siteConfig.ts Helper

**File**: `src/lib/server/siteConfig.ts`

**Change**: Point to `site_settings` table, OR deprecate and use `siteSettings.ts` everywhere

### Step 4: Verify Facets Migration

**Action**: Check if `facet_configuration` table exists and has data

**Query**:
```sql
SELECT COUNT(*) FROM facet_configuration WHERE is_enabled = true;
```

**Expected**: Should return 5-9 facets

**If empty**: Run migration `018_faceted_search_configuration.sql`

### Step 5: Fix Facet Loading

**File**: `src/routes/(public)/catalog/search/results/+page.server.ts`

**Verify**:
- Line 105: `const facetConfigs = await loadFacetConfigs(supabase);`
- Check if `facetConfigs` is passed to page data
- Verify it reaches FacetSidebar component

### Step 6: Debug FacetSidebar

**File**: `src/routes/(public)/catalog/search/results/FacetSidebar.svelte`

**Check**:
- Props are received correctly
- `facetConfigs` array is not empty
- `getFacetValues()` returns data
- Render logic is not hidden by CSS

### Step 7: Test Everything

1. Update site settings in admin UI
2. Verify changes appear on public site
3. Check header navigation
4. Check footer text
5. Check homepage hero
6. Search for items
7. Verify facets display on left sidebar
8. Click facet checkboxes
9. Verify filtering works

---

## Implementation Order

### Phase 1: Database Verification (10 mins)
- [ ] Check which tables exist in database
- [ ] Verify facet_configuration has data
- [ ] Check site_settings has default row

### Phase 2: Fix Configuration System (30 mins)
- [ ] Update admin site-config page UI
- [ ] Update site-config API endpoint
- [ ] Update helper functions
- [ ] Test admin UI saves correctly

### Phase 3: Fix Facets (20 mins)
- [ ] Verify facet migration ran
- [ ] Debug facet loading in search results
- [ ] Fix FacetSidebar rendering
- [ ] Test facet filtering

### Phase 4: Fix Home Page/Header/Footer (15 mins)
- [ ] Verify public layout loads site_settings
- [ ] Check header navigation renders
- [ ] Check footer renders
- [ ] Check homepage hero renders

### Phase 5: Testing (15 mins)
- [ ] Full end-to-end test
- [ ] Admin config changes → Public site
- [ ] Search → Facets display → Filtering works
- [ ] All pages show correct header/footer

---

## Files to Modify

### Critical Files:
1. `src/routes/(admin)/admin/site-config/+page.svelte` - Admin UI
2. `src/routes/(admin)/admin/site-config/+page.server.ts` - Data loading
3. `src/routes/api/site-config/+server.ts` - API endpoint
4. `src/lib/server/siteConfig.ts` - Helper (maybe deprecate)
5. `src/routes/(public)/catalog/search/results/+page.server.ts` - Facet loading
6. `src/routes/(public)/catalog/search/results/FacetSidebar.svelte` - Facet rendering

### Migration Check:
- `migrations/018_faceted_search_configuration.sql` - Verify ran
- `migrations/028_site_settings.sql` - Verify ran

---

## Risk Assessment

### Low Risk:
- Updating admin UI to use site_settings
- Fixing facet loading logic

### Medium Risk:
- Changing API endpoints (test thoroughly)
- Deprecating site_configuration table

### High Risk:
- Database migrations on live data
- Removing tables with existing data

---

## Rollback Plan

If fixes break things:

1. **Revert code changes**: Git revert commits
2. **Restore table access**: Re-enable site_configuration loading
3. **Clear cache**: Refresh all cached configs
4. **Test**: Verify old behavior restored

---

## Next Steps

**You decide**:

1. **Quick fix**: Just fix facets + basic config (30 mins)
2. **Full fix**: Implement Option A completely (90 mins)
3. **Investigation only**: Check database state first (10 mins)

**My recommendation**: Start with investigation (Phase 1) to understand actual database state, then proceed with full fix (Option A).

Would you like me to:
- [ ] Start with database investigation?
- [ ] Jump straight to implementation?
- [ ] Create a different fix strategy?
