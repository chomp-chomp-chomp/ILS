# Site Configuration System

**Version**: 1.0  
**Date**: January 2026  
**Status**: Production Ready

## Overview

The **Site Configuration System** is a comprehensive solution for managing public-facing site content and theming, independent of the existing branding system. It provides a single source of truth for:

- Custom header navigation
- Footer content and links
- Homepage information section
- Light/dark theme system with per-page overrides

## Key Features

### 1. Header Configuration
- Enable/disable custom header on public pages
- Upload header logo
- Add/remove/reorder navigation links
- Links automatically sorted by order
- Theme toggle integrated into header

### 2. Footer Configuration
- Enable/disable footer on public pages
- Plain text footer content
- Add/remove/reorder footer links
- Shown only on non-admin routes

### 3. Homepage Info Section
- Enable/disable info section on homepage
- Customizable title and plain text content
- Add/remove/reorder quick links
- Alternative to default catalog description

### 4. Theme System
- **Three theme modes**: Light, Dark, System (auto-detect)
- **Theme toggle**: Cycles through light → dark → system
- **localStorage persistence**: User preference saved across sessions
- **System theme detection**: Respects `prefers-color-scheme` media query
- **Per-page overrides**: Different themes for different page types
- **CSS variable application**: Applies theme tokens as `--theme-*` variables

