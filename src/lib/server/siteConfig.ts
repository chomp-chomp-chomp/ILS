import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

// Centralized default site configuration
export const defaultSiteConfig = {
	// Header
	header_enabled: false,
	header_logo_url: null,
	header_links: [],

	// Footer
	footer_enabled: false,
	footer_text: 'Powered by Open Library System',
	footer_links: [],

	// Homepage info
	homepage_info_enabled: false,
	homepage_info_title: 'Quick Links',
	homepage_info_content: 'Welcome to our library catalog. Use the search box above to find items by title, author, subject, or ISBN.',
	homepage_info_links: [],

	// Homepage hero
	homepage_hero_enabled: false,
	homepage_hero_title: '',
	homepage_hero_tagline: '',
	homepage_hero_image_url: null,
	homepage_hero_links: [],

	// Site metadata assets
	favicon_url: null,
	apple_touch_icon_url: null,
	android_chrome_192_url: null,
	android_chrome_512_url: null,
	og_image_url: null,
	twitter_card_image_url: null,

	// Theme
	theme_mode: 'system', // 'system', 'light', 'dark'
	theme_light: {
		primary: '#e73b42',
		secondary: '#667eea',
		accent: '#2c3e50',
		background: '#ffffff',
		text: '#333333',
		font: 'system-ui, -apple-system, sans-serif'
	},
	theme_dark: {
		primary: '#ff6b72',
		secondary: '#8b9eff',
		accent: '#3d5a7f',
		background: '#1a1a1a',
		text: '#e5e5e5',
		font: 'system-ui, -apple-system, sans-serif'
	},
	page_themes: {}
};

function getSiteConfigClient(fallback: SupabaseClient) {
	// Prefer the service role key when available so site config can be read without anon permissions
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

export async function loadActiveSiteConfig(
	supabase: SupabaseClient
): Promise<{ siteConfig: Record<string, any>; error: PostgrestError | null }> {
	try {
		console.log('[loadActiveSiteConfig] Starting site config load operation');
		const client = getSiteConfigClient(supabase);

		console.log('[loadActiveSiteConfig] Querying database for active site configuration');
		const { data, error } = await client
			.from('site_configuration')
			.select('*')
			.eq('is_active', true)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error) {
			console.error('[loadActiveSiteConfig] Database query error:', error);
			console.error('[loadActiveSiteConfig] Error code:', error.code);
			console.error('[loadActiveSiteConfig] Error message:', error.message);
			console.log('[loadActiveSiteConfig] Returning default site config due to error');
			// Return defaults on error (no 500 - graceful fallback)
			return {
				siteConfig: defaultSiteConfig,
				error
			};
		}

		if (data) {
			console.log('[loadActiveSiteConfig] Database record found');
			console.log('[loadActiveSiteConfig] Record ID:', data.id);
			console.log('[loadActiveSiteConfig] Header enabled:', data.header_enabled);
			console.log('[loadActiveSiteConfig] Footer enabled:', data.footer_enabled);
			console.log('[loadActiveSiteConfig] Homepage info enabled:', data.homepage_info_enabled);
			console.log('[loadActiveSiteConfig] Theme mode:', data.theme_mode);
		} else {
			console.log('[loadActiveSiteConfig] No active site config record found in database');
		}

		// Merge defaults with database data
		const mergedSiteConfig = {
			...defaultSiteConfig,
			...(data || {})
		};

		console.log('[loadActiveSiteConfig] Merged site configuration:');
		console.log('[loadActiveSiteConfig] - Header enabled:', mergedSiteConfig.header_enabled);
		console.log('[loadActiveSiteConfig] - Footer enabled:', mergedSiteConfig.footer_enabled);
		console.log('[loadActiveSiteConfig] - Homepage info enabled:', mergedSiteConfig.homepage_info_enabled);
		console.log('[loadActiveSiteConfig] - Theme mode:', mergedSiteConfig.theme_mode);

		// Always return merged defaults + database data (never null)
		return {
			siteConfig: mergedSiteConfig,
			error: null
		};
	} catch (err) {
		console.error('[loadActiveSiteConfig] Exception caught:', err);
		console.error('[loadActiveSiteConfig] Exception type:', err instanceof Error ? err.constructor.name : typeof err);
		if (err instanceof Error) {
			console.error('[loadActiveSiteConfig] Exception message:', err.message);
			console.error('[loadActiveSiteConfig] Exception stack:', err.stack);
		}
		console.log('[loadActiveSiteConfig] Returning default site config due to exception');
		// Return defaults on exception (no 500 - graceful fallback)
		return {
			siteConfig: defaultSiteConfig,
			error: null
		};
	}
}
