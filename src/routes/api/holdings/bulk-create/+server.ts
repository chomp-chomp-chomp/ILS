import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Bulk Holdings Creation API
 *
 * Creates a holding for each MARC record that doesn't already have one
 * Call number format: TX683.[FirstLetterLastName][2RandomDigits] [Year]
 * Example: TX683.C46 2025
 */

export const POST: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Get all marc records with author information for call number generation
		const { data: records, error: recordsError } = await supabase
			.from('marc_records')
			.select('id, publication_info, title_statement, main_entry_personal_name');

		if (recordsError) throw recordsError;
		if (!records) throw error(404, 'No records found');

		// Get existing items to avoid duplicates
		const { data: existingItems, error: itemsError } = await supabase
			.from('items')
			.select('marc_record_id');

		if (itemsError) throw itemsError;

		const existingRecordIds = new Set(existingItems?.map(h => h.marc_record_id) || []);

		// Filter records that don't have items
		const recordsNeedingItems = records.filter(r => !existingRecordIds.has(r.id));

		if (recordsNeedingItems.length === 0) {
			return json({
				success: true,
				message: 'All records already have items',
				created: 0
			});
		}

		// Generate items for each record
		const itemsToCreate = recordsNeedingItems.map(record => {
			const year = record.publication_info?.c || '0000';
			const callNumber = generateTXCallNumber(record, year);

			return {
				marc_record_id: record.id,
				barcode: generateBarcode(),
				call_number: callNumber,
				copy_number: 'c.1',
				location: 'The Kitchen',
				status: 'available',
				material_type: 'book'
			};
		});

		// Insert items in batches of 100
		const batchSize = 100;
		let created = 0;

		for (let i = 0; i < itemsToCreate.length; i += batchSize) {
			const batch = itemsToCreate.slice(i, i + batchSize);
			const { error: insertError } = await supabase
				.from('items')
				.insert(batch);

			if (insertError) {
				console.error('Error inserting batch:', insertError);
				throw insertError;
			}

			created += batch.length;
		}

		return json({
			success: true,
			message: `Successfully created ${created} items`,
			created
		});

	} catch (err: any) {
		console.error('Error bulk creating items:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to bulk create items');
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
 * Generate TX classification call number
 * Format: TX683.[FirstLetterLastName][2RandomDigits] [Year]
 * Example: TX683.C46 2025
 */
function generateTXCallNumber(record: any, year: string): string {
	// Try to extract first letter of author's last name
	let authorLetter = 'X'; // Default if no author found

	// Check main entry personal name (MARC 100)
	if (record.main_entry_personal_name?.a) {
		const authorName = record.main_entry_personal_name.a;
		// Author names are usually in format "Last, First" or just "Last"
		const lastNameMatch = authorName.match(/^([A-Za-z])/);
		if (lastNameMatch) {
			authorLetter = lastNameMatch[1].toUpperCase();
		}
	}
	// Fallback to title if no author
	else if (record.title_statement?.a) {
		const title = record.title_statement.a;
		const firstLetter = title.match(/^[A-Za-z]/);
		if (firstLetter) {
			authorLetter = firstLetter[0].toUpperCase();
		}
	}

	// Generate random 2-digit number (10-99)
	const randomDigits = Math.floor(Math.random() * 90) + 10;

	return `TX683.${authorLetter}${randomDigits} ${year}`;
}
