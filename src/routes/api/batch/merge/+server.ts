import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const {
		sourceRecordIds, // Array of record IDs to merge
		targetRecordId, // Keep this record
		fieldSelections, // Which fields to keep from which record
		mergeStrategy = 'field_by_field', // 'keep_target', 'keep_source', 'field_by_field'
		duplicateRecordId = null // If this merge is resolving a duplicate
	} = await request.json();

	if (!sourceRecordIds || !Array.isArray(sourceRecordIds) || sourceRecordIds.length === 0) {
		throw error(400, 'Source record IDs required');
	}

	if (!targetRecordId) {
		throw error(400, 'Target record ID required');
	}

	try {
		// Create batch job
		const { data: batchJob, error: jobError } = await supabase
			.from('batch_jobs')
			.insert({
				job_type: 'merge',
				job_name: `Merge Records: ${sourceRecordIds.length} → 1`,
				description: `Merging ${sourceRecordIds.length} records into ${targetRecordId}`,
				parameters: { sourceRecordIds, targetRecordId, fieldSelections, mergeStrategy },
				status: 'running',
				created_by: session.user.id
			})
			.select()
			.single();

		if (jobError) throw jobError;

		// Fetch all records
		const { data: allRecords, error: fetchError } = await supabase
			.from('marc_records')
			.select('*, holdings(*)')
			.in('id', [...sourceRecordIds, targetRecordId]);

		if (fetchError) throw fetchError;

		const targetRecord = allRecords?.find(r => r.id === targetRecordId);
		const sourceRecords = allRecords?.filter(r => sourceRecordIds.includes(r.id));

		if (!targetRecord || !sourceRecords || sourceRecords.length === 0) {
			throw error(404, 'Records not found');
		}

		// Build merged record based on strategy
		let mergedRecord = { ...targetRecord };

		if (mergeStrategy === 'field_by_field' && fieldSelections) {
			// Use field selections to build merged record
			for (const [field, sourceId] of Object.entries(fieldSelections)) {
				if (sourceId === targetRecordId) {
					// Keep target's value (already in mergedRecord)
					continue;
				} else {
					// Use source record's value
					const sourceRecord = sourceRecords.find(r => r.id === sourceId);
					if (sourceRecord && sourceRecord[field]) {
						mergedRecord[field] = sourceRecord[field];
					}
				}
			}
		} else if (mergeStrategy === 'keep_source') {
			// Keep first source record's data, but target's ID
			mergedRecord = { ...sourceRecords[0], id: targetRecordId };
		}
		// 'keep_target' - already in mergedRecord

		// Merge arrays (like subject_topical, general_note, etc.)
		const arrayFields = ['subject_topical', 'subject_geographic', 'general_note', 'bibliography_note'];

		for (const field of arrayFields) {
			const allValues = new Set();

			// Add target's values
			if (targetRecord[field] && Array.isArray(targetRecord[field])) {
				targetRecord[field].forEach((v: any) => allValues.add(JSON.stringify(v)));
			}

			// Add source values
			for (const sourceRecord of sourceRecords) {
				if (sourceRecord[field] && Array.isArray(sourceRecord[field])) {
					sourceRecord[field].forEach((v: any) => allValues.add(JSON.stringify(v)));
				}
			}

			if (allValues.size > 0) {
				mergedRecord[field] = Array.from(allValues).map(v => JSON.parse(v as string));
			}
		}

		// Collect all holdings from source records
		let holdingsMoved = 0;
		for (const sourceRecord of sourceRecords) {
			if (sourceRecord.holdings && sourceRecord.holdings.length > 0) {
				// Move holdings to target record
				const { error: holdingsError } = await supabase
					.from('holdings')
					.update({ marc_record_id: targetRecordId })
					.eq('marc_record_id', sourceRecord.id);

				if (!holdingsError) {
					holdingsMoved += sourceRecord.holdings.length;
				}
			}
		}

		// Update target record with merged data
		const { id, holdings, created_at, ...updateData } = mergedRecord;

		const { error: updateError } = await supabase
			.from('marc_records')
			.update({
				...updateData,
				updated_at: new Date().toISOString()
			})
			.eq('id', targetRecordId);

		if (updateError) throw updateError;

		// Save merge record for audit trail
		const { data: mergeRecord, error: mergeError } = await supabase
			.from('merged_records')
			.insert({
				source_record_ids: sourceRecordIds,
				target_record_id: targetRecordId,
				field_selections: fieldSelections,
				merge_strategy: mergeStrategy,
				holdings_moved: holdingsMoved,
				merged_by: session.user.id,
				source_records_backup: sourceRecords // Full backup for undo
			})
			.select()
			.single();

		if (mergeError) console.error('Error saving merge record:', mergeError);

		// Delete source records
		for (const sourceRecordId of sourceRecordIds) {
			// Log deletion
			await supabase.from('audit_log').insert({
				table_name: 'marc_records',
				record_id: sourceRecordId,
				operation: 'delete',
				old_values: sourceRecords.find(r => r.id === sourceRecordId),
				new_values: null,
				batch_job_id: batchJob.id,
				change_reason: `Merged into record ${targetRecordId}`,
				changed_by: session.user.id
			});

			// Delete the record
			await supabase
				.from('marc_records')
				.delete()
				.eq('id', sourceRecordId);
		}

		// Update duplicate record if applicable
		if (duplicateRecordId) {
			await supabase
				.from('duplicate_records')
				.update({
					status: 'merged',
					merged_into_id: targetRecordId,
					resolved_at: new Date().toISOString(),
					resolved_by: session.user.id
				})
				.eq('id', duplicateRecordId);
		}

		// Update batch job
		await supabase
			.from('batch_jobs')
			.update({
				status: 'completed',
				total_records: sourceRecordIds.length + 1,
				processed_records: sourceRecordIds.length + 1,
				successful_records: 1,
				completed_at: new Date().toISOString(),
				result_summary: {
					mergedInto: targetRecordId,
					sourceRecordsDeleted: sourceRecordIds.length,
					holdingsMoved
				}
			})
			.eq('id', batchJob.id);

		return json({
			success: true,
			batchJobId: batchJob.id,
			mergedRecordId: targetRecordId,
			sourceRecordsDeleted: sourceRecordIds.length,
			holdingsMoved,
			mergeRecordId: mergeRecord?.id
		});

	} catch (err) {
		console.error('Merge error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to merge records');
	}
};

