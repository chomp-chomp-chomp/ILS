import type { LayoutServerLoad } from './$types';

/**
 * Root layout - handles only authentication
 * Site-specific configuration is now handled by route group layouts:
 * - (public) layout handles public site settings
 * - (admin) layout handles admin authentication guard
 */
export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  return {
    session,
    cookies: cookies.getAll(),
    supabase
  };
};
