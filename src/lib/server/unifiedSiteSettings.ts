import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Unified Site Settings Type
 * Consolidates branding_configuration, site_configuration, and site_settings
 * into a single comprehensive settings object
 */
export interface UnifiedSiteSettings {
	// Library Identity
	library_name: string;
	library_tagline: string | null;

	// Logos
	logo_url: string | null;
	homepage_logo_url: string | null;
	favicon_url: string | null;

	// Header Navigation
	header_links: Array<{ title: string; url: string }>;

	// Footer
	footer_text: string;
	footer_link: string | null;
	show_powered_by: boolean;

	// Homepage Hero
	hero_title: string;
	hero_subhead: string;
	hero_image_url: string;

	// Color Scheme
	primary_color: string;
	secondary_color: string;
	accent_color: string;
	background_color: string;
	text_color: string;

	// Typography
	font_family: string;
	heading_font: string | null;

	// Custom Styling
	custom_css: string | null;
	custom_head_html: string | null;

	// Contact Information
	contact_email: string | null;
	contact_phone: string | null;
	contact_address: string | null;

	// Social Media
	facebook_url: string | null;
	twitter_url: string | null;
	instagram_url: string | null;

	// Feature Toggles
	show_covers: boolean;
	show_facets: boolean;
	items_per_page: number;

	// Metadata
	id: string;
	created_at: string;
	updated_at: string;
	updated_by: string | null;
}

/**
 * Default settings - used as fallback if database is unavailable
 */
export const DEFAULT_UNIFIED_SETTINGS: UnifiedSiteSettings = {
	// Library Identity
	library_name: 'Chomp Chomp Library Catalog',
	library_tagline: 'Explore our collection',

	// Logos
	logo_url: null,
	homepage_logo_url: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library',
	favicon_url: null,

	// Header Navigation
	header_links: [
		{ title: 'Home', url: '/' },
		{ title: 'Advanced Search', url: '/catalog/search/advanced' },
		{ title: 'Browse', url: '/catalog/browse' }
	],

	// Footer
	footer_text: 'Powered by Chomp Chomp',
	footer_link: 'https://chompchomp.cc',
	show_powered_by: true,

	// Homepage Hero
	hero_title: 'Welcome to the Chomp Chomp Library',
	hero_subhead: 'Explore our collection',
	hero_image_url: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516',

	// Color Scheme
	primary_color: '#e73b42',
	secondary_color: '#667eea',
	accent_color: '#2c3e50',
	background_color: '#ffffff',
	text_color: '#333333',

	// Typography
	font_family: 'system-ui, -apple-system, sans-serif',
	heading_font: null,

	// Custom Styling
	custom_css: null,
	custom_head_html: null,

	// Contact Information
	contact_email: null,
	contact_phone: null,
	contact_address: null,

	// Social Media
	facebook_url: null,
	twitter_url: null,
	instagram_url: null,

	// Feature Toggles
	show_covers: true,
	show_facets: true,
	items_per_page: 20,

	// Metadata
	id: 'default',
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
	updated_by: null
};

/**
 * Load unified site settings from the site_settings table
 *
 * This function queries the singleton site_settings row and merges it with defaults.
 * It provides a comprehensive settings object that includes all branding, header, footer,
 * and hero configuration.
 *
 * @param supabase - Supabase client
 * @returns Promise<UnifiedSiteSettings> - Always returns settings (never null/undefined)
 */
