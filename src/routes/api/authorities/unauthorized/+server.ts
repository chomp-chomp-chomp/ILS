import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Unauthorized Headings API
 *
 * Finds MARC records with headings not linked to authority records
 * Suggests matching authorities for correction
 */

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const field = url.searchParams.get('field'); // '100', '650', etc.
	const limit = parseInt(url.searchParams.get('limit') || '100');

	try {
		// Use the database function to find unauthorized headings
		const { data: unauthorized, error: dbError } = await supabase.rpc(
			'find_unauthorized_headings',
			{
				field_type: field
			}
		);

		if (dbError) throw dbError;

		const unauthorizedHeadings = unauthorized || [];

		// Fetch linked heading count to calculate coverage
		const { count: linkedCount } = await supabase
			.from('marc_authority_links')
			.select('*', { head: true, count: 'exact' });

		const results = unauthorizedHeadings.slice(0, limit);

		// Group by heading for statistics
		const headingCounts = new Map<string, number>();
		unauthorizedHeadings.forEach((item: any) => {
			const count = headingCounts.get(item.heading) || 0;
			headingCounts.set(item.heading, count + 1);
		});

		const totalUnauthorized = unauthorizedHeadings.length;
		const coverageDenominator = totalUnauthorized + (linkedCount || 0);

		const summary = {
			total_unauthorized: totalUnauthorized,
			unique_headings: headingCounts.size,
			coverage: coverageDenominator > 0 ? Math.round(((linkedCount || 0) / coverageDenominator) * 100) : 100,
			top_headings: Array.from(headingCounts.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([heading, count]) => ({ heading, count }))
		};

		return json({
			unauthorized: results,
			summary
		});
	} catch (err) {
		console.error('Error finding unauthorized headings:', err);
		throw error(500, 'Failed to find unauthorized headings');
	}
};

/**
 * POST - Batch correct unauthorized headings
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { corrections } = body;

		// corrections format:
		// [{ marc_record_id, field, field_index, authority_id, old_heading, new_heading }]

		if (!corrections || !Array.isArray(corrections)) {
			throw error(400, 'Corrections array is required');
		}

		const results = {
			success: 0,
			failed: 0,
			errors: [] as any[]
		};

		for (const correction of corrections) {
			try {
				const { marc_record_id, field, field_index = 0, authority_id, new_heading, old_heading } = correction;

				// Create authority link
				const { error: linkError } = await supabase
					.from('marc_authority_links')
					.insert({
						marc_record_id,
						authority_id,
						marc_field: field,
						field_index,
						is_automatic: false,
						confidence: 1.0,
						created_by: session.user.id
					});

				if (linkError) throw linkError;

				// Update the MARC record heading if new_heading provided
				if (new_heading) {
					let updateData: any = {};

					if (field === '100') {
						// Update main entry personal name
						const { data: record } = await supabase
							.from('marc_records')
							.select('main_entry_personal_name')
							.eq('id', marc_record_id)
							.single();

						updateData.main_entry_personal_name = {
							...record?.main_entry_personal_name,
							a: new_heading
						};
					} else if (field === '650') {
						// Update subject heading
						const { data: record } = await supabase
							.from('marc_records')
							.select('subject_topical')
							.eq('id', marc_record_id)
							.single();

						const subjects = record?.subject_topical || [];
						if (subjects[field_index]) {
							subjects[field_index] = {
								...subjects[field_index],
								a: new_heading
							};
							updateData.subject_topical = subjects;
						}
					}

					if (Object.keys(updateData).length > 0) {
						const { error: updateError } = await supabase
							.from('marc_records')
							.update(updateData)
							.eq('id', marc_record_id);

						if (updateError) throw updateError;
					}
				}

				results.success++;
			} catch (err: any) {
				results.failed++;
				results.errors.push({
					correction,
					error: err.message
				});
			}
		}

		// Log the batch correction
		await supabase.from('authority_update_log').insert({
			action: 'heading_corrected',
			records_affected: results.success,
			old_value: corrections.map((c: any) => ({
				marc_record_id: c.marc_record_id,
				field: c.field,
				field_index: c.field_index ?? 0,
				old_heading: c.old_heading
			})),
			new_value: corrections.map((c: any) => ({
				marc_record_id: c.marc_record_id,
				field: c.field,
				field_index: c.field_index ?? 0,
				authority_id: c.authority_id,
				new_heading: c.new_heading
			})),
			performed_by: session.user.id,
			note: `Batch correction: ${results.success} succeeded, ${results.failed} failed`
		});

		return json(results);
	} catch (err: any) {
		console.error('Error batch correcting headings:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to batch correct headings');
	}
};
