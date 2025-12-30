import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const {
		macroId,
		operations, // Can pass operations directly without saving as macro
		recordIds = null, // Optional: limit to specific records
		previewOnly = true
	} = await request.json();

	try {
		let macroOperations = operations;
		let macroName = 'Custom Macro';

		// If macroId provided, fetch the macro
		if (macroId) {
			const { data: macro, error: macroError } = await supabase
				.from('batch_macros')
				.select('*')
				.eq('id', macroId)
				.single();

			if (macroError) throw macroError;

			macroOperations = macro.operations;
			macroName = macro.name;

			// Update usage stats
			if (!previewOnly) {
				await supabase
					.from('batch_macros')
					.update({
						times_used: macro.times_used + 1,
						last_used_at: new Date().toISOString()
					})
					.eq('id', macroId);
			}
		}

		if (!macroOperations || !Array.isArray(macroOperations)) {
			throw error(400, 'Invalid macro operations');
		}

		// Create batch job
		const { data: batchJob, error: jobError } = await supabase
			.from('batch_jobs')
			.insert({
				job_type: 'macro',
				job_name: `Execute Macro: ${macroName}`,
				description: previewOnly ? 'Preview mode' : 'Apply changes',
				parameters: { macroId, operations: macroOperations, recordIds },
				status: previewOnly ? 'completed' : 'running',
				created_by: session.user.id
			})
			.select()
			.single();

		if (jobError) throw jobError;

		// Get records to process
		let query = supabase.from('marc_records').select('*');

		if (recordIds && recordIds.length > 0) {
			query = query.in('id', recordIds);
		}

		const { data: records, error: recordsError } = await query;
		if (recordsError) throw recordsError;

		const changes: any[] = [];
		let processedCount = 0;
		let successCount = 0;
		let failureCount = 0;

		// Process each record
		for (const record of records || []) {
			processedCount++;

			try {
				const result = await applyMacroToRecord(
					record,
					macroOperations,
					previewOnly,
					batchJob.id,
					supabase,
					session.user.id
				);

				if (result.changed) {
					successCount++;
					changes.push(result);
				}
			} catch (err) {
				failureCount++;
				console.error(`Error processing record ${record.id}:`, err);
			}
		}

		// Update batch job
		await supabase
			.from('batch_jobs')
			.update({
				status: 'completed',
				total_records: processedCount,
				processed_records: processedCount,
				successful_records: successCount,
				failed_records: failureCount,
				completed_at: new Date().toISOString(),
				result_summary: {
					recordsAffected: successCount,
					changes: previewOnly ? changes.slice(0, 100) : []
				}
			})
			.eq('id', batchJob.id);

		return json({
			success: true,
			batchJobId: batchJob.id,
			preview: previewOnly,
			summary: {
				totalRecords: processedCount,
				recordsAffected: successCount,
				failed: failureCount
			},
			changes: previewOnly ? changes : changes.slice(0, 20)
		});

	} catch (err) {
		console.error('Macro execution error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to execute macro');
	}
};

