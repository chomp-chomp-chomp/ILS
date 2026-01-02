import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStaffContext } from '$lib/utils/staff';

export const PATCH: RequestHandler = async ({ params, request, locals: { supabase } }) => {
	const { session, isStaff } = await getStaffContext(supabase);

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!isStaff) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	const allowedFields = [
		'title',
		'description',
		'access_level',
		'file_type',
		'file_size',
		'external_url',
		'external_expires_at',
		'filename_original',
		'sort_order'
	] as const;

	const updates: Record<string, unknown> = {};
	for (const field of allowedFields) {
		if (field in body) {
			updates[field] = body[field];
		}
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields provided' }, { status: 400 });
	}

	const { data, error } = await supabase
		.from('marc_attachments')
		.update(updates)
		.eq('id', params.id)
		.select()
		.single();

	if (error) {
		console.error('Error updating attachment', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ attachment: data });
};

export const DELETE: RequestHandler = async ({ params, locals: { supabase } }) => {
	const { session, isStaff } = await getStaffContext(supabase);

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!isStaff) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { error } = await supabase.from('marc_attachments').delete().eq('id', params.id);

	if (error) {
		console.error('Error deleting attachment', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
};
