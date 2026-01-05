/**
 * Bulk Cover Migration API
 * Migrates existing covers to ImageKit and/or re-fetches from Open Library
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
 * POST /api/covers/bulk-migrate
 * Migrate existing covers to ImageKit
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
		const { batchSize = 10, operation = 'migrate' } = await request.json();

		let records: any[] = [];

		// First, get IDs of records that already have ImageKit covers
		const { data: existingCovers, error: coversError } = await supabase
			.from('covers')
			.select('marc_record_id, imagekit_file_id')
			.eq('is_active', true)
			.not('imagekit_file_id', 'is', null);

		console.log(`Covers table query - Error:`, coversError, `Records found:`, existingCovers?.length || 0);

		// If covers table doesn't have imagekit_file_id column or query fails, just process all
		const processedIds = (coversError ? [] : existingCovers?.map(c => c.marc_record_id)) || [];

		console.log(`Cover migration - Found ${processedIds.length} records already with ImageKit covers`);
		if (processedIds.length > 0 && processedIds.length <= 5) {
			console.log(`First few processed IDs:`, processedIds.slice(0, 5));
		}

		if (operation === 'migrate') {
			// Get records with cover_image_url but no ImageKit cover in covers table
			let query = supabase
				.from('marc_records')
				.select('id, isbn, title_statement, cover_image_url')
				.not('cover_image_url', 'is', null);

			// Exclude already processed records
			if (processedIds.length > 0) {
				query = query.not('id', 'in', `(${processedIds.join(',')})`);
			}

			const { data, error } = await query.limit(batchSize);

			if (error) throw error;
			records = data || [];
		} else if (operation === 'refetch') {
			// First check total count of records with ISBNs
			const { count: totalWithISBN } = await supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('isbn', 'is', null);

			console.log(`Re-fetch: Total records with ISBN = ${totalWithISBN}`);
			console.log(`Re-fetch: processedIds count = ${processedIds.length}`);

			// Get records with ISBNs but no ImageKit cover yet
			let query = supabase
				.from('marc_records')
				.select('id, isbn, title_statement, cover_image_url')
				.not('isbn', 'is', null);

			// Exclude already processed records
			if (processedIds.length > 0) {
				console.log(`Re-fetch: Excluding ${processedIds.length} already processed records`);
				query = query.not('id', 'in', `(${processedIds.join(',')})`);
			}

			const { data, error } = await query.limit(batchSize);

			console.log(`Re-fetch: Query returned ${data?.length || 0} records, error:`, error);

			if (error) throw error;
			records = data || [];
		}

		const results = [];

		for (const record of records) {
			try {
				let coverUrl: string | null = null;

				if (operation === 'migrate' && record.cover_image_url) {
					// Download existing cover and upload to ImageKit
					const imageResponse = await fetch(record.cover_image_url);
					if (!imageResponse.ok) {
						results.push({
							id: record.id,
							title: record.title_statement?.a,
							success: false,
							error: 'Failed to download existing cover'
						});
						continue;
					}

					const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
					const timestamp = Date.now();
					const fileName = `cover-${record.id}-${timestamp}.jpg`;

					// Upload to ImageKit
					const uploadResponse = await imagekit.upload({
						file: imageBuffer,
						fileName: fileName,
						folder: '/library-covers',
						tags: ['library', 'book-cover', record.id, 'migrated'],
						useUniqueFileName: true
					});

					coverUrl = uploadResponse.url;

					// Create cover record with ImageKit data
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
						quality_score: 90,
						is_placeholder: false,
						fetch_status: 'success',
						is_active: true,
						uploaded_by: session.user.id,
						imagekit_file_id: uploadResponse.fileId
					});

					// Update marc_records
					await supabase
						.from('marc_records')
						.update({ cover_image_url: coverUrl })
						.eq('id', record.id);

				} else if (operation === 'refetch' && record.isbn) {
					// Try Open Library first, then Google Books as fallback
					const isbn = record.isbn.replace(/[-\s]/g, '');
					let imageBuffer: Buffer | null = null;
					let source = '';

					// Try Open Library
					const olResponse = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
					if (olResponse.ok && olResponse.headers.get('content-type')?.startsWith('image/')) {
						imageBuffer = Buffer.from(await olResponse.arrayBuffer());
						source = 'openlibrary';
					}

					// If Open Library failed, try Google Books
					if (!imageBuffer) {
						const gbResponse = await fetch(`https://books.google.com/books/content?id=${isbn}&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api`);
						if (gbResponse.ok && gbResponse.headers.get('content-type')?.startsWith('image/')) {
							imageBuffer = Buffer.from(await gbResponse.arrayBuffer());
							source = 'google';
						}
					}

					// If we got a cover from either source
					if (imageBuffer && source) {
						const timestamp = Date.now();
						const fileName = `cover-${record.id}-${timestamp}.jpg`;

						// Upload to ImageKit
						const uploadResponse = await imagekit.upload({
							file: imageBuffer,
							fileName: fileName,
							folder: '/library-covers',
							tags: ['library', 'book-cover', record.id, source],
							useUniqueFileName: true
						});

						coverUrl = uploadResponse.url;

						const thumbnailSmall = `${uploadResponse.url}?tr=w-150,h-225,fo-auto,q-80`;
						const thumbnailMedium = `${uploadResponse.url}?tr=w-200,h-300,fo-auto,q-80`;
						const thumbnailLarge = `${uploadResponse.url}?tr=w-300,h-450,fo-auto,q-85`;

						// Deactivate old covers
						await supabase.from('covers').update({ is_active: false }).eq('marc_record_id', record.id);

						// Insert new cover record
						await supabase.from('covers').insert({
							marc_record_id: record.id,
							isbn: record.isbn,
							source,
							original_url: coverUrl,
							thumbnail_small_url: thumbnailSmall,
							thumbnail_medium_url: thumbnailMedium,
							thumbnail_large_url: thumbnailLarge,
							storage_path_original: uploadResponse.filePath,
							quality_score: source === 'openlibrary' ? 80 : 75,
							is_placeholder: false,
							fetch_status: 'success',
							is_active: true,
							imagekit_file_id: uploadResponse.fileId
						});

						// Update marc_records
						await supabase
							.from('marc_records')
							.update({ cover_image_url: coverUrl })
							.eq('id', record.id);
					} else {
						results.push({
							id: record.id,
							title: record.title_statement?.a,
							success: false,
							error: 'No cover found on Open Library or Google Books'
						});
						continue;
					}
				}

				results.push({
					id: record.id,
					title: record.title_statement?.a,
					success: true,
					coverUrl
				});
			} catch (error: any) {
				results.push({
					id: record.id,
					title: record.title_statement?.a,
					success: false,
					error: error.message
				});
			}
		}

		// Count remaining records (excluding ones with ImageKit covers)
		// Re-fetch the processed IDs to include the ones we just processed
		const { data: updatedCovers } = await supabase
			.from('covers')
			.select('marc_record_id')
			.eq('is_active', true)
			.not('imagekit_file_id', 'is', null);

		const updatedProcessedIds = updatedCovers?.map(c => c.marc_record_id) || [];

		let remaining = 0;
		if (operation === 'migrate') {
			let countQuery = supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('cover_image_url', 'is', null);

			if (updatedProcessedIds.length > 0) {
				countQuery = countQuery.not('id', 'in', `(${updatedProcessedIds.join(',')})`);
			}

			const { count } = await countQuery;
			remaining = count || 0;
		} else if (operation === 'refetch') {
			let countQuery = supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('isbn', 'is', null);

			if (updatedProcessedIds.length > 0) {
				countQuery = countQuery.not('id', 'in', `(${updatedProcessedIds.join(',')})`);
			}

			const { count } = await countQuery;
			remaining = count || 0;
		}

		return json({
			success: true,
			processed: records.length,
			succeeded: results.filter(r => r.success).length,
			failed: results.filter(r => !r.success).length,
			remaining,
			results
		});
	} catch (error: any) {
		console.error('Bulk migration error:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
