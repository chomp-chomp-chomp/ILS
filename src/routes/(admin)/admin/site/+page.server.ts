import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Load current site settings
	const { data: settings, error } = await supabase
		.from('site_settings')
		.select('*')
		.eq('is_active', true)
		.maybeSingle();

	if (error) {
		console.error('Error loading site settings:', error);
		return {
			settings: null,
			error: error.message
		};
	}

	return {
		settings
	};
};
