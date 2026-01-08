# Homepage Hero and Site Metadata Assets Implementation

## Overview

This implementation extends the `site_configuration` system to add two major features:

1. **Homepage Hero Section** - Customizable hero banner with image, title, tagline, and call-to-action links
2. **Site Metadata Asset URLs** - Centralized management of favicon, Open Graph images, Twitter cards, and app icons

## Migration Files

### 026_add_homepage_hero_to_site_config.sql

Adds the following columns to the `site_configuration` table:

- `homepage_hero_enabled` (BOOLEAN, default false) - Toggle hero section on/off
- `homepage_hero_title` (TEXT, default '') - Main hero title
- `homepage_hero_tagline` (TEXT, default '') - Hero subtitle/tagline
- `homepage_hero_image_url` (TEXT, nullable) - URL to hero background image
- `homepage_hero_links` (JSONB, default '[]') - Array of call-to-action links with title, url, and order

### 027_add_metadata_assets_to_site_config.sql

Adds the following columns to the `site_configuration` table:

- `favicon_url` (TEXT, nullable) - Main favicon (overrides branding if set)
- `apple_touch_icon_url` (TEXT, nullable) - iOS home screen icon (180x180)
- `android_chrome_192_url` (TEXT, nullable) - Android icon (192x192)
- `android_chrome_512_url` (TEXT, nullable) - Android icon (512x512)
- `og_image_url` (TEXT, nullable) - Open Graph image for social sharing (1200x630 recommended)
- `twitter_card_image_url` (TEXT, nullable) - Twitter card image (fallback to OG image if empty)

## Code Changes

### 1. src/lib/server/siteConfig.ts

Updated `defaultSiteConfig` to include all new fields with appropriate defaults:

```typescript
export const defaultSiteConfig = {
  // ... existing fields ...
  
  // Homepage hero
  homepage_hero_enabled: false,
  homepage_hero_title: '',
  homepage_hero_tagline: '',
  homepage_hero_image_url: null,
  homepage_hero_links: [],

  // Site metadata assets
  favicon_url: null,
  apple_touch_icon_url: null,
  android_chrome_192_url: null,
  android_chrome_512_url: null,
  og_image_url: null,
  twitter_card_image_url: null,
  
  // ... existing theme fields ...
};
```

### 2. src/routes/admin/site-config/+page.svelte

Added two new tabs to the admin interface:

#### "Homepage Hero" Tab

Allows staff to:
- Enable/disable hero section
- Set hero title and tagline
- Specify hero background image URL
- Add/remove/order call-to-action links

#### "Metadata" Tab

Allows staff to configure:
- Favicon URLs (with helpful guidance on dimensions)
- Apple touch icon
- Android Chrome icons (192x192 and 512x512)
- Open Graph image for social sharing
- Twitter card image (with automatic fallback to OG image)

All fields include help text explaining their purpose and recommended dimensions.

### 3. src/routes/+page.svelte

Enhanced homepage to display hero section when enabled:

- Shows hero section above search box if `homepage_hero_enabled` is true
- Displays hero background image via inline style if URL provided
- Renders hero title and tagline with gradient overlay for readability
- Displays call-to-action link buttons in horizontal layout
- Fully responsive with mobile-optimized styles

CSS features:
- Gradient overlay over background image for text readability
- Large, bold typography for hero title (3rem, scales to 2rem mobile)
- Clickable link buttons with hover effects
- Absolute positioned admin link when hero is shown

### 4. src/routes/+layout.svelte

Updated `<svelte:head>` section to use new metadata URLs:

```svelte
<svelte:head>
  <!-- Favicon with fallback to branding -->
  <link rel="icon" href={effectiveFaviconUrl} />
  
  <!-- Apple Touch Icon -->
  {#if siteConfig.apple_touch_icon_url}
    <link rel="apple-touch-icon" href={siteConfig.apple_touch_icon_url} />
  {/if}
  
  <!-- Android Chrome Icons -->
  {#if siteConfig.android_chrome_192_url}
    <link rel="icon" type="image/png" sizes="192x192" href={siteConfig.android_chrome_192_url} />
  {/if}
  {#if siteConfig.android_chrome_512_url}
    <link rel="icon" type="image/png" sizes="512x512" href={siteConfig.android_chrome_512_url} />
  {/if}
  
  <!-- Open Graph Tags -->
  {#if effectiveOgImage}
    <meta property="og:image" content={effectiveOgImage} />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
  {/if}
  
  <!-- Twitter Card Tags -->
  {#if effectiveTwitterImage}
    <meta name="twitter:image" content={effectiveTwitterImage} />
  {/if}
  
  <!-- ... existing custom HTML and CSS ... -->
</svelte:head>
```

Added derived values for fallback logic:
- `effectiveFaviconUrl` - Uses siteConfig.favicon_url, falls back to branding.favicon_url, then to static favicon
- `effectiveOgImage` - Uses siteConfig.og_image_url
- `effectiveTwitterImage` - Uses siteConfig.twitter_card_image_url, falls back to siteConfig.og_image_url

### 5. src/routes/api/site-config/+server.ts

**No changes required!** The existing API already handles all fields transparently via the spread operator:

```typescript
await supabase
  .from('site_configuration')
  .update({
    ...config,  // All fields including new ones are automatically included
    updated_by: session.user.id,
    updated_at: new Date().toISOString()
  })
```

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **All new columns are nullable or have defaults** - Existing records continue to work
2. **Favicon fallback** - If siteConfig.favicon_url is null, system falls back to branding.favicon_url, then to static favicon
3. **Twitter image fallback** - Automatically uses OG image if Twitter-specific image not provided
4. **Hero section is opt-in** - Disabled by default, doesn't affect existing homepages
5. **API is transparent** - Existing API code handles new fields automatically

## Usage Instructions

### Setting Up Homepage Hero

1. Go to `/admin/site-config`
2. Click the "Homepage Hero" tab
3. Check "Enable Homepage Hero Section"
4. Fill in:
   - Hero Title (e.g., "Welcome to Our Library")
   - Hero Tagline (e.g., "Discover, Learn, Grow")
   - Hero Background Image URL (e.g., https://example.com/hero.jpg)
5. Add call-to-action links:
   - Enter link title and URL
   - Click "Add" button
   - Links display in order added
6. Click "Save Configuration"
7. Visit homepage to see hero section

### Configuring Site Metadata

1. Go to `/admin/site-config`
2. Click the "Metadata" tab
3. Fill in URLs for:
   - **Favicon**: Main site icon (typically .ico or .png)
   - **Apple Touch Icon**: 180x180 PNG for iOS home screens
   - **Android Icons**: 192x192 and 512x512 PNGs
   - **Open Graph Image**: 1200x630 image for Facebook, LinkedIn sharing
   - **Twitter Card Image**: Image for Twitter shares (optional, uses OG image if empty)
4. Click "Save Configuration"
5. Check `<head>` in browser DevTools to verify tags are present

### Testing Social Sharing

After configuring OG/Twitter images:

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
   - Enter your site URL
   - Click "Scrape Again" to refresh
   - Verify og:image shows correctly

2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
   - Enter your site URL
   - Verify image displays

3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/
   - Enter your site URL
   - Check preview rendering

## Implementation Notes

### Hero Section Design Decisions

- **URL-only for images**: Keeps implementation simple and flexible
- **Gradient overlay**: Ensures text is readable regardless of background image
- **Responsive design**: Hero scales appropriately on mobile devices
- **Opt-in feature**: Doesn't disrupt existing homepage layouts

### Metadata Asset Decisions

- **Fallback chain for favicon**: siteConfig → branding → static file
- **Twitter auto-fallback to OG**: Reduces duplication for most use cases
- **No file upload**: URLs only to avoid storage complexity
- **Comprehensive meta tags**: Includes proper OG dimensions and types

### CSS Styling

Hero section CSS includes:
- Min-height of 400px for desktop presence
- Background-size: cover for image scaling
- Gradient overlay for text legibility (135deg, red to dark blue with 85% opacity)
- Large typography: 3rem title, 1.5rem tagline
- White text with text-shadow for enhanced readability
- Hover effects on CTA buttons (translateY, box-shadow)

## Future Enhancements

Potential improvements for future iterations:

1. **File upload support** - Allow uploading assets directly vs. URL-only
2. **Hero video backgrounds** - Support video URLs in addition to images
3. **Multiple hero slides** - Carousel/slider functionality
4. **Image optimization** - Auto-resize and optimize uploaded images
5. **Preview mode** - Live preview of hero section in admin interface
6. **Social sharing analytics** - Track how often links are shared
7. **A/B testing** - Test different hero variants
8. **Scheduled hero changes** - Rotate hero content automatically

## Testing Checklist

- [x] Migrations run without errors
- [x] Default config includes new fields
- [x] Admin UI renders hero and metadata tabs
- [x] Hero section displays when enabled
- [x] Hero title, tagline, image render correctly
- [x] Hero links are clickable and ordered
- [x] Favicon fallback works (null → branding → static)
- [x] OG meta tags present when image URL set
- [x] Twitter meta tags present with fallback
- [x] Android/Apple icon tags render when URLs provided
- [x] API saves new fields transparently
- [x] Build completes successfully
- [x] Responsive design works on mobile

## Deployment Steps

1. **Database**: Run migrations 026 and 027 in Supabase SQL Editor
2. **Code**: Deploy latest code to Vercel (automatic via PR merge)
3. **Verify**: Check admin interface has new tabs
4. **Test**: Enable hero section and add test content
5. **Social**: Configure OG/Twitter images and validate with debugging tools
6. **Document**: Update user documentation with new features

## Support and Troubleshooting

### Hero section not showing

- Check `homepage_hero_enabled` is true in site config
- Verify hero title or tagline is set (empty strings won't display)
- Check browser console for CSS errors

### Social sharing images not appearing

- Verify OG image URL is publicly accessible
- Check image dimensions (1200x630 recommended)
- Use Facebook debugger to force re-scrape
- Wait 5-10 minutes for social platforms to cache

### Favicon not updating

- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check `effectiveFaviconUrl` in DevTools
- Verify favicon_url is set in site config

### Admin interface doesn't save

- Check browser console for errors
- Verify user is authenticated
- Check network tab for failed API calls
- Ensure database has write permissions
