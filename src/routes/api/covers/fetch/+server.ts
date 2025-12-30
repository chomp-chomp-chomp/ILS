/**
 * Cover Fetching API
 * Fetches book covers from multiple sources (OpenLibrary, Google Books, LibraryThing)
 * POST /api/covers/fetch - Fetch cover for a specific record
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cover source interfaces
interface CoverSource {
	name: string;
	fetchCover: (isbn: string, title?: string, author?: string) => Promise<CoverResult | null>;
}

interface CoverResult {
	url: string;
	width?: number;
	height?: number;
	quality: number; // 0-100
	source: string;
}

/**
 * OpenLibrary Cover API
 * Supports ISBN-based lookups with multiple sizes
 */
const openLibrarySource: CoverSource = {
	name: 'openlibrary',
	fetchCover: async (isbn: string) => {
		const cleanISBN = isbn.replace(/[-\s]/g, '');

		// Try different sizes to check availability
		const sizes = [
			{ size: 'L', quality: 80 },
			{ size: 'M', quality: 60 },
			{ size: 'S', quality: 40 }
		];

		for (const { size, quality } of sizes) {
			const url = `https://covers.openlibrary.org/b/isbn/${cleanISBN}-${size}.jpg`;

			try {
				// Check if image exists (OpenLibrary returns small placeholder for missing)
				const response = await fetch(url, { method: 'HEAD' });
				const contentLength = parseInt(response.headers.get('content-length') || '0');

				// OpenLibrary returns ~807 bytes for placeholder, real covers are larger
				if (response.ok && contentLength > 1000) {
					return {
						url,
						quality,
						source: 'openlibrary'
					};
				}
			} catch (err) {
				console.error(`OpenLibrary fetch error for ${isbn}:`, err);
			}
		}

		return null;
	}
};

/**
 * Google Books API
 * Requires API key for high volume, but works without for basic usage
 */
const googleBooksSource: CoverSource = {
	name: 'google',
	fetchCover: async (isbn: string, title?: string) => {
		const cleanISBN = isbn.replace(/[-\s]/g, '');

		try {
			// Search by ISBN
			let apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`;

			// Add API key if available
			const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
			if (apiKey) {
				apiUrl += `&key=${apiKey}`;
			}

			const response = await fetch(apiUrl);
			const data = await response.json();

			if (data.items && data.items.length > 0) {
				const book = data.items[0];
				const imageLinks = book.volumeInfo?.imageLinks;

				if (imageLinks) {
					// Prefer larger images
					const imageUrl =
						imageLinks.extraLarge ||
						imageLinks.large ||
						imageLinks.medium ||
						imageLinks.thumbnail ||
						imageLinks.smallThumbnail;

					if (imageUrl) {
						// Convert to HTTPS and get high-res version
						let url = imageUrl.replace('http://', 'https://');
						// Remove zoom parameter to get full size
						url = url.replace(/&zoom=\d+/, '');

						return {
							url,
							quality: imageLinks.extraLarge ? 90 : imageLinks.large ? 75 : 60,
							source: 'google'
						};
					}
				}
			}
		} catch (err) {
			console.error(`Google Books fetch error for ${isbn}:`, err);
		}

		return null;
	}
};

/**
 * LibraryThing Cover API
 * Requires developer key (free)
 */
const libraryThingSource: CoverSource = {
	name: 'librarything',
	fetchCover: async (isbn: string) => {
		const apiKey = process.env.LIBRARYTHING_API_KEY;

		if (!apiKey) {
			console.warn('LibraryThing API key not configured');
			return null;
		}

		const cleanISBN = isbn.replace(/[-\s]/g, '');

		try {
			// LibraryThing covers: http://covers.librarything.com/devkey/[YOUR_KEY]/[SIZE]/isbn/[ISBN]
			// Sizes: small, medium, large
			const sizes = [
				{ size: 'large', quality: 80 },
				{ size: 'medium', quality: 60 },
				{ size: 'small', quality: 40 }
			];

			for (const { size, quality } of sizes) {
				const url = `https://covers.librarything.com/devkey/${apiKey}/${size}/isbn/${cleanISBN}`;

				const response = await fetch(url, { method: 'HEAD' });

				if (response.ok) {
					const contentLength = parseInt(response.headers.get('content-length') || '0');

					// Check if it's a real cover (not placeholder)
					if (contentLength > 1000) {
						return {
							url,
							quality,
							source: 'librarything'
						};
					}
				}
			}
		} catch (err) {
			console.error(`LibraryThing fetch error for ${isbn}:`, err);
		}

		return null;
	}
};