export async function loadUnifiedSiteSettings(
	supabase: SupabaseClient
): Promise<UnifiedSiteSettings> {
	try {
		console.log('[loadUnifiedSiteSettings] Querying site_settings table');

		const { data, error } = await supabase
			.from('site_settings')
			.select('*')
			.eq('id', 'default')
			.maybeSingle();

		if (error) {
			console.error('[loadUnifiedSiteSettings] Database error:', error.message);
			console.error('[loadUnifiedSiteSettings] Error code:', error.code);

			// Handle different error types
			if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
				console.warn('[loadUnifiedSiteSettings] site_settings table does not exist - migration 028 may not have run yet');
				console.log('[loadUnifiedSiteSettings] Site will use defaults until migration is executed');
			} else if (error.code === '42703' || error.message?.includes('column')) {
				console.warn('[loadUnifiedSiteSettings] New columns not found - migration 029 may not have run yet');
				console.log('[loadUnifiedSiteSettings] Site will use defaults until migration is executed');
			}

			console.log('[loadUnifiedSiteSettings] Returning default settings');
			return DEFAULT_UNIFIED_SETTINGS;
		}

		if (!data) {
			console.warn('[loadUnifiedSiteSettings] No site_settings row found, using defaults');
			return DEFAULT_UNIFIED_SETTINGS;
		}

		console.log('[loadUnifiedSiteSettings] Successfully loaded settings from database');
		console.log('[loadUnifiedSiteSettings] Library name:', data.library_name);
		console.log('[loadUnifiedSiteSettings] Show facets:', data.show_facets);

		// Merge database data with defaults
		// Use defensive access in case migration hasn't run yet
		const settings: UnifiedSiteSettings = {
			// Library Identity (may not exist yet)
			library_name: data.library_name ?? DEFAULT_UNIFIED_SETTINGS.library_name,
			library_tagline: data.library_tagline ?? DEFAULT_UNIFIED_SETTINGS.library_tagline,

			// Logos (may not exist yet)
			logo_url: data.logo_url ?? DEFAULT_UNIFIED_SETTINGS.logo_url,
			homepage_logo_url: data.homepage_logo_url ?? DEFAULT_UNIFIED_SETTINGS.homepage_logo_url,
			favicon_url: data.favicon_url ?? DEFAULT_UNIFIED_SETTINGS.favicon_url,

			// Header Navigation
			header_links: Array.isArray(data.header_links)
				? data.header_links
				: DEFAULT_UNIFIED_SETTINGS.header_links,

			// Footer
			footer_text: data.footer_text ?? DEFAULT_UNIFIED_SETTINGS.footer_text,
			footer_link: data.footer_link ?? DEFAULT_UNIFIED_SETTINGS.footer_link,
			show_powered_by: data.show_powered_by ?? DEFAULT_UNIFIED_SETTINGS.show_powered_by,

			// Homepage Hero
			hero_title: data.hero_title ?? DEFAULT_UNIFIED_SETTINGS.hero_title,
			hero_subhead: data.hero_subhead ?? DEFAULT_UNIFIED_SETTINGS.hero_subhead,
			hero_image_url: data.hero_image_url ?? DEFAULT_UNIFIED_SETTINGS.hero_image_url,

			// Color Scheme (may not exist yet)
			primary_color: data.primary_color ?? DEFAULT_UNIFIED_SETTINGS.primary_color,
			secondary_color: data.secondary_color ?? DEFAULT_UNIFIED_SETTINGS.secondary_color,
			accent_color: data.accent_color ?? DEFAULT_UNIFIED_SETTINGS.accent_color,
			background_color: data.background_color ?? DEFAULT_UNIFIED_SETTINGS.background_color,
			text_color: data.text_color ?? DEFAULT_UNIFIED_SETTINGS.text_color,

			// Typography (may not exist yet)
			font_family: data.font_family ?? DEFAULT_UNIFIED_SETTINGS.font_family,
			heading_font: data.heading_font ?? DEFAULT_UNIFIED_SETTINGS.heading_font,

			// Custom Styling (may not exist yet)
			custom_css: data.custom_css ?? DEFAULT_UNIFIED_SETTINGS.custom_css,
			custom_head_html: data.custom_head_html ?? DEFAULT_UNIFIED_SETTINGS.custom_head_html,

			// Contact Information (may not exist yet)
			contact_email: data.contact_email ?? DEFAULT_UNIFIED_SETTINGS.contact_email,
			contact_phone: data.contact_phone ?? DEFAULT_UNIFIED_SETTINGS.contact_phone,
			contact_address: data.contact_address ?? DEFAULT_UNIFIED_SETTINGS.contact_address,

			// Social Media (may not exist yet)
			facebook_url: data.facebook_url ?? DEFAULT_UNIFIED_SETTINGS.facebook_url,
			twitter_url: data.twitter_url ?? DEFAULT_UNIFIED_SETTINGS.twitter_url,
			instagram_url: data.instagram_url ?? DEFAULT_UNIFIED_SETTINGS.instagram_url,

			// Feature Toggles (may not exist yet)
			show_covers: data.show_covers ?? DEFAULT_UNIFIED_SETTINGS.show_covers,
			show_facets: data.show_facets ?? DEFAULT_UNIFIED_SETTINGS.show_facets,
			items_per_page: data.items_per_page ?? DEFAULT_UNIFIED_SETTINGS.items_per_page,

			// Metadata
			id: data.id ?? DEFAULT_UNIFIED_SETTINGS.id,
			created_at: data.created_at ?? DEFAULT_UNIFIED_SETTINGS.created_at,
			updated_at: data.updated_at ?? DEFAULT_UNIFIED_SETTINGS.updated_at,
			updated_by: data.updated_by ?? DEFAULT_UNIFIED_SETTINGS.updated_by
		};

		return settings;
	} catch (error) {
		console.error('[loadUnifiedSiteSettings] Exception:', error);
		console.log('[loadUnifiedSiteSettings] Returning default settings due to exception');
		return DEFAULT_UNIFIED_SETTINGS;
	}
}

