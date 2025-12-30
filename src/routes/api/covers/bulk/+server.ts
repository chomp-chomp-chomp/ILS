/**
 * Bulk Cover Fetching API
 * Processes cover fetch queue and bulk operations
 * POST /api/covers/bulk - Queue multiple records for cover fetching
 * GET /api/covers/bulk - Get queue status
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/covers/bulk
 * Get queue status and statistics
 */
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const action = url.searchParams.get('action');

		// Get statistics
		if (action === 'stats') {
			const { data: stats, error: statsError } = await supabase
				.from('cover_statistics')
				.select('*')
				.single();

			if (statsError) throw statsError;

			return json({ success: true, stats });
		}

		// Get queue items
		const status = url.searchParams.get('status') || 'pending';
		const limit = parseInt(url.searchParams.get('limit') || '50');

		const { data: queueItems, error: queueError } = await supabase
			.from('cover_fetch_queue')
			.select(
				`
        *,
        marc_records (
          id,
          title_statement,
          main_entry_personal_name,
          isbn
        )
      `
			)
			.eq('status', status)
			.order('priority', { ascending: false })
			.order('scheduled_for', { ascending: true })
			.limit(limit);

		if (queueError) throw queueError;

		return json({
			success: true,
			queueItems,
			total: queueItems?.length || 0
		});
	} catch (err) {
		console.error('Bulk fetch GET error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to get queue status');
	}
};

