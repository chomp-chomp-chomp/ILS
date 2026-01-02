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
│   ├── [slug]/                     # Dynamic WYSIWYG pages
│   ├── catalog/                    # Public OPAC
│   │   ├── search/                 # Search interface
│   │   ├── browse/                 # Browse by subjects
│   │   ├── record/[id]/            # Detail pages
│   │   └── my-lists/               # Reading lists
│   ├── admin/                      # Admin panel (protected)
│   │   ├── +layout.server.ts       # Auth guard
│   │   ├── cataloging/             # MARC cataloging
│   │   │   ├── authorities/        # Authority control
│   │   │   ├── batch/              # Batch operations
│   │   │   ├── covers/             # Cover management
│   │   │   └── templates/          # Cataloging templates
│   │   ├── circulation/            # Checkout/checkin
│   │   ├── acquisitions/           # Purchase orders
│   │   ├── serials/                # Periodicals
│   │   ├── ill/                    # Interlibrary Loan
│   │   ├── pages/                  # WYSIWYG page editor
│   │   ├── branding/               # Branding customization
│   │   ├── search-config/          # Search configuration
│   │   ├── display-config/         # Display configuration
│   │   └── holdings/               # Item management
│   ├── api/                        # API endpoints
│   │   ├── reading-lists/          # List CRUD
│   │   ├── book-cover/             # Cover proxy
│   │   ├── shorten/                # URL shortener
│   │   ├── authorities/            # Authority control
│   │   ├── branding/               # Branding config
│   │   ├── search-config/          # Search config
│   │   ├── display-config/         # Display config
│   │   └── attachments/            # Record attachments (CRUD + download)
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

#### 11. `authorities` - Authority Control
Name and subject authority records (LCNAF, LCSH, local).

#### 12. `authority_references` - Authority Links
Links between bibliographic records and authority records.

#### 13. `ill_partners` - ILL Partner Libraries
Partner library information for interlibrary loan.

#### 14. `ill_requests` - ILL Requests
Borrowing and lending requests between libraries.

#### 15. `pages` - WYSIWYG Content Pages
Editable content pages (homepage, about, help, etc.).

#### 16. `branding_configuration` - Branding Settings
Customizable branding, colors, and library information.

#### 17. `search_field_configuration` - Search Field Config
Customizable search field settings and behavior.

#### 18. `display_field_configuration` - Display Field Config
Customizable MARC field display settings.

#### 19. `cover_images` - Cover Image Management
Locally uploaded cover images for catalog records.

#### 20. `related_records` - Record Relationships
Links between related bibliographic records (series, editions, translations).

#### 21. `marc_attachments` - Record Attachments
External file attachments linked to MARC records (storage-agnostic system).

**Key Fields**:
- `marc_record_id` (UUID) - FK to marc_records
- `external_url` (TEXT) - Share link from external storage provider
- `external_expires_at` (TIMESTAMPTZ) - Optional expiration timestamp
- `file_metadata` (JSONB) - Title, description, MIME type, size, original filename
- `access_level` (VARCHAR) - public, authenticated, staff_only
- `sort_order` (INTEGER) - Display ordering
- `view_count`, `download_count` (INTEGER) - Analytics

**Access Control**: Staff-only insert/update/delete via RLS; read access enforces access_level

**Analytics**: Automatic view/download tracking, stats view per record

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
├── 011_short_urls.sql
├── 012_electronic_resources.sql
├── 013_related_records.sql
├── 014_wysiwyg_pages.sql
├── 015_branding_configuration.sql
├── 016_search_configuration.sql
├── 017_display_configuration.sql
├── 018_authority_control.sql
├── 018_batch_operations.sql
├── 018_book_cover_management.sql
├── 018_custom_cover_images.sql
├── 018_faceted_search_configuration.sql
├── 018_ill_module.sql
├── 019_patron_self_service.sql
├── 020_authority_control_enhancements.sql
└── 021_marc_attachments.sql
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

### 9. Authority Control

**Files**: `src/routes/admin/cataloging/authorities/`, `migrations/018_authority_control.sql`

**Features**:
- Name authority records (LCNAF - Library of Congress Name Authority File)
- Subject authority records (LCSH - Library of Congress Subject Headings)
- Local authority creation and management
- Authority linking to bibliographic records
- Variant form tracking (see/see also references)
- Authority record browsing and searching
- LC authority synchronization
- Global find/replace for authority corrections
- Authority usage reports

**Authority Types**:
- Personal names (100)
- Corporate names (110)
- Meeting names (111)
- Geographic names (151)
- Topical subjects (150)
- Genre/form terms (155)

**Key Functions**:
- Link bibliographic records to authority records
- Track variant forms and cross-references
- Maintain consistency across catalog
- Support batch authority updates

### 10. Interlibrary Loan (ILL)

**Files**: `src/routes/admin/ill/`, `migrations/018_ill_module.sql`

**Features**:
- Partner library management
- Borrowing requests (requesting materials from other libraries)
- Lending requests (fulfilling requests from other libraries)
- Request tracking and status management
- Due date and renewal tracking
- Shipping/delivery information
- ILL statistics and reporting
- Partner agreements and policies

**Request Statuses**: pending, requested, shipped, received, returned, cancelled

**Request Types**: loan, copy (article/chapter), returnables, non-returnables

**Delivery Methods**: mail, courier, electronic, pickup

### 11. WYSIWYG Content Pages

**Files**: `src/routes/admin/pages/`, `src/routes/[slug]/`, `migrations/014_wysiwyg_pages.sql`

**Features**:
- Rich text editor (TipTap) for content creation
- Dynamic page creation (About, Help, Contact, etc.)
- SEO fields (meta description, keywords)
- Menu management (show in menu, ordering)
- Page templates and layouts
- Draft/published workflow
- View tracking
- Image embedding

