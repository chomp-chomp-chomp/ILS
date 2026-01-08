# Site Configuration System - Visual Guide

## Admin Interface Screenshots Guide

This guide explains what to look for when testing the admin interface.

---

## Admin Navigation

**Path**: Admin → Configuration → Site Configuration

The site configuration link appears in the Configuration section of the admin sidebar, above "Branding & Appearance".

---

## Tab 1: Header Configuration

### Layout
```
┌─────────────────────────────────────────────┐
│ [✓] Enable Custom Header                   │
│                                             │
│ Header Logo URL:                            │
│ [https://example.com/logo.png         ]    │
│                                             │
│ Header Links                                │
│ ┌─────────────────────────────────────┐    │
│ │ Home          https://example.com   │    │
│ │ [↑] [↓] [🗑]                        │    │
│ ├─────────────────────────────────────┤    │
│ │ About         /about                │    │
│ │ [↑] [↓] [🗑]                        │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ [Link Title       ] [URL          ] [Add]  │
└─────────────────────────────────────────────┘
```

### Features
- Toggle checkbox to enable/disable
- Text input for logo URL
- List of links with controls
- Add new link form at bottom
- Each link shows title and URL
- Up/down buttons to reorder
- Delete button (trash icon)

---

## Tab 2: Footer Configuration

### Layout
```
┌─────────────────────────────────────────────┐
│ [✓] Enable Footer                           │
│                                             │
│ Footer Text:                                │
│ ┌─────────────────────────────────────┐    │
│ │ Copyright © 2024 Your Library       │    │
│ │                                     │    │
│ │                                     │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Footer Links                                │
│ ┌─────────────────────────────────────┐    │
│ │ Privacy       /privacy              │    │
│ │ [↑] [↓] [🗑]                        │    │
│ ├─────────────────────────────────────┤    │
│ │ Terms         /terms                │    │
│ │ [↑] [↓] [🗑]                        │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ [Link Title       ] [URL          ] [Add]  │
└─────────────────────────────────────────────┘
```

### Features
- Toggle to enable/disable footer
- Multi-line textarea for footer text
- Same link management as header
- Plain text only (no HTML)

---

## Tab 3: Homepage Info

### Layout
```
┌─────────────────────────────────────────────┐
│ [✓] Enable Homepage Info Section            │
│                                             │
│ Section Title:                              │
│ [Quick Links                           ]    │
│                                             │
│ Section Content:                            │
│ ┌─────────────────────────────────────┐    │
│ │ Find resources, guides, and help.   │    │
│ │                                     │    │
│ │                                     │    │
│ │                                     │    │
│ │                                     │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Homepage Links                              │
│ ┌─────────────────────────────────────┐    │
│ │ Research Guides   /guides           │    │
│ │ [↑] [↓] [🗑]                        │    │
│ ├─────────────────────────────────────┤    │
│ │ Help Center       /help             │    │
│ │ [↑] [↓] [🗑]                        │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ [Link Title       ] [URL          ] [Add]  │
└─────────────────────────────────────────────┘
```

### Features
- Toggle to enable/disable section
- Title input (short text)
- Large textarea for content (plain text)
- Link management (same as header/footer)
- Shows on homepage below search box

---

## Tab 4: Theme

### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Default Theme Mode:                                     │
│ [System (Auto) ▼]                                       │
│                                                         │
│ ┌─────────────────────┬─────────────────────┐         │
│ │ Light Theme Tokens  │ Dark Theme Tokens   │         │
│ │ ┌─────────────────┐ │ ┌─────────────────┐ │         │
│ │ │ {               │ │ │ {               │ │         │
│ │ │   "primary":    │ │ │   "primary":    │ │         │
│ │ │     "#e73b42",  │ │ │     "#ff5a61",  │ │         │
│ │ │   "secondary":  │ │ │   "secondary":  │ │         │
│ │ │     "#667eea",  │ │ │     "#7c8ffa",  │ │         │
│ │ │   "background": │ │ │   "background": │ │         │
│ │ │     "#ffffff",  │ │ │     "#1a1a1a",  │ │         │
│ │ │   "text":       │ │ │   "text":       │ │         │
│ │ │     "#333333"   │ │ │     "#e0e0e0"   │ │         │
│ │ │ }               │ │ │ }               │ │         │
│ │ └─────────────────┘ │ └─────────────────┘ │         │
│ └─────────────────────┴─────────────────────┘         │
│                                                         │
│ Per-Page Theme Overrides                               │
│ ┌─────────────────────────────────────────────┐       │
│ │ Advanced: Configure specific overrides for  │       │
│ │ different page types. Edit in database or   │       │
│ │ future enhancement.                         │       │
│ └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Features
- Dropdown for default theme mode (system/light/dark)
- Side-by-side JSON editors
- Monospace font for code
- Info message about advanced overrides
- JSON validation on save

