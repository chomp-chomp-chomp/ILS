# CLAUDE.md - AI Assistant Development Guide

**Library Catalog System (ILS)** - Comprehensive documentation for AI assistants working on this codebase.

---

## Project Overview

This is an **Integrated Library System (ILS)** - a modern, full-featured library catalog system for small to medium-sized libraries, personal collections, or library schools. The system implements MARC21 bibliographic standards with a comprehensive feature set including cataloging, circulation, acquisitions, and serials management.

**Status**: Version 0.1.0-beta, Active Development
**Purpose**: Educational and small library use
**License**: MIT

---

## Tech Stack

### Core Technologies
- **Framework**: SvelteKit 5 (latest with runes: $state, $effect, $props)
- **Language**: TypeScript (strict mode enabled)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **Hosting**: Vercel
- **APIs**: OpenLibrary (bibliographic data), Library of Congress

### Key Dependencies
```json
{
  "@sveltejs/kit": "^2.49.1",
  "svelte": "^5.45.6",
  "@supabase/ssr": "^0.8.0",
  "@supabase/supabase-js": "^2.89.0",
  "typescript": "^5.9.3",
  "chart.js": "^4.5.1",
  "qrcode": "^1.5.4"
}
```

---

## Architecture Overview

### SvelteKit File-Based Routing

```
src/
├── routes/
│   ├── +layout.svelte              # Root layout
│   ├── +layout.server.ts           # Root server load (session)
│   ├── +page.svelte                # Homepage
│   ├── catalog/                    # Public OPAC
│   │   ├── search/                 # Search interface
│   │   ├── browse/                 # Browse by subjects
│   │   ├── record/[id]/            # Detail pages
│   │   └── my-lists/               # Reading lists
│   ├── admin/                      # Admin panel (protected)
│   │   ├── +layout.server.ts       # Auth guard
│   │   ├── cataloging/             # MARC cataloging
│   │   ├── circulation/            # Checkout/checkin
│   │   ├── acquisitions/           # Purchase orders
│   │   ├── serials/                # Periodicals
│   │   └── holdings/               # Item management
│   ├── api/                        # API endpoints
│   │   ├── reading-lists/          # List CRUD
│   │   ├── book-cover/             # Cover proxy
│   │   ├── shorten/                # URL shortener
│   │   └── subject-headings/       # Authority control
│   └── r/[code]/                   # Short URL redirects
├── lib/
│   ├── components/                 # Reusable components
│   ├── utils/                      # Utility functions
│   └── supabase.ts                 # Supabase client
└── hooks.server.ts                 # Global server hooks
```

### Key Architectural Patterns

#### 1. Server-Side Data Loading
```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ locals, params }) => {
  const supabase = locals.supabase;
  const { session } = await locals.safeGetSession();

  // Fetch data server-side
  const { data, error } = await supabase
    .from('marc_records')
    .select('*')
    .eq('id', params.id)
    .single();

  return { record: data };
};
```

#### 2. Client-Side Reactivity (Svelte 5 Runes)
```svelte
<script lang="ts">
  import { $state, $effect } from 'svelte';

  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log(`Count is ${count}`);
  });
</script>
```

#### 3. Authentication Guard
```typescript
// admin/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals, url }) => {
  const { session } = await locals.safeGetSession();

  if (!session && url.pathname !== '/admin/login') {
    throw redirect(303, '/admin/login');
  }

  return { session };
};
```

#### 4. API Endpoints
```typescript
// api/endpoint/+server.ts
export const GET: RequestHandler = async ({ locals, url }) => {
  const supabase = locals.supabase;
  // Handle request
  return json({ data });
};
```

---

## Database Schema

### Core Tables

#### 1. `marc_records` - Bibliographic Data
MARC21 bibliographic records with full-text search support.

**Key Fields**:
- `id` (UUID) - Primary key
- `isbn`, `issn` - Standard identifiers
- `title_statement` (JSONB) - Title, subtitle, statement of responsibility
- `main_entry_personal_name` (JSONB) - Author
- `publication_info` (JSONB) - Publisher, place, date
- `subject_topical` (JSONB[]) - Subject headings
- `summary` (TEXT) - Description
- `material_type` (VARCHAR) - book, serial, dvd, etc.
- `search_vector` (TSVECTOR) - Full-text search index
- `marc_json` (JSONB) - Complete MARC record

