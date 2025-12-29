import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { slug } = params;

	// Fetch the page
	const { data: page, error: pageError } = await supabase
		.from('pages')
		.select('*')
		.eq('slug', slug)
		.eq('is_published', true)
		.single();

	if (pageError || !page) {
		throw error(404, 'Page not found');
	}

	// Increment view count (non-blocking)
	supabase.rpc('increment_page_views', { page_slug: slug }).then();

	return { page };
};
