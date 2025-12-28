import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, url }) => {
  const { session } = await safeGetSession();

  // Redirect to login if not authenticated (except on login page)
  if (!session && url.pathname !== '/admin/login') {
    throw redirect(303, '/admin/login');
  }

  return {
    session,
  };
};
