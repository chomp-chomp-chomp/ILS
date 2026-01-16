# Book Cover Management System

## Overview

The ILS includes a comprehensive book cover management system that automatically fetches, stores, and displays cover images from multiple sources. The system features:

- **Multiple Sources**: OpenLibrary, Google Books, HathiTrust, LibraryThing APIs
- **Manual Uploads**: Custom cover image uploads via Supabase Storage
- **Bulk Processing**: Queue-based system for fetching covers for entire catalog
- **Lazy Loading**: Performance-optimized image loading
- **Cover Flow Display**: 3D carousel view for browsing covers
- **Fallback Generation**: Automatic placeholder generation with title/author text

---

## Setup Instructions

### 1. Run Database Migration

First, apply the cover management migration to create the necessary tables:

```bash
# In Supabase SQL Editor, run:
migrations/018_book_cover_management.sql
```

This creates:
- `covers` table - Stores cover metadata and URLs
- `cover_fetch_queue` table - Queue for bulk fetching with priority
- `cover_statistics` view - Coverage statistics and reporting
- Helper functions for queue management

### 2. Create Supabase Storage Bucket

For custom cover uploads, create a storage bucket:

1. Go to Supabase Dashboard → Storage
2. Click "Create Bucket"
3. Name: `book-covers`
4. **Public bucket**: ✅ Yes (covers should be publicly accessible)
5. Click "Create Bucket"

**Set bucket policies:**

```sql
-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'book-covers');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book-covers');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'book-covers');
```

### 3. Configure API Keys (Optional)

For better results, configure API keys as environment variables:

**Google Books API** (recommended for quality covers):
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project or select existing
3. Enable "Books API"
4. Create credentials → API Key
5. Add to `.env`:
   ```
   GOOGLE_BOOKS_API_KEY=your_key_here
   ```

