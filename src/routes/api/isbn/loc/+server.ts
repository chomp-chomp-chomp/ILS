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

	const baseUrl = env.LOC_SRU_BASE_URL || 'https://lx2.loc.gov:210/LCDB';
	const fallbackBaseUrl = env.LOC_SRU_FALLBACK_BASE_URL || 'https://www.loc.gov/sru/';
	const userAgent = env.BIBLIOGRAPHIC_PROXY_USER_AGENT || 'ILS ISBN Lookup';
	const query = `bath.isbn=${cleanISBN}`;
	const buildLocUrl = (rootUrl: string) => {
		const locUrl = new URL(rootUrl);
		locUrl.searchParams.set('operation', 'searchRetrieve');
		locUrl.searchParams.set('version', '1.1');
		locUrl.searchParams.set('query', query);
		locUrl.searchParams.set('maximumRecords', '1');
		locUrl.searchParams.set('recordSchema', 'marcxml');
		return locUrl.toString();
	};
	const locUrls = [buildLocUrl(baseUrl)];
	const fallbackUrl = buildLocUrl(fallbackBaseUrl);
	if (fallbackUrl !== locUrls[0]) {
		locUrls.push(fallbackUrl);
	}

	try {
		let lastError = 'LoC API request failed';
		for (const locUrl of locUrls) {
			try {
				const response = await fetchWithRetry(locUrl, 8000, {
					headers: {
						'User-Agent': userAgent,
						'Accept': 'text/xml, application/xml'
					}
				});
				if (response.ok) {
					const xmlText = await response.text();
					return new Response(xmlText, {
						headers: {
							'content-type': 'text/xml; charset=utf-8'
						}
					});
				}
				const errorBody = await response.text().catch(() => '');
				const details = errorBody ? `: ${errorBody.slice(0, 200)}` : '';
				lastError = `LoC API returned ${response.status}${details}`;
			} catch (err: any) {
				lastError = err?.message || lastError;
			}
		}
		throw error(502, lastError);
	} catch (err: any) {
		throw error(502, err?.message || 'LoC API request failed');
	}
};
