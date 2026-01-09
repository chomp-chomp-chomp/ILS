# Homepage Hero, Typography, Footer, and Mobile Menu Implementation Guide

## Overview

This implementation addresses the problem statement by:
1. Consolidating duplicate hero sections
2. Adding configurable typography
3. Enhancing footer styling with configurable colors and structured links
4. Implementing a mobile hamburger menu with left drawer navigation
5. Consolidating admin entry points to a single floating button

## Changes Made

### 1. Database Migration: Typography and Footer Styling

**File**: `migrations/029_typography_and_footer_styling.sql`

Added the following columns to the `site_settings` table:

#### Typography Configuration:
- `typography_h1_size` - Default: '2.5rem'
- `typography_h2_size` - Default: '2rem'
- `typography_h3_size` - Default: '1.75rem'
- `typography_h4_size` - Default: '1.5rem'
- `typography_h5_size` - Default: '1.25rem'
- `typography_h6_size` - Default: '1rem'
- `typography_p_size` - Default: '1rem'
- `typography_small_size` - Default: '0.875rem'
- `typography_line_height` - Default: '1.6'

#### Footer Styling Configuration:
- `footer_background_color` - Default: '#2c3e50'
- `footer_text_color` - Default: 'rgba(255, 255, 255, 0.9)'
- `footer_link_color` - Default: 'rgba(255, 255, 255, 0.9)'
- `footer_link_hover_color` - Default: '#e73b42'
- `footer_padding` - Default: '2rem 0'
- `footer_links` - JSONB array for structured links

#### Hero Height Configuration:
- `hero_min_height` - Default: '250px' (reduced from 400px)
- `hero_mobile_min_height` - Default: '200px'

**To apply this migration:**
```sql
-- In Supabase SQL Editor
-- Copy and paste the contents of migrations/029_typography_and_footer_styling.sql
-- Execute the migration
```

### 2. Updated Type Definitions

**File**: `src/lib/siteDefaults.ts`

Extended the `SiteSettings` interface to include:
- Typography configuration with all heading and text sizes
- Extended footer configuration with colors, padding, and structured links
- Hero height configuration for desktop and mobile

### 3. Server-Side Settings Loader

**File**: `src/lib/server/siteSettings.ts`

Updated the `getSiteSettings()` function to:
- Parse and merge typography settings from database
- Parse and merge footer styling settings
- Parse and merge hero height settings
- Provide safe defaults for all new fields

### 4. New Components

#### HamburgerMenu Component

**File**: `src/lib/components/HamburgerMenu.svelte`

Features:
- Three-line hamburger icon positioned in top-left on mobile
- Left sliding drawer navigation
- Overlay backdrop that closes menu when clicked
- Smooth animations (slide-in from left)
- Prevents body scroll when menu is open
- Accessible (ARIA labels, keyboard support)
- Automatic close when link is clicked

**Usage:**
```svelte
<HamburgerMenu links={siteSettings.header.links} />
```

**Mobile Behavior:**
- Hamburger button shows only on screens ≤ 768px
- Desktop navigation links hide on mobile
- Drawer slides in from left over content
- Dark semi-transparent overlay behind drawer

#### FloatingAdminButton Component

**File**: `src/lib/components/FloatingAdminButton.svelte`

Features:
- Circular button fixed in bottom-right corner
- Settings gear icon
- Only visible to authenticated users
- Tooltip on hover ("Admin")
- Semi-transparent by default (85% opacity)
- Hover effects: full opacity, slight lift
- Responsive sizing (smaller on mobile)

**Usage:**
```svelte
<FloatingAdminButton show={isAuthenticated} />
```

**Visual Properties:**
- Size: 56px × 56px (desktop), 48px × 48px (mobile)
- Position: 2rem from bottom-right (1rem on mobile)
- Color: Primary color background with white icon
- z-index: 900 (below modals, above content)

### 5. Public Layout Updates

**File**: `src/routes/(public)/+layout.svelte`

#### Typography CSS Variables

Typography is now applied globally via CSS variables in the `<svelte:head>`:

```css
:root {
  --typography-h1-size: {siteSettings.typography?.h1Size};
  --typography-h2-size: {siteSettings.typography?.h2Size};
  --typography-h3-size: {siteSettings.typography?.h3Size};
  --typography-h4-size: {siteSettings.typography?.h4Size};
  --typography-h5-size: {siteSettings.typography?.h5Size};
  --typography-h6-size: {siteSettings.typography?.h6Size};
  --typography-p-size: {siteSettings.typography?.pSize};
  --typography-small-size: {siteSettings.typography?.smallSize};
  --typography-line-height: {siteSettings.typography?.lineHeight};
}
```

These variables are then applied to all heading and paragraph elements globally:

```css
:global(h1) {
  font-size: var(--typography-h1-size, 2.5rem);
}
/* etc... */
```

#### Footer CSS Variables

Footer styling is also applied via CSS variables:

```css
:root {
  --footer-background-color: {siteSettings.footer?.backgroundColor};
  --footer-text-color: {siteSettings.footer?.textColor};
  --footer-link-color: {siteSettings.footer?.linkColor};
  --footer-link-hover-color: {siteSettings.footer?.linkHoverColor};
  --footer-padding: {siteSettings.footer?.padding};
}
```

#### Consolidated Hero Section

The hero is now rendered **only once** in the layout, on the homepage:

```svelte
{#if showHero}
  <section class="homepage-hero" style="background-image: url('{siteSettings.hero.imageUrl}');">
    <div class="hero-overlay">
      <div class="hero-content">
        <h1 class="hero-title">{siteSettings.hero.title}</h1>
        <p class="hero-tagline">{siteSettings.hero.subhead}</p>
      </div>
    </div>
  </section>
{/if}
```

**Key changes:**
- Removed admin link from hero (now using floating button)
- Hero only shows when `pathname === '/'` and hero image exists
- Uses configurable min-height from CSS variables
- Mobile responsive with reduced height

#### Enhanced Footer

Footer now supports structured links:

```svelte
{#if siteSettings.footer.links && siteSettings.footer.links.length > 0}
  <div class="footer-links">
    {#each siteSettings.footer.links.sort((a, b) => (a.order || 0) - (b.order || 0)) as link}
      <a href={link.url} class="footer-link">
        {link.title}
      </a>
    {/each}
  </div>
{:else if siteSettings.footer.link}
  <a href={siteSettings.footer.link} class="footer-link">
    {siteSettings.footer.text}
  </a>
{:else}
  <p class="footer-text">{siteSettings.footer.text}</p>
{/if}
```

#### Header with Hamburger Menu

Header now includes the hamburger menu component:

```svelte
<nav class="site-header">
  <div class="header-container">
    <!-- Hamburger Menu (Mobile) -->
    <HamburgerMenu links={siteSettings.header.links} />
    
    <!-- Desktop Links -->
    <div class="header-links">
      {#each siteSettings.header.links as link}
        <a href={link.url} class="header-link">{link.title}</a>
      {/each}
    </div>
    <button class="theme-toggle" onclick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  </div>
</nav>
```

**Mobile behavior:**
- Desktop links hidden on screens ≤ 768px
- Hamburger menu visible on screens ≤ 768px

### 6. Homepage Simplification

**File**: `src/routes/(public)/+page.svelte`

**Removed:**
- Duplicate hero section (using siteConfig.homepage_hero_*)
- All admin links (replaced by floating button)
- Complex conditional logic for multiple hero sources

**Simplified structure:**
```svelte
<div class="catalog-home">
  <section class="search-section">
    <div class="search-content">
      <!-- Logo -->
      <!-- Tagline -->
      <!-- Search box -->
      <!-- Quick links -->
      <!-- Catalog info -->
    </div>
  </section>
</div>
```

**Key improvements:**
- No duplicate rendering of hero image/text
- Cleaner, more maintainable code
- Consistent typography using CSS variables
- Better vertical spacing
- Mobile-optimized layout

## Visual Comparison

### Before:
```
┌──────────────────────────────────────┐
│ [Admin Link]                         │
├──────────────────────────────────────┤
│                                      │
│    LARGE HERO IMAGE (400px)          │
│    Welcome Title                     │
│    Tagline                           │
│    [Admin Link Again]                │
│                                      │
├──────────────────────────────────────┤
│                                      │
│    Logo (rendered again!)            │
│    Search Box                        │
│    Catalog Info                      │
│                                      │
└──────────────────────────────────────┘
```

### After:
```
┌──────────────────────────────────────┐
│ [☰ Hamburger]  Home | Advanced Search│
├──────────────────────────────────────┤
│                                      │
│    HERO IMAGE (250px)                │
│    Welcome Title                     │
│    Tagline                           │
│                                      │
├──────────────────────────────────────┤
│                                      │
│    Logo                              │
│    Search Box                        │
│    Catalog Info                      │
│                                      │
├──────────────────────────────────────┤
│ Footer with Links                    │
│ [Link 1]  [Link 2]  [Link 3]        │
└──────────────────────────────────────┘
                            [⚙️] ← Floating Admin Button
```

## Configuration Guide

### Configuring Typography

Typography is configured in the `site_settings` table. To update typography:

```sql
UPDATE site_settings
SET 
  typography_h1_size = '3rem',      -- Larger h1
  typography_h2_size = '2.25rem',   -- Larger h2
  typography_p_size = '1.125rem',   -- Larger body text
  typography_line_height = '1.8'    -- More line spacing
WHERE id = 'default';
```

Or create an admin UI at `/admin/site-settings/typography` to edit these values.

### Configuring Footer

To configure footer styling:

