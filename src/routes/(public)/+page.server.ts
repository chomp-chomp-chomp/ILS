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
	const settings = await loadUnifiedSiteSettings(supabase);

	return {
		session,
		homepage: homepage || null,
		// Provide backward compatibility with old property names
		branding: settings,
		siteConfig: settings
	};
};
