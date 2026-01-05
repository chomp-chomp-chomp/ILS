import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Catalog CSV Export API
 * Exports all catalog records with holdings information to CSV
 */

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Fetch all marc records with their items (holdings)
		const { data: records, error: fetchError } = await supabase
			.from('marc_records')
			.select(`
				id,
				title_statement,
				main_entry_personal_name,
				publication_info,
				isbn,
				cover_image_url,
				items:items(
					id,
					call_number,
					location,
					copy_number
				),
				covers:covers!covers_marc_record_id_fkey(
					id,
					original_url
				)
			`)
			.order('title_statement->a');

		if (fetchError) throw fetchError;
		if (!records) throw error(404, 'No records found');

		// Generate CSV
		const csvRows: string[] = [];

		// Header row
		csvRows.push([
			'Title',
			'Author',
			'Publisher',
			'Year',
			'ISBN',
			'Call Number',
			'Location',
			'Number of Copies',
			'Cover Present'
		].map(escapeCSV).join(','));

		// Data rows
		for (const record of records) {
			const title = record.title_statement?.a || '';
			const author = record.main_entry_personal_name?.a || '';
			const publisher = record.publication_info?.b?.trim() || '';
			const year = record.publication_info?.c?.trim() || '';
			const isbn = record.isbn || '';

			// Group items by location
			const items = record.items || [];
			const itemsByLocation = new Map<string, any[]>();

			for (const item of items) {
				const loc = item.location || 'Unknown';
				if (!itemsByLocation.has(loc)) {
					itemsByLocation.set(loc, []);
				}
				itemsByLocation.get(loc)!.push(item);
			}

			// Check if cover exists
			const hasCover = !!(record.cover_image_url || (record.covers && record.covers.length > 0));
			const coverPresent = hasCover ? 'Y' : 'N';

			if (itemsByLocation.size === 0) {
				// Record with no items
				csvRows.push([
					title,
					author,
					publisher,
					year,
					isbn,
					'',
					'',
					'0',
					coverPresent
				].map(escapeCSV).join(','));
			} else {
				// One row per location
				for (const [location, locationItems] of itemsByLocation) {
					const callNumber = locationItems[0]?.call_number || '';
					const copyCount = locationItems.length.toString();

					csvRows.push([
						title,
						author,
						publisher,
						year,
						isbn,
						callNumber,
						location,
						copyCount,
						coverPresent
					].map(escapeCSV).join(','));
				}
			}
		}

		const csvContent = csvRows.join('\n');

		// Return CSV file
		return new Response(csvContent, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="catalog-export-${new Date().toISOString().split('T')[0]}.csv"`
			}
		});

	} catch (err: any) {
		console.error('Error exporting catalog:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to export catalog');
	}
};

/**
 * Escape CSV field values
 * Handles quotes, commas, and newlines
 */
function escapeCSV(value: string): string {
	if (!value) return '""';

	// If value contains comma, quote, or newline, wrap in quotes and escape quotes
	if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
		return `"${value.replace(/"/g, '""')}"`;
	}

	return `"${value}"`;
}