**Indexes**:
- GIN index on `search_vector` for full-text search
- Index on `isbn`, `control_number`, `material_type`

**Trigger**: Auto-updates `search_vector` on INSERT/UPDATE

#### 2. `holdings` - Physical Copies
Tracks individual copies and their locations.

**Key Fields**:
- `marc_record_id` (UUID) - FK to marc_records
- `barcode` (VARCHAR) - Unique identifier
- `call_number` (VARCHAR) - Shelving location
- `status` (VARCHAR) - available, checked_out, missing, damaged
- `location`, `sublocation` - Physical location
- `is_electronic` (BOOLEAN) - Electronic resource flag
- `url` (TEXT) - Electronic access URL

#### 3. `serials` - Periodicals
Manages journal/magazine subscriptions.

**Key Fields**:
- `marc_record_id` (UUID) - FK to marc_records
- `title`, `issn` - Serial identification
- `frequency` (VARCHAR) - publishing frequency
- `format` (VARCHAR) - print, electronic, email_newsletter
- `subscription_start/end` (DATE) - Subscription period
- `is_active` (BOOLEAN) - Current subscription status

#### 4. `serial_issues` - Individual Issues
Tracks receipt of serial issues.

**Key Fields**:
- `serial_id` (UUID) - FK to serials
- `volume`, `issue_number` - Issue identification
- `issue_date`, `expected_date` - Dates
- `checked_in` (BOOLEAN) - Receipt status

#### 5. `patrons` - Library Users
Patron accounts for circulation.

#### 6. `checkouts` - Circulation Transactions
Tracks borrowed items.

#### 7. `orders`, `invoices`, `vendors` - Acquisitions
Purchase order and invoice management.

#### 8. `cataloging_templates` - Cataloging Templates
Reusable templates for common material types.

#### 9. `reading_lists` - Public Lists
User-created book lists.

#### 10. `short_urls` - URL Shortener
Shortened URLs for sharing searches/records.

### Row Level Security (RLS)

All tables use Supabase RLS:
- **Public read**: All catalog data readable by `anon` and `authenticated`
- **Admin write**: Only `authenticated` users can INSERT/UPDATE/DELETE
- **Future**: Role-based permissions (admin, cataloger, viewer)

---

## Development Workflows

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with Supabase credentials

# Run development server
npm run dev  # Runs on http://localhost:5173

# Type checking
npm run check

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Migrations

Located in `migrations/` directory:

```bash
migrations/
├── 003_acquisitions.sql
├── 004_items.sql
├── 005_circulation.sql
├── 006_reading_lists.sql
├── 007_cataloging_templates.sql
├── 008_receiving_enhancements.sql
├── 009_serials_management.sql
├── 010_spell_correction.sql
└── 011_short_urls.sql
```

**To apply migrations**:
1. Open Supabase SQL Editor
2. Copy migration SQL
3. Execute in order
4. Verify in Table Editor

### Git Workflow

**Branch Naming**: `claude/<feature-description>-<session-id>`

**Commit Messages**: Clear, descriptive
- Examples from history:
  - "Add short URL generation for shared searches"
  - "Add comprehensive accessibility improvements"
  - "Add spell correction with 'Did You Mean?' suggestions"

**Pull Requests**: Feature branches merged via PRs

**Important**: Always develop on designated feature branches, never push directly to main.

---

## Key Features & Implementation

### 1. MARC21 Cataloging

**Files**: `src/routes/admin/cataloging/`

**Features**:
- Manual MARC entry with all major fields
- ISBN lookup via OpenLibrary API
- Copy cataloging (duplicate records)
- Batch editing (bulk updates)
- MARC import/export (MARCXML format)
- Cataloging templates for common types
- Duplicate detection

**Key Functions**:
- ISBN normalization: Strip hyphens, validate format
- MARC parsing: JSONB fields for structured data
- Search indexing: Automatic tsvector updates

### 2. Public OPAC (Catalog Search)

**Files**: `src/routes/catalog/`

**Search Types**:
- **Simple Search**: Single query box, full-text search
- **Advanced Search**: Field-specific (title, author, subject, ISBN)
- **Boolean Operators**: AND/OR for multi-term queries
- **Faceted Navigation**: Filter by material type, language, location
- **Spell Correction**: "Did You Mean?" using trigram similarity