### 5. Page Type Detection
Automatically detects and applies page-specific theme overrides for:
- `home` - Homepage (/)
- `search_results` - Search results (/catalog/search/results)
- `search_advanced` - Advanced search (/catalog/search/advanced)
- `catalog_browse` - Browse page (/catalog/browse)
- `record_details` - Record detail pages (/catalog/record/*)
- `public_default` - All other public pages

## Database Schema

### Table: `site_configuration`

```sql
CREATE TABLE site_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,

  -- Header
  header_enabled BOOLEAN DEFAULT false,
  header_logo_url TEXT,
  header_links JSONB DEFAULT '[]'::jsonb,

  -- Footer
  footer_enabled BOOLEAN DEFAULT false,
  footer_text TEXT DEFAULT '',
  footer_links JSONB DEFAULT '[]'::jsonb,

  -- Homepage Info
  homepage_info_enabled BOOLEAN DEFAULT false,
  homepage_info_title TEXT DEFAULT '',
  homepage_info_content TEXT DEFAULT '',
  homepage_info_links JSONB DEFAULT '[]'::jsonb,

  -- Theme
  theme_mode TEXT DEFAULT 'system',
  theme_light JSONB DEFAULT '{}'::jsonb,
  theme_dark JSONB DEFAULT '{}'::jsonb,
  page_themes JSONB DEFAULT '{}'::jsonb
);
```

**Key Constraints:**
- Unique partial index ensures only one active configuration
- RLS policies allow public read of active config
- Authenticated users can view/edit all configs

### Default Theme Tokens

**Light Theme:**
```json
{
  "primary": "#e73b42",
  "secondary": "#667eea",
  "accent": "#2c3e50",
  "background": "#ffffff",
  "surface": "#f5f5f5",
  "text": "#333333",
  "text-muted": "#666666",
  "border": "#e0e0e0"
}
```

**Dark Theme:**
```json
{
  "primary": "#ff5a61",
  "secondary": "#7c8ffa",
  "accent": "#4a5f7f",
  "background": "#1a1a1a",
  "surface": "#2d2d2d",
  "text": "#e0e0e0",
  "text-muted": "#a0a0a0",
  "border": "#404040"
}
```

## API Endpoints

### GET /api/site-config
Returns the active site configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "header_enabled": false,
    "header_logo_url": null,
    "header_links": [],
    "footer_enabled": false,
    "footer_text": "",
    "footer_links": [],
    "homepage_info_enabled": false,
    "homepage_info_title": "",
    "homepage_info_content": "",
    "homepage_info_links": [],
    "theme_mode": "system",
    "theme_light": { /* theme tokens */ },
    "theme_dark": { /* theme tokens */ },
    "page_themes": { /* per-page overrides */ }
  }
}
```

**Error Handling:**
- Returns defaults if table doesn't exist (never crashes)
- Merges database data with defaults
- Safe for missing/partial data

### PUT /api/site-config
Updates the active site configuration (requires authentication).

**Request Body:**
```json
{
  "header_enabled": true,
  "header_logo_url": "https://example.com/logo.png",
  "header_links": [
    { "title": "Home", "url": "/", "order": 0 },
    { "title": "About", "url": "/about", "order": 1 }
  ],
  "footer_enabled": true,
  "footer_text": "Copyright © 2024",
  "footer_links": [
    { "title": "Privacy", "url": "/privacy", "order": 0 }
  ],
  "theme_mode": "system",
  "theme_light": { /* tokens */ },
  "theme_dark": { /* tokens */ }
}
```

**Response:**
```json
{
  "success": true,
  "config": { /* updated config */ }
}
```

**Authentication:**
- Requires valid session (authenticated user)
- Sets `updated_by` to current user ID
- Updates `updated_at` timestamp automatically

## Admin Interface

### Location
`/admin/site-config`

### Access
Accessible via **Admin → Configuration → Site Configuration**

### Interface Overview

The admin interface uses a **4-tab layout**:

#### 1. Header Tab
- **Enable Custom Header** - Toggle checkbox
- **Header Logo URL** - Text input for logo image
- **Header Links** - Dynamic list with:
  - Add new link (title + URL)
  - Reorder links (↑↓ buttons)
  - Remove links (🗑 button)

#### 2. Footer Tab
- **Enable Footer** - Toggle checkbox
- **Footer Text** - Textarea for main footer text
- **Footer Links** - Dynamic list (same controls as header)

#### 3. Homepage Info Tab
- **Enable Homepage Info Section** - Toggle checkbox
- **Section Title** - Text input
- **Section Content** - Textarea (plain text)
- **Homepage Links** - Dynamic list (same controls)

#### 4. Theme Tab
- **Default Theme Mode** - Dropdown (system/light/dark)
- **Light Theme Tokens** - JSON editor textarea
- **Dark Theme Tokens** - JSON editor textarea
- **Per-Page Theme Overrides** - Info message (advanced feature)

### User Flow
1. Navigate to `/admin/site-config`
2. Select desired tab
3. Configure settings
4. Click **Save Configuration**
5. Changes immediately reflected on public site

## Theme System

### Theme Toggle Component
**Location**: Header and navigation bars

**Behavior**:
- Displays current theme with icon
  - ☀️ Light mode
  - 🌙 Dark mode
  - 🌓 System mode
- Clicking cycles: light → dark → system → light
- Persists preference to `localStorage`
- Dispatches `themechange` event

### Theme Application
**Applied via CSS variables** prefixed with `--theme-*`:

```css
:root {
  --theme-primary: #e73b42;
  --theme-secondary: #667eea;
  --theme-accent: #2c3e50;
  --theme-background: #ffffff;
  --theme-surface: #f5f5f5;
  --theme-text: #333333;
  --theme-text-muted: #666666;
  --theme-border: #e0e0e0;
}
```

**Usage in components**:
```css
.element {
  background: var(--theme-background);
  color: var(--theme-text);
  border: 1px solid var(--theme-border);
}
```

### System Theme Detection
- Uses `window.matchMedia('(prefers-color-scheme: dark)')`
- Listens for system theme changes
- Automatically updates when system preference changes (if theme mode is 'system')

### Page-Specific Overrides
Theme tokens can be overridden per page type. For example:

```json
{
  "page_themes": {
    "search_results": {
      "light": {
        "primary": "#1976d2",
        "background": "#f0f4f8"
      },
      "dark": {
        "primary": "#64b5f6",
        "background": "#121212"
      }
    }
  }
}
```

This makes search results use a blue theme instead of red.

## TypeScript Types

### Core Types

```typescript
interface HeaderLink {
  title: string;
  url: string;
  order: number;
}

interface FooterLink {
  title: string;
  url: string;
  order: number;
}

interface HomepageInfoLink {
  title: string;
  url: string;
  order: number;
}

