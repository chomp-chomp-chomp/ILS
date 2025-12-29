import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST /api/reading-lists/[id]/items - Add item to list
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const supabase = locals.supabase;
	const listId = params.id;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const patronId = session.data.session.user.id;
	const body = await request.json();

	const { marc_record_id, notes } = body;

	if (!marc_record_id) {
		return json({ error: 'Record ID is required' }, { status: 400 });
	}

	// Verify ownership
	const { data: list } = await supabase
		.from('reading_lists')
		.select('patron_id')
		.eq('id', listId)
		.single();

	if (!list || list.patron_id !== patronId) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	// Get current max sort_order
	const { data: maxSort } = await supabase
		.from('reading_list_items')
		.select('sort_order')
		.eq('list_id', listId)
		.order('sort_order', { ascending: false })
		.limit(1)
		.single();

	const nextSortOrder = (maxSort?.sort_order || 0) + 1;

	// Add item to list
	const { data, error } = await supabase
		.from('reading_list_items')
		.insert({
			list_id: listId,
			marc_record_id,
			notes: notes?.trim() || null,
			sort_order: nextSortOrder
		})
		.select()
		.single();

	if (error) {
		// Check if it's a duplicate
		if (error.code === '23505') {
			return json({ error: 'Item already in list' }, { status: 409 });
		}
		console.error('Error adding item to list:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ item: data }, { status: 201 });
};
