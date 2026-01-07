import { loadActiveBranding, defaultBranding } from '$lib/server/branding';
import { mergeSiteConfig } from '$lib/types/site-config';
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

  // Load site configuration with defensive coding
  // Always return defaults if anything fails
  let siteConfig = mergeSiteConfig(null);
  
  try {
    const { data, error: siteConfigError } = await supabase
      .from('site_configuration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (siteConfigError) {
      console.warn('Failed to load site config, using defaults:', siteConfigError.message);
    } else {
      siteConfig = mergeSiteConfig(data);
    }
  } catch (error) {
    console.error('Exception loading site config in layout:', error);
    // siteConfig already set to defaults above
  }

  return {
    session,
    cookies: cookies.getAll(),
    branding,
    siteConfig
  };
};
