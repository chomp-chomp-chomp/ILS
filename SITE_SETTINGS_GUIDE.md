# Site Settings Implementation Guide

## Overview

This implementation replaces the complex and brittle `siteConfig` system with a simpler, more robust site settings approach. The new system uses SvelteKit route groups to cleanly separate public and admin layouts, and provides a simple admin UI for managing public site appearance.

## What Changed

### 1. Route Groups (SvelteKit Feature)

**Created Route Groups:**
- `(public)/` - All public-facing routes (homepage, catalog, etc.)
- `(admin)/` - All admin routes (moved under `(admin)/admin/`)
- `api/` - Remains at root (not in a group)

**Benefits:**
- Clean separation of public vs admin UI
- Public layout always shows header/footer chrome
- Admin layout shows admin-only navigation
- URLs remain unchanged (route groups are just for organization)

**File Structure:**
```
src/routes/
├── (public)/
│   ├── +layout.svelte          # Public chrome (header/footer/hero)
│   ├── +layout.server.ts       # Loads site settings
│   ├── +page.svelte            # Homepage
│   ├── catalog/                # Catalog routes
│   ├── my-account/             # Patron account
│   └── [slug]/                 # WYSIWYG pages
├── (admin)/
│   └── admin/
│       ├── +layout.svelte      # Admin navigation
│       ├── +layout.server.ts   # Auth guard
│       ├── +page.svelte        # Dashboard
│       ├── site/               # NEW: Site settings editor
│       └── ...                 # Other admin pages
├── api/                        # API endpoints (not in a group)
├── +layout.svelte              # Minimal root layout
└── +layout.server.ts           # Minimal root server load
```

### 2. Site Settings System

**New Files:**
- `src/lib/siteDefaults.ts` - Default settings (always available)
- `src/lib/server/siteSettings.ts` - Server-side functions
- `migrations/028_site_settings.sql` - Database schema
- `src/routes/(admin)/admin/site/` - Admin UI

**Database Table: `site_settings`**
```sql
- id (text, PRIMARY KEY, default 'default')
- header_links (jsonb) - Array of {title, url}
- footer_text (text)
- footer_link (text)
- hero_title (text)
- hero_subhead (text)
- hero_image_url (text)
```

**Key Features:**
- **Singleton table** - Only one row with `id='default'` allowed
- **Safe fallbacks** - Always returns defaults if DB unavailable
- **Simple API** - `getSiteSettings()` and `updateSiteSettings()`
- **Admin UI** - `/admin/site` for editing settings

### 3. Facets Restoration

**Removed CSS Kill-Switch:**
```css
/* REMOVED FROM +page.svelte: */
.sidebar {
  display: none !important;
}
```

Facets are now visible by default in the search results sidebar.

### 4. Icon Management

**Updated `src/app.html`:**
- Added all favicon link tags
- Added comprehensive documentation
- Links reference files in `/static` folder

**Icon Files (already exist):**
- `/favicon.ico`
- `/favicon-16x16.png`
- `/favicon-32x32.png`
- `/apple-touch-icon.png`
- `/android-chrome-192x192.png`
- `/android-chrome-512x512.png`

### 5. CSS Variables

**Public Layout:**
```css
:root {
  --primary-color: #e73b42;
  --secondary-color: #667eea;
  --accent-color: #2c3e50;
  --background-color: #ffffff;
  --text-color: #333333;
  --font-family: system-ui, -apple-system, sans-serif;
}
```

All header/footer/hero elements use these CSS variables for consistent theming.

## How to Use

### For Administrators

1. **Access Site Settings:**
   - Navigate to `/admin/site`
   - Requires authentication

2. **Configure Header Links:**
   - Add/remove navigation links
   - Each link has a title and URL
   - Links appear in top navigation bar

3. **Configure Footer:**
   - Set footer text (e.g., "Powered by Chomp Chomp")
   - Set footer link URL
   - Footer appears at bottom of all public pages

4. **Configure Hero:**
   - Set hero title (main heading)
   - Set hero subheading (tagline)
   - Set background image URL
   - Hero appears on homepage only

5. **Save Changes:**
   - Click "Save Settings" button
   - Changes reflect immediately on public pages
   - Use "Reset to Defaults" to revert

### For Developers

