import { loadUnifiedSiteSettings } from '$lib/server/unifiedSiteSettings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load unified site settings (includes branding, header, footer, hero - all in one)
  const settings = await loadUnifiedSiteSettings(supabase);

  return {
    session,
    cookies: cookies.getAll(),
    // Keep backward compatibility by providing both
    siteSettings: settings,
    branding: settings,  // Same data, different key for backward compatibility
    settings  // New unified settings
  };
};
