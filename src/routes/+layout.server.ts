import { loadActiveBranding } from '$lib/server/branding';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies, setHeaders }) => {
  const { session } = await safeGetSession();

  // Disable caching for branding data - always fetch fresh
  setHeaders({
    'cache-control': 'no-cache, no-store, must-revalidate'
  });

  // loadActiveBranding now always returns merged branding with defaults
  const { branding } = await loadActiveBranding(supabase);

  return {
    session,
    cookies: cookies.getAll(),
    branding
  };
};
