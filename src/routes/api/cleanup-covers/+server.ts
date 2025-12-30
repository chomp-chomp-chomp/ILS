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
				// Actually download the image to check its real size
				const response = await fetch(coverUrl);

				let shouldRemove = false;
				let reason = '';

				if (!response.ok) {
					// Cover URL is dead/broken
					shouldRemove = true;
					reason = `Dead link (${response.status})`;
				} else {
					// Get the actual image data
					const arrayBuffer = await response.arrayBuffer();
					const actualSize = arrayBuffer.byteLength;

					// Open Library placeholders are typically < 1KB (807 bytes is common)
					// Real book covers are almost always > 10KB
					if (actualSize < 10000) {
						shouldRemove = true;
						reason = `Placeholder detected (${Math.round(actualSize / 1024)}KB - too small)`;
					} else {
						// Additional check: look for Open Library placeholder patterns
						const contentType = response.headers.get('content-type');

						// If it's from covers.openlibrary.org and suspiciously small, remove it
						if (coverUrl.includes('covers.openlibrary.org') && actualSize < 15000) {
							shouldRemove = true;
							reason = `Open Library placeholder (${Math.round(actualSize / 1024)}KB)`;
						} else {
							// Valid cover, keep it
							reason = `Valid cover (${Math.round(actualSize / 1024)}KB)`;
						}
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

				results.push({
					id: record.id,
					title: record.title_statement?.a || 'Untitled',
					reason,
					removed: shouldRemove
				});

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