**Implementation**:
```typescript
// Search with full-text ranking
const query = supabase
  .from('marc_records')
  .select('*, holdings(*)')
  .textSearch('search_vector', searchTerm, {
    type: 'websearch',
    config: 'english'
  })
  .order('search_vector', { ascending: false });
```

### 3. Serials Management

**Files**: `src/routes/admin/serials/`

**Features**:
- Serial registration (journals, magazines, newsletters)
- Issue check-in with prediction
- Claims for missing issues
- Binding management
- Multiple formats (print, electronic, email)

**Frequency Patterns**: daily, weekly, monthly, quarterly, annual, irregular

### 4. Circulation System

**Files**: `src/routes/admin/circulation/`

**Features**:
- Patron management with barcode/ID
- Check-out/check-in with due dates
- Holds/reserves queue
- Overdue tracking
- Fine calculation
- Patron import (CSV bulk upload)

### 5. Acquisitions Module

**Files**: `src/routes/admin/acquisitions/`

**Features**:
- Purchase orders with line items
- Vendor management
- Budget tracking by fund
- Invoice receiving and matching
- Claims for late orders
- Financial reports

### 6. Spell Correction

**Files**: `migrations/010_spell_correction.sql`, search results page

**How It Works**:
1. PostgreSQL `pg_trgm` extension for trigram similarity
2. Compares query terms against catalog titles/authors/subjects
3. Suggests corrections for queries with <5 results
4. Multi-word query handling with confidence scoring
5. Minimum 40% similarity threshold

### 7. Short URLs & Sharing

**Files**: `src/routes/api/shorten/`, `src/routes/r/[code]/`

**Features**:
- Generate short codes for searches and records
- QR code generation for easy mobile sharing
- Permalink support for stable sharing
- Analytics tracking (future)

### 8. Accessibility Features

**Implementation**:
- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Font size adjustment
- Focus indicators

---

## Design System

### "Chomp Design System"

**Primary Color**: `#e73b42` (red accent)

**Spacing Scale**:
- 8px, 12px, 20px, 30px, 40px

**Border Radius**:
- Small: 4px
- Medium: 8px
- Large: 12px

**Button Styles**:
```css
.btn-primary {
  background: #e73b42;
  color: white;
  border-radius: 4px;
  padding: 8px 20px;
}

.btn-secondary {
  background: white;
  color: #333;
  border: 1px solid #ddd;
}

.btn-cancel {
  background: #666;
  color: white;
}
```

**Message Styles**:
```css
.message.success { background: #d4edda; border-color: #c3e6cb; }
.message.error { background: #f8d7da; border-color: #f5c6cb; }
.message.info { background: #d1ecf1; border-color: #bee5eb; }
```

**Card Layout**:
```css
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 20px;
}
```

---

## Common Development Tasks

### Adding a New Feature

1. **Create Feature Branch**:
   ```bash
   git checkout -b claude/feature-name-xxxxx
   ```

2. **Identify Route Location**:
   - Public feature → `src/routes/catalog/`
   - Admin feature → `src/routes/admin/`
   - API endpoint → `src/routes/api/`

3. **Create Files**:
   - `+page.svelte` - UI component
   - `+page.server.ts` - Server-side data loading (if needed)
   - `+page.ts` - Client-side data loading (if needed)

4. **Database Changes**:
   - Create migration in `migrations/NNN_feature_name.sql`
   - Update `DATABASE_SCHEMA.md` with new tables/fields
   - Apply migration in Supabase SQL Editor

5. **Test Locally**:
   ```bash
   npm run dev
   npm run check  # Type checking
   ```

6. **Commit & Push**:
   ```bash
   git add .
   git commit -m "Add feature description"
   git push -u origin claude/feature-name-xxxxx
   ```

### Querying the Database

**Pattern**: Always use `locals.supabase` in server-side code