**LibraryThing API** (optional, requires approval):
1. Apply at [LibraryThing Developer](https://www.librarything.com/services/)
2. Add to `.env`:
   ```
   LIBRARYTHING_API_KEY=your_key_here
   ```

**Note**: OpenLibrary requires no API key and works out of the box.

---

## Architecture

### Database Schema

#### `covers` Table

Stores cover image metadata with support for multiple sizes:

```sql
CREATE TABLE covers (
  id UUID PRIMARY KEY,
  marc_record_id UUID REFERENCES marc_records(id),
  isbn VARCHAR(20),
  source VARCHAR(50), -- 'openlibrary', 'google', 'librarything', 'upload', 'generated'

  -- Image URLs
  original_url TEXT,
  thumbnail_small_url TEXT,   -- 100px
  thumbnail_medium_url TEXT,  -- 200px
  thumbnail_large_url TEXT,   -- 400px

  -- Supabase Storage paths (for uploaded covers)
  storage_path_original TEXT,
  storage_path_small TEXT,
  storage_path_medium TEXT,
  storage_path_large TEXT,

  -- Metadata
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type VARCHAR(50),
  quality_score INTEGER, -- 0-100
  is_placeholder BOOLEAN,
  fetch_status VARCHAR(50),

  -- Only one active cover per record
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id)
);
```

**Key Features:**
- Multiple thumbnail sizes for responsive display
- Quality scoring for prioritizing best covers
- Active flag ensures only one cover per record
- Tracks both external URLs and local storage paths

#### `cover_fetch_queue` Table

Priority queue for bulk cover fetching:

```sql
CREATE TABLE cover_fetch_queue (
  id UUID PRIMARY KEY,
  marc_record_id UUID REFERENCES marc_records(id),
  isbn VARCHAR(20),
  title VARCHAR(500),
  author VARCHAR(500),

  -- Priority and scheduling
  priority INTEGER DEFAULT 50, -- 0-100, higher = more important
  scheduled_for TIMESTAMPTZ,

  -- Processing
  status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Sources
  sources_to_try JSONB, -- ["openlibrary", "google", "librarything"]
  sources_tried JSONB,

  -- Results
  successful_source VARCHAR(50),
  cover_id UUID REFERENCES covers(id),
  error_message TEXT,

  -- Retry logic
  next_retry_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ
);
```

**Key Features:**
- Priority-based processing (popular items first)
- Configurable retry logic with exponential backoff
- Tries multiple sources in order
- Prevents duplicate queue entries

### API Endpoints

#### 1. **GET/POST** `/api/covers/fetch`

Fetch cover for a single record from multiple sources.

**GET Parameters:**
- `isbn` (required) - ISBN to search
- `title` (optional) - Book title
- `author` (optional) - Author name
- `sources` (optional) - Comma-separated sources to try

**POST Body:**
```json
{
  "recordId": "uuid",
  "isbn": "9780547928227",
  "title": "The Hobbit",
  "author": "J.R.R. Tolkien",
  "sources": ["openlibrary", "google", "librarything"],
  "saveToDatabase": true
}
```

**Response:**
```json
{
  "success": true,
  "cover": {
    "id": "uuid",
    "original_url": "https://...",
    "source": "google",
    "quality_score": 85
  },
  "message": "Cover fetched from google"
}
```

#### 2. **POST** `/api/covers/upload`

Upload a custom cover image.

**Form Data:**
- `file` (File) - Image file (JPEG, PNG, WebP, GIF, max 5MB)
- `recordId` (string) - MARC record UUID
- `isbn` (optional) - Associated ISBN

**Response:**
```json
{
  "success": true,
  "cover": {
    "id": "uuid",
    "original_url": "https://...",
    "source": "upload",
    "quality_score": 100
  },
  "message": "Cover uploaded successfully"
}
```

#### 3. **GET/POST/DELETE** `/api/covers/bulk`

Bulk operations for queue management.

**GET Actions:**
- `?action=stats` - Get coverage statistics
- `?status=pending&limit=50` - Get queue items

**POST Actions:**

**Queue specific records:**
```json
{
  "action": "queue",
  "recordIds": ["uuid1", "uuid2"],
  "priority": 75
}
```

**Queue all missing covers:**
```json
{
  "action": "queue-missing",
  "limit": 100,
  "priority": 50,
  "materialType": "book"
}
```

**Process queue:**
```json
{
  "action": "process",
  "limit": 10
}
```

**Retry failed items:**
```json
{
  "action": "retry-failed"
}
```

---

## User Interfaces

### Admin: Cover Management

**Location**: `/admin/cataloging/covers`

Comprehensive admin interface with tabs:

#### **1. Overview & Stats Tab**

Displays:
- Coverage percentage (% of records with covers)
- Cover count by source (OpenLibrary, Google, LibraryThing, uploads)
- Quality metrics (average quality score)
- Queue status (pending/failed items)

**Bulk Operations:**
- Queue Missing Covers - Add records without covers to fetch queue
- Process Queue - Fetch covers for queued items
- Configure priority and material type filters

#### **2. Queue Management Tab**

- View pending items in priority order
- See failed items with error messages
- Retry failed items
- Remove items from queue

#### **3. Upload Tab**

- Upload custom cover for any record
- Drag-and-drop file upload
- Specify record ID and optional ISBN
- Supports JPEG, PNG, WebP, GIF (max 5MB)

#### **4. Search & Fetch Tab**

- Fetch cover for single record by ID
- View records without covers
- Bulk select and queue records

### Components

#### **BookCover Component**

Enhanced cover display component with lazy loading and zoom.

**Usage:**
```svelte
<script>
  import BookCover from '$lib/components/BookCover.svelte';
</script>

<BookCover
  recordId="uuid"
  isbn="9780547928227"
  title="The Hobbit"
  author="J.R.R. Tolkien"
  size="medium"
  lazyLoad={true}
  enableZoom={true}
/>
```

**Props:**
- `recordId` - MARC record UUID (fetches from database)
- `isbn` - ISBN (fallback to API if no database cover)
- `title`, `author` - For generated placeholders
- `customCoverUrl` - Override with specific URL
- `size` - 'small' (4rem), 'medium' (8rem), 'large' (12rem)
- `lazyLoad` - Enable Intersection Observer lazy loading
- `enableZoom` - Click to view full-size overlay

**Features:**
- Lazy loading with Intersection Observer
- Thumbnail → full image progressive loading
- Hover to enlarge hint
- Click to view full-size modal
- Fallback placeholder with generated color and title/author text
- Queries new `covers` table first, falls back to API

#### **CoverFlow Component**

3D carousel for browsing cover images.

**Usage:**
```svelte
<script>
  import CoverFlow from '$lib/components/CoverFlow.svelte';

  const items = [
    { id: 'uuid1', title: 'The Hobbit', author: 'Tolkien', isbn: '...' },
    { id: 'uuid2', title: '1984', author: 'Orwell', isbn: '...' },
    // ...
  ];
</script>

<CoverFlow
  {items}
  title="New Arrivals"
  showControls={true}
  autoRotate={true}
  rotateInterval={3000}
  itemsPerView={7}
  enableZoom={true}
  onItemClick={(item) => goto(`/catalog/record/${item.id}`)}
/>
```

**Props:**
- `items` - Array of {id, title, author?, isbn?, coverUrl?}
- `title` - Section heading
- `showControls` - Show prev/next buttons
- `autoRotate` - Auto-rotate carousel
- `rotateInterval` - Milliseconds between rotations
- `itemsPerView` - Number of items visible at once
- `enableZoom` - Enable zoom on active item
- `onItemClick` - Callback when active item is clicked

**Features:**
- 3D perspective transforms
- Keyboard navigation (arrow keys)
- Mouse/touch controls
- Auto-rotation with pause on hover
- Indicator dots for navigation
- Active item info display
- Responsive design

---

## Workflows

### Bulk Fetch All Missing Covers

**Recommended approach** for populating covers for entire catalog:

1. Go to `/admin/cataloging/covers`
2. Click "Overview & Stats" tab
3. Set batch size (e.g., 100)
4. Choose priority (50 = default, higher = more important)
5. Optional: Filter by material type (e.g., "book" only)
6. Click "Queue Missing Covers"
7. Wait for confirmation (e.g., "Queued 100 records")
8. Click "Process Queue (10 items)" to start fetching
9. Monitor progress in "Queue Management" tab
10. Repeat "Process Queue" until all items complete

**Automation** (future enhancement):
- Set up a cron job to call `/api/covers/bulk` with `action: 'process'`
- Run every 5 minutes to continuously process queue
- Respects rate limits with built-in delays

### Fetch Cover for Single Record

**Manual fetch:**
1. Go to `/admin/cataloging/covers`
2. Click "Search & Fetch" tab
3. Enter record UUID
4. Click "Fetch Cover"
5. System tries OpenLibrary → Google → LibraryThing
6. First successful result is saved

### Upload Custom Cover

**For special editions or when APIs fail:**
1. Prepare image file (JPEG/PNG, ideally 400x600px or larger)
2. Go to `/admin/cataloging/covers` → "Upload" tab
3. Enter record UUID (found in cataloging interface or URL)
4. Optional: Enter ISBN if different from record
5. Select file
6. Click "Upload Cover"
7. Cover is stored in Supabase Storage
8. Replaces any existing cover

### Check Coverage Statistics

**Monitor cover availability:**
1. Go to `/admin/cataloging/covers`
2. View "Overview & Stats" tab
3. Check:
   - **Coverage %**: Percentage of records with covers
   - **By Source**: Distribution across sources
   - **Quality Score**: Average image quality
   - **Queue Status**: Pending/failed items

**Export report** (future):
- Download CSV of records without covers
- Filter by material type, location, etc.

---

## Cover Source Priority

The system tries sources in this order:

### 1. Database (if recordId provided)
- Queries `covers` table for active cover
- Fastest option (no API calls)
- Returns immediately if found

### 2. OpenLibrary
- **URL**: `https://covers.openlibrary.org/b/isbn/{ISBN}-{SIZE}.jpg`
- **Sizes**: S (small), M (medium), L (large)
- **Pros**: Free, no API key, fast
- **Cons**: Limited catalog, lower quality
- **Detection**: Checks content-length > 1000 bytes (placeholder is ~807 bytes)

### 3. Google Books
- **URL**: `https://www.googleapis.com/books/v1/volumes?q=isbn:{ISBN}`
- **API Key**: Optional but recommended for volume
- **Pros**: Excellent quality, large catalog
- **Cons**: Rate limits without key
- **Quality**: Prefers extraLarge > large > medium > thumbnail

### 4. LibraryThing
- **URL**: `https://covers.librarything.com/devkey/{KEY}/{SIZE}/isbn/{ISBN}`
- **API Key**: Required (free, must apply)
- **Pros**: Good quality, unique covers
- **Cons**: Requires approval, smaller catalog

### 5. Generated Placeholder
- Fallback when all sources fail
- Generates colored background based on title hash
- Displays truncated title and author
- Low quality score (20)

**Customizing order:**
```javascript
// In API call, specify sources array
fetch('/api/covers/fetch', {
  method: 'POST',
  body: JSON.stringify({
    recordId: 'uuid',
    sources: ['google', 'openlibrary', 'librarything'] // Custom order
  })
});
```

---

## Performance Considerations

### Lazy Loading

The `BookCover` component uses Intersection Observer:

```javascript
// Starts loading 100px before entering viewport
new IntersectionObserver(entries => {
  if (entry.isIntersecting) {
    loadImage();
  }
}, {
  rootMargin: '100px'
});
```

**Benefits:**
- Reduces initial page load
- Saves bandwidth for images never viewed
- Improves perceived performance

**Disable for critical images:**
```svelte
<BookCover lazyLoad={false} />
```

### Thumbnail Progressive Loading

For uploaded covers (future enhancement):
1. Show small thumbnail (100px) immediately
2. Load medium thumbnail (200px) in background
3. Swap to full image (400px+) when loaded
4. Applies blur to thumbnail during loading

### Caching

**Browser caching:**
- Cover URLs are stable (don't change for same record)
- Browser caches images automatically
- Supabase Storage sets `Cache-Control: max-age=3600`

**Future: CDN integration:**
- Use Vercel Image Optimization
- Cloudflare CDN for Supabase Storage
- Redis cache for cover metadata

---

## Troubleshooting

### No covers showing for any records

**Check:**
1. Is migration applied? Query `covers` table
2. Are covers in database? `SELECT COUNT(*) FROM covers WHERE is_active = true`
3. Check browser console for errors
4. Verify Supabase RLS policies allow SELECT

**Fix:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'covers';

-- Ensure public read access exists
CREATE POLICY "Public read access to covers"
  ON covers FOR SELECT
  TO anon, authenticated
  USING (true);
```

### Covers not fetching (queue stuck)

**Check:**
1. Queue status: `SELECT * FROM cover_fetch_queue WHERE status = 'failed'`
2. Error messages: `SELECT error_message, COUNT(*) FROM cover_fetch_queue WHERE status = 'failed' GROUP BY error_message`
3. API rate limits (429 errors)

**Fix:**
- Add API keys for Google Books / LibraryThing
- Reduce batch size
- Increase delay between batches
- Check `attempts < max_attempts`

### Upload fails with "Upload failed"

**Check:**
1. Storage bucket exists and named `book-covers`
2. Bucket is public
3. RLS policies allow INSERT for authenticated users
4. File size < 5MB
5. File type is allowed (JPEG, PNG, WebP, GIF)

**Fix:**
```sql
-- Verify bucket policies
SELECT * FROM storage.buckets WHERE id = 'book-covers';
SELECT * FROM storage.objects WHERE bucket_id = 'book-covers' LIMIT 5;

-- Check user authentication
SELECT auth.uid(); -- Should return UUID, not null
```

### Covers display but are placeholders

**Possible causes:**
1. ISBN is invalid or not in API databases
2. Book is too obscure/new
3. API rate limits hit

**Solutions:**
- Upload custom cover manually
- Wait and retry (may be temporary API issue)
- Try different ISBN (paperback vs hardcover)
- Check if record has correct ISBN format

### Performance: Page loads slowly with many covers

**Optimizations:**
1. Ensure `lazyLoad={true}` is set
2. Reduce `itemsPerView` in CoverFlow (default 7 → 5)
3. Implement pagination for search results
4. Use smaller `size` prop ('small' vs 'large')

---

## Future Enhancements

### Planned Features

1. **Thumbnail Generation**
   - Automatic resizing on upload
   - Generate small/medium/large from original
   - Use Sharp.js or ImageMagick

2. **Cover Quality Scoring**
   - Analyze resolution, aspect ratio
   - Detect placeholder/generic covers
   - Prioritize higher quality sources

3. **Batch Download & Store**
   - Option to download all API covers to Supabase Storage
   - Improves reliability (no broken external links)
   - Better performance (CDN delivery)

4. **Cover History**
   - Track all covers ever associated with record
   - Allow switching between previous covers
   - Audit trail for changes

5. **Machine Learning Fallbacks**
   - Generate AI covers for uncatalogued books
   - Use DALL-E or Stable Diffusion
   - Stylistic consistency

6. **Advanced Search**
   - Find records without covers by material type, location
   - Filter by cover source or quality
   - Export missing cover reports

7. **API Endpoints for OPAC**
   - Public API to get cover by ISBN
   - Embed in external systems
   - Proxy for rate-limited APIs

8. **Automated Queue Processing**
   - Background job runs every 5 minutes
   - Processes queue automatically
   - Respects rate limits

### Contributing

To add a new cover source:

1. Edit `/src/routes/api/covers/fetch/+server.ts`
2. Add new source implementation:

```typescript
const newSource: CoverSource = {
  name: 'newsource',
  fetchCover: async (isbn: string, title?: string, author?: string) => {
    // Implement API call
    const url = `https://api.example.com/covers/${isbn}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.coverUrl) {
      return {
        url: data.coverUrl,
        quality: 75,
        source: 'newsource'
      };
    }
    return null;
  }
};
```

3. Add to source map:
```typescript
const sourceMap: Record<string, CoverSource> = {
  openlibrary: openLibrarySource,
  google: googleBooksSource,
  librarything: libraryThingSource,
  newsource: newSource  // Add here
};
```

4. Update default sources array in migration and documentation

---

## API Reference

### Database Functions

#### `queue_missing_covers(limit_count, priority_level, material_type_filter)`

Queues records without covers for batch fetching.

**Parameters:**
- `limit_count` (INTEGER) - Max records to queue (default 100)
- `priority_level` (INTEGER) - Priority 0-100 (default 50)
- `material_type_filter` (VARCHAR) - Filter by type (default NULL = all)

**Returns:** INTEGER - Number of records queued

**Example:**
```sql
-- Queue 50 books without covers, high priority
SELECT queue_missing_covers(50, 75, 'book');
```

#### `get_next_cover_fetch()`

Gets next item from queue for processing (atomic).

**Returns:** TABLE
- `queue_id` UUID
- `marc_record_id` UUID
- `isbn` VARCHAR
- `title` VARCHAR
- `author` VARCHAR
- `sources_to_try` JSONB

**Example:**
```sql
SELECT * FROM get_next_cover_fetch();
```

#### `complete_cover_fetch(queue_id, success, source, cover_id, error_msg)`

Marks queue item as completed or failed.

**Parameters:**
- `queue_id` UUID - Queue item ID
- `success` BOOLEAN - Whether fetch succeeded
- `source` VARCHAR - Source that succeeded (if success = true)
- `cover_id` UUID - Created cover ID (if success = true)
- `error_msg` TEXT - Error message (if success = false)

**Example:**
```sql
SELECT complete_cover_fetch(
  'queue-uuid',
  true,
  'google',
  'cover-uuid',
  NULL
);
```

#### `calculate_cover_priority(record_id)`

Calculates fetch priority based on popularity.

**Algorithm:**
- Base priority: 50
- +5 for each checkout
- +3 for each reading list appearance
- Capped at 100

**Returns:** INTEGER (0-100)

---

## License

This cover management system is part of the ILS project and is released under the MIT License. Cover images fetched from external APIs are subject to their respective licenses and terms of service.

---

**Last Updated**: 2025-12-30
**Version**: 1.0.0
**Maintainer**: Development Team
