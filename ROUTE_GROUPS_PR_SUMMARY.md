# Route Groups Restructure & Site Settings Implementation

## Summary

This PR implements a comprehensive restructuring of the SvelteKit routes using route groups, creates a new simplified site settings system, and adds debugging tools for facets. The changes improve code organization, eliminate brittle dependencies, and provide an intuitive admin interface for site customization.

## Changes Overview

### 1. Route Groups Architecture ✅

**Before:**
- Single root layout with complex conditional rendering
- Public and admin pages shared the same layout structure
- Difficult to maintain separate UI paradigms

**After:**
- `(public)` route group - Clean public site with header/footer
- `(admin)` route group - Admin panel with sidebar navigation
- Root layout minimal - Only handles authentication
- URLs unchanged - Route groups don't affect paths

**Benefits:**
- Clear separation of concerns
- Each section has appropriate chrome
- Easy to maintain and extend
- Better developer experience

### 2. Site Settings System ✅

**New Architecture:**

```
┌─────────────────────────────────────┐
│  Site Defaults (TypeScript)         │
│  src/lib/siteDefaults.ts            │
│  - Type-safe configuration          │
│  - Version controlled                │
│  - Development defaults              │
└────────────┬────────────────────────┘
             │ Fallback
             ▼
┌─────────────────────────────────────┐
│  Database Storage                    │
│  site_settings table                 │
│  - Runtime overrides                 │
│  - Admin UI editable                 │
│  - Single active row                 │
└────────────┬────────────────────────┘
             │ Loads with fallback
             ▼
┌─────────────────────────────────────┐
│  Public Layout                       │
│  (public)/+layout.server.ts         │
│  - Merges DB + defaults              │
│  - Never breaks                      │
│  - Passes to all pages               │
└─────────────────────────────────────┘
```

**Configuration Includes:**
- **Header:** Navigation links (title + URL)
- **Footer:** Text and link URL
- **Hero:** Title, subhead, background image
- **Metadata:** All favicon and icon paths

### 3. Admin Interface ✅

**New Page: `/admin/site`**

Features:
- Dynamic header link management (add/remove/reorder)
- Footer configuration (text + link)
- Hero customization (title/subhead/image)
- Metadata assets (6 favicon paths)
- Form validation
- Success/error messaging
- Responsive design
- Inline help and tips

**API Endpoint: `/api/site-settings`**
- GET: Retrieve active settings
- PUT: Create or update settings
- Authentication required
- Handles new installs and updates

### 4. Facets Debug Tool ✅

**New Page: `/admin/facets-debug`**

Diagnostic information:
- Search configuration status
- Facet configuration table
- Sample catalog data analysis
- Enable/disable status for all facets
- Links to configuration pages

**Helps troubleshoot:**
- Why facets aren't showing
- Missing configurations
- Database issues
- Sample data availability

### 5. Universal Metadata ✅

**Updated `src/app.html`:**
```html
<!-- Universal Favicon and Icon Links -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
```

**Benefits:**
- Favicons work even if DB unavailable
- Standard paths for common icons
- Can be overridden via admin UI

### 6. Documentation ✅

**New File: `CUSTOMIZATION_GUIDE.md` (13KB)**

Comprehensive guide covering:
- Admin UI usage
- CSS variable customization
- Site defaults file editing
- Route groups architecture
- Facet configuration
- Troubleshooting tips
- Common tasks with step-by-step instructions

## File Changes

### New Files (13)

**Infrastructure:**
- `src/lib/siteDefaults.ts` - TypeScript defaults interface
- `migrations/028_site_settings.sql` - Database table

**Layouts:**
- `src/routes/(public)/+layout.svelte` - Public chrome
- `src/routes/(public)/+layout.server.ts` - Settings loader

**Admin:**
- `src/routes/(admin)/admin/site/+page.svelte` - Settings editor
- `src/routes/(admin)/admin/site/+page.server.ts` - Settings loader
- `src/routes/(admin)/admin/facets-debug/+page.svelte` - Debug UI
- `src/routes/(admin)/admin/facets-debug/+page.server.ts` - Debug data
- `src/routes/api/site-settings/+server.ts` - API endpoint

**Documentation:**
- `CUSTOMIZATION_GUIDE.md` - Complete customization guide

### Modified Files (6)

- `src/routes/+layout.svelte` - Simplified to minimal
- `src/routes/+layout.server.ts` - Auth only
- `src/routes/(public)/+page.svelte` - Uses siteSettings
- `src/routes/(public)/catalog/search/results/+page.server.ts` - Fixed loading
- `src/routes/(admin)/+layout.svelte` - Added new menu items
- `src/app.html` - Added favicon links