```typescript
// Basic query
const { data, error } = await supabase
  .from('marc_records')
  .select('*')
  .eq('material_type', 'book')
  .limit(10);

// With joins
const { data } = await supabase
  .from('marc_records')
  .select(`
    *,
    holdings (
      id,
      barcode,
      status,
      location
    )
  `)
  .eq('id', recordId)
  .single();

// Full-text search
const { data } = await supabase
  .from('marc_records')
  .select('*')
  .textSearch('search_vector', query, {
    type: 'websearch',
    config: 'english'
  });

// Complex filters
const { data } = await supabase
  .from('marc_records')
  .select('*')
  .ilike('title_statement->>a', `%${term}%`)
  .in('material_type', ['book', 'ebook'])
  .order('created_at', { ascending: false });
```

### Adding a Database Migration

1. **Create Migration File**:
   ```bash
   # migrations/012_new_feature.sql
   ```

2. **Write SQL**:
   ```sql
   -- Create tables
   CREATE TABLE new_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     created_at TIMESTAMPTZ DEFAULT NOW(),
     -- fields...
   );

   -- Create indexes
   CREATE INDEX idx_new_table_field ON new_table(field);

   -- Enable RLS
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Public read access"
     ON new_table FOR SELECT
     TO anon, authenticated
     USING (true);
   ```

3. **Document in Schema**:
   - Update `DATABASE_SCHEMA.md`
   - Add table description and field definitions

4. **Apply Migration**:
   - Open Supabase SQL Editor
   - Execute SQL
   - Verify in Table Editor

### Working with MARC Records

**MARC21 Field Structure**:
```typescript
interface MARCRecord {
  // Control fields
  leader?: string;           // 24 characters
  control_number?: string;   // 001
  date_entered?: string;     // 008

  // Identifiers
  isbn?: string;             // 020
  issn?: string;             // 022

  // Main entries
  main_entry_personal_name?: {  // 100
    a: string;  // Personal name
    d?: string; // Dates
  };

  // Title
  title_statement: {         // 245
    a: string;  // Title
    b?: string; // Subtitle
    c?: string; // Statement of responsibility
  };

  // Publication
  publication_info?: {       // 260/264
    a?: string; // Place
    b?: string; // Publisher
    c?: string; // Date
  };

  // Subjects
  subject_topical?: Array<{  // 650
    a: string;  // Term
    v?: string; // Form
    x?: string; // General
    y?: string; // Chronological
    z?: string; // Geographic
  }>;

  // Full MARC for preservation
  marc_json?: object;
}
```

**Creating a MARC Record**:
```typescript
const record = {
  isbn: '9780062316097',
  title_statement: {
    a: 'Sapiens',
    b: 'A Brief History of Humankind',
    c: 'Yuval Noah Harari'
  },
  main_entry_personal_name: {
    a: 'Harari, Yuval Noah'
  },
  publication_info: {
    a: 'New York',
    b: 'Harper',
    c: '2015'
  },
  material_type: 'book',
  summary: 'The book surveys the history of humankind...'
};

const { data, error } = await supabase
  .from('marc_records')
  .insert(record)
  .select()
  .single();
```

---

## Important Conventions

### TypeScript Standards

1. **Strict Mode**: Always enabled
2. **Type Definitions**: Define interfaces for data structures
3. **Type Safety**: Use PageServerLoad, PageLoad, RequestHandler types
4. **Null Handling**: Check for errors from Supabase

```typescript
// Good
const { data, error } = await supabase.from('table').select();
if (error) throw error;
if (!data) return { items: [] };

// Bad
const { data } = await supabase.from('table').select();
// Assuming data exists
```

### Supabase Patterns

1. **Always use `locals.supabase`** in server code
2. **Check errors** from every query
3. **Use select()** to shape returned data
4. **Leverage RLS** instead of manual permission checks
5. **Use transactions** for multi-table operations

### Svelte 5 Runes

Use new runes syntax (not legacy reactivity):

```svelte
<!-- Good (Svelte 5) -->
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<!-- Bad (Legacy) -->
<script lang="ts">
  let count = 0;
  $: doubled = count * 2;  // Don't use this in new code
</script>
```

### Component Structure

```svelte
<script lang="ts">
  // 1. Imports
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  // 2. Props
  let { data }: { data: PageData } = $props();

  // 3. State
  let searchTerm = $state('');
  let results = $state<any[]>([]);

  // 4. Derived values
  let hasResults = $derived(results.length > 0);

  // 5. Effects
  $effect(() => {
    console.log('Search term changed:', searchTerm);
  });

  // 6. Functions
  async function handleSearch() {
    // Implementation
  }
</script>

<!-- 7. HTML -->
<div class="container">
  <!-- Content -->
</div>

<!-- 8. Styles -->
<style>
  .container {
    /* Scoped styles */
  }
</style>
```

