import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const {
		searchPattern,
		replaceWith,
		fieldFilter,
		subfieldFilter,
		caseSensitive = true,
		useRegex = false,
		previewOnly = true,
		recordIds = null // Optional: limit to specific records
	} = await request.json();

	if (!searchPattern) {
		throw error(400, 'Search pattern is required');
	}

	try {
		// Create a batch job
		const { data: batchJob, error: jobError } = await supabase
			.from('batch_jobs')
			.insert({
				job_type: 'find_replace',
				job_name: `Find/Replace: "${searchPattern}" → "${replaceWith}"`,
				description: previewOnly ? 'Preview mode' : 'Apply changes',
				parameters: {
					searchPattern,
					replaceWith,
					fieldFilter,
					subfieldFilter,
					caseSensitive,
					useRegex,
					recordIds
				},
				status: previewOnly ? 'completed' : 'running',
				created_by: session.user.id
			})
			.select()
			.single();

		if (jobError) throw jobError;

		// Get the records to process
		let query = supabase
			.from('marc_records')
			.select('*');

		if (recordIds && recordIds.length > 0) {
			query = query.in('id', recordIds);
		}

		const { data: records, error: recordsError } = await query;
		if (recordsError) throw recordsError;

		const changes: Array<{
			recordId: string;
			recordTitle: string;
			fieldName: string;
			oldValue: string;
			newValue: string;
		}> = [];

		let processedCount = 0;
		let changedCount = 0;

		// Process each record
		for (const record of records || []) {
			processedCount++;
			const recordChanges = await processRecord(
				record,
				searchPattern,
				replaceWith,
				fieldFilter,
				subfieldFilter,
				caseSensitive,
				useRegex,
				previewOnly,
				batchJob.id,
				supabase,
				session.user.id
			);

			if (recordChanges.length > 0) {
				changedCount++;
				changes.push(...recordChanges);
			}
		}

		// Update batch job
		await supabase
			.from('batch_jobs')
			.update({
				status: previewOnly ? 'completed' : 'completed',
				total_records: processedCount,
				processed_records: processedCount,
				successful_records: changedCount,
				completed_at: new Date().toISOString(),
				result_summary: {
					totalChanges: changes.length,
					recordsAffected: changedCount,
					changes: previewOnly ? changes.slice(0, 100) : [] // Limit preview results
				}
			})
			.eq('id', batchJob.id);

		return json({
			success: true,
			batchJobId: batchJob.id,
			preview: previewOnly,
			summary: {
				totalRecords: processedCount,
				recordsAffected: changedCount,
				totalChanges: changes.length
			},
			changes: previewOnly ? changes : changes.slice(0, 20) // Return sample for confirmation
		});

	} catch (err) {
		console.error('Find/replace error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to perform find/replace');
	}
};

