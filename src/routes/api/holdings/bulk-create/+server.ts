import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Bulk Holdings Creation API
 *
 * Creates a holding for each MARC record that doesn't already have one
 */

export const POST: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Get all marc records
		const { data: records, error: recordsError } = await supabase
			.from('marc_records')
			.select('id, publication_info, title_statement');

		if (recordsError) throw recordsError;
		if (!records) throw error(404, 'No records found');

		// Get existing holdings to avoid duplicates
		const { data: existingHoldings, error: holdingsError } = await supabase
			.from('holdings')
			.select('marc_record_id');

		if (holdingsError) throw holdingsError;

		const existingRecordIds = new Set(existingHoldings?.map(h => h.marc_record_id) || []);

		// Filter records that don't have holdings
		const recordsNeedingHoldings = records.filter(r => !existingRecordIds.has(r.id));

		if (recordsNeedingHoldings.length === 0) {
			return json({
				success: true,
				message: 'All records already have holdings',
				created: 0
			});
		}

		// Generate holdings for each record
		const holdingsToCreate = recordsNeedingHoldings.map(record => {
			const year = record.publication_info?.c || '0000';
			const randomLetters = generateRandomLetters(4);

			return {
				marc_record_id: record.id,
				barcode: generateBarcode(),
				call_number: `CHOMP .${randomLetters}${year}`,
				copy_number: 1,
				location: 'The Kitchen',
				status: 'available',
				is_electronic: false
			};
		});

		// Insert holdings in batches of 100
		const batchSize = 100;
		let created = 0;

		for (let i = 0; i < holdingsToCreate.length; i += batchSize) {
			const batch = holdingsToCreate.slice(i, i + batchSize);
			const { error: insertError } = await supabase
				.from('holdings')
				.insert(batch);

			if (insertError) {
				console.error('Error inserting batch:', insertError);
				throw insertError;
			}

			created += batch.length;
		}

		return json({
			success: true,
			message: `Successfully created ${created} holdings`,
			created
		});

	} catch (err: any) {
		console.error('Error bulk creating holdings:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to bulk create holdings');
	}
};

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

/**
 * Generate random uppercase letters
 */
function generateRandomLetters(length: number): string {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += letters.charAt(Math.floor(Math.random() * letters.length));
	}
	return result;
}
