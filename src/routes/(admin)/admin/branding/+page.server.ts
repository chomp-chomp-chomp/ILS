import { loadActiveBranding, defaultBranding } from '$lib/server/branding';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { branding, error } = await loadActiveBranding(supabase);

	// branding is always defined (merged with defaults), but we also provide
	// defaultBranding for the reset functionality
	return { 
		branding,
		defaultBranding
	};
};