**Common Pages**: homepage, about, help, contact, policies, hours

### 12. Cover Image Management

**Files**: `src/routes/admin/cataloging/covers/`, `migrations/018_book_cover_management.sql`

**Features**:
- Upload custom cover images
- Automatic cover fetching from Open Library
- Cover image cropping and resizing
- Fallback to external sources (Open Library, Google Books)
- Cover quality management
- Bulk cover fetching
- Missing cover identification
- Cover replacement/updates

**Cover Sources**: local upload, Open Library API, Google Books API

### 13. Batch Operations

**Files**: `src/routes/admin/cataloging/batch/`, `migrations/018_batch_operations.sql`

**Features**:
- Bulk edit MARC records
- Batch field updates (material type, location, etc.)
- Global find/replace
- Batch deletion
- Batch export
- Batch authority linking
- Tag manipulation (add/remove/edit MARC tags)
- Progress tracking for long operations

**Common Batch Operations**:
- Update material types
- Change locations
- Fix publisher names
- Normalize ISBNs
- Apply authority headings

### 14. Related Records & Series

**Files**: `src/routes/admin/cataloging/[id]/related/`, `migrations/013_related_records.sql`

**Features**:
- Link related bibliographic records
- Series tracking and browsing
- Edition relationships
- Translation linking
- Format variations (print/ebook/audio)
- Part/whole relationships
- Reciprocal linking
- Series display on detail pages

**Relationship Types**: series, edition, translation, adaptation, related, part_of, has_part

### 15. Record Attachments (Storage-Agnostic)

**Files**: `src/routes/api/attachments/`, `src/routes/admin/cataloging/edit/[id]/`, `migrations/021_marc_attachments.sql`

**Features**:
- **External Storage Integration**: Links to files hosted on any provider (pCloud, S3, Google Drive, etc.)
- **No File Storage**: Stores only metadata and external share links, not file bytes
- **Expiration Management**: Optional expiration timestamps aligned with provider link expiry
- **Access Control**: Three levels - public, authenticated, staff-only
- **Analytics**: Automatic view and download counting
- **Proxied Downloads**: All downloads route through ILS for access control and analytics
- **File Metadata**: Title, description, MIME type, size, original filename
- **Ordering**: Staff-controlled display order with up/down controls

**API Endpoints**:
- `POST /api/attachments` - Create attachment metadata (staff-only)
- `PATCH /api/attachments/:id` - Update attachment (staff-only)
- `DELETE /api/attachments/:id` - Remove attachment (staff-only)
- `GET /api/attachments/record/:recordId` - List attachments for a record (increments views)
- `GET /api/attachments/:id/download` - Proxied download with expiry check (302 redirect)

**Public OPAC Integration**:
- Attachments section on record detail pages
- Inline image preview (proxied through download endpoint)
- Metadata display with size and status badges
- Expiring/expired indicators
- Downloads always use internal endpoint

**Admin Interface** (`/admin/cataloging/edit/[id]` - Attachments tab):
- Paste external share links from storage providers
- Set expiration dates to match provider link expiry
- Configure title, description, file type, size, access level
- Reorder attachments (up/down buttons)
- Refresh external URLs when provider links change
- Copy internal download URL for testing
- Status badges (valid/expired)
- View/download analytics display

**Typical Workflow**:
1. Staff creates expiring share link in external provider (e.g., pCloud presigned URL)
2. Staff pastes URL into admin Attachments form
3. Staff sets `external_expires_at` to match provider's expiry
4. Staff configures access level and metadata
5. Patrons/staff access files through ILS endpoints
6. ILS enforces access rules, tracks analytics, handles expiry
7. Downloads redirect to external provider (302) but log through ILS

**Use Cases**:
- Supplementary materials (teacher guides, answer keys)
- High-resolution images or maps
- Audio/video content too large for database
- Subscription content with time-limited access
- Course reserves with semester-based expiration
- Digital special collections

