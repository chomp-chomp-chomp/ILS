# Deployment Guide - Configuration & Facets Fix

## 🎯 What's Been Fixed

### ✅ Recent Updates (Latest Commits)

**Fixed 500 Error - Data Structure** (Commit 9):
- Fixed data structure transformation in layout servers
- Public layout now receives nested `siteSettings` structure (header.links, hero.title, etc.)
- Homepage and branding pages receive properly formatted objects
- **Result**: Components now receive data in the format they expect

**Fixed 500 Error - Old Helpers** (Commits 6-8):
- Updated homepage to use unified settings helper
- Updated admin branding page to use unified settings helper
- All pages now use the same unified configuration system

### ✅ Code Changes (Complete - Already Committed)

1. **Unified Configuration System**
   - Created `src/lib/server/unifiedSiteSettings.ts` - single helper for all settings
   - Updated public layout to use unified helper
   - Updated admin site-config page to use unified helper
   - Updated API endpoint to use unified helper
   - **Result**: Admin changes now save/load from same table as public site

2. **Admin Menu Simplified**
   - Reduced confusing 6 options → 3 clear options in admin menu
   - **Result**: Clearer navigation for administrators

3. **Facets Code Verified**
   - Checked search results page - correctly loads facet configs
   - Checked FacetSidebar component - correctly renders facets
   - Checked conditional logic - facets enabled by default
   - **Result**: Code is correct, just needs database migration

---

## 🗄️ Database Migrations Required

### Migration 1: Consolidate Site Settings (REQUIRED)

**File**: `migrations/029_consolidate_site_settings.sql`

**What it does**:
- Adds all branding fields to `site_settings` table
- Automatically migrates data from `branding_configuration` if it exists
- Creates single source of truth for all settings

**How to run**:
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `migrations/029_consolidate_site_settings.sql`
3. Paste and execute
4. Verify: `SELECT * FROM site_settings WHERE id='default';` should return a row with all fields

**Expected result**:
```sql
-- Should see columns like:
library_name, library_tagline, logo_url, homepage_logo_url,
primary_color, secondary_color, header_links, footer_text,
hero_title, hero_subhead, show_facets, show_covers, etc.
```

---

### Migration 2: Faceted Search Configuration (PROBABLY ALREADY RAN)

**File**: `migrations/018_faceted_search_configuration.sql`

**What it does**:
- Creates `facet_configuration` table
- Creates `facet_values_cache` table
- Inserts 9 default facet configurations:
  - Material Type (enabled)
  - Language (enabled)
  - Publication Decade (enabled)
  - Availability (enabled)
  - Location (enabled)
  - Subject (enabled but collapsed)
  - Author (disabled)
  - Publication Year Range (disabled)
  - Call Number Range (disabled)

**How to check if it already ran**:
```sql
SELECT COUNT(*) FROM facet_configuration WHERE is_enabled = true;
```

**Expected result**: Should return 5-6 (enabled facets)

**If query returns 0 or table doesn't exist**:
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `migrations/018_faceted_search_configuration.sql`
3. Paste and execute

---

## 🧪 Testing Steps

### Test 1: Admin Configuration Changes

