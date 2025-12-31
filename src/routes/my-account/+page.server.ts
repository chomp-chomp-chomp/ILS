import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  const { patron } = await parent();

  const supabase = locals.supabase;

  const [{ data: checkoutData }, { data: holdData }, { data: fineData }, { data: notificationData }, { data: listData }] =
    await Promise.all([
      supabase
        .from('checkouts')
        .select(
          `
          id,
          due_date,
          renewal_count,
          status,
          checkout_date,
          item:items (
            id,
            call_number,
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
        .in('status', ['checked_out', 'overdue']),
      supabase
        .from('holds')
        .select(
          `
          id,
          status,
          hold_date,
          queue_position,
          pickup_location,
          suspended_until,
          marc_record:marc_records (
            id,
            title_statement,
            main_entry_personal_name
          )
        `
        )
        .eq('patron_id', patron.id)
        .in('status', ['placed', 'in_transit', 'available', 'picked_up']),
      supabase
        .from('patron_fines')
        .select('id, reason, amount, balance, status')
        .eq('patron_id', patron.id),
      supabase
        .from('patron_notifications')
        .select('*')
        .eq('patron_id', patron.id)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('reading_lists')
        .select('id, name, is_public, created_at')
        .eq('patron_id', patron.id)
        .order('updated_at', { ascending: false })
        .limit(3),
    ]);

  const checkouts = checkoutData ?? [];
  const holds = holdData ?? [];
  const fines = fineData ?? [];
  const notifications = notificationData ?? [];
  const readingLists = listData ?? [];

  const totalBalance =
    fines.reduce((sum, fine) => sum + Number(fine.balance ?? fine.amount ?? 0), 0) ?? 0;

  return {
    patron,
    stats: {
      checkouts: checkouts.length,
      overdue: checkouts.filter((c) => c.status === 'overdue').length,
      holds: holds.length,
      fines: totalBalance,
    },
    notifications,
    readingLists,
    holds,
    checkouts,
  };
};
