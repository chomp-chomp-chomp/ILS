import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: record, error: fetchError } = await supabase
    .from('marc_records')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !record) {
    throw error(404, 'Record not found');
  }

  return {
    record,
  };
};
