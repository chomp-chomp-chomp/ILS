import { loadActiveBranding, defaultBranding } from '$lib/server/branding';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load branding configuration with extreme defensive coding
  // Always ensure branding is defined, even if everything fails
  let branding = defaultBranding;
  
  try {
    const result = await loadActiveBranding(supabase);
    if (result && result.branding) {
      branding = result.branding;
    }
  } catch (error) {
    console.error('Failed to load branding in layout:', error);
    // branding already set to defaultBranding above
  }

  return {
    session,
    cookies: cookies.getAll(),
    branding
  };
};
