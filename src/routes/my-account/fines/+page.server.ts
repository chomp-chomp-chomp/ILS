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

  const [{ data: fines }, { data: payments }] = await Promise.all([
    locals.supabase
      .from('patron_fines')
      .select('*')
      .eq('patron_id', patron.id)
      .order('fine_date', { ascending: false }),
    locals.supabase
      .from('patron_payments')
      .select('*')
      .eq('patron_id', patron.id)
      .order('created_at', { ascending: false }),
  ]);

  const totalBalance =
    (fines ?? []).reduce((sum, fine) => sum + Number(fine.balance ?? fine.amount ?? 0), 0) ?? 0;

  return {
    fines: fines ?? [],
    payments: payments ?? [],
    totalBalance,
  };
};

export const actions: Actions = {
  pay: async ({ request, locals }) => {
    const patron = await requirePatron(locals);
    const form = await request.formData();
    const amount = Number(form.get('amount') ?? 0);
    const fineId = form.get('fineId') as string | null;
    const method = (form.get('method') as string) || 'online';

    if (amount <= 0) {
      return fail(400, { message: 'Payment amount must be greater than zero' });
    }

    const { error } = await locals.supabase.from('patron_payments').insert({
      patron_id: patron.id,
      fine_id: fineId,
      amount,
      method,
      status: 'pending',
      metadata: { origin: 'self_service' },
    });

    if (error) {
      return fail(500, { message: 'Unable to record payment' });
    }

    throw redirect(303, '/my-account/fines?payment=1');
  },
};
