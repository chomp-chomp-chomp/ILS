/**
 * Cover Upload API
 * Handles manual cover image uploads to Supabase Storage
 * POST /api/covers/upload - Upload custom cover for a record
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/covers/upload
 * Upload a custom cover image for a MARC record
 */
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

		// Generate unique filename
		const timestamp = Date.now();
		const extension = file.name.split('.').pop() || 'jpg';
		const filename = `cover-${recordId}-${timestamp}.${extension}`;
		const storagePath = `covers/${filename}`;

		// Upload to Supabase Storage
		const { data: uploadData, error: uploadError } = await supabase.storage
			.from('book-covers')
			.upload(storagePath, file, {
				contentType: file.type,
				cacheControl: '3600',
				upsert: false
			});

		if (uploadError) {
			console.error('Upload error:', uploadError);
			throw error(500, `Upload failed: ${uploadError.message}`);
		}

		// Get public URL
		const {
			data: { publicUrl }
		} = supabase.storage.from('book-covers').getPublicUrl(storagePath);

		// TODO: Generate thumbnails (future enhancement)
		// For now, use the same URL for all sizes

		// Deactivate existing covers for this record
		await supabase.from('covers').update({ is_active: false }).eq('marc_record_id', recordId);

		// Insert cover record
		const { data: cover, error: coverError } = await supabase
			.from('covers')
			.insert({
				marc_record_id: recordId,
				isbn: isbn || record.isbn,
				source: 'upload',
				original_url: publicUrl,
				thumbnail_small_url: publicUrl,
				thumbnail_medium_url: publicUrl,
				thumbnail_large_url: publicUrl,
				storage_path_original: storagePath,
				mime_type: file.type,
				file_size: file.size,
				quality_score: 100, // Uploaded images are highest quality
				is_placeholder: false,
				fetch_status: 'success',
				is_active: true,
				uploaded_by: session.user.id,
				uploaded_filename: file.name
			})
			.select()
			.single();

		if (coverError) {
			console.error('Database error:', coverError);
			// Try to clean up uploaded file
			await supabase.storage.from('book-covers').remove([storagePath]);
			throw error(500, `Database error: ${coverError.message}`);
		}

		return json({
			success: true,
			cover,
			message: 'Cover uploaded successfully'
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
 * Delete an uploaded cover from storage
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

		// Only delete if it's an uploaded cover
		if (cover.source !== 'upload' || !cover.storage_path_original) {
			throw error(400, 'Can only delete uploaded covers');
		}

		// Delete from storage
		const { error: storageError } = await supabase.storage
			.from('book-covers')
			.remove([cover.storage_path_original]);

		if (storageError) {
			console.error('Storage delete error:', storageError);
			// Continue anyway to remove from database
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