```sql
UPDATE site_settings
SET 
  footer_background_color = '#1a1a1a',           -- Dark footer
  footer_text_color = 'rgba(255, 255, 255, 0.9)',
  footer_link_color = '#e73b42',                 -- Brand color links
  footer_link_hover_color = '#ff5a61',           -- Lighter on hover
  footer_padding = '3rem 0',                     -- More padding
  footer_links = '[
    {"title": "About", "url": "/about", "order": 1},
    {"title": "Contact", "url": "/contact", "order": 2},
    {"title": "Privacy", "url": "/privacy", "order": 3}
  ]'::jsonb
WHERE id = 'default';
```

### Configuring Hero Height

To adjust hero height:

```sql
UPDATE site_settings
SET 
  hero_min_height = '300px',          -- Taller hero
  hero_mobile_min_height = '250px'    -- Taller mobile hero
WHERE id = 'default';
```

## Mobile Responsive Behavior

### Breakpoint: 768px

**Desktop (> 768px):**
- Full header navigation bar with links
- Hero: 250px min-height (or configured value)
- Footer links in horizontal row
- Admin button: 56px × 56px, bottom-right 2rem

**Mobile (≤ 768px):**
- Hamburger menu button in header
- Desktop navigation links hidden
- Hero: 200px min-height (or configured value)
- Hero text scaled down (70% of h1 size, 80% of h3 size)
- Footer links stacked vertically
- Admin button: 48px × 48px, bottom-right 1rem

## Accessibility Improvements

1. **Hamburger Menu:**
   - `aria-label="Toggle navigation menu"`
   - `aria-expanded` state
   - `aria-hidden` on drawer when closed
   - Keyboard accessible
   - Focus trap when open (body scroll disabled)

2. **Floating Admin Button:**
   - `aria-label="Go to admin panel"`
   - Visible tooltip on hover
   - High contrast in focus state

3. **Typography:**
   - Consistent line-height for readability
   - Scalable font sizes (rem units)
   - Maintains hierarchy (h1 > h2 > h3, etc.)

4. **Footer Links:**
   - Semantic HTML (`<footer>`, `<nav>`)
   - Clear hover states
   - Sufficient color contrast

## Testing Checklist

- [ ] Homepage loads without duplicate hero
- [ ] Hero height is ~250px on desktop, ~200px on mobile
- [ ] Typography sizes apply correctly to all headings and paragraphs
- [ ] Typography is consistent between hero and body content
- [ ] Footer displays with configured colors
- [ ] Footer links render in correct order
- [ ] Footer link hover effect works
- [ ] Hamburger menu shows on mobile (≤768px)
- [ ] Hamburger menu opens left drawer
- [ ] Hamburger menu closes when clicking overlay
- [ ] Hamburger menu closes when clicking a link
- [ ] Desktop navigation links hide on mobile
- [ ] Floating admin button only shows to authenticated users
- [ ] Floating admin button positioned correctly (bottom-right)
- [ ] No admin links in hero or homepage header
- [ ] All text is readable on both light and dark themes
- [ ] Responsive behavior works at various screen sizes

## Future Enhancements

1. **Admin UI for Typography:**
   - Create `/admin/site-settings/typography` page
   - Live preview of typography changes
   - Reset to defaults button

2. **Admin UI for Footer:**
   - Create `/admin/site-settings/footer` page
   - Color pickers for footer colors
   - Drag-and-drop footer link ordering
   - Add/edit/delete footer links

3. **Hamburger Menu Animations:**
   - Animated hamburger icon (→ X)
   - Staggered link animations when drawer opens
   - Swipe gesture to close

4. **Hero Image Optimization:**
   - Lazy loading
   - Responsive image srcset
   - WebP format with fallback

5. **Typography Presets:**
   - "Compact" preset (smaller sizes)
   - "Large" preset (larger sizes for accessibility)
   - "Display" preset (dramatic heading sizes)

## Troubleshooting

### Hero still showing twice
- Check that `siteConfig.homepage_hero_enabled` is false in database
- Clear browser cache
- Check that `+page.svelte` doesn't have a hero section

### Typography not applying
- Ensure migration 029 has been run
- Check browser console for CSS variable errors
- Verify siteSettings is loaded in layout

### Hamburger menu not showing
- Check screen width is ≤768px
- Verify HamburgerMenu component is imported
- Check that header links exist in siteSettings

### Admin button not showing
- Verify user is authenticated (check `data.session`)
- Check z-index conflicts with other elements
- Ensure FloatingAdminButton component is imported

### Footer links not rendering
- Check `footer_links` JSONB format in database
- Verify links have `title`, `url`, and `order` fields
- Check that footer rendering logic includes links branch

## Summary

This implementation successfully addresses all requirements in the problem statement:

✅ **Homepage hero simplified** - Single hero source, no duplicates, reduced height
✅ **Typography configurable** - Per-element sizing via database and CSS variables
✅ **Footer styling enhanced** - Colors, padding, and structured links
✅ **Mobile hamburger menu** - Top-left position, left drawer navigation
✅ **Admin entry consolidated** - Single floating button, only for authenticated users

The implementation is minimal, follows existing patterns, and is fully SSR-safe.
