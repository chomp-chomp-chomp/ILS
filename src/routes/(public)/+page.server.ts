import { loadActiveBranding } from '$lib/server/branding';
import { loadActiveSiteConfig } from '$lib/server/siteConfig';
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

	// Fetch branding configuration for homepage (use service key if available)
	const { branding } = await loadActiveBranding(supabase);

	// Fetch site configuration for hero and other settings
	const { siteConfig } = await loadActiveSiteConfig(supabase);

	return {
		session,
		homepage: homepage || null,
		branding: branding || null,
		siteConfig: siteConfig || null
	};
};
