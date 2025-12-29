import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// DELETE /api/reading-lists/[id]/items/[itemId] - Remove item from list
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const { id: listId, itemId } = params;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const patronId = session.data.session.user.id;

	// Verify ownership of the list
	const { data: list } = await supabase
		.from('reading_lists')
		.select('patron_id')
		.eq('id', listId)
		.single();

	if (!list || list.patron_id !== patronId) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	// Delete the item
	const { error } = await supabase
		.from('reading_list_items')
		.delete()
		.eq('id', itemId)
		.eq('list_id', listId);

	if (error) {
		console.error('Error removing item from list:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
};
