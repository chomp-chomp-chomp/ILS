import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const q = url.searchParams.get('q') || '';
	const limit = parseInt(url.searchParams.get('limit') || '20');

	if (!q) {
		return json({ results: [], total: 0 });
	}

	try {
		// Search using full-text search
		const { data, error: searchError, count } = await supabase
			.from('marc_records')
			.select('id, title_statement, main_entry_personal_name, publication_info, material_type', {
				count: 'exact'
			})
			.textSearch('search_vector', q, {
				type: 'websearch',
				config: 'english'
			})
			.limit(limit);

		if (searchError) {
			console.error('Search error:', searchError);
			return json({ results: [], total: 0 });
		}

		return json({
			results: data || [],
			total: count || 0
		});
	} catch (err) {
		console.error('Records search API error:', err);
		return json({ results: [], total: 0 });
	}
};
