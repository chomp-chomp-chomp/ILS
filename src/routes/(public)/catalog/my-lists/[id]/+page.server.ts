import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
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
		throw error(404, 'List not found');
	}

	// If list is private, check ownership
	if (!list.is_public) {
		if (!session.data.session || session.data.session.user.id !== list.patron_id) {
			throw error(403, 'You do not have permission to view this list');
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
		throw error(500, 'Failed to load list items');
	}

	return {
		list,
		items: items || []
	};
};
