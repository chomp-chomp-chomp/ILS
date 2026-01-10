import { loadUnifiedSiteSettings, DEFAULT_UNIFIED_SETTINGS } from '$lib/server/unifiedSiteSettings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const unified = await loadUnifiedSiteSettings(supabase);

	// Transform to match what the branding component expects
	const branding = {
		id: unified.id,
		library_name: unified.library_name,
		library_tagline: unified.library_tagline,
		logo_url: unified.logo_url,
		favicon_url: unified.favicon_url,
		primary_color: unified.primary_color,
		secondary_color: unified.secondary_color,
		accent_color: unified.accent_color,
		background_color: unified.background_color,
		text_color: unified.text_color,
		font_family: unified.font_family,
		heading_font: unified.heading_font,
		custom_css: unified.custom_css,
		custom_head_html: unified.custom_head_html,
		footer_text: unified.footer_text,
		show_powered_by: unified.show_powered_by,
		contact_email: unified.contact_email,
		contact_phone: unified.contact_phone,
		contact_address: unified.contact_address,
		facebook_url: unified.facebook_url,
		twitter_url: unified.twitter_url,
		instagram_url: unified.instagram_url,
		show_covers: unified.show_covers,
		show_facets: unified.show_facets,
		items_per_page: unified.items_per_page
	};

	// Transform defaults similarly
	const defaultBranding = {
		id: DEFAULT_UNIFIED_SETTINGS.id,
		library_name: DEFAULT_UNIFIED_SETTINGS.library_name,
		library_tagline: DEFAULT_UNIFIED_SETTINGS.library_tagline,
		logo_url: DEFAULT_UNIFIED_SETTINGS.logo_url,
		favicon_url: DEFAULT_UNIFIED_SETTINGS.favicon_url,
		primary_color: DEFAULT_UNIFIED_SETTINGS.primary_color,
		secondary_color: DEFAULT_UNIFIED_SETTINGS.secondary_color,
		accent_color: DEFAULT_UNIFIED_SETTINGS.accent_color,
		background_color: DEFAULT_UNIFIED_SETTINGS.background_color,
		text_color: DEFAULT_UNIFIED_SETTINGS.text_color,
		font_family: DEFAULT_UNIFIED_SETTINGS.font_family,
		heading_font: DEFAULT_UNIFIED_SETTINGS.heading_font,
		custom_css: DEFAULT_UNIFIED_SETTINGS.custom_css,
		custom_head_html: DEFAULT_UNIFIED_SETTINGS.custom_head_html,
		footer_text: DEFAULT_UNIFIED_SETTINGS.footer_text,
		show_powered_by: DEFAULT_UNIFIED_SETTINGS.show_powered_by,
		contact_email: DEFAULT_UNIFIED_SETTINGS.contact_email,
		contact_phone: DEFAULT_UNIFIED_SETTINGS.contact_phone,
		contact_address: DEFAULT_UNIFIED_SETTINGS.contact_address,
		facebook_url: DEFAULT_UNIFIED_SETTINGS.facebook_url,
		twitter_url: DEFAULT_UNIFIED_SETTINGS.twitter_url,
		instagram_url: DEFAULT_UNIFIED_SETTINGS.instagram_url,
		show_covers: DEFAULT_UNIFIED_SETTINGS.show_covers,
		show_facets: DEFAULT_UNIFIED_SETTINGS.show_facets,
		items_per_page: DEFAULT_UNIFIED_SETTINGS.items_per_page
	};

	return {
		branding,
		defaultBranding
	};
};
