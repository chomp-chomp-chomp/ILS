import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Fetch partner libraries
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	let query = supabase
		.from('ill_partners')
		.select('*')
		.order('library_name', { ascending: true });

	// Filter by active status
	const activeOnly = url.searchParams.get('active') === 'true';
	if (activeOnly) {
		query = query.eq('is_active', true);
	}

	// Filter by library type
	const libraryType = url.searchParams.get('type');
	if (libraryType) {
		query = query.eq('library_type', libraryType);
	}

	// Search by name
	const search = url.searchParams.get('search');
	if (search) {
		query = query.or(
			`library_name.ilike.%${search}%,library_code.ilike.%${search}%,city.ilike.%${search}%`
		);
	}

	const { data: partners, error: fetchError } = await query;

	if (fetchError) {
		console.error('Error fetching ILL partners:', fetchError);
		throw error(500, 'Failed to fetch partner libraries');
	}

	return json({ partners });
};

// POST - Create a new partner library
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	// Validate required fields
	if (!body.library_name) {
		throw error(400, 'Library name is required');
	}

	const partnerData = {
		library_name: body.library_name,
		library_code: body.library_code,
		library_type: body.library_type,
		contact_name: body.contact_name,
		contact_email: body.contact_email,
		contact_phone: body.contact_phone,
		address_line1: body.address_line1,
		address_line2: body.address_line2,
		city: body.city,
		state: body.state,
		postal_code: body.postal_code,
		country: body.country || 'USA',
		ill_email: body.ill_email,
		ill_phone: body.ill_phone,
		shipping_notes: body.shipping_notes,
		agreement_type: body.agreement_type,
		lending_allowed: body.lending_allowed !== undefined ? body.lending_allowed : true,
		borrowing_allowed: body.borrowing_allowed !== undefined ? body.borrowing_allowed : true,
		max_loans_per_patron: body.max_loans_per_patron || 5,
		loan_period_days: body.loan_period_days || 21,
		renewal_allowed: body.renewal_allowed !== undefined ? body.renewal_allowed : true,
		is_active: body.is_active !== undefined ? body.is_active : true,
		notes: body.notes,
		created_by: session.user.id
	};

	const { data: newPartner, error: insertError } = await supabase
		.from('ill_partners')
		.insert(partnerData)
		.select()
		.single();

	if (insertError) {
		console.error('Error creating partner library:', insertError);
		throw error(500, 'Failed to create partner library');
	}

	return json(newPartner, { status: 201 });
};

// PUT - Update a partner library
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	if (!body.id) {
		throw error(400, 'Partner ID required');
	}

	const updateData: any = {
		updated_by: session.user.id
	};

	// Update allowed fields
	const allowedFields = [
		'library_name',
		'library_code',
		'library_type',
		'contact_name',
		'contact_email',
		'contact_phone',
		'address_line1',
		'address_line2',
		'city',
		'state',
		'postal_code',
		'country',
		'ill_email',
		'ill_phone',
		'shipping_notes',
		'agreement_type',
		'lending_allowed',
		'borrowing_allowed',
		'max_loans_per_patron',
		'loan_period_days',
		'renewal_allowed',
		'is_active',
		'notes'
	];

	allowedFields.forEach((field) => {
		if (body[field] !== undefined) {
			updateData[field] = body[field];
		}
	});

	const { data: updatedPartner, error: updateError } = await supabase
		.from('ill_partners')
		.update(updateData)
		.eq('id', body.id)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating partner library:', updateError);
		throw error(500, 'Failed to update partner library');
	}

	return json(updatedPartner);
};

// DELETE - Delete a partner library
export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const id = url.searchParams.get('id');

	if (!id) {
		throw error(400, 'Partner ID required');
	}

	// Check if partner has active requests
	const { data: requests } = await supabase
		.from('ill_requests')
		.select('id')
		.eq('partner_library_id', id)
		.in('status', ['pending', 'approved', 'requested', 'shipped', 'received', 'checked_out'])
		.limit(1);

	if (requests && requests.length > 0) {
		throw error(
			400,
			'Cannot delete partner library with active requests. Mark as inactive instead.'
		);
	}

	const { error: deleteError } = await supabase.from('ill_partners').delete().eq('id', id);

	if (deleteError) {
		console.error('Error deleting partner library:', deleteError);
		throw error(500, 'Failed to delete partner library');
	}

	return json({ success: true });
};