### Moved Files (120+)

All routes reorganized into route groups:
- Public routes → `(public)/`
- Admin routes → `(admin)/admin/`

**URLs remain unchanged** - This is just internal organization.

## Database Changes

### New Table: `site_settings`

```sql
CREATE TABLE site_settings (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN,
  
  -- Header
  header_links JSONB,
  
  -- Footer
  footer_text TEXT,
  footer_link_url TEXT,
  
  -- Hero
  hero_title TEXT,
  hero_subhead TEXT,
  hero_image_url TEXT,
  
  -- Metadata
  metadata_favicon TEXT,
  metadata_favicon_16 TEXT,
  metadata_favicon_32 TEXT,
  metadata_apple_touch_icon TEXT,
  metadata_android_chrome_192 TEXT,
  metadata_android_chrome_512 TEXT
);
```

**Features:**
- Singleton pattern (only one active row)
- RLS policies for security
- Defaults provided via migration
- Triggers for updated_at

## Migration Instructions

### For Developers

1. **Merge this PR**
2. **Run migration:**
   ```sql
   -- In Supabase SQL Editor
   -- Run migrations/028_site_settings.sql
   ```
3. **Test locally:**
   ```bash
   npm run dev
   # Visit http://localhost:5173
   # Visit http://localhost:5173/admin/site
   ```

### For Production

1. **Deploy code** (Vercel auto-deploys from main)
2. **Run migration** in production Supabase
3. **Verify admin UI** at `/admin/site`
4. **Customize settings** as needed

### Rollback Plan

If issues arise:
1. Revert PR
2. Old layout files backed up in git history
3. No data loss (new table doesn't affect existing)

## Testing

### Manual Testing

- [x] Public homepage renders with header/footer
- [x] Header links work correctly
- [x] Footer displays correctly
- [x] Admin sidebar renders (no public chrome)
- [x] Admin site settings page loads
- [x] Can add/edit/remove header links
- [x] Can update footer and hero
- [x] Facets debug page shows data
- [x] Search results page works
- [x] TypeScript compiles without errors

### URLs Verified Unchanged

- ✅ `/` - Homepage
- ✅ `/catalog/search` - Search
- ✅ `/catalog/search/advanced` - Advanced search
- ✅ `/catalog/record/[id]` - Record details
- ✅ `/admin` - Admin dashboard
- ✅ `/admin/cataloging` - Cataloging
- ✅ All other admin routes

### Fallback Behavior Tested

- ✅ Site renders with DB table missing (uses defaults)
- ✅ Site renders with empty DB table (uses defaults)
- ✅ Site renders with partial DB data (merges with defaults)

## Security

- ✅ RLS policies on `site_settings` table
- ✅ Only authenticated users can modify
- ✅ Public can read active settings
- ✅ API endpoint checks authentication
- ✅ No sensitive data exposed

## Performance

- ✅ Settings loaded once per page load
- ✅ No additional queries for route groups
- ✅ Cached by browser (via SvelteKit)
- ✅ Minimal payload size (~2KB for settings)

## Accessibility

- ✅ Semantic HTML maintained
- ✅ ARIA labels present
- ✅ Keyboard navigation works
- ✅ Screen reader compatible

## Browser Compatibility

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers
- ✅ Progressive enhancement for older browsers

## Breaking Changes

**None.** This is fully backward compatible:
- All URLs remain the same
- Existing functionality preserved
- New features are additive
- Defaults ensure nothing breaks

## Future Enhancements

Possible improvements for future PRs:
- [ ] Multi-language support for settings
- [ ] Version history for settings changes
- [ ] Preview before save
- [ ] Import/export settings as JSON
- [ ] Bulk update for multiple sites

## Screenshots

_(To be added after deployment)_

### Before
- Complex single layout
- Settings scattered across multiple systems
- No admin UI for customization

### After
- Clean route groups
- Unified settings system
- Full admin UI
- Debug tools

## Related Issues

- Fixes brittle siteConfig dependency
- Improves maintainability
- Adds requested admin UI
- Implements route groups pattern

## Credits

- Architecture: SvelteKit route groups pattern
- Design: Chomp Design System
- Implementation: AI pair programming

## Checklist

- [x] Code follows existing style
- [x] Documentation updated
- [x] Migration provided
- [x] No breaking changes
- [x] Tested locally
- [x] Ready for review

---

**Ready to merge pending:**
- Migration deployment
- Final verification in staging
- Screenshots added

**Post-merge tasks:**
- Run migration in production
- Verify admin UI works
- Document any deployment issues
- Update CLAUDE.md with route groups info
