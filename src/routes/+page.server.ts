import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	// Fetch homepage content
	const { data: homepage } = await supabase
		.from('pages')
		.select('*')
		.eq('slug', 'homepage')
		.eq('is_published', true)
		.single();

	// Fetch branding configuration for homepage
	const { data: branding } = await supabase
		.from('branding_configuration')
		.select('homepage_logo_url, library_name, library_tagline, show_homepage_info, homepage_info_title, homepage_info_content, homepage_info_links')
		.eq('is_active', true)
		.single();

	return {
		session,
		homepage: homepage || null,
		branding: branding || null
	};
};
