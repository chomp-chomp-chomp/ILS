import { getSiteSettings } from '$lib/server/siteSettings';
import { loadActiveBranding, defaultBranding } from '$lib/server/branding';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load site settings (always returns valid settings, never null)
  const siteSettings = await getSiteSettings(supabase);

  // Load branding for backward compatibility (favicon, library name, etc.)
  let branding: any = defaultBranding;
  
  try {
    const result = await loadActiveBranding(supabase);
    if (result && result.branding) {
      branding = result.branding;
    }
  } catch (error) {
    console.error('Failed to load branding in public layout:', error);
  }

  return {
    session,
    cookies: cookies.getAll(),
    siteSettings,
    branding
  };
};
