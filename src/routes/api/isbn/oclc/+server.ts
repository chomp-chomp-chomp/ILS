import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function fetchWithTimeout(url: string, timeout = 8000, init?: RequestInit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		clearTimeout(timeoutId);
		return response;
	} catch (err) {
		clearTimeout(timeoutId);
		throw err;
	}
}

async function fetchWithRetry(url: string, timeout: number, init?: RequestInit, retries = 1) {
	try {
		const response = await fetchWithTimeout(url, timeout, init);
		if (!response.ok && response.status >= 500 && retries > 0) {
			return fetchWithRetry(url, timeout, init, retries - 1);
		}
		return response;
	} catch (err) {
		if (retries > 0) {
			return fetchWithRetry(url, timeout, init, retries - 1);
		}
		throw err;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const isbnParam = url.searchParams.get('isbn')?.trim() || '';
	const cleanISBN = isbnParam.replace(/[^0-9X]/gi, '');

	if (!cleanISBN) {
		throw error(400, 'ISBN is required');
	}

	const baseUrl = env.OCLC_CLASSIFY_BASE_URL || 'https://classify.oclc.org/classify2/Classify';
	const userAgent = env.BIBLIOGRAPHIC_PROXY_USER_AGENT || 'ILS ISBN Lookup';
	const oclcUrl = `${baseUrl}?isbn=${cleanISBN}&summary=true`;

	try {
		const response = await fetchWithRetry(oclcUrl, 8000, {
			headers: {
				'User-Agent': userAgent,
				'Accept': 'text/xml'
			}
		});
		if (!response.ok) {
			throw error(502, `OCLC API returned ${response.status}`);
		}
		const xmlText = await response.text();
		return new Response(xmlText, {
			headers: {
				'content-type': 'text/xml; charset=utf-8'
			}
		});
	} catch (err: any) {
		throw error(502, err?.message || 'OCLC API request failed');
	}
};
