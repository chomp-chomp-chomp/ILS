import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadActiveSiteConfig, defaultSiteConfig } from '$lib/server/siteConfig';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	// Require authentication for site config admin page
	if (!session) {
		throw redirect(303, '/admin/login');
	}

	const { siteConfig } = await loadActiveSiteConfig(supabase);
	return { siteConfig: siteConfig || defaultSiteConfig };
};
