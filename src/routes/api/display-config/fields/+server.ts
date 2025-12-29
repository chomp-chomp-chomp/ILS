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
				.from('display_field_configuration')
				.update({
					field_label: field.field_label,
					display_order: field.display_order,
					display_style: field.display_style,
					show_in_results: field.show_in_results,
					show_in_detail: field.show_in_detail,
					show_in_brief: field.show_in_brief,
					make_clickable: field.make_clickable,
					link_type: field.link_type,
					prefix_text: field.prefix_text,
					suffix_text: field.suffix_text,
					updated_by: session.user.id
				})
				.eq('id', field.id)
		);

		const results = await Promise.all(updatePromises);

		// Check for errors
		const errors = results.filter((r) => r.error);
		if (errors.length > 0) {
			console.error('Error updating display fields:', errors);
			throw error(500, 'Failed to update some display fields');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Display fields API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
