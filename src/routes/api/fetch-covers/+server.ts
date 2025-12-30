import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { session } = await safeGetSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { batchSize = 10 } = await request.json();

		// Get records without custom covers
		const { data: records, error: fetchError } = await supabase
			.from('marc_records')
			.select('id, isbn, title_statement, main_entry_personal_name, cover_image_url')
			.is('cover_image_url', null)
			.limit(batchSize);

		if (fetchError) {
			return json({ error: fetchError.message }, { status: 500 });
		}

		if (!records || records.length === 0) {
			return json({
				processed: 0,
				found: 0,
				remaining: 0,
				message: 'No records to process'
			});
		}

		const results = [];
		let foundCount = 0;

		for (const record of records) {
			const isbn = record.isbn;
			const title = record.title_statement?.a;
			const author = record.main_entry_personal_name?.a;

			let coverUrl: string | null = null;

			// Try Google Books first
			if (isbn) {
				coverUrl = await tryGoogleBooks(isbn);
			}

			// Fallback to Open Library
			if (!coverUrl && (isbn || title)) {
				coverUrl = await tryOpenLibrary(isbn, title, author);
			}

			if (coverUrl) {
				// Save to database
				const { error: updateError } = await supabase
					.from('marc_records')
					.update({ cover_image_url: coverUrl })
					.eq('id', record.id);

				if (!updateError) {
					foundCount++;
					results.push({
						id: record.id,
						title: title || 'Untitled',
						coverUrl,
						success: true
					});
				} else {
					results.push({
						id: record.id,
						title: title || 'Untitled',
						error: updateError.message,
						success: false
					});
				}
			} else {
				results.push({
					id: record.id,
					title: title || 'Untitled',
					coverUrl: null,
					success: false
				});
			}
		}

		// Get count of remaining records
		const { count: remainingCount } = await supabase
			.from('marc_records')
			.select('id', { count: 'exact', head: true })
			.is('cover_image_url', null);

		return json({
			processed: records.length,
			found: foundCount,
			remaining: remainingCount || 0,
			results
		});

	} catch (error: any) {
		console.error('Cover fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
};

async function tryGoogleBooks(isbn: string): Promise<string | null> {
	try {
		const cleanISBN = isbn.replace(/[^0-9X]/gi, '');
		const response = await fetch(
			`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`
		);

		if (!response.ok) return null;

		const data = await response.json();

		if (data.items && data.items[0]?.volumeInfo?.imageLinks) {
			const imageLinks = data.items[0].volumeInfo.imageLinks;
			return (
				imageLinks.large ||
				imageLinks.medium ||
				imageLinks.thumbnail ||
				imageLinks.smallThumbnail ||
				null
			);
		}

		return null;
	} catch (error) {
		return null;
	}
}

async function tryOpenLibrary(
	isbn: string | null,
	title: string | null,
	author: string | null
): Promise<string | null> {
	try {
		// Try ISBN first
		if (isbn) {
			const cleanISBN = isbn.replace(/[^0-9X]/gi, '');
			const coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanISBN}-L.jpg`;

			const response = await fetch(coverUrl, { method: 'HEAD' });
			if (response.ok) {
				return coverUrl;
			}
		}

		// Try title/author search
		if (title) {
			let query = `title:${title}`;
			if (author) {
				query += ` author:${author}`;
			}

			const response = await fetch(
				`https://openlibrary.org/search.json?${new URLSearchParams({ q: query, limit: '1' })}`
			);

			if (!response.ok) return null;

			const data = await response.json();

			if (data.docs && data.docs[0]?.cover_i) {
				const coverId = data.docs[0].cover_i;
				return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
			}
		}

		return null;
	} catch (error) {
		return null;
	}
}
