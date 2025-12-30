import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST - Refresh facet cache (requires auth)
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { facet_key } = await request.json();

		if (facet_key) {
			// Refresh cache for specific facet
			const { data, error: rpcError } = await supabase.rpc('refresh_facet_cache', {
				facet_key_param: facet_key
			});

			if (rpcError) throw rpcError;

			return json({
				success: true,
				message: `Refreshed cache for facet: ${facet_key}`,
				deleted_count: data
			});
		} else {
			// Refresh all facet caches
			const { data, error: rpcError } = await supabase.rpc('refresh_all_facet_caches');

			if (rpcError) throw rpcError;

			return json({
				success: true,
				message: 'Refreshed all facet caches',
				deleted_count: data
			});
		}
	} catch (err) {
		console.error('Error refreshing facet cache:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		return json(
			{ error: 'Failed to refresh facet cache' },
			{ status: 500 }
		);
	}
};