interface ThemeTokens {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  'text-muted'?: string;
  border?: string;
  [key: string]: string | undefined;
}

type PageType = 
  | 'home' 
  | 'search_results' 
  | 'search_advanced' 
  | 'catalog_browse' 
  | 'record_details' 
  | 'public_default';

interface SiteConfiguration {
  id?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  is_active?: boolean;

  header_enabled: boolean;
  header_logo_url: string | null;
  header_links: HeaderLink[];

  footer_enabled: boolean;
  footer_text: string;
  footer_links: FooterLink[];

  homepage_info_enabled: boolean;
  homepage_info_title: string;
  homepage_info_content: string;
  homepage_info_links: HomepageInfoLink[];

  theme_mode: 'system' | 'light' | 'dark';
  theme_light: ThemeTokens;
  theme_dark: ThemeTokens;
  page_themes: PageThemes;
}
```

### Utility Functions

```typescript
// Merge with defaults
mergeSiteConfig(data: Partial<SiteConfiguration> | null): SiteConfiguration

// Detect page type from pathname
getPageType(pathname: string): PageType

// Get merged theme tokens for page and mode
getMergedThemeTokens(
  config: SiteConfiguration,
  pageType: PageType,
  themeMode: 'light' | 'dark'
): ThemeTokens

// Safely coerce JSONB arrays
coerceToArray<T>(value: unknown): T[]

// Safely coerce JSONB objects
coerceToObject<T>(value: unknown, defaultValue: T): T
```

## Relationship to Branding System

### Site Configuration (New)
**Purpose**: Public site content and theming
- Header navigation
- Footer content
- Homepage info section
- Light/dark theme system

### Branding System (Existing)
**Purpose**: Visual identity and advanced customization
- Library name and tagline
- Logos (multiple contexts)
- Color palette (for components)
- Typography (fonts)
- Custom CSS/HTML
- Contact information
- Social media links
- Display preferences (covers, facets, items per page)

### Coexistence
- **No Conflicts**: Both systems work independently
- **Different Scopes**: Site config handles content/theming, branding handles identity/styling
- **Compatible**: Both can be enabled simultaneously
- **Header/Footer**: Now controlled by site config (not branding)
- **Homepage Info**: Now controlled by site config (not branding)

## Migration Instructions

### For Supabase Users

1. **Open Supabase SQL Editor**
2. **Run migration**: `migrations/026_site_configuration.sql`
3. **Verify table created**: Check Tables in Supabase Dashboard
4. **Verify default row**: Query `SELECT * FROM site_configuration WHERE is_active = true;`

### For Existing Sites

If you previously used branding for header/footer/homepage info:

1. **Save current settings** from branding configuration
2. **Run site configuration migration**
3. **Transfer settings** to site configuration via admin UI
4. **Test public pages** to ensure header/footer render correctly
5. **Optionally disable** old branding flags (they won't interfere)

## Usage Examples

### Enable Custom Header

1. Go to `/admin/site-config`
2. Click **Header** tab
3. Check **Enable Custom Header**
4. Enter **Header Logo URL**: `https://example.com/logo.png`
5. Add links:
   - Title: "Home", URL: "/", Order: 0
   - Title: "About", URL: "/about", Order: 1
   - Title: "Contact", URL: "/contact", Order: 2
6. Click **Save Configuration**
7. Visit public pages to see custom header

### Configure Light/Dark Themes

1. Go to `/admin/site-config`
2. Click **Theme** tab
3. Set **Default Theme Mode** to "system"
4. Edit **Light Theme Tokens**:
   ```json
   {
     "primary": "#1976d2",
     "background": "#ffffff",
     "text": "#212121"
   }
   ```
5. Edit **Dark Theme Tokens**:
   ```json
   {
     "primary": "#64b5f6",
     "background": "#121212",
     "text": "#e0e0e0"
   }
   ```
6. Click **Save Configuration**
7. Visit public site and use theme toggle to test

### Add Homepage Info Section

