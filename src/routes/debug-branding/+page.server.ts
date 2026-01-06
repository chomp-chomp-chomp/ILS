import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  // Fetch branding configuration
  const { data: branding, error } = await supabase
    .from('branding_configuration')
    .select('*')
    .eq('is_active', true)
    .single();

  return {
    branding,
    error: error?.message || null,
    timestamp: new Date().toISOString()
  };
};
