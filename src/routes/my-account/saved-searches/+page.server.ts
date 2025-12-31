import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function requirePatron(locals: App.Locals) {
  const { session } = await locals.safeGetSession();
  if (!session) throw redirect(303, '/my-account/login');

  const { data: patron } = await locals.supabase.from('patrons').select('id').eq('user_id', session.user.id).single();
  if (!patron) throw redirect(303, '/my-account/login');
  return patron;
}

export const load: PageServerLoad = async ({ locals }) => {
  const patron = await requirePatron(locals);

  const { data: searches } = await locals.supabase
    .from('saved_searches')
    .select('*')
    .eq('patron_id', patron.id)
    .order('updated_at', { ascending: false });

  return {
    searches: searches ?? [],
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const name = form.get('name') as string;
    const query = form.get('query') as string;
    const alert = form.get('alert') === 'on';
    const frequency = (form.get('frequency') as string) || 'weekly';

    const payload = {
      patron_id: patron.id,
      name,
      query: { q: query },
      send_email_alerts: alert,
      alert_frequency: frequency,
    };

    const { error } = await locals.supabase.from('saved_searches').insert(payload);

    if (error) {
      return fail(500, { message: 'Unable to save search' });
    }

    throw redirect(303, '/my-account/saved-searches');
  },

  update: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const id = form.get('id') as string;
    const name = form.get('name') as string;
    const query = form.get('query') as string;
    const alert = form.get('alert') === 'on';
    const frequency = (form.get('frequency') as string) || 'weekly';

    const { error } = await locals.supabase
      .from('saved_searches')
      .update({
        name,
        query: { q: query },
        send_email_alerts: alert,
        alert_frequency: frequency,
      })
      .eq('id', id)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to update search' });
    }

    throw redirect(303, '/my-account/saved-searches');
  },

  delete: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const id = form.get('id') as string;

    const { error } = await locals.supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to delete search' });
    }

    throw redirect(303, '/my-account/saved-searches');
  },
};
