import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const session = await supabase.auth.getSession();

	if (!session.data.session) {
		throw redirect(303, '/auth/login?redirect=/catalog/my-lists');
	}

	const patronId = session.data.session.user.id;

	// Get all lists for the current patron
	const { data: lists, error } = await supabase
		.from('reading_list_stats')
		.select('*')
		.eq('patron_id', patronId)
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Error loading reading lists:', error);
		return {
			lists: []
		};
	}

	return {
		lists: lists || []
	};
};
