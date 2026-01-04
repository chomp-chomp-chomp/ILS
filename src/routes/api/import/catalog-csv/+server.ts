import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Catalog CSV Import API
 * Imports catalog updates from CSV file
 * - Matches records by ISBN
 * - Updates metadata
 * - Creates/updates holdings
 * - Cannot create new titles or change ISBNs
 */

interface CSVRow {
	title: string;
	author: string;
	publisher: string;
	year: string;
	isbn: string;
	callNumber: string;
	location: string;
	numberOfCopies: string;
	coverPresent: string;
}

interface ImportResult {
	row: number;
	isbn: string;
	title: string;
	action: string;
	success: boolean;
	error?: string;
}

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			throw error(400, 'No file uploaded');
		}

		// Read CSV file
		const csvText = await file.text();
		const rows = parseCSV(csvText);

		if (rows.length === 0) {
			throw error(400, 'CSV file is empty');
		}

		const results: ImportResult[] = [];

		// Process each row
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNumber = i + 2; // +2 because row 1 is header, array is 0-indexed

			try {
				const result = await processRow(supabase, row, rowNumber);
				results.push(result);
			} catch (err: any) {
				results.push({
					row: rowNumber,
					isbn: row.isbn,
					title: row.title,
					action: 'error',
					success: false,
					error: err.message
				});
			}
		}

		const summary = {
			total: results.length,
			successful: results.filter(r => r.success).length,
			failed: results.filter(r => !r.success).length,
			updatedRecords: results.filter(r => r.action === 'updated_record').length,
			createdCopies: results.filter(r => r.action === 'created_copies').length,
			skipped: results.filter(r => r.action === 'skipped').length
		};

		return json({
			success: true,
			summary,
			results
		});

	} catch (err: any) {
		console.error('Import error:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to process import');
	}
};

/**
 * Process a single CSV row
 */
async function processRow(
	supabase: any,
	row: CSVRow,
	rowNumber: number
): Promise<ImportResult> {
	// Validate ISBN
	if (!row.isbn || !row.isbn.trim()) {
		throw new Error('ISBN is required');
	}

	const normalizedISBN = row.isbn.replace(/[-\s]/g, '');

	// Find record by ISBN
	const { data: records, error: findError } = await supabase
		.from('marc_records')
		.select('id, title_statement, main_entry_personal_name, publication_info')
		.eq('isbn', normalizedISBN);

	if (findError) throw findError;

	if (!records || records.length === 0) {
		return {
			row: rowNumber,
			isbn: row.isbn,
			title: row.title,
			action: 'skipped',
			success: false,
			error: 'Record not found (cannot create new titles)'
		};
	}

	const record = records[0];
	let updated = false;
	let createdCopies = 0;

	// Update metadata if changed (optional - only if provided in CSV)
	if (row.title && row.title !== record.title_statement?.a) {
		await supabase
			.from('marc_records')
			.update({
				title_statement: {
					...record.title_statement,
					a: row.title
				}
			})
			.eq('id', record.id);
		updated = true;
	}

	if (row.author && row.author !== record.main_entry_personal_name?.a) {
		await supabase
			.from('marc_records')
			.update({
				main_entry_personal_name: {
					...record.main_entry_personal_name,
					a: row.author
				}
			})
			.eq('id', record.id);
		updated = true;
	}

	if (row.publisher || row.year) {
		const publisherChanged = row.publisher && row.publisher.trim() !== record.publication_info?.b?.trim();
		const yearChanged = row.year && row.year.trim() !== record.publication_info?.c?.trim();

		if (publisherChanged || yearChanged) {
			await supabase
				.from('marc_records')
				.update({
					publication_info: {
						...record.publication_info,
						...(row.publisher ? { b: row.publisher.trim() } : {}),
						...(row.year ? { c: row.year.trim() } : {})
					}
				})
				.eq('id', record.id);
			updated = true;
		}
	}

	// Handle copies/holdings
	if (row.location && row.callNumber && row.numberOfCopies) {
		const copyCount = parseInt(row.numberOfCopies) || 0;

		if (copyCount > 0) {
			// Check existing items for this record and location
			const { data: existingItems } = await supabase
				.from('items')
				.select('id, copy_number')
				.eq('marc_record_id', record.id)
				.eq('location', row.location);

			const existingCount = existingItems?.length || 0;

			// Create additional copies if needed
			if (copyCount > existingCount) {
				const copiesToCreate = copyCount - existingCount;

				for (let i = 0; i < copiesToCreate; i++) {
					const copyNumber = existingCount + i + 1;

					await supabase.from('items').insert({
						marc_record_id: record.id,
						barcode: generateBarcode(),
						copy_number: `c.${copyNumber}`,
						call_number: row.callNumber,
						location: row.location,
						status: 'available',
						material_type: record.material_type || 'book'
					});

					createdCopies++;
				}
			}
			// Note: We don't delete copies if the count is lower
			// That would be a destructive operation
		}
	}

	let action = 'skipped';
	if (updated && createdCopies > 0) {
		action = 'updated_record_and_created_copies';
	} else if (updated) {
		action = 'updated_record';
	} else if (createdCopies > 0) {
		action = 'created_copies';
	}

	return {
		row: rowNumber,
		isbn: row.isbn,
		title: row.title || record.title_statement?.a || '',
		action,
		success: true
	};
}

/**
 * Parse CSV text into rows
 */
function parseCSV(csvText: string): CSVRow[] {
	const lines = csvText.split('\n').filter(line => line.trim());

	if (lines.length < 2) {
		return [];
	}

	// Skip header row
	const dataLines = lines.slice(1);

	return dataLines.map(line => {
		const values = parseCSVLine(line);

		return {
			title: values[0] || '',
			author: values[1] || '',
			publisher: values[2] || '',
			year: values[3] || '',
			isbn: values[4] || '',
			callNumber: values[5] || '',
			location: values[6] || '',
			numberOfCopies: values[7] || '',
			coverPresent: values[8] || ''
		};
	});
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
	const values: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i++; // Skip next quote
			} else {
				// Toggle quote mode
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// Field separator
			values.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	// Add last field
	values.push(current.trim());

	return values;
}

/**
 * Generate a random 14-digit barcode
 */
function generateBarcode(): string {
	const digits = [];
	for (let i = 0; i < 14; i++) {
		digits.push(Math.floor(Math.random() * 10));
	}
	return digits.join('');
}
