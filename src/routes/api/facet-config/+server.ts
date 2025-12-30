import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Fetch all facet configurations
export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { session } = await safeGetSession();

	try {
		// Check if we should include inactive facets (admin only)
		const includeInactive = url.searchParams.get('include_inactive') === 'true' && session;

		let query = supabase
			.from('facet_configuration')
			.select('*')
			.order('display_order', { ascending: true });

		// Filter by active status if not admin requesting all
		if (!includeInactive) {
			query = query.eq('is_enabled', true).eq('is_active', true);
		}

		const { data, error: queryError } = await query;

		if (queryError) throw queryError;

		return json({ facets: data || [] });
	} catch (err) {
		console.error('Error fetching facet configurations:', err);
		return json(
			{ error: 'Failed to fetch facet configurations' },
			{ status: 500 }
		);
	}
};

// PUT - Update facet configuration (requires auth)
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const config = await request.json();

		// Validate required fields
		if (!config.id) {
			throw error(400, 'Facet ID is required');
		}

		// Update the configuration
		const { data, error: updateError } = await supabase
			.from('facet_configuration')
			.update({
				...config,
				updated_by: session.user.id,
				updated_at: new Date().toISOString()
			})
			.eq('id', config.id)
			.select()
			.single();

		if (updateError) throw updateError;

		return json({ success: true, facet: data });
	} catch (err) {
		console.error('Error updating facet configuration:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{ error: 'Failed to update facet configuration' },
			{ status: 500 }
		);
	}
};

// POST - Create new facet configuration (requires auth)
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const config = await request.json();

		// Validate required fields
		if (!config.facet_key || !config.facet_label || !config.source_type || !config.source_field) {
			throw error(400, 'Missing required fields: facet_key, facet_label, source_type, source_field');
		}

		// Create the configuration
		const { data, error: insertError } = await supabase
			.from('facet_configuration')
			.insert({
				...config,
				updated_by: session.user.id
			})
			.select()
			.single();

		if (insertError) throw insertError;

		return json({ success: true, facet: data });
	} catch (err) {
		console.error('Error creating facet configuration:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{ error: 'Failed to create facet configuration' },
			{ status: 500 }
		);
	}
};

// DELETE - Delete facet configuration (requires auth)
export const DELETE: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { id } = await request.json();

		if (!id) {
			throw error(400, 'Facet ID is required');
		}

		// Soft delete by setting is_active to false
		const { error: deleteError } = await supabase
			.from('facet_configuration')
			.update({ is_active: false, updated_by: session.user.id })
			.eq('id', id);

		if (deleteError) throw deleteError;

		return json({ success: true });
	} catch (err) {
		console.error('Error deleting facet configuration:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{ error: 'Failed to delete facet configuration' },
			{ status: 500 }
		);
	}
};
