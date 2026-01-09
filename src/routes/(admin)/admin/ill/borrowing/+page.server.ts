import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const status = url.searchParams.get('status');

	let query = supabase
		.from('ill_requests')
		.select(
			`
			*,
			patron:patrons(id, name, email, barcode),
			partner:ill_partners(id, library_name, library_code)
		`
		)
		.eq('request_type', 'borrowing')
		.order('created_at', { ascending: false });

	if (status) {
		query = query.eq('status', status);
	}

	const { data: requests, error } = await query;

	if (error) {
		console.error('Error fetching borrowing requests:', error);
		return { requests: [] };
	}

	// Get active partners for the new request form
	const { data: partners } = await supabase
		.from('ill_partners')
		.select('id, library_name, library_code')
		.eq('is_active', true)
		.eq('borrowing_allowed', true)
		.order('library_name');

	// Get patrons for the new request form
	const { data: patrons } = await supabase
		.from('patrons')
		.select('id, name, email, barcode')
		.order('name')
		.limit(100);

	return {
		requests: requests || [],
		partners: partners || [],
		patrons: patrons || []
	};
};
