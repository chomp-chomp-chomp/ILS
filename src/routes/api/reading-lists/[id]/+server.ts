import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/reading-lists/[id] - Get list details with items
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const supabase = locals.supabase;
	const listId = params.id;
	const session = await supabase.auth.getSession();

	// Check if list is public or user is the owner
	const { data: list, error: listError } = await supabase
		.from('reading_lists')
		.select('*')
		.eq('id', listId)
		.single();

	if (listError || !list) {
		return json({ error: 'List not found' }, { status: 404 });
	}

	// If list is private, check ownership
	if (!list.is_public) {
		if (!session.data.session || session.data.session.user.id !== list.patron_id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
	}

	// Get list items with MARC record details
	const { data: items, error: itemsError } = await supabase
		.from('reading_list_items')
		.select(
			`
			*,
			marc_records (
				id,
				title_statement,
				main_entry_personal_name,
				publication_info,
				isbn,
				material_type,
				summary
			)
		`
		)
		.eq('list_id', listId)
		.order('sort_order', { ascending: true });

	if (itemsError) {
		console.error('Error fetching list items:', itemsError);
		return json({ error: itemsError.message }, { status: 500 });
	}

	return json({ list, items });
};

// PUT /api/reading-lists/[id] - Update list
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const supabase = locals.supabase;
	const listId = params.id;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const patronId = session.data.session.user.id;
	const body = await request.json();

	const { name, description, is_public } = body;

	// Verify ownership
	const { data: existingList } = await supabase
		.from('reading_lists')
		.select('patron_id')
		.eq('id', listId)
		.single();

	if (!existingList || existingList.patron_id !== patronId) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	const updateData: any = {};
	if (name !== undefined) updateData.name = name.trim();
	if (description !== undefined) updateData.description = description?.trim() || null;
	if (is_public !== undefined) updateData.is_public = is_public;

	const { data, error } = await supabase
		.from('reading_lists')
		.update(updateData)
		.eq('id', listId)
		.select()
		.single();

	if (error) {
		console.error('Error updating reading list:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ list: data });
};

// DELETE /api/reading-lists/[id] - Delete list
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const listId = params.id;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const patronId = session.data.session.user.id;

	// Verify ownership
	const { data: existingList } = await supabase
		.from('reading_lists')
		.select('patron_id')
		.eq('id', listId)
		.single();

	if (!existingList || existingList.patron_id !== patronId) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	const { error } = await supabase.from('reading_lists').delete().eq('id', listId);

	if (error) {
		console.error('Error deleting reading list:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
};
