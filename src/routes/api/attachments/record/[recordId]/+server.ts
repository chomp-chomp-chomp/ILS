import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { supabase } }) => {
	const recordId = params.recordId;

	const { data, error } = await supabase
		.from('marc_attachments')
		.select(
			'id, marc_record_id, title, description, file_type, file_size, access_level, external_expires_at, filename_original, sort_order'
		)
		.eq('marc_record_id', recordId)
		.order('sort_order', { ascending: true })
		.order('upload_date', { ascending: false });

	if (error) {
		console.error('Error fetching attachments', error);
		return json({ error: 'Failed to load attachments' }, { status: 500 });
	}

	if (data && data.length > 0) {
		await supabase.rpc('increment_attachment_views', { p_attachment_ids: data.map((a) => a.id) });
	}

	return json({ attachments: data || [] });
};
