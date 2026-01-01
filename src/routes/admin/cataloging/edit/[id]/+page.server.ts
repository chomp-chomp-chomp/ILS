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

  const { data: authorityLinks } = await supabase
    .from('marc_authority_links')
    .select(`
      marc_field,
      field_index,
      confidence,
      is_automatic,
      authority:authority_id (
        id,
        heading,
        source
      )
    `)
    .eq('marc_record_id', params.id);

  return {
    record,
    authorityLinks: authorityLinks || []
  };
};
