import { loadUnifiedSiteSettings } from '$lib/server/unifiedSiteSettings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	// Fetch homepage content
	const { data: homepage } = await supabase
		.from('pages')
		.select('*')
		.eq('slug', 'homepage')
		.eq('is_published', true)
		.single();

	// Fetch unified site settings (includes branding, site config, hero, etc.)
	const unified = await loadUnifiedSiteSettings(supabase);

	// Transform for backward compatibility with component expectations
	const branding = {
		library_name: unified.library_name,
		library_tagline: unified.library_tagline,
		homepage_logo_url: unified.homepage_logo_url,
		logo_url: unified.logo_url,
		favicon_url: unified.favicon_url,
		primary_color: unified.primary_color,
		secondary_color: unified.secondary_color,
		accent_color: unified.accent_color
	};

	return {
		session,
		homepage: homepage || null,
		branding,
		siteConfig: unified
	};
};
