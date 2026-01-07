import { loadActiveBranding, defaultBranding } from '$lib/server/branding';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// loadActiveBranding now always returns merged branding with defaults
	const { branding } = await loadActiveBranding(supabase);

	return { branding };
};
