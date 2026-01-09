import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/admin/login?redirect=/catalog/ill/request');
	}

	// Get patron info for the logged-in user
	const { data: patron } = await supabase
		.from('patrons')
		.select('*')
		.eq('email', session.user.email)
		.single();

	if (!patron) {
		// Create a basic patron record if it doesn't exist
		const { data: newPatron } = await supabase
			.from('patrons')
			.insert({
				email: session.user.email,
				name: session.user.user_metadata?.name || session.user.email
			})
			.select()
			.single();

		return { patron: newPatron, session };
	}

	return { patron, session };
};
