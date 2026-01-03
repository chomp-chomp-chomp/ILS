/**
 * Cover Upload API - ImageKit Version
 * Handles manual cover image uploads to ImageKit
 * POST /api/covers/upload - Upload custom cover for a record
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import ImageKit from 'imagekit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Initialize ImageKit (will be null if env vars not set)
let imagekit: ImageKit | null = null;
try {
	if (publicEnv.PUBLIC_IMAGEKIT_URL_ENDPOINT && privateEnv.IMAGEKIT_PUBLIC_KEY && privateEnv.IMAGEKIT_PRIVATE_KEY) {
		imagekit = new ImageKit({
			publicKey: privateEnv.IMAGEKIT_PUBLIC_KEY,
			privateKey: privateEnv.IMAGEKIT_PRIVATE_KEY,
			urlEndpoint: publicEnv.PUBLIC_IMAGEKIT_URL_ENDPOINT
		});
	}
} catch (err) {
	console.error('ImageKit initialization error:', err);
}

/**
 * POST /api/covers/upload
 * Upload a custom cover image for a MARC record
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	// Check if ImageKit is configured
	if (!imagekit) {
		throw error(
			500,
			'ImageKit not configured. Please set IMAGEKIT environment variables in .env file.'
		);
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

		// Validate file type
		if (!ALLOWED_TYPES.includes(file.type)) {
			throw error(400, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`);
		}

		// Validate file size
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

/**
 * DELETE /api/covers/upload
 * Delete an uploaded cover from ImageKit
 */
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

		// Delete from ImageKit if configured and file ID exists
		if (imagekit && cover.imagekit_file_id) {
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
