import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStaffContext } from '$lib/utils/staff';

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	const { session, isStaff } = await getStaffContext(supabase);

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!isStaff) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	const {
		marc_record_id,
		filename_original,
		external_url,
		external_expires_at,
		title,
		description,
		file_type,
		file_size,
		access_level = 'public',
		sort_order
	} = body;

	if (!marc_record_id || !external_url) {
		return json({ error: 'marc_record_id and external_url are required' }, { status: 400 });
	}

	// Determine next sort order if not provided
	let resolvedSortOrder = Number.isFinite(sort_order) ? sort_order : 0;
	if (!Number.isFinite(sort_order)) {
		const { data: lastAttachment } = await supabase
			.from('marc_attachments')
			.select('sort_order')
			.eq('marc_record_id', marc_record_id)
			.order('sort_order', { ascending: false })
			.limit(1)
			.single();

		resolvedSortOrder = lastAttachment?.sort_order ? lastAttachment.sort_order + 1 : 0;
	}

	const { data, error } = await supabase
		.from('marc_attachments')
		.insert({
			marc_record_id,
			filename_original,
			external_url,
			external_expires_at: external_expires_at || null,
			title,
			description,
			file_type,
			file_size,
			access_level,
			uploaded_by: session.user.id,
			upload_date: new Date().toISOString(),
			sort_order: resolvedSortOrder
		})
		.select()
		.single();

	if (error) {
		console.error('Error creating attachment', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ attachment: data }, { status: 201 });
};
