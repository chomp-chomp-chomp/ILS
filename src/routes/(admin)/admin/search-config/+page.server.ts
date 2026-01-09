import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Fetch search field configuration
	const { data: fields, error: fieldsError } = await supabase
		.from('search_field_configuration')
		.select('*')
		.order('display_order', { ascending: true });

	// Fetch active search configuration
	const { data: config, error: configError } = await supabase
		.from('search_configuration')
		.select('*')
		.eq('is_active', true)
		.single();

	// Fetch facet configurations (including inactive for admin view)
	const { data: facets, error: facetsError } = await supabase
		.from('facet_configuration')
		.select('*')
		.order('display_order', { ascending: true });

	// Return with defaults if not found
	return {
		fields: fields || [],
		config: config || {
			default_search_type: 'keyword',
			enable_spell_correction: true,
			spell_correction_threshold: 0.4,
			min_results_for_suggestion: 5,
			results_per_page: 20,
			results_layout: 'list',
			show_covers: true,
			show_availability: true,
			show_call_number: true,
			enable_facets: true,
			facet_material_types: true,
			facet_languages: true,
			facet_publication_years: true,
			facet_locations: true,
			facet_availability: true,
			max_facet_values: 10,
			enable_advanced_search: true,
			enable_boolean_operators: true,
			default_sort: 'relevance',
			available_sort_options: ['relevance', 'title', 'author', 'date_newest', 'date_oldest']
		},
		facets: facets || []
	};
};
