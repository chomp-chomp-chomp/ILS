import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { code } = params;
	const supabase = locals.supabase;

	try {
		// Track access and get full URL
		const { data, error } = await supabase.rpc('track_short_url_access', {
			p_code: code
		});

		if (error || !data) {
			// Short URL not found
			throw redirect(302, '/catalog');
		}

		// Redirect to full URL
		throw redirect(302, data);
	} catch (error) {
		// If it's already a redirect, re-throw it
		if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
			throw error;
		}

		// Otherwise, redirect to catalog home
		console.error('Short URL error:', error);
		throw redirect(302, '/catalog');
	}
};
