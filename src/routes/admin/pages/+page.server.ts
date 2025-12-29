import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: pages, error } = await supabase
		.from('pages')
		.select('*')
		.order('menu_order')
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Error loading pages:', error);
		return { pages: [] };
	}

	return {
		pages: pages || []
	};
};
