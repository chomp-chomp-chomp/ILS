import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	console.log('Subject headings API called with query:', query);

	if (!query || query.length < 3) {
		console.log('Query too short or missing');
		return json([]);
	}

	try {
		// Call Library of Congress Suggest API
		const lcUrl = `https://id.loc.gov/authorities/subjects/suggest2/?q=${encodeURIComponent(query)}`;
		console.log('Calling LC API:', lcUrl);

		const response = await fetch(lcUrl);

		if (!response.ok) {
			console.error('LC API error:', response.status, response.statusText);
			const text = await response.text();
			console.error('Response body:', text);
			return json([]);
		}

		const data = await response.json();
		console.log('LC API response:', JSON.stringify(data, null, 2));

		// The suggest2 API returns: { query: "...", hits: [{ uri: "...", suggestLabel: "..." }] }
		if (data && data.hits && Array.isArray(data.hits)) {
			// Extract just the labels from the hits
			const suggestions = data.hits
				.slice(0, 10)
				.map((hit: any) => hit.suggestLabel || hit.aLabel || 'Unknown');
			console.log('Returning suggestions:', suggestions);
			return json(suggestions);
		}

		console.log('No valid data in response');
		return json([]);
	} catch (error) {
		console.error('Error fetching subject headings:', error);
		return json([]);
	}
};
