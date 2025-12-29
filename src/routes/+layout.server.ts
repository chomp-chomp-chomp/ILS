import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Fetch active branding configuration
  const { data: branding } = await supabase
    .from('branding_configuration')
    .select('*')
    .eq('is_active', true)
    .single();

  return {
    session,
    cookies: cookies.getAll(),
    branding: branding || null
  };
};