**Key Benefits**:
- Storage-agnostic (works with any provider)
- Cost-effective (no file storage in database)
- Access control remains in ILS
- Analytics captured regardless of storage provider
- Easy to update/replace external links
- Respects provider expiration policies

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
- **AUTHORITY_CONTROL.md** - Authority control system documentation
- **ILL_MODULE.md** - Interlibrary loan module guide
- **COVER_MANAGEMENT.md** - Cover image management guide
- **SERIES_AND_LINKING.md** - Related records and series documentation
- **USER_GUIDE.md** - End-user guide for patrons
- **migrations/** - SQL migration files

---

## Future Enhancements

### Recently Implemented Features
1. ✅ **Authority Control** - Name and subject authority files (LCNAF, LCSH)
2. ✅ **Interlibrary Loan** - Complete ILL borrowing/lending system
3. ✅ **WYSIWYG Pages** - Content management for custom pages
4. ✅ **Cover Management** - Upload and manage book covers
5. ✅ **Batch Operations** - Bulk editing capabilities
6. ✅ **Related Records** - Series and relationship linking
7. ✅ **Branding Customization** - UI-based branding configuration
8. ✅ **Search Configuration** - Customizable search fields and behavior
9. ✅ **Display Configuration** - Customizable field display
10. ✅ **Record Attachments** - Storage-agnostic external file linking with expiry and analytics

### Planned Features
1. **Binary MARC Support** - Import/export .mrc files
2. **Patron Self-Service Portal** - Account management, hold requests (in progress)
3. **Enhanced Reporting** - Statistical reports, charts
4. **Mobile App** - React Native companion app
5. **API Access** - RESTful API for external integrations
6. **LDAP Integration** - Enterprise authentication
7. **Multilingual Support** - i18n for interface
8. **Z39.50 Client** - Search external library catalogs
9. **RFID Support** - Self-checkout stations
10. **Analytics Dashboard** - Usage statistics and insights

### Technical Debt
- Add comprehensive test suite (Vitest, Playwright)
- Implement caching layer (Redis)
- Add monitoring/logging (Sentry)
- Performance profiling
- Accessibility audit

---

## Customization & Advanced Topics

### UI-Based Customization System

The ILS includes three comprehensive admin interfaces that allow librarians to customize the catalog's appearance and behavior without writing code. These features are accessible through the admin panel and store all configuration in the database.

#### Overview of Customization Features

1. **Branding Customization** (`/admin/branding`) - Control visual identity, colors, logos, and library information
2. **Search Configuration** (`/admin/search-config`) - Configure search fields, behavior, and facets
3. **Display Configuration** (`/admin/display-config`) - Control which MARC fields are displayed and how

All three systems share common features:
- Database-driven with sensible defaults
- Live preview of changes
- Row Level Security (RLS) for access control
- Single active configuration enforced by database triggers
- Audit trails (updated_by, updated_at timestamps)
- Reset functionality to revert changes

---

### 1. Branding Customization

**Location**: `/admin/branding`
**Migration**: `migrations/015_branding_configuration.sql`
**Database Table**: `branding_configuration`

#### Features

**Library Identity:**
- Library name (appears as page title)
- Tagline/subtitle
- Logo URL
- Favicon URL

**Color Scheme:**
- Primary color (main brand color, buttons)
- Secondary color (accent elements)
- Accent color (links, highlights)
- Background color
- Text color

**Typography:**
- Body font (CSS font-family)
- Heading font (optional, defaults to body font)

**Contact Information:**
- Email address
- Phone number
- Physical address

**Social Media:**
- Facebook URL
- Twitter/X URL
- Instagram URL

**Footer:**
- Custom footer text
- Toggle "Powered by" attribution

**Display Features:**
- Toggle book covers in results
- Toggle faceted search
- Items per page setting

**Advanced:**
- Custom CSS (inject your own styles)
- Custom HTML (head section - for analytics, fonts, etc.)

#### Database Schema

```sql
CREATE TABLE branding_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Library identity
  library_name VARCHAR(255) DEFAULT 'Library Catalog',
  library_tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,

  -- Color scheme
  primary_color VARCHAR(7) DEFAULT '#e73b42',
  secondary_color VARCHAR(7) DEFAULT '#667eea',
  accent_color VARCHAR(7) DEFAULT '#2c3e50',
  background_color VARCHAR(7) DEFAULT '#ffffff',
  text_color VARCHAR(7) DEFAULT '#333333',

  -- Typography
  font_family VARCHAR(255) DEFAULT 'system-ui, -apple-system, sans-serif',
  heading_font VARCHAR(255),

  -- Custom styling
  custom_css TEXT,
  custom_head_html TEXT,

  -- Footer
  footer_text VARCHAR(255) DEFAULT 'Powered by Open Library System',
  show_powered_by BOOLEAN DEFAULT true,

  -- Contact
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_address TEXT,

  -- Social media
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,

  -- Feature toggles
  show_covers BOOLEAN DEFAULT true,
  show_facets BOOLEAN DEFAULT true,
  items_per_page INTEGER DEFAULT 20,

  -- Active flag
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id)
);
```

#### Implementation Details

**Frontend Integration** (`src/routes/+layout.svelte` and `+layout.server.ts`):

The root layout loads the active branding configuration on every page:

```typescript
// +layout.server.ts
export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Fetch active branding configuration
  const { data: branding } = await supabase
    .from('branding_configuration')
    .select('*')
    .eq('is_active', true)
    .single();

  return {
    session,
    cookies: cookies.getAll(),
    branding: branding || null
  };
};
```

CSS variables are injected into the page:

```svelte
<!-- +layout.svelte -->
<main
  id="main-content"
  style="
    --primary-color: {branding.primary_color};
    --secondary-color: {branding.secondary_color};
    --accent-color: {branding.accent_color};
    --background-color: {branding.background_color};
    --text-color: {branding.text_color};
    --font-family: {branding.font_family};
    --heading-font: {branding.heading_font || branding.font_family};
  "
>
  {@render children()}
</main>
```

**API Endpoint** (`src/routes/api/branding/+server.ts`):

```typescript
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) throw error(401, 'Unauthorized');

  const config = await request.json();

  // Update or create branding configuration
  // Database trigger ensures only one active config
};
```

#### Usage

1. Navigate to `/admin/branding`
2. Modify colors using color pickers
3. Enter library name, logo URLs, contact info
4. Add custom CSS if needed
5. Preview changes in real-time in the right panel
6. Click "Save Changes"
7. Branding applies immediately across the entire site

#### Customization Examples

**Change primary color:**
```
1. Go to /admin/branding
2. Click the primary color picker
3. Select your brand color (e.g., #2c5aa0 for blue)
4. Click Save
5. All buttons and primary elements update immediately
```

**Add custom CSS:**
```css
/* In the Custom CSS field */
.btn-primary {
  border-radius: 20px;
  font-weight: bold;
  text-transform: uppercase;
}

.card {
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}
```

**Add Google Analytics:**
```html
<!-- In Custom HTML (Head) field -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

### 2. Search Form Customization

**Location**: `/admin/search-config`
**Migration**: `migrations/016_search_configuration.sql`
**Database Tables**: `search_field_configuration`, `search_configuration`

#### Features

**Search Fields Configuration:**
- 10 default fields: keyword, title, author, subject, ISBN, ISSN, publisher, series, call number, publication year
- Drag-and-drop reordering
- Toggle visibility in basic vs. advanced search
- Customize labels, placeholders, help text
- Configure search operators (contains, exact, starts with, range)
- Enable/disable autocomplete per field
- Set validation rules (min/max length, regex)

