import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Run authority control check
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const {
		fieldType = 'subjects', // 'subjects', 'names', 'all'
		autoCorrect = false,
		previewOnly = true
	} = await request.json();

	try {
		// Create batch job
		const { data: batchJob, error: jobError } = await supabase
			.from('batch_jobs')
			.insert({
				job_type: 'authority_control',
				job_name: `Authority Control: ${fieldType}`,
				description: previewOnly ? 'Preview mode' : 'Apply corrections',
				parameters: { fieldType, autoCorrect },
				status: previewOnly ? 'completed' : 'running',
				created_by: session.user.id
			})
			.select()
			.single();

		if (jobError) throw jobError;

		// Fetch subject headings from the database
		const { data: subjectHeadings } = await supabase
			.from('subject_headings')
			.select('*');

		const authorizedHeadings = new Set(
			subjectHeadings?.map(s => s.heading.toLowerCase()) || []
		);

		// Get all records
		const { data: records, error: recordsError } = await supabase
			.from('marc_records')
			.select('id, title_statement, subject_topical, subject_geographic, main_entry_personal_name');

		if (recordsError) throw recordsError;

		const issues: any[] = [];
		let processedCount = 0;
		let issuesCount = 0;

		for (const record of records || []) {
			processedCount++;

			// Check subject headings
			if (fieldType === 'subjects' || fieldType === 'all') {
				const subjects = record.subject_topical || [];

				for (const subject of subjects) {
					const heading = subject.a?.toLowerCase();
					if (heading && !authorizedHeadings.has(heading)) {
						// Find closest match
						const suggestion = findClosestMatch(heading, Array.from(authorizedHeadings));

						issues.push({
							recordId: record.id,
							recordTitle: record.title_statement?.a || 'Unknown',
							fieldType: 'subject',
							currentValue: subject.a,
							suggestedValue: suggestion,
							confidence: suggestion ? calculateSimilarity(heading, suggestion) : 0
						});

						issuesCount++;
					}
				}
			}

			// Check name headings
			if (fieldType === 'names' || fieldType === 'all') {
				// Simplified - would check against name authority file
				// For now, just check basic formatting
				const name = record.main_entry_personal_name?.a;
				if (name && !isProperlyFormatted(name)) {
					issues.push({
						recordId: record.id,
						recordTitle: record.title_statement?.a || 'Unknown',
						fieldType: 'name',
						currentValue: name,
						suggestedValue: formatName(name),
						confidence: 0.9
					});

					issuesCount++;
				}
			}
		}

		// If auto-correct and not preview
		if (autoCorrect && !previewOnly) {
			for (const issue of issues) {
				if (issue.confidence > 0.8 && issue.suggestedValue) {
					// Apply correction
					// This is simplified - real implementation would update specific fields
					await supabase
						.from('audit_log')
						.insert({
							table_name: 'marc_records',
							record_id: issue.recordId,
							operation: 'update',
							batch_job_id: batchJob.id,
							change_reason: `Authority control: ${issue.currentValue} → ${issue.suggestedValue}`,
							changed_by: session.user.id
						});
				}
			}
		}

		// Update batch job
		await supabase
			.from('batch_jobs')
			.update({
				status: 'completed',
				total_records: processedCount,
				processed_records: processedCount,
				successful_records: issuesCount,
				completed_at: new Date().toISOString(),
				result_summary: {
					issuesFound: issuesCount,
					issues: issues.slice(0, 100)
				}
			})
			.eq('id', batchJob.id);

		return json({
			success: true,
			batchJobId: batchJob.id,
			summary: {
				recordsChecked: processedCount,
				issuesFound: issuesCount
			},
			issues: issues.slice(0, 100)
		});

	} catch (err) {
		console.error('Authority control error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to run authority control');
	}
};

function findClosestMatch(term: string, authorized: string[]): string | null {
	let bestMatch = null;
	let bestScore = 0;

	for (const auth of authorized) {
		const score = calculateSimilarity(term, auth);
		if (score > bestScore && score > 0.7) {
			bestScore = score;
			bestMatch = auth;
		}
	}

	return bestMatch;
}

function calculateSimilarity(a: string, b: string): number {
	const longer = a.length > b.length ? a : b;
	const shorter = a.length > b.length ? b : a;

	if (longer.length === 0) return 1.0;

	const editDistance = levenshteinDistance(longer, shorter);
	return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				);
			}
		}
	}

	return matrix[b.length][a.length];
}

function isProperlyFormatted(name: string): boolean {
	// Check if name is in "Last, First" format
	return /^[A-Z][a-z]+,\s*[A-Z]/.test(name);
}

function formatName(name: string): string {
	// Simple name formatting - capitalize properly
	return name
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}
