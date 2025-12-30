import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Fetch shipments
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	let query = supabase
		.from('ill_shipments')
		.select(
			`
			*,
			request:ill_requests(
				id,
				title,
				author,
				request_type,
				status,
				patron:patrons(id, name, email),
				partner:ill_partners(id, library_name)
			)
		`
		)
		.order('created_at', { ascending: false });

	// Filter by request ID
	const requestId = url.searchParams.get('request_id');
	if (requestId) {
		query = query.eq('ill_request_id', requestId);
	}

	// Filter by direction
	const direction = url.searchParams.get('direction');
	if (direction) {
		query = query.eq('direction', direction);
	}

	// Filter by tracking number
	const trackingNumber = url.searchParams.get('tracking');
	if (trackingNumber) {
		query = query.eq('tracking_number', trackingNumber);
	}

	const { data: shipments, error: fetchError } = await query;

	if (fetchError) {
		console.error('Error fetching shipments:', fetchError);
		throw error(500, 'Failed to fetch shipments');
	}

	return json({ shipments });
};

// POST - Create a new shipment
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	// Validate required fields
	if (!body.ill_request_id || !body.direction) {
		throw error(400, 'ILL request ID and direction are required');
	}

	const shipmentData = {
		ill_request_id: body.ill_request_id,
		direction: body.direction,
		carrier: body.carrier,
		tracking_number: body.tracking_number,
		tracking_url: body.tracking_url,
		service_type: body.service_type,
		shipped_date: body.shipped_date,
		expected_arrival_date: body.expected_arrival_date,
		actual_arrival_date: body.actual_arrival_date,
		weight_oz: body.weight_oz,
		packaging_type: body.packaging_type,
		insured_value: body.insured_value,
		shipping_cost: body.shipping_cost,
		notes: body.notes,
		created_by: session.user.id
	};

	const { data: newShipment, error: insertError } = await supabase
		.from('ill_shipments')
		.insert(shipmentData)
		.select(
			`
			*,
			request:ill_requests(
				id,
				title,
				author,
				request_type,
				status,
				patron:patrons(id, name, email),
				partner:ill_partners(id, library_name)
			)
		`
		)
		.single();

	if (insertError) {
		console.error('Error creating shipment:', insertError);
		throw error(500, 'Failed to create shipment');
	}

	// Update the ILL request status based on shipment direction
	if (body.shipped_date && !body.actual_arrival_date) {
		const { error: updateError } = await supabase
			.from('ill_requests')
			.update({
				status: 'shipped',
				shipped_date: body.shipped_date,
				updated_by: session.user.id
			})
			.eq('id', body.ill_request_id);

		if (updateError) {
			console.error('Error updating request status:', updateError);
		}
	}

	return json(newShipment, { status: 201 });
};

// PUT - Update a shipment
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	if (!body.id) {
		throw error(400, 'Shipment ID required');
	}

	const updateData: any = {
		updated_by: session.user.id
	};

	// Update allowed fields
	const allowedFields = [
		'carrier',
		'tracking_number',
		'tracking_url',
		'service_type',
		'shipped_date',
		'expected_arrival_date',
		'actual_arrival_date',
		'weight_oz',
		'packaging_type',
		'insured_value',
		'shipping_cost',
		'notes'
	];

	allowedFields.forEach((field) => {
		if (body[field] !== undefined) {
			updateData[field] = body[field];
		}
	});

	const { data: updatedShipment, error: updateError } = await supabase
		.from('ill_shipments')
		.update(updateData)
		.eq('id', body.id)
		.select(
			`
			*,
			request:ill_requests(
				id,
				title,
				author,
				request_type,
				status,
				patron:patrons(id, name, email),
				partner:ill_partners(id, library_name)
			)
		`
		)
		.single();

	if (updateError) {
		console.error('Error updating shipment:', updateError);
		throw error(500, 'Failed to update shipment');
	}

	// If actual arrival date is set, update the ILL request status
	if (body.actual_arrival_date && updatedShipment) {
		const direction = updatedShipment.direction;
		const newStatus = direction === 'incoming' ? 'received' : 'completed';

		const { error: statusError } = await supabase
			.from('ill_requests')
			.update({
				status: newStatus,
				[direction === 'incoming' ? 'received_date' : 'completed_date']:
					body.actual_arrival_date,
				updated_by: session.user.id
			})
			.eq('id', updatedShipment.ill_request_id);

		if (statusError) {
			console.error('Error updating request status:', statusError);
		}
	}

	return json(updatedShipment);
};

// DELETE - Delete a shipment
export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const id = url.searchParams.get('id');

	if (!id) {
		throw error(400, 'Shipment ID required');
	}

	const { error: deleteError } = await supabase.from('ill_shipments').delete().eq('id', id);

	if (deleteError) {
		console.error('Error deleting shipment:', deleteError);
		throw error(500, 'Failed to delete shipment');
	}

	return json({ success: true });
};
