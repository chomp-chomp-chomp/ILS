# Site Configuration System

## Overview

The Site Configuration System is the single source of truth for public-facing site customization, including:
- Custom header with logo and navigation links
- Custom footer with text and links
- Homepage information section with content and quick links
- Theme system with light/dark modes and per-page-type overrides

## Architecture

### Database

**Table**: `site_configuration`

The system uses a single active configuration row with the following structure:

```sql
CREATE TABLE site_configuration (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  
  -- Header
  header_enabled BOOLEAN,
  header_logo_url TEXT,
  header_links JSONB, -- [{ title, url, order }]
  
  -- Footer
  footer_enabled BOOLEAN,
  footer_text TEXT,
  footer_links JSONB, -- [{ title, url, order }]
  
  -- Homepage Info
  homepage_info_enabled BOOLEAN,
  homepage_info_title TEXT,
  homepage_info_content TEXT,
  homepage_info_links JSONB, -- [{ title, url, order }]
  
  -- Theme
  theme_mode TEXT, -- 'system', 'light', 'dark'
  theme_light JSONB, -- { primary, secondary, accent, background, text, font }
  theme_dark JSONB,
  page_themes JSONB -- { home: {...}, search_results: {...}, etc. }
);
```

### Server-Side Loading

**File**: `src/lib/server/siteConfig.ts`

Provides:
- `defaultSiteConfig`: Safe fallback configuration
- `loadActiveSiteConfig(supabase)`: Loads active configuration with graceful error handling

The configuration is loaded in the root layout server load function (`src/routes/+layout.server.ts`) and passed to all pages as `data.siteConfig`.

### Public Rendering

**Files**: 
- `src/routes/+layout.svelte` - Renders header/footer, applies theme
- `src/routes/+page.svelte` - Renders homepage info section

The layout component:
1. Reads `siteConfig` from page data
2. Applies conditional rendering for header/footer based on `*_enabled` flags
3. Calculates active theme (light/dark) based on system preference and manual override
4. Applies page-type-specific theme overrides
5. Provides theme toggle button that persists to localStorage

### Theme System

#### Theme Modes
- **system**: Automatically detects user's OS preference (light/dark)
- **light**: Forces light theme
- **dark**: Forces dark theme

Users can override any mode with the theme toggle button (☀️/🌙/🔄):
- ☀️ = Manual light mode
- 🌙 = Manual dark mode
- 🔄 = System preference

#### Theme Tokens

Each theme (light/dark) includes these tokens:
- `primary`: Main brand color (used for headers, buttons)
- `secondary`: Secondary accent color
- `accent`: Tertiary accent color
- `background`: Page background color
- `text`: Main text color
- `font`: Font family stack

#### Per-Page-Type Overrides

The system supports theme customization for specific page types:
- `home` - Homepage (/)
- `search_results` - Search results page
- `search_advanced` - Advanced search page
- `catalog_browse` - Browse catalog page
- `record_details` - Individual record detail pages
- `public_default` - Fallback for all other public pages

Page-type overrides merge with the base theme (light or dark), allowing selective customization.

### Admin Interface

**URL**: `/admin/site-config`

**Files**:
- `src/routes/admin/site-config/+page.server.ts` - Loads current configuration
- `src/routes/admin/site-config/+page.svelte` - Admin UI

**Features**:
- Tabbed interface (Header / Footer / Homepage Info / Theme)
- Link management with drag-and-drop ordering
- Visual color pickers for theme tokens
- Per-page-type theme override editor
- Live save with validation
- Reset to last saved state

### API Endpoints

**URL**: `/api/site-config`

**Methods**:
- `GET` - Read active site configuration (public)
- `PUT` - Update site configuration (authenticated only)

**Request Body (PUT)**:
```json
{
  "header_enabled": true,
  "header_logo_url": "https://example.com/logo.png",
  "header_links": [
    { "title": "Catalog", "url": "/catalog", "order": 1 },
    { "title": "About", "url": "/about", "order": 2 }
  ],
  "footer_enabled": true,
  "footer_text": "© 2024 My Library",
  "footer_links": [
    { "title": "Privacy", "url": "/privacy", "order": 1 }
  ],
  "homepage_info_enabled": true,
  "homepage_info_title": "Welcome",
  "homepage_info_content": "Welcome to our catalog...",
  "homepage_info_links": [
    { "title": "New Arrivals", "url": "/new", "order": 1 }
  ],
  "theme_mode": "system",
  "theme_light": {
    "primary": "#e73b42",
    "secondary": "#667eea",
    "accent": "#2c3e50",
    "background": "#ffffff",
    "text": "#333333",
    "font": "system-ui, -apple-system, sans-serif"
  },
  "theme_dark": {
    "primary": "#ff6b72",
    "secondary": "#8b9eff",
    "accent": "#3d5a7f",
    "background": "#1a1a1a",
    "text": "#e5e5e5",
    "font": "system-ui, -apple-system, sans-serif"
  },
  "page_themes": {
    "home": {
      "primary": "#ff0000"
    }
  }
}
```

## Usage

### Initial Setup

1. **Run Migration**: Apply `migrations/024_site_configuration.sql` in Supabase SQL Editor
2. **Verify Table**: Check that `site_configuration` table exists with default row
3. **Access Admin**: Navigate to `/admin/site-config`

### Enabling Header

1. Go to `/admin/site-config`
2. Click "Header" tab
3. Check "Enable Custom Header"
4. Enter logo URL (optional)
5. Add navigation links with title and URL
6. Click "Save Configuration"

### Enabling Footer

