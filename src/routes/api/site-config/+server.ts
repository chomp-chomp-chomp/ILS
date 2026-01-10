import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	loadUnifiedSiteSettings,
	updateUnifiedSiteSettings,
	DEFAULT_UNIFIED_SETTINGS
} from '$lib/server/unifiedSiteSettings';

// GET - Read unified site settings
export const GET: RequestHandler = async ({ locals: { supabase } }) => {
	try {
		const settings = await loadUnifiedSiteSettings(supabase);
		return json({ config: settings });
	} catch (err) {
		console.error('Exception in GET /api/site-config:', err);
		// Return defaults even on exception (graceful degradation)
		return json({ config: DEFAULT_UNIFIED_SETTINGS });
	}
};

// PUT - Update unified site settings (authenticated only)
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

		console.log('[PUT /api/site-config] Updating settings for user:', session.user.id);

		// Update using unified helper
		const result = await updateUnifiedSiteSettings(supabase, config, session.user.id);

		if (!result.success) {
			console.error('[PUT /api/site-config] Update failed:', result.error);
			throw error(500, result.error || 'Failed to update site settings');
		}

		// Reload settings to return updated data
		const updatedSettings = await loadUnifiedSiteSettings(supabase);

		return json({ config: updatedSettings });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('Exception in PUT /api/site-config:', err);
		throw error(500, 'Internal server error');
	}
};