### Error Handling

```typescript
// Server-side
export const load: PageServerLoad = async ({ locals }) => {
  try {
    const { data, error } = await locals.supabase
      .from('marc_records')
      .select('*');

    if (error) throw error;

    return { records: data };
  } catch (error) {
    console.error('Error loading records:', error);
    return { records: [], error: 'Failed to load records' };
  }
};

// Client-side
async function saveRecord() {
  try {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });

    if (!response.ok) throw new Error('Save failed');

    const data = await response.json();
    message = 'Record saved successfully';
  } catch (error) {
    console.error('Save error:', error);
    message = 'Error saving record';
  }
}
```

---

## Testing & Quality Assurance

### Before Committing

1. **Type Check**: `npm run check`
2. **Test in Browser**: Verify feature works
3. **Test Authentication**: Check both logged-in and logged-out states
4. **Check Responsive**: Test mobile/tablet layouts
5. **Console Errors**: Check browser console for errors
6. **Database**: Verify data saves correctly in Supabase

### Common Issues

**Issue**: "Cannot find module '$env/static/public'"
**Solution**: Run `npm run prepare` to sync SvelteKit

**Issue**: Supabase query returns empty
**Solution**: Check RLS policies in Supabase dashboard

**Issue**: "Session not found"
**Solution**: Verify authentication in `locals.safeGetSession()`

**Issue**: TypeScript errors on Svelte components
**Solution**: Restart TypeScript server in IDE

---

## Security Considerations

### Authentication

- **Admin Routes**: Protected by `+layout.server.ts` guards
- **Session Management**: Handled by Supabase Auth via cookies
- **Logout**: Clear session, redirect to login

### Authorization

- **RLS Policies**: Enforce read/write permissions at database level
- **API Endpoints**: Verify session before mutations
- **Client-Side**: Hide UI elements, but always enforce server-side

### Input Validation

- **SQL Injection**: Prevented by Supabase parameterized queries
- **XSS**: Svelte automatically escapes HTML
- **CSRF**: SvelteKit provides CSRF protection
- **User Input**: Validate on both client and server

### Best Practices

1. Never commit `.env` files
2. Use environment variables for secrets
3. Validate all user input
4. Check authentication on every protected route
5. Use HTTPS in production (Vercel provides this)
6. Sanitize file uploads (if implementing)
7. Rate limit API endpoints (future enhancement)

---

## Performance Optimization

### Database Queries

1. **Use Indexes**: All search fields should be indexed
2. **Limit Results**: Always use `.limit()` on queries
3. **Select Specific Fields**: Don't use `select('*')` if you only need a few fields
4. **Pagination**: Implement offset/limit for large result sets

```typescript
// Good
const { data } = await supabase
  .from('marc_records')
  .select('id, title_statement, isbn')
  .range(offset, offset + limit - 1);

// Bad
const { data } = await supabase
  .from('marc_records')
  .select('*');  // Returns all fields for all records
```

### Full-Text Search

- Use `textSearch()` on indexed `search_vector` column
- Leverage PostgreSQL's built-in ranking
- Cache frequent searches (future enhancement)

### Client-Side

1. **Lazy Loading**: Load images on demand
2. **Debounce Search**: Wait for user to stop typing
3. **Virtual Scrolling**: For long lists (future enhancement)
4. **Code Splitting**: SvelteKit does this automatically

---

## Deployment

### Vercel (Production)

**Auto-Deploy**: Pushes to main branch automatically deploy

**Environment Variables** (set in Vercel dashboard):
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional)

**Build Settings**:
- Framework: SvelteKit
- Build Command: `npm run build`
- Output Directory: `.svelte-kit` (auto-detected)
- Install Command: `npm install`

### Supabase (Database)

**Free Tier Limits**:
- 500MB database storage
- 50,000 monthly active users
- 2GB file storage
- Daily backups

**Connection**:
- PostgreSQL connection via Supabase client
- Row Level Security enforced
- Realtime subscriptions available (not currently used)