1. Go to `/admin/site-config`
2. Click "Footer" tab
3. Check "Enable Custom Footer"
4. Enter footer text
5. Add footer links (optional)
6. Click "Save Configuration"

### Configuring Homepage Info

1. Go to `/admin/site-config`
2. Click "Homepage Info" tab
3. Check "Enable Homepage Info Section"
4. Enter title (e.g., "Quick Links")
5. Enter content (plain text)
6. Add quick links (optional)
7. Click "Save Configuration"

### Customizing Theme

1. Go to `/admin/site-config`
2. Click "Theme" tab
3. Select theme mode (System/Light/Dark)
4. Click "☀️ Light Theme" or "🌙 Dark Theme" to edit
5. Adjust color tokens using color pickers or hex inputs
6. (Optional) Select page type and add per-page overrides
7. Click "Save Configuration"

## Technical Details

### Required Environment Variables

**SUPABASE_SERVICE_ROLE_KEY** (Recommended for production)

The site configuration system can optionally use the Supabase service role key for server-side reads. This is **strongly recommended** for production deployments to ensure reliable loading of site configuration even when Row Level Security (RLS) policies are strict.

**Why it's important:**
- Bypasses RLS restrictions for server-side configuration loads
- Ensures header/footer/theme render correctly for all users
- Prevents 500 errors when RLS policies are misconfigured
- Allows configuration to load even when database permissions are restrictive

**How to set it up:**

1. Get your service role key from Supabase Dashboard → Settings → API
2. Add to your `.env` file or deployment environment:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
3. In Vercel/production: Add to Environment Variables in project settings
4. The system will automatically use it when available

**Fallback behavior:**
- If `SUPABASE_SERVICE_ROLE_KEY` is not set, the system uses the regular Supabase client
- This works fine if RLS policies allow public read access to `site_configuration` table
- Without the service key, ensure the following RLS policy exists:
  ```sql
  CREATE POLICY "Public can view active site config"
    ON site_configuration FOR SELECT
    TO public
    USING (is_active = true);
  ```

**Diagnostic logging:**
- When loading site config, check server logs for:
  - `[getSiteConfigClient] Using SERVICE ROLE client` - Good! Using service key
  - `[getSiteConfigClient] Using FALLBACK client` - Warning: No service key, using regular client

### Graceful Fallbacks

The system is designed to never cause 500 errors. If the `site_configuration` table or active row is missing:
- Server-side: `loadActiveSiteConfig()` returns `defaultSiteConfig`
- API endpoints: Return defaults with 200 OK instead of throwing errors
- Client-side: Components use default values via `||` operators
- No header/footer is shown if not explicitly enabled

### Theme Application Flow

1. `+layout.server.ts` loads `siteConfig` from database
2. `+layout.svelte` receives `siteConfig` in page data
3. System theme is detected via `window.matchMedia('(prefers-color-scheme: dark)')`
4. Manual theme preference is loaded from `localStorage` if present
5. Current theme is calculated: `manualTheme || (theme_mode === 'system' ? systemTheme : theme_mode)`
6. Page type is determined from URL pathname
7. Active theme is computed: `baseTheme + pageOverrides`
8. CSS variables are injected into `<main>` element

### Performance Considerations

- Configuration is loaded once per page load (no reactivity needed)
- Theme calculation happens on mount (minimal overhead)
- CSS variables provide instant theme switching
- No external API calls for theme system

## Migration from Branding System

The site configuration system **replaces** branding for:
- Header (`show_header`, `header_links`, `logo_url`)
- Footer (`show_powered_by`, `footer_text`, `footer_links`)
- Homepage Info (`show_homepage_info`, `homepage_info_*`)

Branding remains for:
- Library name (`library_name`)
- Favicon (`favicon_url`)
- Custom CSS/HTML (`custom_css`, `custom_head_html`)
- Contact information (still in branding)
- Social media links (still in branding)

**Recommendation**: In the future, deprecate branding table and migrate all remaining fields to site_configuration.

## Troubleshooting

### Header/Footer Not Showing

**Check**:
1. Is `header_enabled` / `footer_enabled` set to `true`?
2. Are you on a public page (not `/admin/*`)?
3. Does active site configuration exist in database?
4. Check browser console for JavaScript errors

### Theme Not Changing

**Check**:
1. Is localStorage blocking theme preference?
2. Are CSS variables being applied? (Inspect `<main>` element styles)
3. Check that theme tokens are valid hex colors
4. Verify `theme_mode` is set correctly

### Admin Page Not Saving

**Check**:
1. Are you authenticated? (Check session)
2. Check browser console for API errors
3. Verify RLS policies allow authenticated UPDATE
4. Check Supabase logs for database errors

## Security

### Row Level Security (RLS)

**Public**: Can SELECT active configuration only (`is_active = true`)
**Authenticated**: Can SELECT all, INSERT, UPDATE, DELETE

### Admin Access

Admin pages are protected by:
1. Server-side authentication check in `+layout.server.ts`
2. API endpoints verify session before mutations
3. RLS policies enforce permissions at database level

### Input Validation

- Color values should be hex format (#rrggbb)
- URLs should be validated client-side
- Text content is plain text only (no HTML)
- JSONB fields are validated for structure

## Future Enhancements

- [ ] Import/export site configuration as JSON
- [ ] Theme preview pane in admin UI
- [ ] A/B testing for different configurations
- [ ] Multi-tenant support (multiple active configs)
- [ ] Scheduled configuration changes
- [ ] Configuration versioning and rollback
- [ ] Migration wizard from branding to site config
- [ ] Template library for popular themes
