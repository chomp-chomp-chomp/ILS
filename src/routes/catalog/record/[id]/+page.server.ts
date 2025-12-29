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

  const { data: holdings } = await supabase
    .from('items')
    .select('*')
    .eq('marc_record_id', params.id);

  // Fetch related records
  const { data: relatedRecords } = await supabase
    .from('related_records')
    .select(`
      id,
      relationship_type,
      relationship_note,
      display_order,
      target_record:marc_records!related_records_target_record_id_fkey(
        id,
        title_statement,
        main_entry_personal_name,
        publication_info,
        material_type
      )
    `)
    .eq('source_record_id', params.id)
    .order('display_order')
    .order('created_at');

  return {
    record,
    holdings,
    relatedRecords: relatedRecords || [],
  };
};
