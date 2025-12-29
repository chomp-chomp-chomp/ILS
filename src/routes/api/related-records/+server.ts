import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	try {
		const body = await request.json();

		const {
			source_record_id,
			target_record_id,
			relationship_type,
			relationship_note,
			display_order
		} = body;

		// Validate required fields
		if (!source_record_id || !target_record_id || !relationship_type) {
			throw error(400, 'Missing required fields');
		}

		// Prevent linking a record to itself
		if (source_record_id === target_record_id) {
			throw error(400, 'Cannot link a record to itself');
		}

		// Insert the related record
		const { data, error: insertError } = await supabase
			.from('related_records')
			.insert({
				source_record_id,
				target_record_id,
				relationship_type,
				relationship_note: relationship_note || null,
				display_order: display_order || 0
			})
			.select()
			.single();

		if (insertError) {
			console.error('Error inserting related record:', insertError);

			// Check for unique constraint violation
			if (insertError.code === '23505') {
				throw error(400, 'This relationship already exists');
			}

			throw error(500, 'Failed to create related record link');
		}

		return json({ success: true, data });
	} catch (err) {
		console.error('Related records API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
