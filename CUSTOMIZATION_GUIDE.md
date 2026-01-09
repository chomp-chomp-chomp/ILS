# Site Customization Guide

## Overview

This guide explains how to customize the Chomp Chomp Library Catalog's appearance, content, and behavior. The system is designed to be easily customizable through multiple layers:

1. **Admin UI** - Easiest, no coding required
2. **Site Defaults File** - TypeScript file for developers
3. **CSS Variables** - Global design tokens
4. **Database Settings** - Runtime configuration

---

## Table of Contents

1. [Site Settings (Header/Footer/Hero/Metadata)](#site-settings)
2. [CSS Customization](#css-customization)
3. [Site Defaults File](#site-defaults-file)
4. [Route Groups Architecture](#route-groups-architecture)
5. [Facet Configuration](#facet-configuration)

---

## Site Settings

### Admin UI Method (Easiest)

Navigate to **Admin → Site Settings** (`/admin/site`) to configure:

#### Header Navigation
- Add/remove/reorder navigation links
- Each link has a title and URL
- Links appear in the header on all public pages

**Example Configuration:**
```
Title: Home | URL: https://library.chompchomp.cc/
Title: Advanced Search | URL: https://library.chompchomp.cc/catalog/search/advanced
Title: Tools | URL: https://chompchomp.cc/tools/
Title: Recipes | URL: https://chompchomp.cc/
```

#### Footer
- Footer text (e.g., "Powered by Chomp Chomp")
- Footer link URL (e.g., https://chompchomp.cc)
- Displays at bottom of all public pages

#### Homepage Hero
- **Hero Title**: Main heading (e.g., "Welcome to the Chomp Chomp Library")
- **Hero Subhead**: Secondary text (e.g., "Explore our collection")
- **Hero Image URL**: Background image (recommended: 1920x600px or larger)

#### Metadata Assets (Favicons)
Configure paths to favicon and icon files:
- Favicon (ICO): `/favicon.ico`
- Favicon 16x16 (PNG): `/favicon-16x16.png`
- Favicon 32x32 (PNG): `/favicon-32x32.png`
- Apple Touch Icon: `/apple-touch-icon.png`
- Android Chrome 192x192: `/android-chrome-192x192.png`
- Android Chrome 512x512: `/android-chrome-512x512.png`

**Notes:**
- Paths can be repository-relative (`/favicon.ico`) or external URLs
- Changes take effect immediately for all users
- Settings are stored in the `site_settings` database table

---

## CSS Customization

### Global CSS Variables

All colors, spacing, and typography are controlled through CSS custom properties in `/static/global.css`.

#### Primary Design Tokens

```css
:root {
  /* Brand Colors */
  --accent: #e73b42;              /* Primary brand color */
  --accent-hover: #d12d34;        /* Hover state */
  
  /* Background Colors */
  --bg-primary: #fdfdfd;          /* Main background */
  --bg-secondary: #f5f5f5;        /* Secondary background */
  
  /* Text Colors */
  --text-primary: #353535;        /* Main text */
  --text-muted: #7d7d7d;          /* Secondary text */
  --text-light: #9d9d9d;          /* Tertiary text */
  
  /* Action Colors */
  --success: #4caf50;
  --warning: #ff9800;
  --info: #2196f3;
  --danger: #f44336;
  
  /* Spacing Scale (Consistent spacing throughout) */
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 20px;
  --space-lg: 30px;
  --space-xl: 40px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --line-height: 1.7;
  --line-height-tight: 1.3;
}
```

### How to Customize Colors

**Example: Change Primary Brand Color**

1. Open `/static/global.css`
2. Find `--accent: #e73b42;`
3. Change to your color: `--accent: #2563eb;` (blue)
4. Save the file
5. Reload the site - all buttons, links, and accent colors update automatically

**Common Customizations:**

```css
/* Change to blue theme */
:root {
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
}

/* Change to green theme */
:root {
  --accent: #10b981;
  --accent-hover: #059669;
}

/* Change to purple theme */
:root {
  --accent: #8b5cf6;
  --accent-hover: #7c3aed;
}
```

### Dark Mode

Dark mode is automatically supported via media query:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #231f1f;
    --bg-secondary: #2b2626;
    --text-primary: #d9d4d4;
    --text-muted: #b9b4b4;
    --accent: #ff6b7a;
    --border: #3b3636;
  }
}
```

To customize dark mode colors, edit the values inside this media query.

---

## Site Defaults File

### Location
`src/lib/siteDefaults.ts`

### Purpose
Defines default configuration values used when database settings are unavailable or as fallbacks. This is the developer-friendly way to set site-wide defaults.

### Structure

```typescript
export interface SiteSettings {
  header: {
    links: Array<{ title: string; url: string; }>;
  };
  footer: {
    text: string;
    linkUrl: string;
  };
  hero: {
    title: string;
    subhead: string;
    imageUrl: string;
  };
  metadata: {
    favicon: string;
    favicon16: string;
    favicon32: string;
    appleTouchIcon: string;
    androidChrome192: string;
    androidChrome512: string;
  };
}
```

### How to Edit Defaults

1. Open `src/lib/siteDefaults.ts`
2. Modify the `siteDefaults` object:

```typescript
export const siteDefaults: SiteSettings = {
  header: {
    links: [
      { title: 'Home', url: 'https://library.example.com/' },
      { title: 'About', url: 'https://library.example.com/about' },
      // Add more links here
    ]
  },
  footer: {
    text: 'My Library Name',
    linkUrl: 'https://example.com'
  },
  hero: {
    title: 'Welcome to My Library',
    subhead: 'Discover great books',
    imageUrl: 'https://example.com/hero.jpg'
  },
  metadata: {
    // Update these paths to match your favicon files
    favicon: '/favicon.ico',
    favicon16: '/favicon-16x16.png',
    // ... etc
  }
};
```

3. Save the file
4. Restart the development server or redeploy

**When to Use This:**
- Setting defaults for new installations
- Defining fallback values when database is unavailable
- Version-controlled configuration (good for teams)

**Priority:**
Database settings (via Admin UI) always override defaults from this file.

---

## Route Groups Architecture

### Structure

The application uses SvelteKit route groups to separate public and admin layouts:

```
src/routes/
├── (public)/                    # Public site
│   ├── +layout.svelte          # Public chrome (header/footer)
│   ├── +layout.server.ts       # Loads site settings
│   ├── +page.svelte            # Homepage
│   ├── catalog/                # Catalog pages
│   └── my-account/             # User account pages
├── (admin)/                     # Admin panel
│   ├── +layout.svelte          # Admin sidebar layout
│   ├── +layout.server.ts       # Auth guard
│   └── admin/                  # Admin pages
├── api/                         # API endpoints
└── +layout.svelte              # Root layout (minimal)
```

### How Route Groups Work

- Parentheses in directory names `(public)` and `(admin)` create **route groups**
- Route groups affect layouts but **not URLs**
- URLs remain unchanged: `/catalog/search` works the same way

**Benefits:**
- Public pages get header/footer automatically
- Admin pages don't have public chrome
- Clean separation of concerns
- Easy to maintain different layouts

### Public Layout Flow

1. User visits `/catalog/search`
2. `(public)/+layout.server.ts` loads site settings from database
3. Falls back to defaults from `siteDefaults.ts` if DB unavailable
4. `(public)/+layout.svelte` renders header and footer
5. Page content renders inside layout

### Admin Layout Flow

1. User visits `/admin/cataloging`
2. `(admin)/+layout.server.ts` checks authentication
3. Redirects to login if not authenticated
4. `(admin)/+layout.svelte` renders admin sidebar
5. Page content renders inside sidebar layout

---

## Facet Configuration

### What Are Facets?

Facets are filters on search results that let users narrow results by:
- Material type (book, DVD, etc.)
- Language
- Publication year
- Location
- Availability status

### Configuring Facets

Facets are configured in the admin panel at **Admin → Search Configuration** (`/admin/search-config`).

#### Enable/Disable Facets Globally

In the "Search Settings" tab:
- Toggle "Enable Facets" on/off
- Affects all search results pages

#### Configure Individual Facets

In the "Facets & Filters" tab:
1. Toggle each facet type on/off
2. Set maximum values to display
3. Choose sort order (by count or alphabetically)
4. Configure display style (checkbox list, date range, etc.)

#### Troubleshooting Facet Visibility

If facets don't appear:

1. **Check search configuration:**
   - Go to `/admin/search-config`
   - Verify "Enable Facets" is ON
   - Check individual facet toggles

2. **Check facet data:**
   - Facets only appear if results exist
   - Empty result sets won't show facets

3. **Database check:**
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM search_configuration WHERE is_active = true;
   SELECT * FROM facet_configuration WHERE is_enabled = true;
   ```

4. **Check facet configs exist:**
   - Should see configurations for: material_types, languages, publication_years, availability, locations

5. **Clear cache:**
   - In Search Configuration, click "Clear Facet Cache"
   - Forces recomputation of all facet values

---

## Database Tables

### site_settings

Stores all site configuration set via Admin UI.

**Key Columns:**
- `header_links` (JSONB): Array of navigation links
- `footer_text`, `footer_link_url`: Footer configuration
- `hero_title`, `hero_subhead`, `hero_image_url`: Hero section
- `metadata_*`: Favicon and icon paths
- `is_active` (BOOLEAN): Only one active config at a time

**Migration:** `migrations/028_site_settings.sql`

### search_configuration

Controls search behavior and facet display.

**Key Columns:**
- `enable_facets`: Master toggle for facets
- `enable_spell_correction`: Spell correction toggle
- `results_per_page`: Items per page
- `facet_*`: Individual facet toggles

**Migration:** `migrations/016_search_configuration.sql`

### facet_configuration

Defines individual facet settings.

**Key Columns:**
- `facet_key`: Unique identifier (e.g., "material_types")
- `facet_label`: Display name (e.g., "Material Type")
- `is_enabled`: Show/hide this facet
- `display_order`: Order in sidebar
- `max_items`: Limit displayed values

**Migration:** `migrations/018_faceted_search_configuration.sql`

---

## Common Tasks

### Task: Add a New Header Link

**Method 1: Admin UI**
1. Go to `/admin/site`
2. Scroll to "Header Navigation Links"
3. Click "Add Link"
4. Enter title and URL
5. Click "Save Settings"

**Method 2: Site Defaults**
1. Open `src/lib/siteDefaults.ts`
2. Add to `header.links` array:
   ```typescript
   { title: 'New Link', url: 'https://example.com' }
   ```
3. Save and restart server

### Task: Change Footer Text

**Method 1: Admin UI**
1. Go to `/admin/site`
2. Edit "Footer Text" field
3. Click "Save Settings"

**Method 2: Site Defaults**
1. Open `src/lib/siteDefaults.ts`
2. Change `footer.text` value
3. Save and restart server

### Task: Update Hero Image

**Method 1: Admin UI**
1. Go to `/admin/site`
2. Update "Hero Background Image URL"
3. Click "Save Settings"

**Method 2: Site Defaults**
1. Open `src/lib/siteDefaults.ts`
2. Change `hero.imageUrl` value
3. Save and restart server

### Task: Replace Favicon

1. Generate favicons at [favicon.io](https://favicon.io/) or similar tool
2. Upload files to repository root (or external CDN)
3. Update paths in Admin UI (`/admin/site`) OR in `siteDefaults.ts`
4. Browser cache may need clearing to see changes

### Task: Change Primary Color

1. Open `/static/global.css`
2. Find `--accent:` variable
3. Change color value (hex, rgb, or named color)
4. Save file
5. Reload browser

### Task: Enable/Disable Facets

1. Go to `/admin/search-config`
2. Click "Facets & Filters" tab
3. Toggle "Enable Facets" or individual facet types
4. Click "Save Configuration"
5. Test on `/catalog/search` results page

---

## Best Practices

1. **Always test in development first**
   - Changes via Admin UI affect production immediately
   - Test layout changes thoroughly

2. **Use Site Defaults for version control**
   - Commit `siteDefaults.ts` changes to git
   - Good for teams collaborating on configuration

3. **Document custom CSS**
   - Add comments when overriding default styles
   - Keep customizations minimal

4. **Backup database settings**
   - Export `site_settings` table periodically
   - Useful for disaster recovery

5. **Mobile testing**
   - Always test header/footer on mobile devices
   - Responsive design is built-in but verify

6. **Image optimization**
   - Compress hero images before uploading
   - Use WebP format for better performance
   - CDN recommended for external images

---

## Troubleshooting

### Header/Footer Not Appearing

1. Check `(public)/+layout.svelte` is rendering
2. Verify site settings loaded: check browser console logs
3. Check database: `SELECT * FROM site_settings WHERE is_active = true;`
4. Ensure defaults exist in `siteDefaults.ts`

### Admin UI Not Saving

1. Check authentication: must be logged in
2. Check browser console for API errors
3. Verify `/api/site-settings` endpoint exists
4. Check Supabase RLS policies

### CSS Changes Not Appearing

1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check file saved correctly
4. Verify CSS file path is correct

### Facets Not Showing

1. Go to `/admin/search-config`
2. Check "Enable Facets" is ON
3. Verify individual facet toggles
4. Check search has results (facets hidden on empty results)
5. Clear facet cache in admin

---

## Support

For issues or questions:
- Check this guide first
- Review `CLAUDE.md` for technical details
- Check migration files for database schema
- GitHub Issues for bug reports

---

**Last Updated:** January 2026
**Version:** 1.0
