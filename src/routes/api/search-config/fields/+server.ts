import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const { fields } = await request.json();

		if (!Array.isArray(fields)) {
			throw error(400, 'Fields must be an array');
		}

		// Update each field
		const updatePromises = fields.map((field) =>
			supabase
				.from('search_field_configuration')
				.update({
					field_label: field.field_label,
					placeholder_text: field.placeholder_text,
					help_text: field.help_text,
					is_enabled: field.is_enabled,
					is_default_visible: field.is_default_visible,
					display_order: field.display_order,
					show_in_advanced: field.show_in_advanced,
					updated_by: session.user.id
				})
				.eq('id', field.id)
		);

		const results = await Promise.all(updatePromises);

		// Check for errors
		const errors = results.filter((r) => r.error);
		if (errors.length > 0) {
			console.error('Error updating search fields:', errors);
			throw error(500, 'Failed to update some search fields');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Search fields API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
