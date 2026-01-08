import type { PageServerLoad } from './$types';
import { loadActiveSiteConfig, defaultSiteConfig } from '$lib/server/siteConfig';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { siteConfig } = await loadActiveSiteConfig(supabase);
	return { siteConfig: siteConfig || defaultSiteConfig };
};