---

## Save Button

At the bottom of all tabs:

```
┌─────────────────────────────────────────────┐
│ [Save Configuration]  [Cancel]              │
└─────────────────────────────────────────────┘
```

### States
- **Normal**: Blue "Save Configuration" button
- **Saving**: "Saving..." with disabled state
- **Success**: Green message banner at top
- **Error**: Red message banner at top

---

## Public Site Appearance

### With Header Enabled

```
┌─────────────────────────────────────────────────────┐
│ [Logo]  Home  About  Contact         [☀️ Light]    │ ← Custom Header
└─────────────────────────────────────────────────────┘
│                                                     │
│                   Page Content                      │
│                                                     │
```

### With Footer Enabled

```
│                   Page Content                      │
│                                                     │
┌─────────────────────────────────────────────────────┐
│        Copyright © 2024 Your Library                │ ← Footer
│        Privacy | Terms | Contact                    │
└─────────────────────────────────────────────────────┘
```

### Homepage with Info Section

```
┌─────────────────────────────────────────────────────┐
│                   [Library Logo]                    │
│                Search our collection                │
│  ┌──────────────────────────────────────────────┐  │
│  │ [Search Box                              ] 🔍│  │
│  └──────────────────────────────────────────────┘  │
│       Advanced Search | Browse Collection          │
├─────────────────────────────────────────────────────┤
│                    Quick Links                      │ ← Info Section
│  Find resources, research guides, and help docs.   │
│  ┌──────────────┬──────────────┬──────────────┐   │
│  │Research Guide│ Help Center  │ Contact Us   │   │
│  └──────────────┴──────────────┴──────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Theme Toggle Component

### Appearance

**In Header:**
```
[☀️ Light]    or    [🌙 Dark]    or    [🌓 System]
```

**Mobile (icon only):**
```
[☀️]    or    [🌙]    or    [🌓]
```

### Click Behavior
1. **Light** (☀️) → Click → **Dark** (🌙)
2. **Dark** (🌙) → Click → **System** (🌓)
3. **System** (🌓) → Click → **Light** (☀️)

### Visual Feedback
- Smooth transition
- Icon changes immediately
- Colors fade in/out
- No page flash

---

## Success Messages

### After Saving

```
┌─────────────────────────────────────────────┐
│ ✓ Configuration saved successfully!         │ ← Green banner
└─────────────────────────────────────────────┘
```

### After Adding Link

```
┌─────────────────────────────────────────────┐
│ ✓ Header link added                         │ ← Green banner
└─────────────────────────────────────────────┘
```

### After Removing Link

```
┌─────────────────────────────────────────────┐
│ ✓ Footer link removed                       │ ← Green banner
└─────────────────────────────────────────────┘
```

---

## Error Messages

### Missing Required Field

```
┌─────────────────────────────────────────────┐
│ ✗ Title and URL are required                │ ← Red banner
└─────────────────────────────────────────────┘
```

### Invalid JSON

```
┌─────────────────────────────────────────────┐
│ ✗ Invalid JSON format                       │ ← Red banner
└─────────────────────────────────────────────┘
```

### Save Failed

```
┌─────────────────────────────────────────────┐
│ ✗ Failed to save configuration              │ ← Red banner
└─────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (> 768px)
- Side-by-side theme editors
- Full link controls visible
- All labels shown
- Spacious layout

### Mobile (≤ 768px)
- Stacked theme editors
- Vertical link forms
- Icon-only theme toggle
- Compact buttons

---

## Keyboard Navigation

