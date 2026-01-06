import { loadActiveBranding } from '$lib/server/branding';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { branding, error } = await loadActiveBranding(supabase);

  return {
    branding,
    error: error?.message || null,
    timestamp: new Date().toISOString()
  };
};