async function applyMacroToRecord(
	record: any,
	operations: any[],
	previewOnly: boolean,
	batchJobId: string,
	supabase: any,
	userId: string
): Promise<any> {
	let updatedRecord = { ...record };
	let changed = false;
	const appliedOperations: any[] = [];

	for (const operation of operations) {
		const { operation: opType, field, subfield, value, condition, transform } = operation;

		// Check condition if specified
		if (condition && !evaluateCondition(updatedRecord, condition)) {
			continue;
		}

		// Apply operation
		switch (opType) {
			case 'add_field':
				if (!updatedRecord[field]) {
					updatedRecord[field] = value;
					changed = true;
					appliedOperations.push({ operation: opType, field, value });
				}
				break;

			case 'append_to_field':
				if (Array.isArray(updatedRecord[field])) {
					updatedRecord[field] = [...updatedRecord[field], value];
					changed = true;
					appliedOperations.push({ operation: opType, field, value });
				}
				break;

			case 'remove_field':
				if (updatedRecord[field]) {
					delete updatedRecord[field];
					changed = true;
					appliedOperations.push({ operation: opType, field });
				}
				break;

			case 'update_subfield':
				if (updatedRecord[field] && typeof updatedRecord[field] === 'object') {
					if (subfield) {
						updatedRecord[field] = { ...updatedRecord[field], [subfield]: value };
						changed = true;
						appliedOperations.push({ operation: opType, field, subfield, value });
					}
				}
				break;

			case 'transform_field':
				if (updatedRecord[field]) {
					const oldValue = subfield ? updatedRecord[field][subfield] : updatedRecord[field];
					const newValue = applyTransform(oldValue, transform, operation);

					if (newValue !== oldValue) {
						if (subfield && typeof updatedRecord[field] === 'object') {
							updatedRecord[field] = { ...updatedRecord[field], [subfield]: newValue };
						} else {
							updatedRecord[field] = newValue;
						}
						changed = true;
						appliedOperations.push({ operation: opType, field, subfield, oldValue, newValue });
					}
				}
				break;

			case 'copy_field':
				const { sourceField, targetField } = operation;
				if (updatedRecord[sourceField]) {
					updatedRecord[targetField] = updatedRecord[sourceField];
					changed = true;
					appliedOperations.push({ operation: opType, sourceField, targetField });
				}
				break;

			case 'add_prefix':
				if (updatedRecord[field]) {
					const oldValue = updatedRecord[field];
					updatedRecord[field] = `${value}${oldValue}`;
					changed = true;
					appliedOperations.push({ operation: opType, field, prefix: value });
				}
				break;

			case 'add_suffix':
				if (updatedRecord[field]) {
					const oldValue = updatedRecord[field];
					updatedRecord[field] = `${oldValue}${value}`;
					changed = true;
					appliedOperations.push({ operation: opType, field, suffix: value });
				}
				break;
		}
	}

	// Apply changes if not in preview mode
	if (changed && !previewOnly) {
		const updates: any = {};

		// Only include changed fields in update
		for (const key in updatedRecord) {
			if (JSON.stringify(updatedRecord[key]) !== JSON.stringify(record[key])) {
				updates[key] = updatedRecord[key];
			}
		}

		if (Object.keys(updates).length > 0) {
			const { error: updateError } = await supabase
				.from('marc_records')
				.update(updates)
				.eq('id', record.id);

			if (!updateError) {
				// Log audit entry
				await supabase.from('audit_log').insert({
					table_name: 'marc_records',
					record_id: record.id,
					operation: 'update',
					old_values: record,
					new_values: updatedRecord,
					batch_job_id: batchJobId,
					change_reason: `Macro execution: ${appliedOperations.length} operations applied`,
					changed_by: userId
				});
			}
		}
	}

	return {
		recordId: record.id,
		recordTitle: record.title_statement?.a || 'Unknown',
		changed,
		appliedOperations
	};
}

function evaluateCondition(record: any, condition: any): boolean {
	for (const [field, expectedValue] of Object.entries(condition)) {
		if (record[field] !== expectedValue) {
			return false;
		}
	}
	return true;
}

function applyTransform(value: any, transformType: string, operation: any): any {
	if (typeof value !== 'string') return value;

	switch (transformType) {
		case 'extract_year':
			const yearMatch = value.match(/\d{4}/);
			return yearMatch ? yearMatch[0] : value;

		case 'uppercase':
			return value.toUpperCase();

		case 'lowercase':
			return value.toLowerCase();

		case 'title_case':
			return value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

		case 'trim':
			return value.trim();

		case 'remove_punctuation':
			return value.replace(/[^\w\s]/g, '');

		case 'regex_replace':
			if (operation.regex && operation.replacement !== undefined) {
				return value.replace(new RegExp(operation.regex, 'g'), operation.replacement);
			}
			return value;

		default:
			return value;
	}
}
