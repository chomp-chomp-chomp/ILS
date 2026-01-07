import { loadActiveBranding } from '$lib/server/branding';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load branding configuration (always returns merged defaults)
  const { branding } = await loadActiveBranding(supabase);

  return {
    session,
    cookies: cookies.getAll(),
    branding
  };
};