**Search Behavior:**
- Default search type (keyword, title, author, advanced)
- Enable/disable spell correction
- Spell correction threshold (0-1 similarity)
- Minimum results before showing "Did you mean?" suggestions
- Enable/disable advanced search
- Enable/disable Boolean operators (AND, OR, NOT)

**Results Display:**
- Results per page (5-100)
- Default layout (list, grid, compact)
- Show/hide book covers
- Show/hide availability status
- Show/hide call numbers

**Faceted Search:**
- Enable/disable facets globally
- Toggle individual facets:
  - Material types
  - Languages
  - Publication years
  - Locations
  - Availability
- Maximum facet values to display before "Show more"

**Sorting:**
- Default sort order (relevance, title, author, date)
- Available sort options

#### Database Schema

```sql
-- Individual search field configuration
CREATE TABLE search_field_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key VARCHAR(50) NOT NULL UNIQUE,
  field_label VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  placeholder_text VARCHAR(255),
  help_text TEXT,
  is_enabled BOOLEAN DEFAULT true,
  is_default_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  show_in_advanced BOOLEAN DEFAULT true,
  operator_options JSONB,
  enable_autocomplete BOOLEAN DEFAULT false,
  autocomplete_source VARCHAR(100),
  is_required BOOLEAN DEFAULT false,
  min_length INTEGER,
  max_length INTEGER,
  validation_regex VARCHAR(255),
  updated_by UUID REFERENCES auth.users(id)
);

-- Global search configuration
CREATE TABLE search_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_search_type VARCHAR(50) DEFAULT 'keyword',
  enable_spell_correction BOOLEAN DEFAULT true,
  spell_correction_threshold REAL DEFAULT 0.4,
  min_results_for_suggestion INTEGER DEFAULT 5,
  results_per_page INTEGER DEFAULT 20,
  results_layout VARCHAR(50) DEFAULT 'list',
  show_covers BOOLEAN DEFAULT true,
  show_availability BOOLEAN DEFAULT true,
  show_call_number BOOLEAN DEFAULT true,
  enable_facets BOOLEAN DEFAULT true,
  facet_material_types BOOLEAN DEFAULT true,
  facet_languages BOOLEAN DEFAULT true,
  facet_publication_years BOOLEAN DEFAULT true,
  facet_locations BOOLEAN DEFAULT true,
  facet_availability BOOLEAN DEFAULT true,
  max_facet_values INTEGER DEFAULT 10,
  enable_advanced_search BOOLEAN DEFAULT true,
  enable_boolean_operators BOOLEAN DEFAULT true,
  default_sort VARCHAR(50) DEFAULT 'relevance',
  available_sort_options JSONB,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id)
);
```

#### Default Fields

The migration creates these search fields automatically:

1. **keyword** - Search across all fields (enabled, visible by default)
2. **title** - Title search (enabled, advanced only)
3. **author** - Author search (enabled, advanced only)
4. **subject** - Subject search (enabled, advanced only)
5. **isbn** - ISBN search (enabled, advanced only)
6. **issn** - ISSN search (enabled, advanced only)
7. **publisher** - Publisher search (enabled, advanced only)
8. **series** - Series search (enabled, advanced only)
9. **call_number** - Call number search (enabled, advanced only)
10. **publication_year** - Year search (enabled, advanced only)

#### Usage

**To configure search fields:**
1. Go to `/admin/search-config`
2. Click "Search Fields" tab
3. Drag fields to reorder
4. Toggle "Enabled" to show/hide fields
5. Toggle "Show in basic search" to display in homepage search
6. Edit labels and placeholders
7. Click "Save Configuration"

**To configure search behavior:**
1. Go to `/admin/search-config`
2. Click "Search Settings" tab
3. Adjust spell correction threshold
4. Set results per page
5. Choose default layout (list/grid)
6. Click "Save Configuration"

**To configure facets:**
1. Go to `/admin/search-config`
2. Click "Facets & Filters" tab
3. Toggle facets on/off
4. Set maximum values to show
5. Click "Save Configuration"

#### API Endpoints

**Save search configuration:**
```typescript
PUT /api/search-config
Body: { config object }
```

**Save search fields:**
```typescript
PUT /api/search-config/fields
Body: { fields: [...] }
```

---

### 3. Display Configuration

**Location**: `/admin/display-config`
**Migration**: `migrations/017_display_configuration.sql`
**Database Tables**: `display_field_configuration`, `display_configuration`

#### Features

**MARC Field Display:**
- 15 default display fields with MARC mappings
- Drag-and-drop field reordering
- Toggle visibility per context:
  - Search results
  - Detail page
  - Brief view
  - Public OPAC
  - Staff catalog
- Configure display style:
  - Plain text
  - Link (clickable)
  - Badge (colored tag)
  - Heading (emphasized)
  - List (multiple values)
- Clickable field behavior:
  - Search by author
  - Search by subject
  - Search by series
  - External URL
- Field prefixes/suffixes (e.g., "ISBN: ")
- Separator for multi-value fields
- Conditional display (show only for certain material types)

**Search Results Appearance:**
- Show/hide book covers
- Cover size (small, medium, large)
- Show/hide availability status
- Show/hide location
- Show/hide call number
- Show/hide material type badge
- Compact mode toggle

**Record Detail Appearance:**
- Show/hide book cover
- Cover size (medium, large, extra large)
- Show/hide raw MARC view (staff only)
- Show/hide holdings section
- Show/hide related records
- Display subjects as clickable tags
- Group fields by category

