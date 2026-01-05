import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Fetch the active branding configuration
	const { data: branding, error } = await supabase
		.from('branding_configuration')
		.select('*')
		.eq('is_active', true)
		.single();

	// If no branding exists, return defaults
	if (error || !branding) {
		return {
			branding: {
				library_name: 'Chomp Chomp Library Catalog',
				library_tagline: 'Search our collection',
				logo_url: null,
				homepage_logo_url: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library',
				favicon_url: null,
				primary_color: '#e73b42',
				secondary_color: '#667eea',
				accent_color: '#2c3e50',
				background_color: '#ffffff',
				text_color: '#333333',
				font_family: 'system-ui, -apple-system, sans-serif',
				heading_font: null,
				custom_css: null,
				custom_head_html: null,
				footer_text: 'Powered by Open Library System',
				show_powered_by: true,
				contact_email: null,
				contact_phone: null,
				contact_address: null,
				facebook_url: null,
				twitter_url: null,
				instagram_url: null,
				show_covers: true,
				show_facets: true,
				items_per_page: 20,
				show_header: false,
				header_links: [],
				show_homepage_info: false,
				homepage_info_title: 'Quick Links',
				homepage_info_content: '',
				homepage_info_links: []
			}
		};
	}

	return { branding };
};
