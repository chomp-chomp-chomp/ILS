import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Read active site configuration
export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		// Public can read active config, authenticated can read all
		const { data, error: dbError } = await supabase
			.from('site_configuration')
			.select('*')
			.eq('is_active', true)
			.single();

		if (dbError) {
			console.error('Error loading site config:', dbError);
			throw error(500, 'Failed to load site configuration');
		}

		return json({ config: data });
	} catch (err) {
		console.error('Exception in GET /api/site-config:', err);
		throw error(500, 'Internal server error');
	}
};

// PUT - Update site configuration (authenticated only)
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const config = await request.json();

		// Validate config structure
		if (!config || typeof config !== 'object') {
			throw error(400, 'Invalid configuration format');
		}

		// Get the active configuration ID
		const { data: activeConfig } = await supabase
			.from('site_configuration')
			.select('id')
			.eq('is_active', true)
			.single();

		if (!activeConfig) {
			// No active config exists, create one
			const { data, error: insertError } = await supabase
				.from('site_configuration')
				.insert({
					...config,
					is_active: true,
					updated_by: session.user.id
				})
				.select()
				.single();

			if (insertError) {
				console.error('Error creating site config:', insertError);
				throw error(500, 'Failed to create site configuration');
			}

			return json({ config: data });
		}

		// Update existing active configuration
		const { data, error: updateError } = await supabase
			.from('site_configuration')
			.update({
				...config,
				updated_by: session.user.id,
				updated_at: new Date().toISOString()
			})
			.eq('id', activeConfig.id)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating site config:', updateError);
			throw error(500, 'Failed to update site configuration');
		}

		return json({ config: data });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('Exception in PUT /api/site-config:', err);
		throw error(500, 'Internal server error');
	}
};
