import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Fetch display field configuration
	const { data: fields, error: fieldsError } = await supabase
		.from('display_field_configuration')
		.select('*')
		.order('display_order', { ascending: true });

	// Fetch active display configuration
	const { data: config, error: configError } = await supabase
		.from('display_configuration')
		.select('*')
		.eq('is_active', true)
		.single();

	// Return with defaults if not found
	return {
		fields: fields || [],
		config: config || {
			results_show_covers: true,
			results_cover_size: 'medium',
			results_show_availability: true,
			results_show_location: true,
			results_show_call_number: true,
			results_show_material_badge: true,
			results_compact_mode: false,
			detail_show_cover: true,
			detail_cover_size: 'large',
			detail_show_marc: false,
			detail_show_holdings: true,
			detail_show_related: true,
			detail_show_subjects_as_tags: true,
			detail_group_by_category: true,
			holdings_show_barcode: true,
			holdings_show_call_number: true,
			holdings_show_location: true,
			holdings_show_status: true,
			holdings_show_notes: true,
			holdings_show_electronic_access: true,
			cover_source: 'openlibrary',
			cover_fallback_icon: true
		}
	};
};
