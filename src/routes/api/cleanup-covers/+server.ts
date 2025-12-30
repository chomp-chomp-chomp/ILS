import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { session } = await safeGetSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { batchSize = 50 } = await request.json();

		// Get records WITH covers to verify
		const { data: records, error: fetchError } = await supabase
			.from('marc_records')
			.select('id, title_statement, cover_image_url')
			.not('cover_image_url', 'is', null)
			.limit(batchSize);

		if (fetchError) {
			return json({ error: fetchError.message }, { status: 500 });
		}

		if (!records || records.length === 0) {
			return json({
				processed: 0,
				removed: 0,
				remaining: 0,
				message: 'No records to verify'
			});
		}

		const results = [];
		let removedCount = 0;

		for (const record of records) {
			const coverUrl = record.cover_image_url;

			if (!coverUrl) continue;

			try {
				// Check if the cover URL is valid and points to a real image
				const response = await fetch(coverUrl, { method: 'HEAD' });

				let shouldRemove = false;

				if (!response.ok) {
					// Cover URL is dead/broken
					shouldRemove = true;
					results.push({
						id: record.id,
						title: record.title_statement?.a || 'Untitled',
						reason: 'Dead link (404/error)',
						removed: true
					});
				} else {
					// Check content length for placeholders
					const contentLength = response.headers.get('content-length');
					if (contentLength && parseInt(contentLength) < 5000) {
						// Likely a placeholder image (< 5KB)
						shouldRemove = true;
						results.push({
							id: record.id,
							title: record.title_statement?.a || 'Untitled',
							reason: `Placeholder detected (${contentLength} bytes)`,
							removed: true
						});
					} else {
						// Valid cover, keep it
						results.push({
							id: record.id,
							title: record.title_statement?.a || 'Untitled',
							reason: 'Valid cover',
							removed: false
						});
					}
				}

				if (shouldRemove) {
					// Remove the invalid cover URL
					const { error: updateError } = await supabase
						.from('marc_records')
						.update({ cover_image_url: null })
						.eq('id', record.id);

					if (!updateError) {
						removedCount++;
					}
				}
			} catch (error) {
				// If we can't verify, assume it's bad and remove it
				const { error: updateError } = await supabase
					.from('marc_records')
					.update({ cover_image_url: null })
					.eq('id', record.id);

				if (!updateError) {
					removedCount++;
					results.push({
						id: record.id,
						title: record.title_statement?.a || 'Untitled',
						reason: 'Failed to verify (removed)',
						removed: true
					});
				}
			}
		}

		// Get count of remaining records with covers
		const { count: remainingCount } = await supabase
			.from('marc_records')
			.select('id', { count: 'exact', head: true })
			.not('cover_image_url', 'is', null);

		return json({
			processed: records.length,
			removed: removedCount,
			remaining: remainingCount || 0,
			results
		});

	} catch (error: any) {
		console.error('Cover cleanup error:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
