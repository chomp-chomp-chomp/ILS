import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals: { supabase } }) => {
	try {
		const { id } = params;

		if (!id) {
			throw error(400, 'Missing related record ID');
		}

		const { error: deleteError } = await supabase
			.from('related_records')
			.delete()
			.eq('id', id);

		if (deleteError) {
			console.error('Error deleting related record:', deleteError);
			throw error(500, 'Failed to delete related record link');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Delete related record API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
