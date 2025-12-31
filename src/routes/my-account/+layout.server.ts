import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (url.pathname.startsWith('/my-account/login')) {
    return { patron: null, isAuthPage: true };
  }

  const { session } = await locals.safeGetSession();

  if (!session) {
    throw redirect(303, `/my-account/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const { data: patron, error: patronError } = await locals.supabase
    .from('patrons')
    .select(
      `
        *,
        patron_type:patron_types(*),
        preferences:patron_preferences(*)
      `
    )
    .eq('user_id', session.user.id)
    .single();

  if (patronError) {
    throw redirect(303, '/my-account/login');
  }

  return {
    patron,
    isAuthPage: false,
  };
};