/**
 * Fetch cover from all available sources in priority order
 */
async function fetchCoverFromSources(
	isbn: string,
	title?: string,
	author?: string,
	sources: string[] = ['openlibrary', 'google', 'librarything']
): Promise<CoverResult | null> {
	const sourceMap: Record<string, CoverSource> = {
		openlibrary: openLibrarySource,
		google: googleBooksSource,
		librarything: libraryThingSource
	};

	for (const sourceName of sources) {
		const source = sourceMap[sourceName];
		if (!source) continue;

		try {
			const result = await source.fetchCover(isbn, title, author);
			if (result) {
				return result;
			}
		} catch (err) {
			console.error(`Error fetching from ${sourceName}:`, err);
		}
	}

	return null;
}

/**
 * Generate a fallback placeholder cover with title/author
 */
function generatePlaceholderCover(title: string, author?: string): CoverResult {
	// Use a placeholder service or generate a data URI
	const text = encodeURIComponent(title.substring(0, 30));
	const url = `https://via.placeholder.com/400x600/e73b42/ffffff?text=${text}`;

	return {
		url,
		quality: 20,
		source: 'generated'
	};
}

/**
 * POST /api/covers/fetch
 * Fetch cover for a specific MARC record
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { recordId, isbn, title, author, sources, saveToDatabase = true } = body;

		if (!recordId) {
			throw error(400, 'recordId is required');
		}

		// Get record details if not provided
		let recordISBN = isbn;
		let recordTitle = title;
		let recordAuthor = author;

		if (!isbn || !title) {
			const { data: record, error: recordError } = await supabase
				.from('marc_records')
				.select('isbn, title_statement, main_entry_personal_name')
				.eq('id', recordId)
				.single();

			if (recordError) throw recordError;

			recordISBN = recordISBN || record.isbn;
			recordTitle = recordTitle || record.title_statement?.a;
			recordAuthor = recordAuthor || record.main_entry_personal_name?.a;
		}

		if (!recordISBN) {
			throw error(400, 'ISBN is required for cover fetching');
		}

		// Fetch cover from sources
		let coverResult = await fetchCoverFromSources(recordISBN, recordTitle, recordAuthor, sources);

		// Use placeholder if no cover found
		if (!coverResult && recordTitle) {
			coverResult = generatePlaceholderCover(recordTitle, recordAuthor);
			coverResult.source = 'generated';
		}

		if (!coverResult) {
			return json({
				success: false,
				message: 'No cover found and unable to generate placeholder'
			});
		}

		// Save to database if requested
		if (saveToDatabase) {
			// Deactivate existing covers
			await supabase
				.from('covers')
				.update({ is_active: false })
				.eq('marc_record_id', recordId);

			// Insert new cover
			const { data: cover, error: coverError } = await supabase
				.from('covers')
				.insert({
					marc_record_id: recordId,
					isbn: recordISBN,
					source: coverResult.source,
					original_url: coverResult.url,
					thumbnail_large_url: coverResult.url,
					quality_score: coverResult.quality,
					is_placeholder: coverResult.source === 'generated',
					fetch_status: 'success',
					is_active: true,
					uploaded_by: session.user.id
				})
				.select()
				.single();

			if (coverError) throw coverError;

			return json({
				success: true,
				cover,
				message: `Cover fetched from ${coverResult.source}`
			});
		}

		return json({
			success: true,
			url: coverResult.url,
			source: coverResult.source,
			quality: coverResult.quality
		});
	} catch (err) {
		console.error('Cover fetch error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to fetch cover');
	}
};

/**
 * GET /api/covers/fetch?isbn=XXX
 * Quick fetch without saving to database
 */
export const GET: RequestHandler = async ({ url }) => {
	const isbn = url.searchParams.get('isbn');
	const title = url.searchParams.get('title') || undefined;
	const author = url.searchParams.get('author') || undefined;
	const sourcesParam = url.searchParams.get('sources');

	if (!isbn) {
		throw error(400, 'ISBN parameter is required');
	}

	const sources = sourcesParam ? sourcesParam.split(',') : undefined;
	const coverResult = await fetchCoverFromSources(isbn, title, author, sources);

	if (!coverResult) {
		return json({
			success: false,
			message: 'No cover found'
		});
	}

	return json({
		success: true,
		url: coverResult.url,
		source: coverResult.source,
		quality: coverResult.quality
	});
};
