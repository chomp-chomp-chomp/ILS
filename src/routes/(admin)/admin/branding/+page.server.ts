import { loadUnifiedSiteSettings, DEFAULT_UNIFIED_SETTINGS } from '$lib/server/unifiedSiteSettings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const settings = await loadUnifiedSiteSettings(supabase);

	// Provide settings and defaults for reset functionality
	return {
		branding: settings,
		defaultBranding: DEFAULT_UNIFIED_SETTINGS
	};
};
