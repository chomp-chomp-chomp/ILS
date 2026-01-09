import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '$lib/siteDefaults';

/**
 * Get site settings with safe fallbacks
 * 
 * This function loads settings from the database and merges them with defaults.
 * If the database is unavailable or returns no data, it returns defaults.
 * This ensures the UI always has settings to render.
 * 
 * @param supabase - Supabase client
 * @returns Site settings object (never null/undefined)
 */
export async function getSiteSettings(supabase: SupabaseClient): Promise<SiteSettings> {
	try {
		// Query the singleton settings row
		const { data, error } = await supabase
			.from('site_settings')
			.select('*')
			.eq('id', 'default')
			.maybeSingle();
		
		if (error) {
			console.warn('[getSiteSettings] Database query error, using defaults:', error.message);
			return DEFAULT_SITE_SETTINGS;
		}
		
		if (!data) {
			console.warn('[getSiteSettings] No site settings found in database, using defaults');
			return DEFAULT_SITE_SETTINGS;
		}
		
		// Parse and merge database settings with defaults
		const settings: SiteSettings = {
			header: {
				links: Array.isArray(data.header_links) 
					? data.header_links 
					: DEFAULT_SITE_SETTINGS.header.links
			},
			footer: {
				text: data.footer_text || DEFAULT_SITE_SETTINGS.footer.text,
				link: data.footer_link || DEFAULT_SITE_SETTINGS.footer.link,
				links: Array.isArray(data.footer_links) 
					? data.footer_links 
					: DEFAULT_SITE_SETTINGS.footer.links,
				backgroundColor: data.footer_background_color || DEFAULT_SITE_SETTINGS.footer.backgroundColor,
				textColor: data.footer_text_color || DEFAULT_SITE_SETTINGS.footer.textColor,
				linkColor: data.footer_link_color || DEFAULT_SITE_SETTINGS.footer.linkColor,
				linkHoverColor: data.footer_link_hover_color || DEFAULT_SITE_SETTINGS.footer.linkHoverColor,
				padding: data.footer_padding || DEFAULT_SITE_SETTINGS.footer.padding
			},
			hero: {
				title: data.hero_title || DEFAULT_SITE_SETTINGS.hero.title,
				subhead: data.hero_subhead || DEFAULT_SITE_SETTINGS.hero.subhead,
				imageUrl: data.hero_image_url || DEFAULT_SITE_SETTINGS.hero.imageUrl,
				minHeight: data.hero_min_height || DEFAULT_SITE_SETTINGS.hero.minHeight,
				mobileMinHeight: data.hero_mobile_min_height || DEFAULT_SITE_SETTINGS.hero.mobileMinHeight
			},
			typography: {
				h1Size: data.typography_h1_size || DEFAULT_SITE_SETTINGS.typography!.h1Size,
				h2Size: data.typography_h2_size || DEFAULT_SITE_SETTINGS.typography!.h2Size,
				h3Size: data.typography_h3_size || DEFAULT_SITE_SETTINGS.typography!.h3Size,
				h4Size: data.typography_h4_size || DEFAULT_SITE_SETTINGS.typography!.h4Size,
				h5Size: data.typography_h5_size || DEFAULT_SITE_SETTINGS.typography!.h5Size,
				h6Size: data.typography_h6_size || DEFAULT_SITE_SETTINGS.typography!.h6Size,
				pSize: data.typography_p_size || DEFAULT_SITE_SETTINGS.typography!.pSize,
				smallSize: data.typography_small_size || DEFAULT_SITE_SETTINGS.typography!.smallSize,
				lineHeight: data.typography_line_height || DEFAULT_SITE_SETTINGS.typography!.lineHeight
			}
		};
		
		return settings;
	} catch (error) {
		console.error('[getSiteSettings] Exception loading site settings:', error);
		return DEFAULT_SITE_SETTINGS;
	}
}

/**
 * Update site settings in the database
 * 
 * @param supabase - Supabase client (must be authenticated)
 * @param settings - New settings to save
 * @param userId - ID of user making the change (for audit trail)
 * @returns Success boolean and error message if any
 */
export async function updateSiteSettings(
	supabase: SupabaseClient,
	settings: Partial<SiteSettings>,
	userId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Build update object
		const updateData: Record<string, any> = {
			updated_by: userId,
			updated_at: new Date().toISOString()
		};
		
		if (settings.header?.links) {
			updateData.header_links = settings.header.links;
		}
		
		if (settings.footer?.text !== undefined) {
			updateData.footer_text = settings.footer.text;
		}
		
		if (settings.footer?.link !== undefined) {
			updateData.footer_link = settings.footer.link;
		}
		
		if (settings.hero?.title !== undefined) {
			updateData.hero_title = settings.hero.title;
		}
		
		if (settings.hero?.subhead !== undefined) {
			updateData.hero_subhead = settings.hero.subhead;
		}
		
		if (settings.hero?.imageUrl !== undefined) {
			updateData.hero_image_url = settings.hero.imageUrl;
		}
		
		// Update the singleton row (or insert if doesn't exist)
		const { error } = await supabase
			.from('site_settings')
			.upsert({
				id: 'default',
				...updateData
			});
		
		if (error) {
			console.error('[updateSiteSettings] Database update error:', error);
			return {
				success: false,
				error: error.message
			};
		}
		
		return { success: true };
	} catch (error) {
		console.error('[updateSiteSettings] Exception updating site settings:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