**To change default settings:**
Edit `src/lib/siteDefaults.ts`:
```typescript
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  header: {
    links: [
      { title: 'Home', url: 'https://library.example.com/' },
      // ... add more links
    ]
  },
  footer: {
    text: 'Your footer text',
    link: 'https://example.com'
  },
  hero: {
    title: 'Your library name',
    subhead: 'Your tagline',
    imageUrl: 'https://example.com/hero.jpg'
  }
};
```

**To customize CSS:**
1. Edit CSS variables in `src/routes/(public)/+layout.svelte`
2. Or use the existing branding customization at `/admin/branding`

**To add more settings:**
1. Add column to `site_settings` table (migration)
2. Update `SiteSettings` interface in `siteDefaults.ts`
3. Update `getSiteSettings()` and `updateSiteSettings()` in `siteSettings.ts`
4. Update admin form in `/admin/site/+page.svelte`

## Migration Instructions

### Database Setup

1. **Run the migration:**
   ```sql
   -- Execute migrations/028_site_settings.sql in Supabase SQL Editor
   ```

2. **Verify table created:**
   ```sql
   SELECT * FROM site_settings WHERE id = 'default';
   ```

3. **Initial settings:**
   The migration automatically inserts default settings.

### Code Deployment

1. **Deploy changes:**
   - All code changes are in this PR
   - No additional configuration needed
   - Existing URLs unchanged

2. **Environment Variables:**
   - No new environment variables required
   - Uses existing Supabase credentials

## Troubleshooting

### Issue: Header/Footer Not Showing

**Check:**
1. Verify you're on a public route (not `/admin`)
2. Check browser console for errors
3. Verify `site_settings` table exists in database
4. Check that defaults are loading: view page source, look for `siteSettings` in `<script>` tags

**Solution:**
Even if database is unavailable, defaults from `siteDefaults.ts` should render. If nothing shows, check browser console for JavaScript errors.

### Issue: Facets Not Showing

**Check:**
1. Verify facets data in search results: open browser dev tools, check Network tab
2. Check `enable_facets` setting in `search_configuration` table
3. Ensure `showFacets` is true in search results page

**Solution:**
Facets are controlled by `searchConfig.enable_facets`. Check `/admin/search-config` to ensure facets are enabled.

### Issue: Settings Not Saving

**Check:**
1. Verify user is authenticated
2. Check browser console for API errors
3. Verify `site_settings` table has correct RLS policies

**Solution:**
Check Supabase logs for database errors. Ensure authenticated users have UPDATE permission on `site_settings` table.

## Testing Checklist

- [ ] Homepage loads with hero section
- [ ] Header navigation shows correct links
- [ ] Footer shows at bottom with correct text/link
- [ ] Admin can access `/admin/site`
- [ ] Admin can edit header links (add/remove/reorder)
- [ ] Admin can edit footer text and link
- [ ] Admin can edit hero title/subhead/image
- [ ] Settings persist after saving
- [ ] Settings reflect immediately on public pages
- [ ] Facets visible in search results sidebar (desktop)
- [ ] Facets accessible via dropdown (mobile)
- [ ] All URLs unchanged (public and admin)
- [ ] Admin navigation unchanged
- [ ] Build completes without errors

## Comparison: Old vs New

### Old System (siteConfig)
- Complex JSONB structure in `site_configuration` table
- Many nullable fields, inconsistent behavior
- Brittle loading with no fallbacks
- Required multiple migrations
- Hard to understand what controls what

### New System (site_settings)
- Simple singleton table with clear columns
- Always returns valid settings (fallbacks)
- Easy to understand and maintain
- Single migration
- Clear separation: `site_settings` for public UI, `branding_configuration` for branding

### Migration Path
- Old `site_configuration` table still exists (not removed)
- New `site_settings` table is independent
- Public layout uses only `site_settings`
- Can deprecate `site_configuration` in future release

## Future Enhancements

1. **Preview Mode** - Preview settings before saving
2. **Multiple Layouts** - Different headers for different page types
3. **Link Groups** - Dropdown menus in header
4. **Theme Integration** - Merge with branding configuration
5. **Import/Export** - Export settings as JSON for backup

## Related Documentation

- `CLAUDE.md` - Full codebase documentation
- `DATABASE_SCHEMA.md` - Database schema reference
- `DEPLOYMENT.md` - Deployment guide
- `migrations/028_site_settings.sql` - Database migration

## Support

For questions or issues:
1. Check this guide first
2. Review console logs for errors
3. Check Supabase dashboard for database issues
4. Verify RLS policies are correct

---

**Last Updated:** 2026-01-09
**Version:** 1.0
**Author:** Claude (Anthropic AI Assistant)
