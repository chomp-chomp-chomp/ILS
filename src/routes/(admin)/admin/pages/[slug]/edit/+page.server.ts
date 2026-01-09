import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// If slug is 'new', return empty page for creation
	if (params.slug === 'new') {
		return { page: null };
	}

	const { data: page, error } = await supabase
		.from('pages')
		.select('*')
		.eq('slug', params.slug)
		.single();

	if (error) {
		console.error('Error loading page:', error);
		return { page: null };
	}

	return { page };
};
