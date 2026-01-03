/**
 * Bulk Local Cover Upload API
 * Upload multiple local cover images to ImageKit
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import ImageKit from 'imagekit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Initialize ImageKit
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
 * POST /api/covers/bulk-upload
 * Upload multiple local files to ImageKit
 * Matches files to records by ISBN or record ID in filename
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!imagekit) {
		return json({ error: 'ImageKit not configured' }, { status: 500 });
	}

	try {
		const formData = await request.formData();
		const files = formData.getAll('files') as File[];

		if (!files || files.length === 0) {
			return json({ error: 'No files provided' }, { status: 400 });
		}

		const results = [];

		for (const file of files) {
			try {
				// Try to extract identifier from filename
				// Supports formats like: 9780062316097.jpg, 123e4567-e89b.png, cover-9780062316097.jpg
				const fileName = file.name.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
				let identifier = fileName;

				// Remove common prefixes
				identifier = identifier.replace(/^(cover[-_]?|book[-_]?|img[-_]?)/i, '');

				// Try to find record by ISBN first
				let record = null;
				const isbnMatch = identifier.match(/\d{10,13}/);

				if (isbnMatch) {
					const isbn = isbnMatch[0];
					const { data } = await supabase
						.from('marc_records')
						.select('id, isbn, title_statement')
						.eq('isbn', isbn)
						.single();
					record = data;
				}

				// If not found by ISBN, try by UUID (record ID)
				if (!record) {
					const uuidMatch = identifier.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
					if (uuidMatch) {
						const recordId = uuidMatch[0];
						const { data } = await supabase
							.from('marc_records')
							.select('id, isbn, title_statement')
							.eq('id', recordId)
							.single();
						record = data;
					}
				}

				if (!record) {
					results.push({
						filename: file.name,
						success: false,
						error: 'Could not match file to any record. Use ISBN or record ID in filename.'
					});
					continue;
				}

				// Upload to ImageKit
				const buffer = Buffer.from(await file.arrayBuffer());
				const timestamp = Date.now();
				const extension = file.name.split('.').pop() || 'jpg';
				const imagekitFileName = `cover-${record.id}-${timestamp}.${extension}`;

				const uploadResponse = await imagekit.upload({
					file: buffer,
					fileName: imagekitFileName,
					folder: '/library-covers',
					tags: ['library', 'book-cover', record.id, 'bulk-upload'],
					useUniqueFileName: true
				});

				const coverUrl = uploadResponse.url;
				const thumbnailSmall = `${uploadResponse.url}?tr=w-150,h-225,fo-auto,q-80`;
				const thumbnailMedium = `${uploadResponse.url}?tr=w-200,h-300,fo-auto,q-80`;
				const thumbnailLarge = `${uploadResponse.url}?tr=w-300,h-450,fo-auto,q-85`;

				// Deactivate old covers
				await supabase.from('covers').update({ is_active: false }).eq('marc_record_id', record.id);

				// Insert new cover record
				await supabase.from('covers').insert({
					marc_record_id: record.id,
					isbn: record.isbn,
					source: 'upload',
					original_url: coverUrl,
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
				});

				// Update marc_records
				await supabase
					.from('marc_records')
					.update({ cover_image_url: coverUrl })
					.eq('id', record.id);

				results.push({
					filename: file.name,
					recordId: record.id,
					title: record.title_statement?.a,
					success: true,
					coverUrl
				});
			} catch (error: any) {
				results.push({
					filename: file.name,
					success: false,
					error: error.message
				});
			}
		}

		const succeeded = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;

		return json({
			success: true,
			total: files.length,
			succeeded,
			failed,
			results
		});
	} catch (error: any) {
		console.error('Bulk upload error:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
