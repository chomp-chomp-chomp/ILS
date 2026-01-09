import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const search = url.searchParams.get('search') || '';
	const activeOnly = url.searchParams.get('active') !== 'false';

	let query = supabase
		.from('ill_partners')
		.select('*')
		.order('library_name', { ascending: true });

	if (activeOnly) {
		query = query.eq('is_active', true);
	}

	if (search) {
		query = query.or(
			`library_name.ilike.%${search}%,library_code.ilike.%${search}%,city.ilike.%${search}%`
		);
	}

	const { data: partners, error } = await query;

	if (error) {
		console.error('Error fetching partners:', error);
		return { partners: [], search, activeOnly };
	}

	return {
		partners: partners || [],
		search,
		activeOnly
	};
};