// GET - Undo merge
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const mergeId = url.searchParams.get('mergeId');
		if (!mergeId) {
			throw error(400, 'Merge ID required');
		}

		// Fetch merge record
		const { data: mergeRecord, error: fetchError } = await supabase
			.from('merged_records')
			.select('*')
			.eq('id', mergeId)
			.single();

		if (fetchError) throw fetchError;

		if (!mergeRecord.can_undo) {
			throw error(400, 'This merge cannot be undone');
		}

		// Restore source records from backup
		const sourceRecords = mergeRecord.source_records_backup;

		for (const sourceRecord of sourceRecords) {
			// Re-insert the source record
			const { error: insertError } = await supabase
				.from('marc_records')
				.insert(sourceRecord);

			if (insertError) {
				console.error('Error restoring source record:', insertError);
				continue;
			}

			// Log restore
			await supabase.from('audit_log').insert({
				table_name: 'marc_records',
				record_id: sourceRecord.id,
				operation: 'insert',
				old_values: null,
				new_values: sourceRecord,
				change_reason: `Undo merge ${mergeId}`,
				changed_by: session.user.id
			});
		}

		// Move holdings back (simplified - would need more logic)
		// Mark merge as undone
		await supabase
			.from('merged_records')
			.update({ can_undo: false })
			.eq('id', mergeId);

		return json({
			success: true,
			restoredRecords: sourceRecords.length
		});

	} catch (err) {
		console.error('Undo merge error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to undo merge');
	}
};
