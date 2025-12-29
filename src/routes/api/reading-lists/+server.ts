import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/reading-lists - Get all lists for current patron
export const GET: RequestHandler = async ({ locals }) => {
	const supabase = locals.supabase;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const patronId = session.data.session.user.id;

	const { data, error } = await supabase
		.from('reading_list_stats')
		.select('*')
		.eq('patron_id', patronId)
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Error fetching reading lists:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ lists: data });
};

// POST /api/reading-lists - Create new list
export const POST: RequestHandler = async ({ request, locals }) => {
	const supabase = locals.supabase;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const patronId = session.data.session.user.id;
	const body = await request.json();

	const { name, description, is_public } = body;

	if (!name || name.trim() === '') {
		return json({ error: 'List name is required' }, { status: 400 });
	}

	const { data, error } = await supabase
		.from('reading_lists')
		.insert({
			patron_id: patronId,
			name: name.trim(),
			description: description?.trim() || null,
			is_public: is_public || false
		})
		.select()
		.single();

	if (error) {
		console.error('Error creating reading list:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ list: data }, { status: 201 });
};
