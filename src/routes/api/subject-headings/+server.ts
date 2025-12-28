import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query || query.length < 3) {
		return json([]);
	}

	try {
		// Call Library of Congress Suggest API
		const response = await fetch(
			`https://id.loc.gov/authorities/subjects/suggest2/?q=${encodeURIComponent(query)}`
		);

		if (!response.ok) {
			console.error('LC API error:', response.status, response.statusText);
			return json([]);
		}

		const data = await response.json();

		// The response format is [query, [labels], [uris], [extras]]
		if (data && data[1] && Array.isArray(data[1])) {
			return json(data[1].slice(0, 10)); // Return up to 10 suggestions
		}

		return json([]);
	} catch (error) {
		console.error('Error fetching subject headings:', error);
		return json([]);
	}
};
