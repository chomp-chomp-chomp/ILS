/**
 * Cover Upload API - ImageKit Version (Legacy Endpoint)
 * Handles manual cover image uploads to ImageKit
 * This endpoint maintains backward compatibility with existing UI
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import ImageKit from 'imagekit';
import { env } from '$env/dynamic/private';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Initialize ImageKit (will be null if env vars not set)
let imagekit: ImageKit | null = null;
try {
	if (env.PUBLIC_IMAGEKIT_URL_ENDPOINT && env.IMAGEKIT_PUBLIC_KEY && env.IMAGEKIT_PRIVATE_KEY) {
		imagekit = new ImageKit({
			publicKey: env.IMAGEKIT_PUBLIC_KEY,
			privateKey: env.IMAGEKIT_PRIVATE_KEY,
			urlEndpoint: env.PUBLIC_IMAGEKIT_URL_ENDPOINT
		});
	}
} catch (err) {
	console.error('ImageKit initialization error:', err);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { session } = await safeGetSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check if ImageKit is configured
	if (!imagekit) {
		return json(
			{ error: 'ImageKit not configured. Please set IMAGEKIT environment variables.' },
			{ status: 500 }
		);
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const recordId = formData.get('recordId') as string;

		// Validation
		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!recordId) {
			return json({ error: 'No record ID provided' }, { status: 400 });
		}

		// Validate file type
		if (!ALLOWED_TYPES.includes(file.type)) {
			return json(
				{ error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
				{ status: 400 }
			);
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			return json(
				{ error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
				{ status: 400 }
			);
		}

		// Verify record exists
		const { data: record, error: recordError } = await supabase
			.from('marc_records')
			.select('id, isbn, title_statement')
			.eq('id', recordId)
			.single();

		if (recordError || !record) {
			return json({ error: 'Record not found' }, { status: 404 });
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
			folder: '/library-covers',
			tags: ['library', 'book-cover', recordId],
			useUniqueFileName: true,
			responseFields: ['tags', 'customCoordinates', 'isPrivateFile', 'metadata']
		});

		// ImageKit URLs - use transformations for different sizes
		const baseUrl = uploadResponse.url;
		const thumbnailSmall = `${uploadResponse.url}?tr=w-150,h-225,fo-auto,q-80`;
		const thumbnailMedium = `${uploadResponse.url}?tr=w-200,h-300,fo-auto,q-80`;
		const thumbnailLarge = `${uploadResponse.url}?tr=w-300,h-450,fo-auto,q-85`;

		// Deactivate existing covers for this record
		await supabase.from('covers').update({ is_active: false }).eq('marc_record_id', recordId);

		// Insert cover record
		const { data: cover, error: coverError } = await supabase
			.from('covers')
			.insert({
				marc_record_id: recordId,
				isbn: record.isbn,
				source: 'upload',
				original_url: baseUrl,
				thumbnail_small_url: thumbnailSmall,
				thumbnail_medium_url: thumbnailMedium,
				thumbnail_large_url: thumbnailLarge,
				storage_path_original: uploadResponse.filePath,
				mime_type: file.type,
				file_size: file.size,
				quality_score: 100,
				is_placeholder: false,
				fetch_status: 'success',
				is_active: true,
				uploaded_by: session.user.id,
				uploaded_filename: file.name,
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
			return json({ error: `Database error: ${coverError.message}` }, { status: 500 });
		}

		// Also update marc_records.cover_image_url for backward compatibility
		await supabase
			.from('marc_records')
			.update({ cover_image_url: baseUrl })
			.eq('id', recordId);

		return json({
			success: true,
			coverUrl: baseUrl, // For backward compatibility
			cover,
			message: 'Cover uploaded successfully to ImageKit'
		});
	} catch (error: any) {
		console.error('Cover upload error:', error);
		return json(
			{ error: error?.message || 'Internal server error' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { session } = await safeGetSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { recordId } = await request.json();

		if (!recordId) {
			return json({ error: 'No record ID provided' }, { status: 400 });
		}

		// Get active cover for this record
		const { data: cover } = await supabase
			.from('covers')
			.select('*')
			.eq('marc_record_id', recordId)
			.eq('is_active', true)
			.eq('source', 'upload')
			.single();

		// Delete from ImageKit if configured and file ID exists
		if (imagekit && cover?.imagekit_file_id) {
			try {
				await imagekit.deleteFile(cover.imagekit_file_id);
			} catch (imagekitError) {
				console.error('ImageKit delete error:', imagekitError);
				// Continue anyway to remove from database
			}
		}

		// Delete from database
		if (cover) {
			await supabase.from('covers').delete().eq('id', cover.id);
		}

		// Remove cover URL from marc_records for backward compatibility
		await supabase
			.from('marc_records')
			.update({ cover_image_url: null })
			.eq('id', recordId);

		return json({
			success: true,
			message: 'Cover removed successfully'
		});
	} catch (error: any) {
		console.error('Cover delete error:', error);
		return json(
			{ error: error?.message || 'Internal server error' },
			{ status: 500 }
		);
	}
};