All interactive elements are keyboard accessible:

- **Tab** - Move between fields
- **Enter** - Submit forms
- **Space** - Toggle checkboxes
- **Arrow keys** - Navigate lists (future enhancement)
- **Escape** - Close modals (if implemented)

---

## Color Scheme

### Primary Actions
- Save button: `#e73b42` (red)
- Add button: `#f5f5f5` (light gray)
- Links: `#e73b42` (red)

### Danger Actions
- Delete button: `#f8d7da` (light red background)
- Error messages: `#f8d7da` background, `#721c24` text

### Success States
- Success messages: `#d4edda` background, `#155724` text
- Confirmation icons: Green

### Neutral States
- Borders: `#e0e0e0`
- Disabled: `opacity: 0.4`
- Background: `#ffffff` (white)

---

## Common Patterns

### Link Item Structure
```
┌─────────────────────────────────────────────┐
│ Link Title          https://example.com     │
│ [↑] [↓] [🗑]                                │
└─────────────────────────────────────────────┘
```

- **Title**: Bold text
- **URL**: Gray, smaller text
- **Controls**: Right-aligned
- **Hover**: Light gray background

### Add Link Form
```
[Title          ] [URL               ] [Add Link]
```

- **Title**: Text input, flex: 1
- **URL**: URL input, flex: 1
- **Button**: Fixed width, secondary style

### Theme JSON Editor
```
┌─────────────────────────────────────────────┐
│ {                                           │
│   "primary": "#e73b42",                     │
│   "background": "#ffffff",                  │
│   "text": "#333333"                         │
│ }                                           │
└─────────────────────────────────────────────┘
```

- **Font**: Monospace (Monaco/Menlo)
- **Background**: `#f5f5f5` (light gray)
- **Border**: `#ddd`
- **Padding**: 1rem

---

## Testing Checklist

### Admin Interface
- [ ] Navigate to `/admin/site-config`
- [ ] All 4 tabs render correctly
- [ ] Checkboxes toggle on/off
- [ ] Text inputs accept text
- [ ] Add link buttons work
- [ ] Up/down buttons reorder
- [ ] Delete buttons remove links
- [ ] JSON editors accept valid JSON
- [ ] Save button works
- [ ] Success messages appear
- [ ] Error messages show for invalid data

### Public Site
- [ ] Custom header appears when enabled
- [ ] Header logo displays
- [ ] Header links render in order
- [ ] Footer appears when enabled
- [ ] Footer text displays
- [ ] Footer links render in order
- [ ] Homepage info section shows when enabled
- [ ] Homepage links render in order
- [ ] Theme toggle appears in header
- [ ] Clicking theme toggle changes theme
- [ ] Theme persists after refresh
- [ ] System theme respected

### Theme System
- [ ] Light theme applies correctly
- [ ] Dark theme applies correctly
- [ ] System theme detects OS preference
- [ ] CSS variables update on theme change
- [ ] Per-page overrides work (if configured)
- [ ] No flash on page load
- [ ] Smooth transitions

---

## Notes for Developers

### Where to Find Components
- **Admin UI**: `src/routes/admin/site-config/+page.svelte`
- **Theme Toggle**: `src/lib/components/ThemeToggle.svelte`
- **Theme Provider**: `src/lib/components/ThemeProvider.svelte`
- **Layout**: `src/routes/+layout.svelte`
- **Homepage**: `src/routes/+page.svelte`

### Styling Classes
- `.admin-container` - Main container
- `.tabs` - Tab navigation
- `.tab` - Individual tab button
- `.tab.active` - Active tab
- `.config-section` - Tab content wrapper
- `.form-group` - Form field group
- `.links-list` - List of links
- `.link-item` - Individual link row
- `.add-link-form` - Add link form
- `.theme-editors` - Theme editor grid
- `.code-editor` - JSON textarea
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.btn-icon` - Icon button
- `.btn-danger` - Danger button
- `.message.success` - Success message
- `.message.error` - Error message

### Custom Events
- `themechange` - Fired when theme toggle clicked
  - `event.detail` - New theme value ('light'|'dark'|'system')

---

**Last Updated**: January 7, 2026  
**Version**: 1.0
