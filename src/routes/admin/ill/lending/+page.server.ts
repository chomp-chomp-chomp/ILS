import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const status = url.searchParams.get('status');

	let query = supabase
		.from('ill_requests')
		.select(
			`
			*,
			patron:patrons(id, name, email, barcode),
			partner:ill_partners(id, library_name, library_code),
			marc_record:marc_records(id, title_statement, isbn)
		`
		)
		.eq('request_type', 'lending')
		.order('created_at', { ascending: false });

	if (status) {
		query = query.eq('status', status);
	}

	const { data: requests, error } = await query;

	if (error) {
		console.error('Error fetching lending requests:', error);
		return { requests: [] };
	}

	return {
		requests: requests || []
	};
};
