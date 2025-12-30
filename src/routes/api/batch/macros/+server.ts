import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all macros (user's own + public)
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const category = url.searchParams.get('category');
		const searchTerm = url.searchParams.get('search');

		let query = supabase
			.from('batch_macros')
			.select('*')
			.or(`created_by.eq.${session.user.id},is_public.eq.true`)
			.order('name');

		if (category) {
			query = query.eq('category', category);
		}

		if (searchTerm) {
			query = query.ilike('name', `%${searchTerm}%`);
		}

		const { data, error: queryError } = await query;
		if (queryError) throw queryError;

		return json({ success: true, macros: data || [] });

	} catch (err) {
		console.error('Error fetching macros:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to fetch macros');
	}
};

// POST - Create new macro
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { name, description, category, operations, isPublic = false, tags = [] } = await request.json();

		if (!name || !operations) {
			throw error(400, 'Name and operations are required');
		}

		// Validate operations format
		if (!Array.isArray(operations) || operations.length === 0) {
			throw error(400, 'Operations must be a non-empty array');
		}

		const { data, error: insertError } = await supabase
			.from('batch_macros')
			.insert({
				name,
				description,
				category,
				operations,
				is_public: isPublic,
				tags,
				created_by: session.user.id
			})
			.select()
			.single();

		if (insertError) throw insertError;

		return json({ success: true, macro: data }, { status: 201 });

	} catch (err) {
		console.error('Error creating macro:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to create macro');
	}
};

// PUT - Update macro
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { id, name, description, category, operations, isPublic, tags } = await request.json();

		if (!id) {
			throw error(400, 'Macro ID required');
		}

		const updates: any = { updated_at: new Date().toISOString() };
		if (name !== undefined) updates.name = name;
		if (description !== undefined) updates.description = description;
		if (category !== undefined) updates.category = category;
		if (operations !== undefined) updates.operations = operations;
		if (isPublic !== undefined) updates.is_public = isPublic;
		if (tags !== undefined) updates.tags = tags;

		const { data, error: updateError } = await supabase
			.from('batch_macros')
			.update(updates)
			.eq('id', id)
			.eq('created_by', session.user.id) // Only update own macros
			.select()
			.single();

		if (updateError) throw updateError;

		return json({ success: true, macro: data });

	} catch (err) {
		console.error('Error updating macro:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to update macro');
	}
};

// DELETE - Delete macro
export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const id = url.searchParams.get('id');
		if (!id) {
			throw error(400, 'Macro ID required');
		}

		const { error: deleteError } = await supabase
			.from('batch_macros')
			.delete()
			.eq('id', id)
			.eq('created_by', session.user.id);

		if (deleteError) throw deleteError;

		return json({ success: true });

	} catch (err) {
		console.error('Error deleting macro:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to delete macro');
	}
};
