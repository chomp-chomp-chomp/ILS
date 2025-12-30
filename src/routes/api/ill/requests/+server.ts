import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Fetch ILL requests with filtering
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	// Build query
	let query = supabase
		.from('ill_requests')
		.select(`
			*,
			patron:patrons(id, name, email, barcode),
			partner:ill_partners(id, library_name, library_code),
			marc_record:marc_records(id, title_statement, isbn, material_type)
		`)
		.order('created_at', { ascending: false });

	// Filter by request type (borrowing or lending)
	const requestType = url.searchParams.get('type');
	if (requestType) {
		query = query.eq('request_type', requestType);
	}

	// Filter by status
	const status = url.searchParams.get('status');
	if (status) {
		query = query.eq('status', status);
	}

	// Filter by patron (for patron's own requests)
	const patronId = url.searchParams.get('patron_id');
	if (patronId) {
		query = query.eq('patron_id', patronId);
	}

	// Filter by partner library
	const partnerId = url.searchParams.get('partner_id');
	if (partnerId) {
		query = query.eq('partner_library_id', partnerId);
	}

	// Date range filters
	const startDate = url.searchParams.get('start_date');
	const endDate = url.searchParams.get('end_date');
	if (startDate) {
		query = query.gte('created_at', startDate);
	}
	if (endDate) {
		query = query.lte('created_at', endDate);
	}

	// Pagination
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = (page - 1) * limit;

	query = query.range(offset, offset + limit - 1);

	const { data: requests, error: fetchError } = await query;

	if (fetchError) {
		console.error('Error fetching ILL requests:', fetchError);
		throw error(500, 'Failed to fetch ILL requests');
	}

	// Get total count for pagination
	let countQuery = supabase
		.from('ill_requests')
		.select('*', { count: 'exact', head: true });

	if (requestType) countQuery = countQuery.eq('request_type', requestType);
	if (status) countQuery = countQuery.eq('status', status);
	if (patronId) countQuery = countQuery.eq('patron_id', patronId);
	if (partnerId) countQuery = countQuery.eq('partner_library_id', partnerId);

	const { count } = await countQuery;

	return json({
		requests,
		pagination: {
			page,
			limit,
			total: count || 0,
			pages: Math.ceil((count || 0) / limit)
		}
	});
};

// POST - Create a new ILL request
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	// Validate required fields
	if (!body.request_type || !body.title) {
		throw error(400, 'Missing required fields: request_type, title');
	}

	// For borrowing requests, ensure patron_id is set
	if (body.request_type === 'borrowing' && !body.patron_id) {
		throw error(400, 'Patron ID required for borrowing requests');
	}

	// Prepare the request data
	const requestData = {
		request_type: body.request_type,
		patron_id: body.patron_id,
		patron_name: body.patron_name,
		patron_email: body.patron_email,
		partner_library_id: body.partner_library_id,
		partner_library_name: body.partner_library_name,
		marc_record_id: body.marc_record_id,
		title: body.title,
		author: body.author,
		isbn: body.isbn,
		issn: body.issn,
		publisher: body.publisher,
		publication_year: body.publication_year,
		edition: body.edition,
		material_type: body.material_type || 'book',
		needed_by_date: body.needed_by_date,
		pickup_location: body.pickup_location,
		notes: body.notes,
		internal_notes: body.internal_notes,
		status: body.status || 'pending',
		created_by: session.user.id
	};

	const { data: newRequest, error: insertError } = await supabase
		.from('ill_requests')
		.insert(requestData)
		.select(`
			*,
			patron:patrons(id, name, email, barcode),
			partner:ill_partners(id, library_name, library_code)
		`)
		.single();

	if (insertError) {
		console.error('Error creating ILL request:', insertError);
		throw error(500, 'Failed to create ILL request');
	}

	return json(newRequest, { status: 201 });
};

// PUT - Update an ILL request
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	if (!body.id) {
		throw error(400, 'Request ID required');
	}

	// Prepare update data
	const updateData: any = {
		updated_by: session.user.id
	};

	// Only update fields that are provided
	const allowedFields = [
		'status',
		'partner_library_id',
		'partner_library_name',
		'marc_record_id',
		'title',
		'author',
		'isbn',
		'issn',
		'publisher',
		'publication_year',
		'edition',
		'material_type',
		'needed_by_date',
		'pickup_location',
		'notes',
		'internal_notes',
		'requested_date',
		'approved_date',
		'shipped_date',
		'received_date',
		'due_date',
		'returned_date',
		'completed_date',
		'fee_amount',
		'fee_paid',
		'fee_notes'
	];

	allowedFields.forEach((field) => {
		if (body[field] !== undefined) {
			updateData[field] = body[field];
		}
	});

	// Auto-set dates based on status changes
	if (body.status) {
		const now = new Date().toISOString().split('T')[0];
		switch (body.status) {
			case 'approved':
				if (!updateData.approved_date) updateData.approved_date = now;
				break;
			case 'requested':
				if (!updateData.requested_date) updateData.requested_date = now;
				break;
			case 'shipped':
				if (!updateData.shipped_date) updateData.shipped_date = now;
				break;
			case 'received':
				if (!updateData.received_date) updateData.received_date = now;
				break;
			case 'returned':
				if (!updateData.returned_date) updateData.returned_date = now;
				break;
			case 'completed':
				if (!updateData.completed_date) updateData.completed_date = now;
				break;
		}
	}

	const { data: updatedRequest, error: updateError } = await supabase
		.from('ill_requests')
		.update(updateData)
		.eq('id', body.id)
		.select(`
			*,
			patron:patrons(id, name, email, barcode),
			partner:ill_partners(id, library_name, library_code)
		`)
		.single();

	if (updateError) {
		console.error('Error updating ILL request:', updateError);
		throw error(500, 'Failed to update ILL request');
	}

	return json(updatedRequest);
};

// DELETE - Delete an ILL request
export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const id = url.searchParams.get('id');

	if (!id) {
		throw error(400, 'Request ID required');
	}

	const { error: deleteError } = await supabase.from('ill_requests').delete().eq('id', id);

	if (deleteError) {
		console.error('Error deleting ILL request:', deleteError);
		throw error(500, 'Failed to delete ILL request');
	}

	return json({ success: true });
};
