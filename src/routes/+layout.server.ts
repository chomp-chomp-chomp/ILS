import { loadActiveBranding } from '$lib/server/branding';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load branding configuration (always returns merged defaults)
  // Wrapped in try-catch to prevent 500 errors if database is unavailable
  let branding;
  try {
    const result = await loadActiveBranding(supabase);
    branding = result.branding;
  } catch (error) {
    console.error('Failed to load branding in layout:', error);
    // Import defaults directly as fallback
    const { defaultBranding } = await import('$lib/server/branding');
    branding = defaultBranding;
  }

  return {
    session,
    cookies: cookies.getAll(),
    branding
  };
};
