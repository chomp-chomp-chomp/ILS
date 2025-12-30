import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const {
		criteria,
		previewOnly = true,
		archiveInsteadOfDelete = false
	} = await request.json();

	if (!criteria || Object.keys(criteria).length === 0) {
		throw error(400, 'Delete criteria required');
	}

	try {
		// Create batch job
		const { data: batchJob, error: jobError } = await supabase
			.from('batch_jobs')
			.insert({
				job_type: 'batch_delete',
				job_name: `Batch Delete: ${JSON.stringify(criteria)}`,
				description: previewOnly ? 'Preview mode' : archiveInsteadOfDelete ? 'Archive records' : 'Delete records',
				parameters: { criteria, archiveInsteadOfDelete },
				status: previewOnly ? 'completed' : 'running',
				created_by: session.user.id
			})
			.select()
			.single();

		if (jobError) throw jobError;

		// Build query based on criteria
		let query = supabase.from('marc_records').select('*, holdings(*)');

		// Apply filters
		if (criteria.materialTypes && criteria.materialTypes.length > 0) {
			query = query.in('material_type', criteria.materialTypes);
		}

		if (criteria.locations && criteria.locations.length > 0) {
			// This requires a join with holdings - simplified for now
		}

		if (criteria.publicationYearFrom) {
			query = query.gte('publication_info->c', criteria.publicationYearFrom.toString());
		}

		if (criteria.publicationYearTo) {
			query = query.lte('publication_info->c', criteria.publicationYearTo.toString());
		}

		if (criteria.noHoldings === true) {
			// Records with no holdings - we'll filter this after fetching
		}

		if (criteria.language) {
			query = query.eq('language_code', criteria.language);
		}

		if (criteria.neverCirculated === true) {
			// Would require join with checkouts table
		}

		const { data: records, error: recordsError } = await query;
		if (recordsError) throw recordsError;

		// Additional filtering for complex criteria
		let filteredRecords = records || [];

		if (criteria.noHoldings === true) {
			filteredRecords = filteredRecords.filter(r => !r.holdings || r.holdings.length === 0);
		}

		// Preview mode - return records that would be deleted
		if (previewOnly) {
			await supabase
				.from('batch_jobs')
				.update({
					total_records: filteredRecords.length,
					result_summary: {
						recordsToDelete: filteredRecords.length,
						preview: filteredRecords.slice(0, 50).map(r => ({
							id: r.id,
							title: r.title_statement?.a,
							isbn: r.isbn,
							material_type: r.material_type,
							holdings_count: r.holdings?.length || 0
						}))
					}
				})
				.eq('id', batchJob.id);

			return json({
				success: true,
				batchJobId: batchJob.id,
				preview: true,
				recordsToDelete: filteredRecords.length,
				records: filteredRecords.slice(0, 50).map(r => ({
					id: r.id,
					title: r.title_statement?.a,
					isbn: r.isbn,
					material_type: r.material_type,
					holdings_count: r.holdings?.length || 0
				}))
			});
		}

		// Execute deletion
		let deletedCount = 0;
		let failedCount = 0;
		const errors: string[] = [];

		for (const record of filteredRecords) {
			try {
				if (archiveInsteadOfDelete) {
					// Archive: add a flag or move to archive table
					// For now, just add a note
					await supabase
						.from('marc_records')
						.update({
							general_note: [...(record.general_note || []), `Archived on ${new Date().toISOString()}`]
						})
						.eq('id', record.id);

					// Log audit
					await supabase.from('audit_log').insert({
						table_name: 'marc_records',
						record_id: record.id,
						operation: 'update',
						old_values: record,
						new_values: { ...record, archived: true },
						batch_job_id: batchJob.id,
						change_reason: 'Batch archive',
						changed_by: session.user.id
					});

					deletedCount++;
				} else {
					// Delete holdings first (cascade)
					if (record.holdings && record.holdings.length > 0) {
						await supabase
							.from('holdings')
							.delete()
							.eq('marc_record_id', record.id);
					}

					// Log before deleting
					await supabase.from('audit_log').insert({
						table_name: 'marc_records',
						record_id: record.id,
						operation: 'delete',
						old_values: record,
						new_values: null,
						batch_job_id: batchJob.id,
						change_reason: 'Batch delete',
						changed_by: session.user.id
					});

					// Delete record
					const { error: deleteError } = await supabase
						.from('marc_records')
						.delete()
						.eq('id', record.id);

					if (deleteError) {
						failedCount++;
						errors.push(`Failed to delete ${record.id}: ${deleteError.message}`);
					} else {
						deletedCount++;
					}
				}
			} catch (err) {
				failedCount++;
				errors.push(`Error processing ${record.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
			}
		}

		// Update batch job
		await supabase
			.from('batch_jobs')
			.update({
				status: failedCount > 0 ? 'completed' : 'completed',
				total_records: filteredRecords.length,
				processed_records: filteredRecords.length,
				successful_records: deletedCount,
				failed_records: failedCount,
				completed_at: new Date().toISOString(),
				error_log: errors,
				result_summary: {
					deleted: deletedCount,
					failed: failedCount,
					archived: archiveInsteadOfDelete
				}
			})
			.eq('id', batchJob.id);

		return json({
			success: true,
			batchJobId: batchJob.id,
			deleted: deletedCount,
			failed: failedCount,
			errors: errors.slice(0, 10) // Return first 10 errors
		});

	} catch (err) {
		console.error('Batch delete error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to perform batch delete');
	}
};

// GET endpoint to preview records matching criteria
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const criteriaParam = url.searchParams.get('criteria');
		if (!criteriaParam) {
			throw error(400, 'Criteria parameter required');
		}

		const criteria = JSON.parse(criteriaParam);

		// Build query
		let query = supabase.from('marc_records').select('id, title_statement, isbn, material_type', { count: 'exact' });

		// Apply filters (same as POST)
		if (criteria.materialTypes && criteria.materialTypes.length > 0) {
			query = query.in('material_type', criteria.materialTypes);
		}

		if (criteria.publicationYearFrom) {
			query = query.gte('publication_info->c', criteria.publicationYearFrom.toString());
		}

		if (criteria.publicationYearTo) {
			query = query.lte('publication_info->c', criteria.publicationYearTo.toString());
		}

		const { data, error: queryError, count } = await query.limit(100);

		if (queryError) throw queryError;

		return json({
			success: true,
			count: count || 0,
			records: data || []
		});

	} catch (err) {
		console.error('Preview error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to preview records');
	}
};
