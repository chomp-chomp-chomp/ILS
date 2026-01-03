# ImageKit Integration Guide for Book Covers

This guide explains how to integrate ImageKit for storing book cover images instead of Supabase Storage.

## Why ImageKit?

ImageKit provides:
- Automatic image optimization
- CDN delivery for fast loading
- Image transformations (resize, crop, format conversion)
- Better reliability than Supabase Storage
- Can be shared across multiple sites (library.chompchomp.cc and chompchomp.cc)

## Prerequisites

1. **ImageKit Account**: You already have one for chompchomp.cc
2. **ImageKit Credentials**: You need:
   - Public Key
   - Private Key
   - URL Endpoint (e.g., `https://ik.imagekit.io/your_imagekit_id`)

## Step 1: Get ImageKit Credentials

1. Log into ImageKit dashboard: https://imagekit.io/dashboard
2. Go to **Developer Options**
3. Copy these values:
   - **URL-endpoint**: Something like `https://ik.imagekit.io/abcd1234`
   - **Public Key**: Your public key
   - **Private Key**: Your private API key (keep this secret!)

## Step 2: Add Environment Variables

Add these to your `.env` file (locally) and Vercel environment variables (production):

```env
# ImageKit Configuration
PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
IMAGEKIT_PUBLIC_KEY=your_public_key_here
IMAGEKIT_PRIVATE_KEY=your_private_key_here
```

**Important:**
- Add to `.env` for local development
- Add to Vercel → Settings → Environment Variables for production
- Mark `IMAGEKIT_PRIVATE_KEY` as secret in Vercel

## Step 3: Install ImageKit SDK

```bash
npm install imagekit
```

## Step 4: Update Cover Upload Endpoint

Replace the contents of `/src/routes/api/covers/upload/+server.ts`:

```typescript
/**
 * Cover Upload API - ImageKit Version
 * Handles manual cover image uploads to ImageKit
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import ImageKit from 'imagekit';
import {
	PUBLIC_IMAGEKIT_URL_ENDPOINT,
	IMAGEKIT_PUBLIC_KEY,
	IMAGEKIT_PRIVATE_KEY
} from '$env/static/private';

// Initialize ImageKit
const imagekit = new ImageKit({
	publicKey: IMAGEKIT_PUBLIC_KEY,
	privateKey: IMAGEKIT_PRIVATE_KEY,
	urlEndpoint: PUBLIC_IMAGEKIT_URL_ENDPOINT
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const recordId = formData.get('recordId') as string;
		const isbn = formData.get('isbn') as string | null;

		// Validation
		if (!file) {
			throw error(400, 'No file provided');
		}

		if (!recordId) {
			throw error(400, 'recordId is required');
		}

		if (!ALLOWED_TYPES.includes(file.type)) {
			throw error(400, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`);
		}

		if (file.size > MAX_FILE_SIZE) {
			throw error(400, `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
		}

		// Verify record exists
		const { data: record, error: recordError } = await supabase
			.from('marc_records')
			.select('id, isbn, title_statement')
			.eq('id', recordId)
			.single();

		if (recordError || !record) {
			throw error(404, 'Record not found');
		}

		// Convert file to buffer
		const buffer = Buffer.from(await file.arrayBuffer());

		// Generate unique filename
		const timestamp = Date.now();
		const extension = file.name.split('.').pop() || 'jpg';
		const fileName = `cover-${recordId}-${timestamp}.${extension}`;

		// Upload to ImageKit
		const uploadResponse = await imagekit.upload({
			file: buffer,
			fileName: fileName,
			folder: '/library-covers', // Organize in a subfolder
			tags: ['library', 'book-cover', recordId],
			useUniqueFileName: true,
			responseFields: ['tags', 'customCoordinates', 'isPrivateFile', 'metadata']
		});

		// ImageKit URLs - use transformations for different sizes
		const baseUrl = uploadResponse.url;
		const thumbnailSmall = `${uploadResponse.url}?tr=w-150,h-225,fo-auto,q-80`; // 150x225px
		const thumbnailMedium = `${uploadResponse.url}?tr=w-200,h-300,fo-auto,q-80`; // 200x300px
		const thumbnailLarge = `${uploadResponse.url}?tr=w-300,h-450,fo-auto,q-85`; // 300x450px

		// Deactivate existing covers for this record
		await supabase.from('covers').update({ is_active: false }).eq('marc_record_id', recordId);

		// Insert cover record
		const { data: cover, error: coverError } = await supabase
			.from('covers')
			.insert({
				marc_record_id: recordId,
				isbn: isbn || record.isbn,
				source: 'upload',
				original_url: baseUrl,
				thumbnail_small_url: thumbnailSmall,
				thumbnail_medium_url: thumbnailMedium,
				thumbnail_large_url: thumbnailLarge,
				storage_path_original: uploadResponse.filePath, // ImageKit file path
				mime_type: file.type,
				file_size: file.size,
				quality_score: 100,
				is_placeholder: false,
				fetch_status: 'success',
				is_active: true,
				uploaded_by: session.user.id,
				uploaded_filename: file.name,
				// Store ImageKit-specific metadata
				imagekit_file_id: uploadResponse.fileId
			})
			.select()
			.single();

		if (coverError) {
			console.error('Database error:', coverError);
			// Try to clean up uploaded file from ImageKit
			try {
				await imagekit.deleteFile(uploadResponse.fileId);
			} catch (cleanupError) {
				console.error('Cleanup error:', cleanupError);
			}
			throw error(500, `Database error: ${coverError.message}`);
		}

		return json({
			success: true,
			cover,
			message: 'Cover uploaded successfully to ImageKit'
		});
	} catch (err) {
		console.error('Cover upload error:', err);

		if (err instanceof Response) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Upload failed');
	}
};

export const DELETE: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { coverId } = body;

		if (!coverId) {
			throw error(400, 'coverId is required');
		}

		// Get cover details
		const { data: cover, error: coverError } = await supabase
			.from('covers')
			.select('*')
			.eq('id', coverId)
			.single();

		if (coverError || !cover) {
			throw error(404, 'Cover not found');
		}

		if (cover.source !== 'upload') {
			throw error(400, 'Can only delete uploaded covers');
		}

		// Delete from ImageKit
		if (cover.imagekit_file_id) {
			try {
				await imagekit.deleteFile(cover.imagekit_file_id);
			} catch (imagekitError) {
				console.error('ImageKit delete error:', imagekitError);
				// Continue anyway to remove from database
			}
		}

		// Delete from database
		const { error: deleteError } = await supabase.from('covers').delete().eq('id', coverId);

		if (deleteError) {
			throw error(500, `Delete failed: ${deleteError.message}`);
		}

		return json({
			success: true,
			message: 'Cover deleted successfully'
		});
	} catch (err) {
		console.error('Cover delete error:', err);

		if (err instanceof Response) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Delete failed');
	}
};
```

## Step 5: Add imagekit_file_id Column to Database

Run this SQL in Supabase SQL Editor:

```sql
-- Add imagekit_file_id column to covers table
ALTER TABLE covers
ADD COLUMN IF NOT EXISTS imagekit_file_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_covers_imagekit_file_id
ON covers(imagekit_file_id)
WHERE imagekit_file_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN covers.imagekit_file_id IS 'ImageKit file ID for uploaded covers';
```

## Step 6: Update Environment Import

The code above imports from `$env/static/private`. Make sure your `.env` file is structured correctly:

```env
# .env
PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxxxxxxxxxxx=
```

## Step 7: Test the Integration

1. **Local Testing**:
   ```bash
   npm run dev
   ```

2. **Upload a Cover**:
   - Go to `/admin/cataloging/edit/[record-id]`
   - Upload a cover image
   - Check ImageKit dashboard to see the uploaded file

3. **Verify Transformations**:
   - Open the uploaded cover URL
   - Try different sizes: `?tr=w-200,h-300`
   - ImageKit automatically optimizes format and quality

## Step 8: Deploy to Vercel

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add:
   - `PUBLIC_IMAGEKIT_URL_ENDPOINT`
   - `IMAGEKIT_PUBLIC_KEY`
   - `IMAGEKIT_PRIVATE_KEY` (mark as sensitive)
3. Redeploy your site

## Benefits of ImageKit

### Automatic Optimization
- Converts to WebP/AVIF automatically
- Compresses images without quality loss
- Lazy loading support

### URL-based Transformations
```
Original: https://ik.imagekit.io/abc/cover.jpg
Thumbnail: https://ik.imagekit.io/abc/cover.jpg?tr=w-150,h-225
Large: https://ik.imagekit.io/abc/cover.jpg?tr=w-400,h-600,q-90
```

### CDN Delivery
- Global CDN for fast loading worldwide
- Automatic caching
- 99.9% uptime

### Shared Across Sites
Since you use the same ImageKit account for chompchomp.cc:
- One place to manage all images
- Shared bandwidth/storage quota
- Consistent image delivery

## Troubleshooting

### "ImageKit is not defined"
- Run `npm install imagekit`
- Restart dev server

### "Private key not found"
- Check `.env` file has `IMAGEKIT_PRIVATE_KEY`
- Restart dev server after adding env vars
- In production: check Vercel env vars

### Images not loading
- Check PUBLIC_IMAGEKIT_URL_ENDPOINT is correct
- Verify ImageKit file exists in dashboard
- Check browser console for CORS errors

### Upload fails
- Verify private key is correct
- Check file size < 5MB
- Ensure ImageKit quota isn't exceeded

## Cost Considerations

ImageKit Free Tier:
- 20GB bandwidth/month
- 20GB storage
- Unlimited transformations

If you exceed:
- Upgrade to paid plan ($49/mo for 200GB)
- Or use your existing chompchomp.cc plan

## Migration Guide

To migrate existing Supabase-stored covers to ImageKit:

1. Download covers from Supabase Storage
2. Re-upload through the admin interface
3. Old covers will be deactivated automatically

Or create a migration script (I can help with this if needed).

---

**Questions?** Let me know if you need help with any step!