**Holdings Display:**
- Show/hide barcode
- Show/hide call number
- Show/hide location
- Show/hide status
- Show/hide notes
- Show/hide electronic access links

**Cover Images:**
- Cover source (Open Library, Google Books, local)
- Fallback placeholder icon

#### Database Schema

```sql
-- Display field configuration
CREATE TABLE display_field_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key VARCHAR(50) NOT NULL UNIQUE,
  field_label VARCHAR(100) NOT NULL,
  marc_field VARCHAR(10),
  show_in_results BOOLEAN DEFAULT true,
  show_in_detail BOOLEAN DEFAULT true,
  show_in_brief BOOLEAN DEFAULT true,
  show_in_opac BOOLEAN DEFAULT true,
  show_in_staff BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  display_style VARCHAR(50) DEFAULT 'text',
  css_class VARCHAR(100),
  prefix_text VARCHAR(50),
  suffix_text VARCHAR(50),
  separator VARCHAR(10) DEFAULT ', ',
  max_values INTEGER,
  make_clickable BOOLEAN DEFAULT false,
  link_type VARCHAR(50),
  link_pattern VARCHAR(255),
  hide_if_empty BOOLEAN DEFAULT true,
  show_only_if_material_type VARCHAR(255)[],
  updated_by UUID REFERENCES auth.users(id)
);

-- Global display configuration
CREATE TABLE display_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  results_show_covers BOOLEAN DEFAULT true,
  results_cover_size VARCHAR(50) DEFAULT 'medium',
  results_show_availability BOOLEAN DEFAULT true,
  results_show_location BOOLEAN DEFAULT true,
  results_show_call_number BOOLEAN DEFAULT true,
  results_show_material_badge BOOLEAN DEFAULT true,
  results_compact_mode BOOLEAN DEFAULT false,
  detail_show_cover BOOLEAN DEFAULT true,
  detail_cover_size VARCHAR(50) DEFAULT 'large',
  detail_show_marc BOOLEAN DEFAULT false,
  detail_show_holdings BOOLEAN DEFAULT true,
  detail_show_related BOOLEAN DEFAULT true,
  detail_show_subjects_as_tags BOOLEAN DEFAULT true,
  detail_group_by_category BOOLEAN DEFAULT true,
  holdings_show_barcode BOOLEAN DEFAULT true,
  holdings_show_call_number BOOLEAN DEFAULT true,
  holdings_show_location BOOLEAN DEFAULT true,
  holdings_show_status BOOLEAN DEFAULT true,
  holdings_show_notes BOOLEAN DEFAULT true,
  holdings_show_electronic_access BOOLEAN DEFAULT true,
  cover_source VARCHAR(50) DEFAULT 'openlibrary',
  cover_fallback_icon BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id)
);
```

#### Default Display Fields

The migration creates these display fields:

1. **title** (MARC 245) - Heading style, show everywhere
2. **author** (MARC 100) - Link style, clickable (search by author)
3. **publication** (MARC 260/264) - Text style
4. **isbn** (MARC 020) - Text style, detail only
5. **issn** (MARC 022) - Text style, detail only
6. **material_type** - Badge style
7. **subjects** (MARC 650) - List style, clickable (search by subject)
8. **series** (MARC 490/830) - Link style, clickable (search by series)
9. **summary** (MARC 520) - Text style, detail only
10. **contents** (MARC 505) - Text style, detail only
11. **notes** (MARC 5XX) - Text style, detail only
12. **physical** (MARC 300) - Text style, detail only
13. **language** (MARC 041) - Text style, detail only
14. **publisher** (MARC 260/264) - Text style, detail only
15. **edition** (MARC 250) - Text style, detail only

#### Usage

**To configure field display:**
1. Go to `/admin/display-config`
2. Click "Field Configuration" tab
3. Drag fields to reorder
4. Toggle visibility for each context (results/detail/brief)
5. Select display style (text/link/badge/heading/list)
6. Choose clickable behavior if applicable
7. Edit labels, prefixes, suffixes
8. Click "Save Configuration"

**To configure search results:**
1. Go to `/admin/display-config`
2. Click "Search Results" tab
3. Toggle covers, availability, call numbers
4. Choose cover size
5. Enable/disable compact mode
6. Click "Save Configuration"

**To configure record details:**
1. Go to `/admin/display-config`
2. Click "Record Details" tab
3. Toggle cover display
4. Choose cover size
5. Toggle holdings, related records, MARC view
6. Configure holdings display options
7. Click "Save Configuration"

#### API Endpoints

**Save display configuration:**
```typescript
PUT /api/display-config
Body: { config object }
```

**Save display fields:**
```typescript
PUT /api/display-config/fields
Body: { fields: [...] }
```

---

### Migration Instructions

To enable these customization features, run the following migrations in Supabase SQL Editor in order:

1. **Branding Configuration:**
   ```bash
   Run migrations/015_branding_configuration.sql
   ```

2. **Search Configuration:**
   ```bash
   Run migrations/016_search_configuration.sql
   ```

3. **Display Configuration:**
   ```bash
   Run migrations/017_display_configuration.sql
   ```

Each migration:
- Creates necessary tables with RLS policies
- Inserts default configurations
- Creates database triggers for data integrity
- Includes helpful comments and documentation

After running migrations, the admin interfaces are immediately accessible at:
- `/admin/branding`
- `/admin/search-config`
- `/admin/display-config`

### Important Notes

**Security:**
- All customization tables use Row Level Security (RLS)
- Only authenticated users can modify configurations
- Public users can view active configurations
- Changes are tracked with `updated_by` and `updated_at` fields

**Performance:**
- Branding config is loaded on every page (cached by browser)
- Search config is loaded when rendering search forms
- Display config is loaded when rendering results/details
- Consider implementing Redis caching for high-traffic sites

