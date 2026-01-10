import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadUnifiedSiteSettings } from '$lib/server/unifiedSiteSettings';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	// Require authentication for site config admin page
	if (!session) {
		throw redirect(303, '/admin/login');
	}

	// Load unified site settings
	const settings = await loadUnifiedSiteSettings(supabase);

	return {
		settings,
		// Backward compatibility
		siteConfig: settings
	};
};
