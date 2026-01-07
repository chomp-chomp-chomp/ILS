import type { PageServerLoad } from './$types';
import { mergeSiteConfig } from '$lib/types/site-config';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  
  if (!session) {
    // Will be handled by layout
    return { siteConfig: mergeSiteConfig(null) };
  }

  try {
    // Try to load active site configuration
    const { data, error } = await supabase
      .from('site_configuration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('[Admin Site Config] Database error:', error.message);
      return { siteConfig: mergeSiteConfig(null) };
    }

    return { siteConfig: mergeSiteConfig(data) };
  } catch (error) {
    console.error('[Admin Site Config] Exception:', error);
    return { siteConfig: mergeSiteConfig(null) };
  }
};
