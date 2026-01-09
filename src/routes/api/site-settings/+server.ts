import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase } }) => {
	const { data, error: dbError } = await supabase
		.from('site_settings')
		.select('*')
		.eq('is_active', true)
		.maybeSingle();

	if (dbError) {
		throw error(500, dbError.message);
	}

	return json(data);
};

export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const settings = await request.json();

	// First, get the current active settings (if any)
	const { data: currentSettings } = await supabase
		.from('site_settings')
		.select('id')
		.eq('is_active', true)
		.maybeSingle();

	let result;

	if (currentSettings) {
		// Update existing settings
		result = await supabase
			.from('site_settings')
			.update({
				...settings,
				updated_by: session.user.id,
				updated_at: new Date().toISOString()
			})
			.eq('id', currentSettings.id)
			.select()
			.single();
	} else {
		// Create new settings
		result = await supabase
			.from('site_settings')
			.insert({
				...settings,
				is_active: true,
				updated_by: session.user.id
			})
			.select()
			.single();
	}

	if (result.error) {
		throw error(500, result.error.message);
	}

	return json(result.data);
};
