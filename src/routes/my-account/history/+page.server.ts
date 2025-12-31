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

export const load: PageServerLoad = async ({ locals, url }) => {
  const patron = await requirePatron(locals);
  const supabase = locals.supabase;

  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const material = url.searchParams.get('material');
  const search = url.searchParams.get('search');

  if (!patron.preferences?.checkout_history_opt_in) {
    return {
      optedIn: false,
      history: [],
    };
  }

  const { data: history } = await supabase
    .from('circulation_history')
    .select(
      `
      id,
      action,
      action_date,
      item:items (
        id,
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
    .order('action_date', { ascending: false })
    .limit(200);

  const rows = (history ?? []) as any[];

  const filtered = rows.filter((entry) => {
    const matchesMaterial = material
      ? entry.item && !Array.isArray(entry.item.marc_record)
        ? entry.item.marc_record?.material_type === material
        : false
      : true;
    const matchesSearch = search
      ? (() => {
          const record = Array.isArray(entry.item?.marc_record)
            ? entry.item?.marc_record?.[0]
            : entry.item?.marc_record;
          const title = record?.title_statement?.a?.toLowerCase() ?? '';
          const author = record?.main_entry_personal_name?.a?.toLowerCase() ?? '';
          return title.includes(search.toLowerCase()) || author.includes(search.toLowerCase());
        })()
      : true;
    const actionDate = new Date(entry.action_date);
    const matchesStart = start ? actionDate >= new Date(start) : true;
    const matchesEnd = end ? actionDate <= new Date(end) : true;
    return matchesMaterial && matchesSearch && matchesStart && matchesEnd;
  });

  return {
    optedIn: true,
    history: filtered.map((entry) => {
      const item = entry.item && Array.isArray(entry.item) ? entry.item[0] : entry.item;
      const marcRecord =
        item && item.marc_record
          ? Array.isArray(item.marc_record)
            ? item.marc_record[0]
            : item.marc_record
          : undefined;
      return { ...entry, item, marcRecord };
    }),
  };
};

export const actions: Actions = {
  toggle_opt_in: async ({ locals }) => {
    const patron = await requirePatron(locals);
    const desired = !patron.preferences?.checkout_history_opt_in;

    const { error } = await locals.supabase
      .from('patron_preferences')
      .update({ checkout_history_opt_in: desired })
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Could not update preference' });
    }

    throw redirect(303, '/my-account/history');
  },
  clear_history: async ({ locals }) => {
    const patron = await requirePatron(locals);

    const { error } = await locals.supabase
      .from('circulation_history')
      .delete()
      .eq('patron_id', patron.id);

    if (error) {
      return fail(500, { message: 'Unable to clear history' });
    }

    throw redirect(303, '/my-account/history');
  },
};
