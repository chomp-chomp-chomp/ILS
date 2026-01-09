import type { LayoutServerLoad } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { siteDefaults, mergeSiteSettings, type SiteSettings } from '$lib/siteDefaults';

/**
 * Load site settings from database with robust fallback to defaults
 * This ensures the public site always renders even if database is unavailable
 */
async function loadSiteSettings(supabase: SupabaseClient): Promise<SiteSettings> {
	try {
		const { data, error } = await supabase
			.from('site_settings')
			.select('*')
			.eq('is_active', true)
			.maybeSingle();

		if (error) {
			console.error('[Public Layout] Error loading site settings:', error);
			return siteDefaults;
		}

		if (!data) {
			console.log('[Public Layout] No active site settings found, using defaults');
			return siteDefaults;
		}

		// Transform database format to SiteSettings format
		const dbSettings: Partial<SiteSettings> = {
			header: {
				links: data.header_links || siteDefaults.header.links
			},
			footer: {
				text: data.footer_text || siteDefaults.footer.text,
				linkUrl: data.footer_link_url || siteDefaults.footer.linkUrl
			},
			hero: {
				title: data.hero_title || siteDefaults.hero.title,
				subhead: data.hero_subhead || siteDefaults.hero.subhead,
				imageUrl: data.hero_image_url || siteDefaults.hero.imageUrl
			},
			metadata: {
				favicon: data.metadata_favicon || siteDefaults.metadata.favicon,
				favicon16: data.metadata_favicon_16 || siteDefaults.metadata.favicon16,
				favicon32: data.metadata_favicon_32 || siteDefaults.metadata.favicon32,
				appleTouchIcon: data.metadata_apple_touch_icon || siteDefaults.metadata.appleTouchIcon,
				androidChrome192: data.metadata_android_chrome_192 || siteDefaults.metadata.androidChrome192,
				androidChrome512: data.metadata_android_chrome_512 || siteDefaults.metadata.androidChrome512
			}
		};

		return mergeSiteSettings(dbSettings);
	} catch (error) {
		console.error('[Public Layout] Exception loading site settings:', error);
		return siteDefaults;
	}
}

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session } = await safeGetSession();

	// Load site settings with robust fallback
	const siteSettings = await loadSiteSettings(supabase);

	return {
		session,
		siteSettings
	};
};
