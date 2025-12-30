import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/admin/login?redirect=/catalog/ill/my-requests');
	}

	// Get patron info
	const { data: patron } = await supabase
		.from('patrons')
		.select('*')
		.eq('email', session.user.email)
		.single();

	if (!patron) {
		return { requests: [], patron: null };
	}

	// Get all requests for this patron
	const { data: requests, error } = await supabase
		.from('ill_requests')
		.select(
			`
			*,
			partner:ill_partners(id, library_name, library_code)
		`
		)
		.eq('patron_id', patron.id)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error fetching patron requests:', error);
		return { requests: [], patron };
	}

	return { requests: requests || [], patron };
};
