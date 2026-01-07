import { loadActiveBranding } from '$lib/server/branding';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Note: Cache-Control headers are configured globally in vercel.json
  // to prevent caching (max-age=0, must-revalidate). This ensures
  // branding data is always fresh without setting headers here,
  // which avoids "header already set" errors when the adapter pre-sets them.

  const { branding } = await loadActiveBranding(supabase);

  return {
    session,
    cookies: cookies.getAll(),
    branding: branding || null
  };
};
