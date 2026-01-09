/**
 * Cover Management Page - Server Load
 * Loads statistics and queue data for cover management
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	try {
		// Get cover statistics
		const { data: stats, error: statsError } = await supabase
			.from('cover_statistics')
			.select('*')
			.single();

		if (statsError) {
			console.error('Stats error:', statsError);
		}

		// Get pending queue items
		const { data: queueItems, error: queueError } = await supabase
			.from('cover_fetch_queue')
			.select('*')
			.eq('status', 'pending')
			.order('priority', { ascending: false })
			.limit(10);

		if (queueError) {
			console.error('Queue error:', queueError);
		}

		// Get recent failed fetches
		const { data: failedItems, error: failedError } = await supabase
			.from('cover_fetch_queue')
			.select('*')
			.eq('status', 'failed')
			.order('updated_at', { ascending: false })
			.limit(10);

		if (failedError) {
			console.error('Failed items error:', failedError);
		}

		// Get records without covers (sample)
		const { data: missingCovers, error: missingError } = await supabase
			.from('marc_records')
			.select('id, title_statement, main_entry_personal_name, isbn, material_type')
			.not('isbn', 'is', null)
			.limit(100);

		if (missingError) {
			console.error('Missing covers error:', missingError);
		}

		// Filter to only those without active covers
		let recordsWithoutCovers: any[] = [];
		if (missingCovers) {
			for (const record of missingCovers) {
				const { data: existingCover } = await supabase
					.from('covers')
					.select('id')
					.eq('marc_record_id', record.id)
					.eq('is_active', true)
					.single();

				if (!existingCover) {
					recordsWithoutCovers.push(record);
					if (recordsWithoutCovers.length >= 20) break;
				}
			}
		}

		return {
			stats: stats || null,
			queueItems: queueItems || [],
			failedItems: failedItems || [],
			recordsWithoutCovers
		};
	} catch (error) {
		console.error('Page load error:', error);
		return {
			stats: null,
			queueItems: [],
			failedItems: [],
			recordsWithoutCovers: []
		};
	}
};