/**
 * Update site settings in the database
 *
 * @param supabase - Supabase client (must be authenticated)
 * @param settings - Partial settings to update
 * @param userId - ID of user making the change (for audit trail)
 * @returns Success boolean and error message if any
 */
export async function updateUnifiedSiteSettings(
	supabase: SupabaseClient,
	settings: Partial<Omit<UnifiedSiteSettings, 'id' | 'created_at' | 'updated_at' | 'updated_by'>>,
	userId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		console.log('[updateUnifiedSiteSettings] Updating site settings for user:', userId);

		// Build update object with only provided fields
		const updateData: Record<string, any> = {
			updated_by: userId,
			updated_at: new Date().toISOString()
		};

		// Map all possible fields
		if (settings.library_name !== undefined) updateData.library_name = settings.library_name;
		if (settings.library_tagline !== undefined) updateData.library_tagline = settings.library_tagline;
		if (settings.logo_url !== undefined) updateData.logo_url = settings.logo_url;
		if (settings.homepage_logo_url !== undefined) updateData.homepage_logo_url = settings.homepage_logo_url;
		if (settings.favicon_url !== undefined) updateData.favicon_url = settings.favicon_url;
		if (settings.header_links !== undefined) updateData.header_links = settings.header_links;
		if (settings.footer_text !== undefined) updateData.footer_text = settings.footer_text;
		if (settings.footer_link !== undefined) updateData.footer_link = settings.footer_link;
		if (settings.show_powered_by !== undefined) updateData.show_powered_by = settings.show_powered_by;
		if (settings.hero_title !== undefined) updateData.hero_title = settings.hero_title;
		if (settings.hero_subhead !== undefined) updateData.hero_subhead = settings.hero_subhead;
		if (settings.hero_image_url !== undefined) updateData.hero_image_url = settings.hero_image_url;
		if (settings.primary_color !== undefined) updateData.primary_color = settings.primary_color;
		if (settings.secondary_color !== undefined) updateData.secondary_color = settings.secondary_color;
		if (settings.accent_color !== undefined) updateData.accent_color = settings.accent_color;
		if (settings.background_color !== undefined) updateData.background_color = settings.background_color;
		if (settings.text_color !== undefined) updateData.text_color = settings.text_color;
		if (settings.font_family !== undefined) updateData.font_family = settings.font_family;
		if (settings.heading_font !== undefined) updateData.heading_font = settings.heading_font;
		if (settings.custom_css !== undefined) updateData.custom_css = settings.custom_css;
		if (settings.custom_head_html !== undefined) updateData.custom_head_html = settings.custom_head_html;
		if (settings.contact_email !== undefined) updateData.contact_email = settings.contact_email;
		if (settings.contact_phone !== undefined) updateData.contact_phone = settings.contact_phone;
		if (settings.contact_address !== undefined) updateData.contact_address = settings.contact_address;
		if (settings.facebook_url !== undefined) updateData.facebook_url = settings.facebook_url;
		if (settings.twitter_url !== undefined) updateData.twitter_url = settings.twitter_url;
		if (settings.instagram_url !== undefined) updateData.instagram_url = settings.instagram_url;
		if (settings.show_covers !== undefined) updateData.show_covers = settings.show_covers;
		if (settings.show_facets !== undefined) updateData.show_facets = settings.show_facets;
		if (settings.items_per_page !== undefined) updateData.items_per_page = settings.items_per_page;

		console.log('[updateUnifiedSiteSettings] Upserting with', Object.keys(updateData).length, 'fields');

		// Upsert the singleton row
		const { error } = await supabase
			.from('site_settings')
			.upsert({
				id: 'default',
				...updateData
			});

		if (error) {
			console.error('[updateUnifiedSiteSettings] Database error:', error.message);
			return {
				success: false,
				error: error.message
			};
		}

		console.log('[updateUnifiedSiteSettings] Settings updated successfully');
		return { success: true };
	} catch (error) {
		console.error('[updateUnifiedSiteSettings] Exception:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