1. **Navigate to** `/admin/site-config`
2. **Change** library name to "Test Library"
3. **Change** primary color to a different color (e.g., #0000ff)
4. **Click** "Save Changes"
5. **Navigate to** public homepage `/`
6. **Verify**:
   - Library name shows "Test Library" in header/footer
   - Primary color changed (buttons, links)

**Expected**: Changes appear immediately ✅

**If changes don't appear**:
- Check browser console for errors
- Verify migration 029 ran successfully
- Check Supabase logs for API errors

---

### Test 2: Facets Display

1. **Navigate to** `/catalog/search/results?q=test`
2. **Look for** left sidebar with "Refine Results"
3. **Verify** facets display:
   - Material Type section (with checkboxes)
   - Language section (with checkboxes)
   - Other enabled facets

**Expected**: Facets sidebar displays on left ✅

**If facets don't display**:

**Debugging steps**:

A. **Check facet configuration exists**:
```sql
SELECT facet_key, facet_label, is_enabled
FROM facet_configuration
ORDER BY display_order;
```

**Expected**: Should return 9 rows

**If returns 0 rows**: Run migration 018

B. **Check if facets are enabled in search config**:
```sql
SELECT enable_facets FROM search_configuration WHERE is_active = true;
```

**Expected**: Should return `true` or no rows (defaults to true)

**If returns `false`**: Update it:
```sql
UPDATE search_configuration
SET enable_facets = true
WHERE is_active = true;
```

C. **Check browser console**:
- Look for JavaScript errors
- Check if `data.facetConfigs` is populated
- Check if `data.facets` has values

D. **Check server logs**:
- Look for database query errors
- Check if `loadFacetConfigs()` is failing

---

### Test 3: Facet Filtering

1. **On search results page**, click a facet checkbox (e.g., "Books" under Material Type)
2. **Verify** URL updates with filter parameter (e.g., `?material_types=book`)
3. **Verify** results refresh showing only books
4. **Click** another facet
5. **Verify** multiple filters work together

**Expected**: Filtering works correctly ✅

---

### Test 4: Header & Footer

1. **Navigate to** any public page
2. **Verify** header navigation displays with links
3. **Verify** footer text displays at bottom
4. **Navigate to** homepage
5. **Verify** hero section displays with title/subtitle/image

**Expected**: All sections display correctly ✅

---

## 🔧 Rollback Plan

If something breaks:

### Rollback Code Changes:
```bash
git revert HEAD~4  # Reverts last 4 commits
git push
```

### Rollback Database Migration:
```sql
-- Remove added columns from site_settings
ALTER TABLE site_settings
DROP COLUMN IF EXISTS library_name,
DROP COLUMN IF EXISTS library_tagline,
DROP COLUMN IF EXISTS logo_url,
-- ... (all new columns)
```

**Better approach**: Don't rollback, just debug and fix forward.

---

## 📊 Post-Deployment Checklist

- [ ] Run migration 029_consolidate_site_settings.sql
- [ ] Verify site_settings table has all new columns
- [ ] Verify migration 018 ran (check facet_configuration has data)
- [ ] Test admin config changes appear on public site
- [ ] Test facets display on search results page
- [ ] Test facet filtering works correctly
- [ ] Test header navigation displays
- [ ] Test footer displays
- [ ] Test homepage hero displays
- [ ] (Optional) Remove old `/admin/branding` page
- [ ] (Optional) Archive old branding_configuration table

---

## 🚨 Common Issues & Solutions

### Issue: "site_settings table doesn't exist"
**Solution**: Run migration 028 first, then 029

### Issue: "Facets still don't display"
**Solution**: Check facet_configuration table has enabled facets

### Issue: "Changes in admin don't appear"
**Solution**: Check migration 029 ran, verify API endpoint is using unified helper

### Issue: "TypeScript errors"
**Solution**: Run `npm run check` and fix any type mismatches

### Issue: "Build fails"
**Solution**: Ensure all imports are correct, run `npm install`

---

## 🎉 Success Criteria

You'll know everything is working when:

1. ✅ Admin changes to site-config appear immediately on public site
2. ✅ Facets display on search results page
3. ✅ Clicking facets filters results correctly
4. ✅ Header navigation displays from site settings
5. ✅ Footer displays from site settings
6. ✅ Homepage hero displays from site settings
7. ✅ No JavaScript console errors
8. ✅ No server-side errors in logs

---

## 📞 Support

If issues persist:
1. Check browser console for errors
2. Check Supabase logs for database errors
3. Verify all migrations ran successfully
4. Check that environment variables are correct
5. Try clearing browser cache/cookies

---

**Branch**: `claude/fix-facets-and-simplify-menu-JJ5VR`
**Commits**: 9 commits
**Status**: ✅ Code complete with data structure fixes - site should load properly (migrations still recommended)
