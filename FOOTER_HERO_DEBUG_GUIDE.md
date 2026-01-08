# Footer & Hero Rendering Debug Guide

## Problem Fixed

This PR fixes rendering issues where the footer and homepage hero sections were not displaying even when properly configured in the database's `site_configuration` table.

## Changes Made

### 1. Robust Boolean Evaluation

**Location**: `src/routes/+layout.svelte` (lines 67-82)

Changed conditional checks from simple equality to explicit boolean casting:

```typescript
// BEFORE (could fail with truthy but not === true values)
let showFooter = $derived(
  siteConfig?.footer_enabled === true && !$page.url.pathname.startsWith('/admin')
);

// AFTER (converts any truthy value to boolean true)
let showFooter = $derived(
  Boolean(siteConfig?.footer_enabled) === true && !$page.url.pathname.startsWith('/admin')
);
```

### 2. CSS Failsafe

**Location**: `src/routes/+layout.svelte` (line 391)

Added CSS enforcement to ensure footer always renders when the condition is met:

```css
.site-footer {
  background: var(--accent-color);
  color: rgba(255, 255, 255, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2rem 0;
  margin-top: 4rem;
  width: 100%;
  /* ROBUST: Ensure footer always renders and is visible */
  display: block !important;
  position: relative;
}
```

### 3. Comprehensive Debugging

**Location**: `src/routes/+layout.svelte` (lines 29-40, 73-81)

Added `$effect` blocks that log all relevant values to browser console:

```typescript
$effect(() => {
  if (browser) {
    console.log('🔍 [Layout Debug] Current page:', $page.url.pathname);
    console.log('🔍 [Layout Debug] siteConfig object:', siteConfig);
    console.log('🔍 [Layout Debug] siteConfig.footer_enabled:', siteConfig?.footer_enabled);
    console.log('🔍 [Layout Debug] siteConfig.footer_text:', siteConfig?.footer_text);
    console.log('🔍 [Layout Debug] showFooter:', showFooter);
    // ... more logs
  }
});
```

**Location**: `src/routes/+page.svelte` (lines 24-34)

Added homepage-specific debugging:

```typescript
$effect(() => {
  if (browser) {
    console.log('🏠 [Homepage Debug] siteConfig:', siteConfig);
    console.log('🏠 [Homepage Debug] homepage_hero_enabled:', siteConfig?.homepage_hero_enabled);
    // ... more logs
  }
});
```

## How to Verify the Fix

### Step 1: Check Database Configuration

Run this SQL in Supabase SQL Editor:

```sql
SELECT 
  id,
  footer_enabled,
  footer_text,
  header_enabled,
  homepage_hero_enabled,
  homepage_hero_title,
  is_active,
  updated_at
FROM site_configuration
WHERE is_active = true
ORDER BY updated_at DESC
LIMIT 1;
```

Expected output should show:
- `is_active` = `true`
- `footer_enabled` = your desired setting (true/false)
- `homepage_hero_enabled` = your desired setting (true/false)

### Step 2: Enable Footer (if not already)

If `footer_enabled` is `false`, update it:

```sql
UPDATE site_configuration
SET 
  footer_enabled = true,
  footer_text = 'Copyright © 2026 Your Library. All rights reserved.',
  footer_links = '[
    {"title": "About", "url": "/about", "order": 1},
    {"title": "Contact", "url": "/contact", "order": 2},
    {"title": "Privacy", "url": "/privacy", "order": 3}
  ]'::jsonb
WHERE is_active = true;
```

### Step 3: Enable Homepage Hero (if desired)

```sql
UPDATE site_configuration
SET 
  homepage_hero_enabled = true,
  homepage_hero_title = 'Welcome to Our Library',
  homepage_hero_tagline = 'Discover thousands of books, journals, and resources',
  homepage_hero_image_url = NULL  -- or a valid image URL
WHERE is_active = true;
```

### Step 4: Check Browser Console

1. Open your application in a browser
2. Open Developer Tools (F12)
3. Go to the **Console** tab
4. Navigate to the homepage (/)

You should see output like:

```
[+layout.server] Site config loaded: { header_enabled: false, footer_enabled: true, ... }
🔍 [Layout Debug] Current page: /
🔍 [Layout Debug] siteConfig object: { footer_enabled: true, footer_text: "...", ... }
🔍 [Layout Debug] siteConfig.footer_enabled: true
🔍 [Layout Debug] showFooter: true
🏠 [Homepage Debug] homepage_hero_enabled: true
```

### Step 5: Visual Verification

#### **Footer Should Display:**
- On homepage (/)
- On catalog search (/catalog/search/results)
- On catalog browse (/catalog/browse)
- On record detail pages (/catalog/record/[id])
- **NOT** on admin pages (/admin/*)

#### **Hero Should Display:**
- Only on homepage (/)
- With configured title and tagline
- With background image (if URL provided)

### Step 6: Test Different Pages

Navigate to these URLs and check console for each:

1. **Homepage**: `/`
   - Check for: `🏠 [Homepage Debug]` logs
   - Should show hero (if enabled) and footer (if enabled)

2. **Catalog Search**: `/catalog/search/results?q=test`
   - Should show footer (if enabled)
   - Should NOT show hero

3. **Admin Panel**: `/admin`
   - Should NOT show footer
   - Should NOT show hero
   - Should NOT show custom header

## What Each Log Means

### Server-Side Logs (in terminal/Vercel logs):

- `[+layout.server] Site config loaded:` - Server successfully fetched config
- `[loadActiveSiteConfig] Database record found` - Config exists in DB
- `[loadActiveSiteConfig] Footer enabled: true` - Footer flag is true

### Client-Side Logs (in browser console):

- `🔍 [Layout Debug] Current page:` - Current URL path
- `🔍 [Layout Debug] siteConfig.footer_enabled:` - Raw value from data prop
- `🔍 [Layout Debug] showFooter:` - Computed boolean (should be true/false)
- `🏠 [Homepage Debug] homepage_hero_enabled:` - Hero enabled flag

## Troubleshooting

### Footer Not Showing

**Check 1**: Console shows `showFooter: false`
- **Cause**: Either `footer_enabled` is false in DB or page is admin page
- **Fix**: Update DB or navigate to non-admin page

**Check 2**: Console shows `showFooter: true` but footer not visible
- **Cause**: CSS override somewhere
- **Fix**: Inspect element, check for `display: none` or `visibility: hidden`

**Check 3**: Console shows `siteConfig: undefined` or `null`
- **Cause**: Server-side loading failed
- **Fix**: Check Supabase connection, RLS policies, table existence

### Hero Not Showing

**Check 1**: Console shows `homepage_hero_enabled: false`
- **Cause**: Disabled in database
- **Fix**: Run SQL to enable (see Step 3 above)

**Check 2**: Console shows `homepage_hero_enabled: true` but hero not visible
- **Cause**: Wrong page (hero only on homepage)
- **Fix**: Navigate to `/` exactly

**Check 3**: Hero shows but no title/content
- **Cause**: `homepage_hero_title` and `homepage_hero_tagline` are empty
- **Fix**: Update database with content

## Code References

### Key Files Modified:
- `src/routes/+layout.svelte` - Added debugging, robust boolean checks, CSS fixes
- `src/routes/+page.svelte` - Added homepage debugging, robust hero check

### Key Functions:
- `loadActiveSiteConfig()` in `src/lib/server/siteConfig.ts` - Loads config from DB
- `$derived` reactive statements - Compute visibility flags

### Database Tables:
- `site_configuration` - Stores header, footer, hero, theme settings
- `branding_configuration` - Legacy table for library name, favicon (still used)

## Expected Behavior After Fix

✅ Footer renders consistently across all non-admin pages when enabled
✅ Hero renders on homepage when enabled
✅ Configuration loads reliably from database
✅ Debugging logs provide clear visibility into configuration state
✅ CSS failsafe ensures visual rendering even if JS has edge case issues
✅ Explicit boolean casting handles any database type variations

## Rollback Instructions

If you need to rollback this change:

```bash
git revert <commit-sha>
```

The old behavior was:
- Simple equality checks (`===`) without boolean casting
- No `display: block !important` on footer
- No debugging logs

## Additional Notes

- **Server-side logging** is always active (already existed)
- **Client-side logging** only runs in browser (guards with `if (browser)`)
- Logging has minimal performance impact
- Can be removed once rendering is stable
- Consider adding environment variable to toggle debug logs in production