**Best Practices:**
- Always test configuration changes in a staging environment first
- Use the "Reset" button to revert to defaults if needed
- Custom CSS should be minimal - prefer using the color scheme
- Avoid heavy JavaScript in custom HTML (performance impact)
- Keep field configurations simple for better user experience

**Backup & Export:**
- Configuration is stored in PostgreSQL (backed up with database)
- Future enhancement: Import/export configuration as JSON
- To backup manually: Export tables via Supabase dashboard

---

### Modifying Search Relevancy Rankings

The search system uses PostgreSQL full-text search with weighted rankings. Understanding and modifying these weights is crucial for tuning search quality.

#### Current Search Vector Configuration

**Location**: Database trigger in `DATABASE_SCHEMA.md` or directly in Supabase SQL Editor

**Current weighting** (from `update_marc_search_vector()` function):

```sql
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Weight levels** (highest to lowest priority):
- **'A'** - Weight 1.0 - Currently: Title (`title_statement->>'a'`)
- **'B'** - Weight 0.4 - Currently: Author (`main_entry_personal_name->>'a'`)
- **'C'** - Weight 0.2 - Currently: Publisher (`publication_info->>'b'`)
- **'D'** - Weight 0.1 - Currently: Summary

#### How to Change Search Weights

**To modify field weights:**

1. Open Supabase SQL Editor
2. Run this modified function with your desired weights:

```sql
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    -- HIGHEST PRIORITY: Title and subjects
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(
      ARRAY(SELECT jsonb_array_elements_text(NEW.subject_topical)->'a'), ' '
    ), '')), 'A') ||

    -- HIGH PRIORITY: Author and subtitle
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'b', '')), 'B') ||

    -- MEDIUM PRIORITY: Publisher and series
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.series_statement->>'a', '')), 'C') ||

    -- LOW PRIORITY: Summary and notes
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.general_note, ' '), '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

3. **Rebuild search vectors** for existing records:

```sql
UPDATE marc_records SET updated_at = NOW();
```

This triggers the function for all records.

#### Adding New Fields to Search

**Example: Add ISBN to search** (weight 'B' - high priority for exact matches)

