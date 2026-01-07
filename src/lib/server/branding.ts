import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

// Centralized default branding configuration
export const defaultBranding = {
	library_name: 'Chomp Chomp Library Catalog',
	library_tagline: '',
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
	show_powered_by: false,
	contact_email: null,
	contact_phone: null,
	contact_address: null,
	facebook_url: null,
	twitter_url: null,
	instagram_url: null,
	show_covers: true,
	// Note: show_facets moved to search_configuration, kept here for backward compatibility
	show_facets: true,
	items_per_page: 20,
	show_header: false,
	header_links: [],
	show_homepage_info: false,
	homepage_info_title: 'Quick Links',
	homepage_info_content: '',
	homepage_info_links: []
};

function getBrandingClient(fallback: SupabaseClient) {
	// Prefer the service role key when available so branding can be read without anon permissions
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL;

	if (serviceRoleKey && supabaseUrl) {
		if (!serviceClient) {
			serviceClient = createClient(supabaseUrl, serviceRoleKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false
				}
			});
		}
		return serviceClient;
	}

	return fallback;
}

export async function loadActiveBranding(
	supabase: SupabaseClient
): Promise<{ branding: Record<string, any>; error: PostgrestError | null }> {
	const client = getBrandingClient(supabase);

	const { data, error } = await client
		.from('branding_configuration')
		.select('*')
		.eq('is_active', true)
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		console.error('Error loading branding configuration:', error);
	}

	// Always return merged defaults + database data (never null)
	return {
		branding: {
			...defaultBranding,
			...(data || {})
		},
		error
	};
}
