import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const config = await request.json();

		// Check if an active configuration exists
		const { data: existing } = await supabase
			.from('display_configuration')
			.select('id')
			.eq('is_active', true)
			.single();

		let result;

		if (existing) {
			// Update existing configuration
			const { data, error: updateError } = await supabase
				.from('display_configuration')
				.update({
					results_show_covers: config.results_show_covers !== false,
					results_cover_size: config.results_cover_size || 'medium',
					results_show_availability: config.results_show_availability !== false,
					results_show_location: config.results_show_location !== false,
					results_show_call_number: config.results_show_call_number !== false,
					results_show_material_badge: config.results_show_material_badge !== false,
					results_compact_mode: config.results_compact_mode === true,
					detail_show_cover: config.detail_show_cover !== false,
					detail_cover_size: config.detail_cover_size || 'large',
					detail_show_marc: config.detail_show_marc === true,
					detail_show_holdings: config.detail_show_holdings !== false,
					detail_show_related: config.detail_show_related !== false,
					detail_show_subjects_as_tags: config.detail_show_subjects_as_tags !== false,
					detail_group_by_category: config.detail_group_by_category !== false,
					holdings_show_barcode: config.holdings_show_barcode !== false,
					holdings_show_call_number: config.holdings_show_call_number !== false,
					holdings_show_location: config.holdings_show_location !== false,
					holdings_show_status: config.holdings_show_status !== false,
					holdings_show_notes: config.holdings_show_notes !== false,
					holdings_show_electronic_access: config.holdings_show_electronic_access !== false,
					cover_source: config.cover_source || 'openlibrary',
					cover_fallback_icon: config.cover_fallback_icon !== false,
					updated_by: session.user.id
				})
				.eq('id', existing.id)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating display configuration:', updateError);
				throw error(500, 'Failed to update display configuration');
			}

			result = data;
		} else {
			// Create new configuration
			const { data, error: insertError } = await supabase
				.from('display_configuration')
				.insert({
					results_show_covers: config.results_show_covers !== false,
					results_cover_size: config.results_cover_size || 'medium',
					results_show_availability: config.results_show_availability !== false,
					results_show_location: config.results_show_location !== false,
					results_show_call_number: config.results_show_call_number !== false,
					results_show_material_badge: config.results_show_material_badge !== false,
					results_compact_mode: config.results_compact_mode === true,
					detail_show_cover: config.detail_show_cover !== false,
					detail_cover_size: config.detail_cover_size || 'large',
					detail_show_marc: config.detail_show_marc === true,
					detail_show_holdings: config.detail_show_holdings !== false,
					detail_show_related: config.detail_show_related !== false,
					detail_show_subjects_as_tags: config.detail_show_subjects_as_tags !== false,
					detail_group_by_category: config.detail_group_by_category !== false,
					holdings_show_barcode: config.holdings_show_barcode !== false,
					holdings_show_call_number: config.holdings_show_call_number !== false,
					holdings_show_location: config.holdings_show_location !== false,
					holdings_show_status: config.holdings_show_status !== false,
					holdings_show_notes: config.holdings_show_notes !== false,
					holdings_show_electronic_access: config.holdings_show_electronic_access !== false,
					cover_source: config.cover_source || 'openlibrary',
					cover_fallback_icon: config.cover_fallback_icon !== false,
					is_active: true,
					updated_by: session.user.id
				})
				.select()
				.single();

			if (insertError) {
				console.error('Error creating display configuration:', insertError);
				throw error(500, 'Failed to create display configuration');
			}

			result = data;
		}

		return json({ success: true, config: result });
	} catch (err) {
		console.error('Display config API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