```sql
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.isbn, '')), 'B') ||  -- Note: 'simple' config for ISBN
    setweight(to_tsvector('english', COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Note**: Use `'simple'` config for ISBNs, ISSNs, and other identifiers to prevent stemming.

#### Removing Fields from Search

Simply remove the line from the concatenation:

```sql
-- Remove publisher from search
NEW.search_vector :=
  setweight(to_tsvector('english', COALESCE(NEW.title_statement->>'a', '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
  -- Removed publisher line
  setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'D');
```

### Advanced Search Ranking

#### Custom Relevance Scoring

**Location**: `src/routes/catalog/search/results/+page.server.ts`

For more control than the built-in `ts_rank`, create a custom scoring function.

**Method 1: Create a Supabase RPC function**

```sql
CREATE OR REPLACE FUNCTION search_records_ranked(
  search_query TEXT,
  boost_recent BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  record JSONB,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(m.*) as record,
    -- Custom ranking formula
    ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) *
    CASE
      WHEN boost_recent THEN
        -- Boost by recency (records from last 5 years get higher scores)
        CASE
          WHEN EXTRACT(YEAR FROM NOW()) - CAST(m.publication_info->>'c' AS INTEGER) <= 5
          THEN 1.5
          ELSE 1.0
        END
      ELSE 1.0
    END as rank
  FROM marc_records m
  WHERE m.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
```

**Method 2: Multi-factor scoring**

```sql
CREATE OR REPLACE FUNCTION advanced_search_rank(
  search_query TEXT
)
RETURNS TABLE (
  record JSONB,
  relevance_score REAL,
  popularity_score INTEGER,
  recency_score REAL,
  final_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(m.*),
    ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) as relevance_score,
    -- Popularity from checkout count (requires circulation integration)
    COALESCE((SELECT COUNT(*) FROM checkouts c WHERE c.marc_record_id = m.id), 0)::INTEGER as popularity_score,
    -- Recency score (1.0 for this year, decreasing)
    GREATEST(0, 1.0 - ((EXTRACT(YEAR FROM NOW()) - COALESCE(CAST(m.publication_info->>'c' AS INTEGER), 1900)) / 100.0)) as recency_score,
    -- Final weighted score (adjust weights as needed)
    (
      ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) * 10.0 +  -- Relevance: 10x
      COALESCE((SELECT COUNT(*) FROM checkouts c WHERE c.marc_record_id = m.id), 0) * 0.1 +  -- Popularity: 0.1x
      GREATEST(0, 1.0 - ((EXTRACT(YEAR FROM NOW()) - COALESCE(CAST(m.publication_info->>'c' AS INTEGER), 1900)) / 100.0)) * 2.0  -- Recency: 2x
    ) as final_score
  FROM marc_records m
  WHERE m.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY final_score DESC;
END;
$$ LANGUAGE plpgsql;
```

**Call from TypeScript**:

```typescript
const { data, error } = await supabase.rpc('advanced_search_rank', {
  search_query: params.q
});
```

#### Boosting Specific Material Types

Prefer books over DVDs in results:

```sql
SELECT
  *,
  ts_rank(search_vector, query) *
  CASE material_type
    WHEN 'book' THEN 1.5
    WHEN 'ebook' THEN 1.3
    WHEN 'serial' THEN 1.2
    WHEN 'dvd' THEN 0.8
    ELSE 1.0
  END as adjusted_rank
FROM marc_records
WHERE search_vector @@ query
ORDER BY adjusted_rank DESC;
```

### Spell Correction Customization

**Location**: `migrations/010_spell_correction.sql`

#### Adjusting Similarity Threshold

The default threshold is **0.4 (40%)** similarity. To make it more or less strict:

```sql
CREATE OR REPLACE FUNCTION suggest_spell_correction(input_term TEXT)
RETURNS TABLE (suggestion TEXT, confidence REAL) AS $$
BEGIN
  RETURN QUERY
  SELECT
    candidate,
    similarity(input_term, candidate) as conf
  FROM (
    SELECT DISTINCT title_statement->>'a' as candidate FROM marc_records
    UNION
    SELECT DISTINCT main_entry_personal_name->>'a' FROM marc_records
    UNION
    SELECT DISTINCT jsonb_array_elements(subject_topical)->>'a' FROM marc_records
  ) candidates
  WHERE similarity(input_term, candidate) > 0.5  -- Changed from 0.4 to 0.5 (stricter)
  ORDER BY conf DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

**Threshold guidelines**:
- **0.3** - Very lenient (more suggestions, some wrong)
- **0.4** - Default (balanced)
- **0.5** - Moderate (fewer suggestions, more accurate)
- **0.6** - Strict (very few suggestions, very accurate)

#### When to Show Spell Suggestions

**Location**: `src/routes/catalog/search/results/+page.server.ts:90`

Current: Shows when results < 5

```typescript
// Only suggest corrections for keyword searches with few/no results
if (params.q && results.total < 5) {  // Change this number
  const suggestion = await getSpellSuggestion(supabase, params.q);
  if (suggestion) {
    spellSuggestion = suggestion;
  }
}
```

**Options**:
- `results.total === 0` - Only when no results (strictest)
- `results.total < 3` - When fewer than 3 results
- `results.total < 10` - More lenient
- Always show if confidence > threshold (regardless of result count)

#### Multi-word Spell Correction

The system already handles multi-word queries via `suggest_query_correction()`. To adjust:

```sql
CREATE OR REPLACE FUNCTION suggest_query_correction(input_query TEXT)
RETURNS TABLE (suggested_query TEXT, confidence REAL) AS $$
DECLARE
  words TEXT[];
  corrected_words TEXT[] := ARRAY[]::TEXT[];
  word TEXT;
  correction RECORD;
  total_confidence REAL := 0;
  word_count INTEGER := 0;
BEGIN
  -- Split into words
  words := string_to_array(lower(input_query), ' ');

  -- Correct each word
  FOREACH word IN ARRAY words LOOP
    word_count := word_count + 1;

    SELECT * INTO correction FROM suggest_spell_correction(word);

    IF correction.confidence > 0.4 AND correction.suggestion IS NOT NULL THEN
      corrected_words := array_append(corrected_words, correction.suggestion);
      total_confidence := total_confidence + correction.confidence;
    ELSE
      -- Keep original if no good correction
      corrected_words := array_append(corrected_words, word);
      total_confidence := total_confidence + 0.5;  -- Assume original is partially correct
    END IF;
  END LOOP;

  -- Average confidence
  suggested_query := array_to_string(corrected_words, ' ');
  confidence := total_confidence / word_count;

  -- Only return if different from input and confidence is reasonable
  IF suggested_query != lower(input_query) AND confidence > 0.4 THEN
    RETURN QUERY SELECT suggested_query, confidence;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### Faceted Search Customization

**Location**: `src/routes/catalog/search/results/+page.server.ts`

#### Adding New Facets

To add a new facet (e.g., "Publication Decade"):

1. **Update the interface** in `+page.server.ts`:

```typescript
export interface FacetGroup {
  material_types: Facet[];
  languages: Facet[];
  publication_years: Facet[];
  publication_decades: Facet[];  // NEW
  availability: Facet[];
  locations: Facet[];
}
```

2. **Add to computeFacets function**:

```typescript
async function computeFacets(
  supabase: SupabaseClient,
  params: SearchParams
): Promise<FacetGroup> {
  // ... existing facet queries ...

  // Publication Decades facet
  const { data: decadeData } = await supabase
    .from('marc_records')
    .select('publication_info->c')
    .not('publication_info->c', 'is', null);

  const decadeCounts = new Map<string, number>();
  decadeData?.forEach(record => {
    const year = parseInt(record['publication_info']?.c);
    if (year) {
      const decade = Math.floor(year / 10) * 10;
      const label = `${decade}s`;
      decadeCounts.set(label, (decadeCounts.get(label) || 0) + 1);
    }
  });

  const publication_decades = Array.from(decadeCounts.entries())
    .map(([label, count]) => ({ value: label, label, count }))
    .sort((a, b) => b.value.localeCompare(a.value));  // Newest first

  return {
    material_types,
    languages,
    publication_years,
    publication_decades,  // Include new facet
    availability,
    locations
  };
}
```

3. **Update UI** in `FacetSidebar.svelte`:

```svelte
{#if facets.publication_decades.length > 0}
  <div class="facet-group">
    <h3>Publication Decade</h3>
    {#each facets.publication_decades as facet}
      <label>
        <input type="checkbox" value={facet.value} />
        {facet.label} ({facet.count})
      </label>
    {/each}
  </div>
{/if}
```

#### Changing Facet Order

Reorder the facets in the UI by changing the order in the Svelte component, or change the sort in the `computeFacets` function.

### Performance Tuning

#### Optimizing Full-Text Search

**1. Index optimization**

Check index usage:

```sql
-- See if search_vector index is being used
EXPLAIN ANALYZE
SELECT * FROM marc_records
WHERE search_vector @@ websearch_to_tsquery('english', 'history');
```

**2. Add covering indexes** for common queries:

```sql
-- Index for title + material_type queries (common filter)
CREATE INDEX idx_marc_title_type ON marc_records(
  (title_statement->>'a'),
  material_type
);

-- Index for author queries
CREATE INDEX idx_marc_author ON marc_records(
  (main_entry_personal_name->>'a')
);

-- Partial index for available items (faster than full table scan)
CREATE INDEX idx_available_items ON items(marc_record_id)
WHERE status = 'available';
```

**3. Partition large tables** (if catalog grows beyond 100K records):

```sql
-- Partition by material type for faster filtered queries
CREATE TABLE marc_records_books PARTITION OF marc_records
  FOR VALUES IN ('book', 'ebook');

CREATE TABLE marc_records_serials PARTITION OF marc_records
  FOR VALUES IN ('serial', 'newspaper', 'magazine');
```

#### Query Optimization

**Use materialized views** for expensive facet calculations:

```sql
CREATE MATERIALIZED VIEW facet_material_types AS
SELECT
  material_type,
  COUNT(*) as count
FROM marc_records
GROUP BY material_type;

-- Refresh periodically (e.g., nightly)
REFRESH MATERIALIZED VIEW facet_material_types;

-- Query the view instead of the table
SELECT * FROM facet_material_types;
```

**Implement caching** in the application:

```typescript
// Simple in-memory cache for facets
const facetCache = new Map<string, { facets: FacetGroup; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedFacets(supabase: SupabaseClient, cacheKey: string) {
  const cached = facetCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.facets;
  }

  const facets = await computeFacets(supabase, params);
  facetCache.set(cacheKey, { facets, timestamp: Date.now() });
  return facets;
}
```

### Custom Search Configurations

#### Searching Different Languages

The default is `'english'` configuration. For multi-language catalogs:

```sql
-- Detect language and use appropriate config
CREATE OR REPLACE FUNCTION update_marc_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  lang_config TEXT := 'english';  -- default
BEGIN
  -- Determine language configuration
  IF NEW.language_code = 'spa' THEN
    lang_config := 'spanish';
  ELSIF NEW.language_code = 'fre' THEN
    lang_config := 'french';
  ELSIF NEW.language_code = 'ger' THEN
    lang_config := 'german';
  -- Add more languages as needed
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector(lang_config, COALESCE(NEW.title_statement->>'a', '')), 'A') ||
    setweight(to_tsvector(lang_config, COALESCE(NEW.main_entry_personal_name->>'a', '')), 'B') ||
    setweight(to_tsvector(lang_config, COALESCE(NEW.publication_info->>'b', '')), 'C') ||
    setweight(to_tsvector(lang_config, COALESCE(NEW.summary, '')), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Case-Insensitive Exact Matches

For identifiers (ISBN, ISSN, call numbers):

```typescript
// ISBN exact match (case-insensitive, ignore hyphens)
const normalizedISBN = isbn.replace(/[-\s]/g, '').toLowerCase();

const { data } = await supabase
  .from('marc_records')
  .select('*')
  .ilike('isbn', normalizedISBN);
```

Or create a functional index:

```sql
-- Index for normalized ISBN searches
CREATE INDEX idx_marc_isbn_normalized ON marc_records(
  LOWER(REPLACE(isbn, '-', ''))
);
```

### Debugging Search Issues

#### Enable Query Logging

**In Supabase Dashboard**: Settings → Database → Enable query logging

**Or add logging to your functions**:

```typescript
async function performSearch(supabase: SupabaseClient, params: SearchParams) {
  console.log('Search params:', JSON.stringify(params, null, 2));

  const query = supabase.from('marc_records').select('*');

  // Log the generated query (if using raw SQL)
  console.log('Query:', query);

  const { data, error } = await query;

  console.log('Results:', data?.length, 'Error:', error);

  return { results: data || [], total: data?.length || 0 };
}
```

#### Test Search Queries Directly

In Supabase SQL Editor:

```sql
-- Test full-text search
SELECT
  title_statement->>'a' as title,
  ts_rank(search_vector, websearch_to_tsquery('english', 'american history')) as rank
FROM marc_records
WHERE search_vector @@ websearch_to_tsquery('english', 'american history')
ORDER BY rank DESC
LIMIT 10;

-- Test spell correction
SELECT * FROM suggest_spell_correction('shakespear');

-- Test multi-word correction
SELECT * FROM suggest_query_correction('amarican histery');
```

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

**Last Updated**: 2026-01-01
**Version**: 1.1
**Maintained By**: Development team via GitHub

## Recent Updates (2026-01-01)

This version adds documentation for:
- Authority Control System (LCNAF/LCSH integration)
- Interlibrary Loan (ILL) Module
- WYSIWYG Content Pages
- Cover Image Management
- Batch Operations for cataloging
- Related Records and Series Linking
- Record Attachments (storage-agnostic external file system)
- Enhanced migration list with all recent additions

## Key Updates Since v1.0

**New Modules**:
- `/admin/ill/` - Complete interlibrary loan system
- `/admin/cataloging/authorities/` - Authority control interface
- `/admin/pages/` - WYSIWYG page editor
- `/admin/cataloging/batch/` - Bulk editing tools
- `/admin/cataloging/covers/` - Cover management

**New Database Tables**:
- `authorities`, `authority_references` - Authority control
- `ill_partners`, `ill_requests` - Interlibrary loan
- `pages` - Content management
- `cover_images` - Local cover uploads
- `related_records` - Record relationships
- `marc_attachments` - External file attachments with expiry and analytics

**New Features**:
- LC authority synchronization
- Partner library management
- Rich text page editing
- Cover upload and management
- Global find/replace in cataloging
- Series browsing
- Storage-agnostic attachment system with expiration and access control

This document is designed to help AI assistants understand the codebase structure, conventions, and best practices. When in doubt, refer to existing code patterns and this documentation.
