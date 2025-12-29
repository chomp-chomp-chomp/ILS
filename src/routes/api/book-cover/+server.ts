import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const isbn = url.searchParams.get('isbn');
	const title = url.searchParams.get('title');
	const author = url.searchParams.get('author');

	if (!isbn && !title) {
		return json({ error: 'ISBN or title required' }, { status: 400 });
	}

	try {
		let coverUrl: string | null = null;

		// Try Google Books first (usually better covers)
		if (isbn) {
			coverUrl = await tryGoogleBooks(isbn);
		}

		// Fallback to Open Library if no ISBN or Google failed
		if (!coverUrl && (isbn || title)) {
			coverUrl = await tryOpenLibrary(isbn, title, author);
		}

		if (coverUrl) {
			return json({ coverUrl });
		}

		return json({ coverUrl: null });
	} catch (error) {
		console.error('Error fetching book cover:', error);
		return json({ coverUrl: null });
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
			// Prefer larger images
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
		console.error('Google Books API error:', error);
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
			// Open Library has a direct cover API
			const coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanISBN}-L.jpg`;

			// Check if image exists
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
		console.error('Open Library API error:', error);
		return null;
	}
}
