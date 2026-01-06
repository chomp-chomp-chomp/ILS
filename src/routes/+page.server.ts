import { loadActiveBranding } from '$lib/server/branding';
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

	return {
		session,
		homepage: homepage || null,
		branding: branding || null
	};
};
