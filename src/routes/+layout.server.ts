import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Fetch active branding configuration with error handling
  const { data: branding, error: brandingError } = await supabase
    .from('branding_configuration')
    .select('*')
    .eq('is_active', true)
    .single();

  if (brandingError) {
    console.error('Error loading branding configuration:', brandingError);
  }

  return {
    session,
    cookies: cookies.getAll(),
    branding: branding || null
  };
};
