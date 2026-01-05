import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: record, error: recordError } = await supabase
    .from('marc_records')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'active')  // Only show active records
    .eq('visibility', 'public')  // Only show public records in OPAC
    .single();

  if (recordError || !record) {
    throw error(404, 'Record not found');
  }

  const { data: attachments } = await supabase
    .from('marc_attachments')
    .select(
      'id, title, description, file_type, file_size, access_level, external_expires_at, filename_original, sort_order'
    )
    .eq('marc_record_id', params.id)
    .order('sort_order', { ascending: true })
    .order('upload_date', { ascending: false });

  // Increment view counts for visible attachments (best-effort)
  if (attachments && attachments.length > 0) {
    await supabase.rpc('increment_attachment_views', {
      p_attachment_ids: attachments.map((a) => a.id),
    });
  }

  const { data: holdings } = await supabase
    .from('items')
    .select('*')
    .eq('marc_record_id', params.id);

  // Fetch related records (only show active, public records)
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
        material_type,
        status,
        visibility
      )
    `)
    .eq('source_record_id', params.id)
    .order('display_order')
    .order('created_at');

  // Filter related records to only show active and public
  const filteredRelatedRecords = relatedRecords?.filter(
    (rel: any) => rel.target_record?.status === 'active' && rel.target_record?.visibility === 'public'
  ) || [];

  return {
    record,
    holdings,
    relatedRecords: filteredRelatedRecords,
    attachments: attachments || [],
  };
};
