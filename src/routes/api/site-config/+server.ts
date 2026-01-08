import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { defaultSiteConfig } from '$lib/server/siteConfig';

// GET - Read active site configuration
export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		// Public can read active config, authenticated can read all
		// Use maybeSingle() to handle case where no active config exists
		const { data, error: dbError } = await supabase
			.from('site_configuration')
			.select('*')
			.eq('is_active', true)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (dbError) {
			// Handle "relation does not exist" or other database errors gracefully
			console.error('Error loading site config:', dbError);
			
			// Check if it's a "table doesn't exist" error (42P01 is PostgreSQL error code)
			if (dbError.code === '42P01' || dbError.message?.includes('does not exist')) {
				console.log('site_configuration table does not exist, returning defaults');
				// Return defaults with 200 OK - table may not be created yet
				return json({ config: defaultSiteConfig });
			}
			
			// For other database errors, still return defaults with 200 (graceful degradation)
			console.log('Database error, returning defaults:', dbError.code, dbError.message);
			return json({ config: defaultSiteConfig });
		}

		// If no active config found, return merged defaults
		if (!data) {
			console.log('No active site config found, returning defaults');
			return json({ config: defaultSiteConfig });
		}

		// Merge database data with defaults (ensures all fields exist)
		const mergedConfig = {
			...defaultSiteConfig,
			...data
		};

		return json({ config: mergedConfig });
	} catch (err) {
		console.error('Exception in GET /api/site-config:', err);
		// Return defaults even on exception (graceful degradation)
		return json({ config: defaultSiteConfig });
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

		// Get the active configuration ID using maybeSingle()
		const { data: activeConfig, error: findError } = await supabase
			.from('site_configuration')
			.select('id')
			.eq('is_active', true)
			.maybeSingle();

		if (findError) {
			console.error('Error finding active site config:', findError);
			throw error(500, 'Failed to find site configuration');
		}

		if (!activeConfig) {
			// No active config exists, create one
			const { data, error: insertError } = await supabase
				.from('site_configuration')
				.insert({
					...config,
					is_active: true,
					updated_by: session.user.id,
					updated_at: new Date().toISOString()
				})
				.select()
				.single();

			if (insertError) {
				console.error('Error creating site config:', insertError);
				throw error(500, 'Failed to create site configuration');
			}

			// Defensive: ensure only this row is active (trigger should handle this, but belt-and-suspenders)
			const { error: deactivateError } = await supabase
				.from('site_configuration')
				.update({ is_active: false })
				.neq('id', data.id)
				.eq('is_active', true);
			
			if (deactivateError) {
				console.warn('Warning: Failed to deactivate other site configs (trigger should handle this):', deactivateError);
				// Don't throw - the trigger should handle single active row, this is just defensive
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
