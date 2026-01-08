import { loadActiveBranding, defaultBranding } from '$lib/server/branding';
import { loadActiveSiteConfig, defaultSiteConfig } from '$lib/server/siteConfig';
import { dev } from '$app/environment';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load site configuration (new single source of truth)
  let siteConfig: any = defaultSiteConfig;
  
  try {
    const result = await loadActiveSiteConfig(supabase);
    if (result && result.siteConfig) {
      siteConfig = result.siteConfig;
    }
    
    // Dev-only: Log summary of loaded site config
    if (dev) {
      console.log('[+layout.server] Site config loaded:', {
        header_enabled: siteConfig.header_enabled,
        footer_enabled: siteConfig.footer_enabled,
        homepage_info_enabled: siteConfig.homepage_info_enabled,
        homepage_hero_enabled: siteConfig.homepage_hero_enabled,
        theme_mode: siteConfig.theme_mode
      });
    }
  } catch (error) {
    console.error('Failed to load site config in layout:', error);
    // siteConfig already set to defaultSiteConfig above
  }

  // Load branding configuration with extreme defensive coding
  // Keep for backward compatibility temporarily
  let branding: any = defaultBranding;
  
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
    siteConfig,
    branding
  };
};