/**
 * POST /api/covers/bulk
 * Bulk operations: queue, process, or queue missing covers
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { action, recordIds, priority, limit, materialType } = body;

		// Action: Queue specific records
		if (action === 'queue' && recordIds && Array.isArray(recordIds)) {
			const queueItems = [];

			for (const recordId of recordIds) {
				// Get record details
				const { data: record, error: recordError } = await supabase
					.from('marc_records')
					.select('id, isbn, title_statement, main_entry_personal_name')
					.eq('id', recordId)
					.single();

				if (recordError || !record) {
					console.warn(`Record ${recordId} not found`);
					continue;
				}

				// Check if already has active cover
				const { data: existingCover } = await supabase
					.from('covers')
					.select('id')
					.eq('marc_record_id', recordId)
					.eq('is_active', true)
					.single();

				if (existingCover) {
					console.log(`Record ${recordId} already has a cover`);
					continue;
				}

				// Check if already in queue
				const { data: existingQueue } = await supabase
					.from('cover_fetch_queue')
					.select('id')
					.eq('marc_record_id', recordId)
					.in('status', ['pending', 'processing'])
					.single();

				if (existingQueue) {
					console.log(`Record ${recordId} already in queue`);
					continue;
				}

				queueItems.push({
					marc_record_id: recordId,
					isbn: record.isbn,
					title: record.title_statement?.a,
					author: record.main_entry_personal_name?.a,
					priority: priority || 50,
					status: 'pending',
					created_by: session.user.id
				});
			}

			if (queueItems.length > 0) {
				const { data: inserted, error: insertError } = await supabase
					.from('cover_fetch_queue')
					.insert(queueItems)
					.select();

				if (insertError) throw insertError;

				return json({
					success: true,
					queued: inserted?.length || 0,
					message: `Queued ${inserted?.length} records for cover fetching`
				});
			}

			return json({
				success: true,
				queued: 0,
				message: 'No new records queued (all already have covers or are in queue)'
			});
		}

		// Action: Queue all missing covers
		if (action === 'queue-missing') {
			const limitCount = limit || 100;
			const priorityLevel = priority || 50;

			// Use the database function to queue missing covers
			const { data, error: queueError } = await supabase.rpc('queue_missing_covers', {
				limit_count: limitCount,
				priority_level: priorityLevel,
				material_type_filter: materialType || null
			});

			if (queueError) throw queueError;

			return json({
				success: true,
				queued: data || 0,
				message: `Queued ${data} records without covers`
			});
		}

		// Action: Process queue (fetch covers)
		if (action === 'process') {
			const batchSize = limit || 10;
			const results = {
				processed: 0,
				successful: 0,
				failed: 0,
				errors: [] as string[]
			};

			for (let i = 0; i < batchSize; i++) {
				// Get next item from queue
				const { data: queueItem, error: queueError } = await supabase.rpc(
					'get_next_cover_fetch'
				);

				if (queueError) {
					console.error('Queue fetch error:', queueError);
					break;
				}

				if (!queueItem || queueItem.length === 0) {
					// Queue is empty
					break;
				}

				const item = queueItem[0];
				results.processed++;

				try {
					// Fetch cover using the fetch API
					const fetchResponse = await fetch(`${url.origin}/api/covers/fetch`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Cookie: request.headers.get('Cookie') || ''
						},
						body: JSON.stringify({
							recordId: item.marc_record_id,
							isbn: item.isbn,
							title: item.title,
							author: item.author,
							sources: item.sources_to_try,
							saveToDatabase: true
						})
					});

					const fetchResult = await fetchResponse.json();

					if (fetchResult.success) {
						// Mark as completed
						await supabase.rpc('complete_cover_fetch', {
							queue_id: item.queue_id,
							success: true,
							source: fetchResult.cover?.source,
							cover_id: fetchResult.cover?.id
						});

						results.successful++;
					} else {
						// Mark as failed
						await supabase.rpc('complete_cover_fetch', {
							queue_id: item.queue_id,
							success: false,
							error_msg: fetchResult.message || 'Unknown error'
						});

						results.failed++;
						results.errors.push(`${item.title}: ${fetchResult.message}`);
					}
				} catch (err) {
					console.error('Process error:', err);

					// Mark as failed
					await supabase.rpc('complete_cover_fetch', {
						queue_id: item.queue_id,
						success: false,
						error_msg: err instanceof Error ? err.message : 'Processing error'
					});

					results.failed++;
					results.errors.push(`${item.title}: ${err instanceof Error ? err.message : 'Error'}`);
				}

				// Small delay to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			return json({
				success: true,
				results,
				message: `Processed ${results.processed} items: ${results.successful} successful, ${results.failed} failed`
			});
		}

		// Action: Clear completed/failed items
		if (action === 'clear') {
			const clearStatus = body.status || 'completed';

			const { error: deleteError } = await supabase
				.from('cover_fetch_queue')
				.delete()
				.eq('status', clearStatus);

			if (deleteError) throw deleteError;

			return json({
				success: true,
				message: `Cleared ${clearStatus} queue items`
			});
		}

		// Action: Retry failed items
		if (action === 'retry-failed') {
			const { error: updateError } = await supabase
				.from('cover_fetch_queue')
				.update({
					status: 'pending',
					attempts: 0,
					next_retry_at: null,
					scheduled_for: new Date().toISOString()
				})
				.eq('status', 'failed');

			if (updateError) throw updateError;

			return json({
				success: true,
				message: 'Reset failed items to pending'
			});
		}

		throw error(400, 'Invalid action or missing parameters');
	} catch (err) {
		console.error('Bulk fetch POST error:', err);

		if (err instanceof Response) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Bulk operation failed');
	}
};

/**
 * DELETE /api/covers/bulk
 * Remove items from queue
 */
export const DELETE: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { queueIds } = body;

		if (!queueIds || !Array.isArray(queueIds)) {
			throw error(400, 'queueIds array is required');
		}

		const { error: deleteError } = await supabase
			.from('cover_fetch_queue')
			.delete()
			.in('id', queueIds);

		if (deleteError) throw deleteError;

		return json({
			success: true,
			message: `Removed ${queueIds.length} items from queue`
		});
	} catch (err) {
		console.error('Bulk delete error:', err);

		if (err instanceof Response) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Delete failed');
	}
};
