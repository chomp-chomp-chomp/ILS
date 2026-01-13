import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function fetchWithTimeout(url: string, timeout = 8000) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		return response;
	} catch (err) {
		clearTimeout(timeoutId);
		throw err;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const isbnParam = url.searchParams.get('isbn')?.trim() || '';
	const cleanISBN = isbnParam.replace(/[^0-9X]/gi, '');

	if (!cleanISBN) {
		throw error(400, 'ISBN is required');
	}

	const query = encodeURIComponent(`bath.isbn=${cleanISBN}`);
	const locUrl = `https://lx2.loc.gov:210/lcdb?operation=searchRetrieve&version=1.1&query=${query}&maximumRecords=1&recordSchema=marcxml`;

	try {
		const response = await fetchWithTimeout(locUrl, 8000);
		if (!response.ok) {
			throw error(502, `LoC API returned ${response.status}`);
		}
		const xmlText = await response.text();
		return new Response(xmlText, {
			headers: {
				'content-type': 'text/xml; charset=utf-8'
			}
		});
	} catch (err: any) {
		throw error(502, err?.message || 'LoC API request failed');
	}
};