1. Go to `/admin/site-config`
2. Click **Homepage Info** tab
3. Check **Enable Homepage Info Section**
4. Enter **Section Title**: "Quick Access"
5. Enter **Section Content**: "Find resources, research guides, and help documentation."
6. Add links:
   - Title: "Research Guides", URL: "/guides", Order: 0
   - Title: "Help Center", URL: "/help", Order: 1
7. Click **Save Configuration**
8. Visit homepage to see info section

## Troubleshooting

### Configuration Not Loading
**Symptom**: Public pages show no header/footer  
**Solution**:
1. Check database table exists: `SELECT * FROM site_configuration;`
2. Verify active row: `WHERE is_active = true`
3. Check RLS policies allow public read
4. Review browser console for errors

### Theme Not Applying
**Symptom**: Colors don't change with theme toggle  
**Solution**:
1. Check localStorage has `theme` key
2. Verify CSS variables are applied to `:root`
3. Ensure component styles use `var(--theme-*)` variables
4. Check browser console for JavaScript errors

### Theme Toggle Not Working
**Symptom**: Clicking theme button does nothing  
**Solution**:
1. Check browser console for errors
2. Verify localStorage is accessible (not disabled)
3. Check `themechange` event listener is attached
4. Ensure `ThemeToggle` component is rendered

### Links Not Ordered Correctly
**Symptom**: Links appear in wrong order  
**Solution**:
1. Check `order` property on each link
2. Use admin UI to reorder with ↑↓ buttons
3. Save configuration
4. Hard refresh page (Ctrl+Shift+R)

### Migration Fails
**Symptom**: SQL errors when running migration  
**Solution**:
1. Check table doesn't already exist
2. Verify RLS is enabled on database
3. Run each CREATE statement individually
4. Check Supabase logs for detailed errors

## Performance Considerations

### Server-Side
- **Single query**: Load active config in layout (cached by SvelteKit)
- **Defensive coding**: Never crashes if table missing
- **Merged defaults**: Always returns complete config
- **No N+1 queries**: All data loaded at once

### Client-Side
- **localStorage**: Minimal overhead for theme persistence
- **CSS variables**: Performant theme switching (no re-render)
- **Event-based**: Theme changes propagate via custom events
- **Lazy evaluation**: Only applies theme when pathname changes

### Optimization Tips
1. **Keep link arrays small**: < 10 links per section
2. **Use simple theme tokens**: Avoid complex calculations
3. **Cache theme preference**: Reduce localStorage reads
4. **Minimize per-page overrides**: Use sparingly for specific pages

## Security

### RLS Policies
- **Public**: Can SELECT active configuration (read-only)
- **Authenticated**: Can SELECT all, UPDATE, INSERT (admin only)
- **No DELETE**: Prevents accidental config loss

### Input Validation
- **URLs**: Validated on server before saving
- **JSON**: Parsed safely with try/catch
- **Links**: Array length limited to prevent abuse
- **Theme tokens**: Validated as valid color values

### XSS Prevention
- **Plain text only**: No HTML in footer_text, homepage_info_content
- **URL sanitization**: Links validated before rendering
- **Svelte escaping**: Automatic HTML escaping in templates

## Future Enhancements

### Planned Features
1. **Rich text editor** for homepage content (TipTap integration)
2. **Image upload** for header logo (ImageKit integration)
3. **Link icons** (Font Awesome or custom)
4. **Footer columns** (multi-column footer layout)
5. **Theme preview** in admin (live preview pane)
6. **Import/export** configuration (JSON backup/restore)
7. **Theme presets** (pre-configured color schemes)
8. **Advanced overrides** (per-page theme editor UI)

### Community Contributions
See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Support

### Documentation
- **Main docs**: [README.md](./README.md)
- **API Reference**: [API.md](./API.md)
- **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)

### Issues
Report bugs or request features:
- **GitHub Issues**: [chomp-chomp-chomp/ILS/issues](https://github.com/chomp-chomp-chomp/ILS/issues)

### Questions
Ask questions in:
- **GitHub Discussions**: [chomp-chomp-chomp/ILS/discussions](https://github.com/chomp-chomp-chomp/ILS/discussions)

---

**Last Updated**: January 7, 2026  
**Version**: 1.0  
**License**: MIT
