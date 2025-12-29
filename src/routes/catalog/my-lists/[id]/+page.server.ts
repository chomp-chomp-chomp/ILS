import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const supabase = locals.supabase;
	const listId = params.id;

	// Get list with items
	const response = await fetch(`${url.origin}/api/reading-lists/${listId}`, {
		headers: {
			cookie: locals.cookies || ''
		}
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw error(404, 'List not found');
		}
		if (response.status === 403) {
			throw error(403, 'You do not have permission to view this list');
		}
		throw error(500, 'Failed to load list');
	}

	const data = await response.json();

	return {
		list: data.list,
		items: data.items || []
	};
};
