import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: record, error: recordError } = await supabase
    .from('marc_records')
    .select('*')
    .eq('id', params.id)
    .single();

  if (recordError || !record) {
    throw error(404, 'Record not found');
  }

  // Load items instead of holdings
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('marc_record_id', params.id)
    .order('created_at', { ascending: false });

  return {
    record,
    items: items || [],
  };
};
