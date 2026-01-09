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
  return { patron };
};

export const actions: Actions = {
  contact: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();

    const updates = {
      email: form.get('email') as string | null,
      phone: form.get('phone') as string | null,
      address_line1: form.get('address1') as string | null,
      address_line2: form.get('address2') as string | null,
      city: form.get('city') as string | null,
      state_province: form.get('state') as string | null,
      postal_code: form.get('postal') as string | null,
    };

    const { error } = await locals.supabase.from('patrons').update(updates).eq('id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to update contact info' });
    }

    throw redirect(303, '/my-account/settings');
  },

  preferences: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();

    const prefs = {
      email_opt_in: form.get('email_opt_in') === 'on',
      sms_opt_in: form.get('sms_opt_in') === 'on',
      sms_number: (form.get('sms_number') as string) || null,
      default_pickup_location: (form.get('pickup') as string) || null,
      digital_receipts: form.get('digital_receipts') === 'on',
      marketing_opt_out: form.get('marketing_opt_out') === 'on',
      notice_lead_time_days: Number(form.get('notice_lead_time_days') ?? 3),
      checkout_history_opt_in: form.get('checkout_history_opt_in') === 'on',
    };

    const { error } = await locals.supabase
      .from('patron_preferences')
      .update(prefs)
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to save preferences' });
    }

    throw redirect(303, '/my-account/settings');
  },

  pin: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const pin = form.get('pin') as string;
    const confirm = form.get('confirm') as string;

    if (!pin || pin !== confirm) {
      return fail(400, { message: 'PINs do not match' });
    }

    const { error } = await locals.supabase.rpc('set_patron_pin', {
      target_patron: patron.id,
      new_pin: pin,
    });

    if (error) {
      return fail(500, { message: 'Unable to update PIN' });
    }

    throw redirect(303, '/my-account/settings?pin=1');
  },

  password: async ({ request, locals }) => {
    const form = await request.formData();
    const newPassword = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (!newPassword || newPassword !== confirm) {
      return fail(400, { message: 'Passwords do not match' });
    }

    const { error } = await locals.supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return fail(500, { message: 'Unable to update password' });
    }

    throw redirect(303, '/my-account/settings?password=1');
  },
};