async function processRecord(
	record: any,
	searchPattern: string,
	replaceWith: string,
	fieldFilter: string | null,
	subfieldFilter: string | null,
	caseSensitive: boolean,
	useRegex: boolean,
	previewOnly: boolean,
	batchJobId: string,
	supabase: any,
	userId: string
): Promise<Array<{
	recordId: string;
	recordTitle: string;
	fieldName: string;
	oldValue: string;
	newValue: string;
}>> {
	const changes: Array<any> = [];
	const updates: any = {};
	let hasChanges = false;

	// MARC fields that contain JSONB data
	const jsonbFields = [
		'title_statement',
		'main_entry_personal_name',
		'publication_info',
		'physical_description',
		'series_statement',
		'subject_topical',
		'subject_geographic',
		'subject_chronological',
		'added_entry_personal_name',
		'added_entry_corporate_name'
	];

	// Text fields
	const textFields = [
		'isbn',
		'issn',
		'control_number',
		'summary',
		'general_note',
		'bibliography_note',
		'contents_note'
	];

	// Process JSONB fields
	for (const fieldName of jsonbFields) {
		// Skip if field filter specified and doesn't match
		if (fieldFilter && !fieldName.includes(fieldFilter.toLowerCase())) {
			continue;
		}

		const fieldValue = record[fieldName];
		if (!fieldValue) continue;

		// Handle arrays (like subject_topical)
		if (Array.isArray(fieldValue)) {
			const newArray = [];
			let arrayChanged = false;

			for (const item of fieldValue) {
				const newItem = processJsonbValue(
					item,
					subfieldFilter,
					searchPattern,
					replaceWith,
					caseSensitive,
					useRegex
				);

				if (JSON.stringify(newItem) !== JSON.stringify(item)) {
					arrayChanged = true;
					changes.push({
						recordId: record.id,
						recordTitle: record.title_statement?.a || 'Unknown',
						fieldName,
						oldValue: JSON.stringify(item),
						newValue: JSON.stringify(newItem)
					});
				}
				newArray.push(newItem);
			}

			if (arrayChanged) {
				updates[fieldName] = newArray;
				hasChanges = true;
			}
		}
		// Handle objects
		else if (typeof fieldValue === 'object') {
			const newValue = processJsonbValue(
				fieldValue,
				subfieldFilter,
				searchPattern,
				replaceWith,
				caseSensitive,
				useRegex
			);

			if (JSON.stringify(newValue) !== JSON.stringify(fieldValue)) {
				updates[fieldName] = newValue;
				hasChanges = true;
				changes.push({
					recordId: record.id,
					recordTitle: record.title_statement?.a || 'Unknown',
					fieldName,
					oldValue: JSON.stringify(fieldValue),
					newValue: JSON.stringify(newValue)
				});
			}
		}
	}

	// Process text fields
	for (const fieldName of textFields) {
		if (fieldFilter && !fieldName.includes(fieldFilter.toLowerCase())) {
			continue;
		}

		const fieldValue = record[fieldName];
		if (!fieldValue || typeof fieldValue !== 'string') continue;

		const newValue = performReplace(
			fieldValue,
			searchPattern,
			replaceWith,
			caseSensitive,
			useRegex
		);

		if (newValue !== fieldValue) {
			updates[fieldName] = newValue;
			hasChanges = true;
			changes.push({
				recordId: record.id,
				recordTitle: record.title_statement?.a || 'Unknown',
				fieldName,
				oldValue: fieldValue,
				newValue
			});
		}
	}

	// Apply updates if not in preview mode
	if (hasChanges && !previewOnly) {
		const { error: updateError } = await supabase
			.from('marc_records')
			.update(updates)
			.eq('id', record.id);

		if (!updateError) {
			// Log audit entry
			await supabase
				.from('audit_log')
				.insert({
					table_name: 'marc_records',
					record_id: record.id,
					operation: 'update',
					old_values: record,
					new_values: { ...record, ...updates },
					batch_job_id: batchJobId,
					change_reason: `Global find/replace: "${searchPattern}" → "${replaceWith}"`,
					changed_by: userId
				});
		}
	}

	return changes;
}

function processJsonbValue(
	value: any,
	subfieldFilter: string | null,
	searchPattern: string,
	replaceWith: string,
	caseSensitive: boolean,
	useRegex: boolean
): any {
	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const result = { ...value };

	for (const [key, val] of Object.entries(value)) {
		// Skip if subfield filter specified and doesn't match
		if (subfieldFilter && key !== subfieldFilter) {
			continue;
		}

		if (typeof val === 'string') {
			result[key] = performReplace(val, searchPattern, replaceWith, caseSensitive, useRegex);
		}
	}

	return result;
}

function performReplace(
	text: string,
	searchPattern: string,
	replaceWith: string,
	caseSensitive: boolean,
	useRegex: boolean
): string {
	if (useRegex) {
		const flags = caseSensitive ? 'g' : 'gi';
		return text.replace(new RegExp(searchPattern, flags), replaceWith);
	} else {
		if (caseSensitive) {
			return text.split(searchPattern).join(replaceWith);
		} else {
			const regex = new RegExp(escapeRegex(searchPattern), 'gi');
			return text.replace(regex, replaceWith);
		}
	}
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
