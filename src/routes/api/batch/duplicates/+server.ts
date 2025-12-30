import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Find duplicate records
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const method = url.searchParams.get('method') || 'isbn'; // isbn, title, lccn, all
		const threshold = parseFloat(url.searchParams.get('threshold') || '0.8');
		const status = url.searchParams.get('status') || 'pending';

		// If requesting existing duplicates
		if (status !== 'new') {
			const { data, error: queryError } = await supabase
				.from('duplicate_records')
				.select(`
					*,
					record_a:marc_records!duplicate_records_record_a_id_fkey(id, title_statement, isbn, main_entry_personal_name),
					record_b:marc_records!duplicate_records_record_b_id_fkey(id, title_statement, isbn, main_entry_personal_name)
				`)
				.eq('status', status)
				.order('similarity_score', { ascending: false })
				.limit(100);

			if (queryError) throw queryError;

			return json({ success: true, duplicates: data || [] });
		}

		// Find new duplicates
		let duplicates: any[] = [];

		if (method === 'isbn' || method === 'all') {
			const { data: isbnDupes, error: isbnError } = await supabase
				.rpc('find_duplicates_by_isbn');

			if (isbnError) {
				console.error('ISBN duplicates error:', isbnError);
			} else if (isbnDupes) {
				duplicates.push(...isbnDupes.map((d: any) => ({
					...d,
					match_method: 'isbn'
				})));
			}
		}

		if (method === 'title' || method === 'all') {
			const { data: titleDupes, error: titleError } = await supabase
				.rpc('find_duplicates_by_title', { threshold });

			if (titleError) {
				console.error('Title duplicates error:', titleError);
			} else if (titleDupes) {
				duplicates.push(...titleDupes.map((d: any) => ({
					...d,
					match_method: 'title_similarity'
				})));
			}
		}

		// Get full record details for duplicates
		const duplicatesWithDetails = await Promise.all(
			duplicates.slice(0, 100).map(async (dup) => {
				const { data: records } = await supabase
					.from('marc_records')
					.select('id, title_statement, isbn, issn, main_entry_personal_name, publication_info, material_type')
					.in('id', [dup.record_a_id, dup.record_b_id]);

				const recordA = records?.find(r => r.id === dup.record_a_id);
				const recordB = records?.find(r => r.id === dup.record_b_id);

				return {
					...dup,
					record_a: recordA,
					record_b: recordB
				};
			})
		);

		// Save to duplicate_records table
		if (duplicatesWithDetails.length > 0) {
			const insertData = duplicatesWithDetails.map(d => ({
				record_a_id: d.record_a_id,
				record_b_id: d.record_b_id,
				similarity_score: d.similarity_score,
				match_method: d.match_method,
				status: 'pending'
			}));

			// Insert, ignoring conflicts (duplicates already exist)
			await supabase
				.from('duplicate_records')
				.upsert(insertData, { onConflict: 'record_a_id,record_b_id', ignoreDuplicates: true });
		}

		return json({
			success: true,
			duplicates: duplicatesWithDetails,
			count: duplicatesWithDetails.length
		});

	} catch (err) {
		console.error('Error finding duplicates:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to find duplicates');
	}
};

// POST - Mark duplicate status
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { duplicateId, status, notes } = await request.json();

		if (!duplicateId || !status) {
			throw error(400, 'Duplicate ID and status required');
		}

		const { data, error: updateError } = await supabase
			.from('duplicate_records')
			.update({
				status,
				resolved_at: new Date().toISOString(),
				resolved_by: session.user.id,
				resolution_notes: notes
			})
			.eq('id', duplicateId)
			.select()
			.single();

		if (updateError) throw updateError;

		return json({ success: true, duplicate: data });

	} catch (err) {
		console.error('Error updating duplicate status:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to update duplicate status');
	}
};
