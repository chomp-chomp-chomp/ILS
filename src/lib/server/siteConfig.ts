import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

/**
 * Centralized default site configuration
 * 
 * UPDATING SERVER-SIDE DEFAULTS:
 * To change the default configuration values that are used when no database 
 * configuration exists, modify the values in this defaultSiteConfig object.
 * 
 * These defaults are merged with database values in loadActiveSiteConfig().
 * Database values take precedence over defaults when both exist.
 * 
 * Key sections:
 * - Header: Navigation bar at top of site (header_enabled, header_links)
 * - Footer: Footer bar at bottom of site (footer_enabled, footer_text, footer_links)
 * - Homepage Hero: Large banner section on homepage (homepage_hero_*)
 * - Homepage Info: Informational section on homepage (homepage_info_*)
 * - Metadata: Favicon and social media images (favicon_url, og_image_url, etc.)
 * - Theme: Color schemes for light/dark modes
 */
export const defaultSiteConfig = {
	// Header configuration
	// Enable header_enabled: true to show custom header navigation
	header_enabled: true,
	header_logo_url: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library',
	header_links: [
		{ title: 'Home', url: 'https://library.chompchomp.cc/', order: 1 },
		{ title: 'Advanced Search', url: 'https://library.chompchomp.cc/catalog/search/advanced', order: 2 },
		{ title: 'Tools', url: 'https://chompchomp.cc/tools/', order: 3 },
		{ title: 'Recipes', url: 'https://chompchomp.cc/', order: 4 }
	],

	// Footer configuration
	// Footer appears at bottom of all non-admin pages when footer_enabled is true
	footer_enabled: true,
	footer_text: 'Powered by Chomp Chomp',
	footer_links: [
		{ title: 'Powered by Chomp Chomp', url: 'https://chompchomp.cc', order: 1 }
	],

	// Homepage info section (below search box)
	homepage_info_enabled: false,
	homepage_info_title: 'Quick Links',
	homepage_info_content: 'Welcome to our library catalog. Use the search box above to find items by title, author, subject, or ISBN.',
	homepage_info_links: [],

	// Homepage hero section (large banner with image)
	// This appears at the very top of the homepage when enabled
	homepage_hero_enabled: true,
	homepage_hero_title: 'Welcome to the Chomp Chomp Library',
	homepage_hero_tagline: 'Explore our collection',
	homepage_hero_image_url: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516',
	homepage_hero_links: [],

	// Site metadata assets (favicons, social sharing images)
	// These URLs can point to files in /static or external URLs
	favicon_url: '/favicon.ico',
	apple_touch_icon_url: '/apple-touch-icon.png',
	android_chrome_192_url: '/android-chrome-192x192.png',
	android_chrome_512_url: '/android-chrome-512x512.png',
	og_image_url: null,
	twitter_card_image_url: null,

	// Theme configuration
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
			console.log('[getSiteConfigClient] Created service role client for site configuration');
		}
		return { client: serviceClient, usingServiceRole: true };
	}

	console.log('[getSiteConfigClient] Service role key not available, using fallback client');
	return { client: fallback, usingServiceRole: false };
}

export async function loadActiveSiteConfig(
	supabase: SupabaseClient
): Promise<{ siteConfig: Record<string, any>; error: PostgrestError | null }> {
	try {
		console.log('[loadActiveSiteConfig] Starting site config load operation');
		const { client, usingServiceRole } = getSiteConfigClient(supabase);
		console.log(`[loadActiveSiteConfig] Using ${usingServiceRole ? 'SERVICE ROLE' : 'FALLBACK'} client`);

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
			console.log('[loadActiveSiteConfig] Homepage hero enabled:', data.homepage_hero_enabled);
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
		console.log('[loadActiveSiteConfig] - Homepage hero enabled:', mergedSiteConfig.homepage_hero_enabled);
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