### Custom Domain

Can be configured in Vercel dashboard (Settings → Domains)

---

## Troubleshooting Guide

### "Module not found" errors
```bash
npm install
npm run prepare
```

### Database connection issues
1. Check environment variables in `.env`
2. Verify Supabase project is active
3. Check RLS policies allow access
4. Look at Supabase logs

### TypeScript errors
```bash
npm run check
# Fix reported errors
```

### Authentication loops
1. Clear browser cookies
2. Check `hooks.server.ts` is correct
3. Verify session in Supabase Auth dashboard

### Build failures on Vercel
1. Check build logs for specific error
2. Verify environment variables are set
3. Test build locally: `npm run build`
4. Check all imports are correct

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run check            # Type checking
npm run check:watch      # Watch mode type checking

# Git
git status               # Check status
git add .                # Stage all changes
git commit -m "message"  # Commit changes
git push                 # Push to remote
git log --oneline -10    # View recent commits

# Supabase (if using CLI)
supabase login           # Authenticate
supabase db push         # Push migrations
supabase db reset        # Reset database (dev only)
```

---

## Documentation Files

- **README.md** - Project overview and quick start
- **DATABASE_SCHEMA.md** - Complete database schema with SQL
- **DEPLOYMENT.md** - Step-by-step deployment guide
- **CATALOGING_FEATURES.md** - Advanced cataloging features
- **SPELL_CORRECTION.md** - Spell correction implementation
- **ACQUISITIONS_SCHEMA.md** - Acquisitions module documentation
- **migrations/** - SQL migration files

---

## Future Enhancements

### Planned Features
1. **Binary MARC Support** - Import/export .mrc files
2. **Authority Control** - Name and subject authority files
3. **Enhanced Reporting** - Statistical reports, charts
4. **Patron Self-Service** - Account management, hold requests
5. **Mobile App** - React Native companion app
6. **API Access** - RESTful API for external integrations
7. **LDAP Integration** - Enterprise authentication
8. **Multilingual Support** - i18n for interface
9. **Z39.50 Client** - Search external library catalogs
10. **RFID Support** - Self-checkout stations

### Technical Debt
- Add comprehensive test suite (Vitest, Playwright)
- Implement caching layer (Redis)
- Add monitoring/logging (Sentry)
- Performance profiling
- Accessibility audit

---

## Key Takeaways for AI Assistants

### When Working on This Codebase:

1. **Always check authentication** on admin routes
2. **Use TypeScript types** from `./$types` for page data
3. **Follow Svelte 5 runes syntax** ($state, $derived, $effect)
4. **Query via `locals.supabase`** in server code
5. **Handle errors** from all database queries
6. **Respect RLS policies** - they enforce security
7. **Match the design system** - use existing styles
8. **Test with real data** - import sample MARC records
9. **Update migrations** when changing schema
10. **Document new features** in appropriate .md files

### Common Patterns:

```typescript
// Server-side data loading
export const load: PageServerLoad = async ({ locals, params }) => {
  const { data, error } = await locals.supabase
    .from('table')
    .select('*')
    .eq('id', params.id);

  if (error) throw error;
  return { data };
};

// Client-side state
let items = $state<Item[]>([]);
let loading = $state(false);

// Form handling
async function handleSubmit() {
  loading = true;
  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    // Handle response
  } catch (error) {
    // Handle error
  } finally {
    loading = false;
  }
}
```

### Don't:
- Use legacy Svelte reactivity (`$:`)
- Bypass RLS policies
- Commit sensitive data
- Skip type checking
- Ignore error handling
- Create global state unnecessarily

### Do:
- Write type-safe code
- Follow existing patterns
- Test authentication flows
- Use meaningful commit messages
- Document complex logic
- Keep components focused

---

## Support & Resources

### Documentation
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Docs](https://svelte.dev/docs/svelte/overview)
- [Supabase Docs](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MARC 21 Format](https://www.loc.gov/marc/bibliographic/)

### Project Documentation
All documentation is in the repository root and `migrations/` directory.

---

**Last Updated**: 2025-12-29
**Version**: 1.0
**Maintained By**: Development team via GitHub

This document is designed to help AI assistants understand the codebase structure, conventions, and best practices. When in doubt, refer to existing code patterns and this documentation.
