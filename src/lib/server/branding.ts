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
	// Typography controls
	font_size_h1: '2.5rem',
	font_size_h2: '2rem',
	font_size_h3: '1.5rem',
	font_size_h4: '1.25rem',
	font_size_p: '1rem',
	font_size_small: '0.875rem',
	custom_css: null,
	custom_head_html: null,
	footer_text: 'Powered by Open Library System',
	show_powered_by: false,
	// Footer styling controls
	footer_background_color: '#2c3e50',
	footer_text_color: '#ffffff',
	footer_link_color: '#ff6b72',
	footer_padding: '2rem 0',
	footer_content: null,
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
	try {
		console.log('[loadActiveBranding] Starting branding load operation');
		const client = getBrandingClient(supabase);

		console.log('[loadActiveBranding] Querying database for active branding configuration');
		const { data, error } = await client
			.from('branding_configuration')
			.select('*')
			.eq('is_active', true)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error) {
			console.error('[loadActiveBranding] Database query error:', error);
			console.error('[loadActiveBranding] Error code:', error.code);
			console.error('[loadActiveBranding] Error message:', error.message);
			console.log('[loadActiveBranding] Returning default branding due to error');
			// Return defaults on error
			return {
				branding: defaultBranding,
				error
			};
		}

		if (data) {
			console.log('[loadActiveBranding] Database record found');
			console.log('[loadActiveBranding] Record ID:', data.id);
			console.log('[loadActiveBranding] Record updated_at:', data.updated_at);
			console.log('[loadActiveBranding] Library name:', data.library_name);
			console.log('[loadActiveBranding] Primary color:', data.primary_color);
			console.log('[loadActiveBranding] Show header:', data.show_header);
			console.log('[loadActiveBranding] Show powered by:', data.show_powered_by);
			console.log('[loadActiveBranding] Footer text:', data.footer_text);
		} else {
			console.log('[loadActiveBranding] No active branding record found in database');
		}

		// Merge defaults with database data
		const mergedBranding = {
			...defaultBranding,
			...(data || {})
		};

		console.log('[loadActiveBranding] Merged branding configuration:');
		console.log('[loadActiveBranding] - Library name:', mergedBranding.library_name);
		console.log('[loadActiveBranding] - Primary color:', mergedBranding.primary_color);
		console.log('[loadActiveBranding] - Show header:', mergedBranding.show_header);
		console.log('[loadActiveBranding] - Show powered by:', mergedBranding.show_powered_by);
		console.log('[loadActiveBranding] - Footer text:', mergedBranding.footer_text);
		console.log('[loadActiveBranding] - Show covers:', mergedBranding.show_covers);

		// Always return merged defaults + database data (never null)
		return {
			branding: mergedBranding,
			error: null
		};
	} catch (err) {
		console.error('[loadActiveBranding] Exception caught:', err);
		console.error('[loadActiveBranding] Exception type:', err instanceof Error ? err.constructor.name : typeof err);
		if (err instanceof Error) {
			console.error('[loadActiveBranding] Exception message:', err.message);
			console.error('[loadActiveBranding] Exception stack:', err.stack);
		}
		console.log('[loadActiveBranding] Returning default branding due to exception');
		// Return defaults on exception
		return {
			branding: defaultBranding,
			error: null
		};
	}
}
