import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Reorder facets (requires auth)
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { facets } = await request.json();

		if (!Array.isArray(facets)) {
			throw error(400, 'Invalid facets array');
		}

		// Update display_order for each facet
		const updates = facets.map((facet, index) =>
			supabase
				.from('facet_configuration')
				.update({
					display_order: index,
					updated_by: session.user.id,
					updated_at: new Date().toISOString()
				})
				.eq('id', facet.id)
		);

		await Promise.all(updates);

		return json({ success: true });
	} catch (err) {
		console.error('Error reordering facets:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{ error: 'Failed to reorder facets' },
			{ status: 500 }
		);
	}
};
