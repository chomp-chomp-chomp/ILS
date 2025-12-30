import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const searchQuery = url.searchParams.get('q') || '';
	const type = url.searchParams.get('type') || '';
	const source = url.searchParams.get('source') || '';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 20;

	try {
		// Build query
		let query = supabase
			.from('authorities')
			.select('*, authority_cross_refs(*)', { count: 'exact' });

		// Apply filters
		if (type) {
			query = query.eq('type', type);
		}

		if (source) {
			query = query.eq('source', source);
		}

		// Apply search
		if (searchQuery) {
			query = query.or(
				`heading.ilike.%${searchQuery}%,variant_forms.cs.{${searchQuery}},lccn.eq.${searchQuery}`
			);
		}

		// Pagination
		const offset = (page - 1) * limit;
		query = query
			.order('usage_count', { ascending: false })
			.order('heading', { ascending: true })
			.range(offset, offset + limit - 1);

		const { data: authorities, error, count } = await query;

		if (error) throw error;

		// Get statistics
		const { data: stats } = await supabase.rpc('get_authority_stats');

		return {
			authorities: authorities || [],
			total: count || 0,
			page,
			limit,
			searchQuery,
			type,
			source,
			stats: stats || {
				total: 0,
				by_type: {},
				by_source: {},
				total_links: 0
			}
		};
	} catch (error) {
		console.error('Error loading authorities:', error);
		return {
			authorities: [],
			total: 0,
			page: 1,
			limit,
			searchQuery,
			type,
			source,
			error: 'Failed to load authorities'
		};
	}
};
