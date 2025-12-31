import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const ACTIVE_STATUSES = ['checked_out', 'overdue'];

async function requirePatron(locals: App.Locals) {
  const { session } = await locals.safeGetSession();
  if (!session) throw redirect(303, '/my-account/login');

  const { data: patron } = await locals.supabase
    .from('patrons')
    .select('*, patron_type:patron_types(*)')
    .eq('user_id', session.user.id)
    .single();

  if (!patron) throw redirect(303, '/my-account/login');
  return patron;
}

export const load: PageServerLoad = async ({ locals }) => {
  const patron = await requirePatron(locals);

  const { data: checkouts } = await locals.supabase
    .from('checkouts')
    .select(
      `
      id,
      patron_id,
      checkout_date,
      due_date,
      renewal_count,
      status,
      item:items (
        id,
        call_number,
        barcode,
        marc_record_id,
        marc_record:marc_records (
          id,
          title_statement,
          main_entry_personal_name,
          material_type
        )
      )
    `
    )
    .eq('patron_id', patron.id)
    .in('status', ACTIVE_STATUSES)
    .order('due_date', { ascending: true });

  const normalized =
    checkouts?.map((checkout) => ({
      ...checkout,
      item: Array.isArray(checkout.item) ? checkout.item[0] : checkout.item,
    })) ?? [];

  return {
    checkouts: normalized as any[],
    patronType: patron.patron_type as any,
  };
};

export const actions: Actions = {
  renew: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const checkoutId = form.get('checkoutId') as string;

    const { data: checkout } = await locals.supabase
      .from('checkouts')
      .select(
        `
        id,
        patron_id,
        due_date,
        renewal_count,
        status,
        item:items (
          id,
          marc_record_id
        )
      `
      )
      .eq('id', checkoutId)
      .eq('patron_id', patron.id)
      .single();

    if (!checkout) {
      return fail(400, { message: 'Checkout not found' });
    }

    const item = Array.isArray(checkout.item) ? checkout.item[0] : checkout.item;

    if (!ACTIVE_STATUSES.includes(checkout.status)) {
      return fail(400, { message: 'This item cannot be renewed' });
    }

    if (checkout.renewal_count >= patron.patron_type.max_renewals) {
      return fail(400, { message: 'Renewal limit reached' });
    }

    const { data: holdBlock } = await locals.supabase
      .from('holds')
      .select('id')
      .eq('marc_record_id', item.marc_record_id)
      .in('status', ['placed', 'in_transit'])
      .limit(1);

    if (holdBlock && holdBlock.length > 0) {
      return fail(400, { message: 'Cannot renew: there is a hold on this title' });
    }

    const loanDays = patron.patron_type.default_loan_period_days ?? 14;
    const newDue = new Date();
    newDue.setDate(newDue.getDate() + loanDays);

    const { error: updateError } = await locals.supabase
      .from('checkouts')
      .update({
        due_date: newDue.toISOString(),
        renewal_count: checkout.renewal_count + 1,
        last_renewal_date: new Date().toISOString(),
      })
      .eq('id', checkout.id);

    if (updateError) {
      return fail(500, { message: 'Failed to renew item' });
    }

    throw redirect(303, '/my-account/checkouts?message=renewed');
  },

  renew_all: async ({ locals }) => {
    const patron = await requirePatron(locals);

    const { data: checkouts } = await locals.supabase
      .from('checkouts')
      .select(
        `
        id,
        due_date,
        renewal_count,
        status,
        item:items (
          id,
          marc_record_id
        )
      `
      )
      .eq('patron_id', patron.id)
      .in('status', ACTIVE_STATUSES);

    if (!checkouts || checkouts.length === 0) {
      return fail(400, { message: 'No items available to renew' });
    }

    const loanDays = patron.patron_type.default_loan_period_days ?? 14;
    const newDue = new Date();
    newDue.setDate(newDue.getDate() + loanDays);

    for (const checkout of checkouts) {
      const item = Array.isArray(checkout.item) ? checkout.item[0] : checkout.item;
      if (checkout.renewal_count >= patron.patron_type.max_renewals) continue;

      const { data: holdBlock } = await locals.supabase
        .from('holds')
        .select('id')
        .eq('marc_record_id', item.marc_record_id)
        .in('status', ['placed', 'in_transit'])
        .limit(1);

      if (holdBlock && holdBlock.length > 0) continue;

      await locals.supabase
        .from('checkouts')
        .update({
          due_date: newDue.toISOString(),
          renewal_count: checkout.renewal_count + 1,
          last_renewal_date: new Date().toISOString(),
        })
        .eq('id', checkout.id);
    }

    throw redirect(303, '/my-account/checkouts?message=renewed_all');
  },
};
