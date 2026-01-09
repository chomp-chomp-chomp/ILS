import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function requirePatron(locals: App.Locals) {
  const { session } = await locals.safeGetSession();
  if (!session) throw redirect(303, '/my-account/login');

  const { data: patron } = await locals.supabase
    .from('patrons')
    .select('*, preferences:patron_preferences(*)')
    .eq('user_id', session.user.id)
    .single();

  if (!patron) throw redirect(303, '/my-account/login');
  return patron;
}

export const load: PageServerLoad = async ({ locals }) => {
  const patron = await requirePatron(locals);

  const { data: holds } = await locals.supabase
    .from('holds')
    .select(
      `
      id,
      status,
      hold_date,
      queue_position,
      pickup_location,
      suspended_until,
      notification_channels,
      marc_record:marc_records (
        id,
        title_statement,
        main_entry_personal_name
      )
    `
    )
    .eq('patron_id', patron.id)
    .in('status', ['placed', 'in_transit', 'available', 'picked_up', 'suspended'])
    .order('hold_date', { ascending: true });

  const normalized =
    holds?.map((hold) => ({
      ...hold,
      marc_record: Array.isArray(hold.marc_record) ? hold.marc_record[0] : hold.marc_record,
    })) ?? [];

  return {
    holds: normalized as any[],
    preferences: patron.preferences,
  };
};

export const actions: Actions = {
  cancel: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const holdId = form.get('holdId') as string;

    const { error } = await locals.supabase
      .from('holds')
      .update({
        status: 'cancelled',
        cancellation_date: new Date().toISOString(),
      })
      .eq('id', holdId)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to cancel hold' });
    }

    throw redirect(303, '/my-account/holds');
  },
  suspend: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const holdId = form.get('holdId') as string;
    const until = form.get('until') as string;

    const { error } = await locals.supabase
      .from('holds')
      .update({
        status: 'suspended',
        suspended_until: until || null,
      })
      .eq('id', holdId)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to suspend hold' });
    }

    throw redirect(303, '/my-account/holds');
  },
  resume: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const holdId = form.get('holdId') as string;

    const { error } = await locals.supabase
      .from('holds')
      .update({
        status: 'placed',
        suspended_until: null,
      })
      .eq('id', holdId)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to resume hold' });
    }

    throw redirect(303, '/my-account/holds');
  },
  notifications: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const holdId = form.get('holdId') as string;
    const email = form.get('email') === 'on';
    const sms = form.get('sms') === 'on';

    const channels = [];
    if (email) channels.push('email');
    if (sms) channels.push('sms');

    const { error } = await locals.supabase
      .from('holds')
      .update({ notification_channels: channels })
      .eq('id', holdId)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to save preferences' });
    }

    throw redirect(303, '/my-account/holds');
  },
};
