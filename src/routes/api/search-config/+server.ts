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
			.from('search_configuration')
			.select('id')
			.eq('is_active', true)
			.single();

		let result;

		if (existing) {
			// Update existing configuration
			const { data, error: updateError } = await supabase
				.from('search_configuration')
				.update({
					default_search_type: config.default_search_type || 'keyword',
					enable_spell_correction: config.enable_spell_correction !== false,
					spell_correction_threshold: config.spell_correction_threshold || 0.4,
					min_results_for_suggestion: config.min_results_for_suggestion || 5,
					results_per_page: config.results_per_page || 20,
					results_layout: config.results_layout || 'list',
					show_covers: config.show_covers !== false,
					show_availability: config.show_availability !== false,
					show_call_number: config.show_call_number !== false,
					enable_facets: config.enable_facets !== false,
					facet_material_types: config.facet_material_types !== false,
					facet_languages: config.facet_languages !== false,
					facet_publication_years: config.facet_publication_years !== false,
					facet_locations: config.facet_locations !== false,
					facet_availability: config.facet_availability !== false,
					max_facet_values: config.max_facet_values || 10,
					enable_advanced_search: config.enable_advanced_search !== false,
					enable_boolean_operators: config.enable_boolean_operators !== false,
					default_sort: config.default_sort || 'relevance',
					available_sort_options: config.available_sort_options || [
						'relevance',
						'title',
						'author',
						'date_newest',
						'date_oldest'
					],
					updated_by: session.user.id
				})
				.eq('id', existing.id)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating search configuration:', updateError);
				throw error(500, 'Failed to update search configuration');
			}

			result = data;
		} else {
			// Create new configuration
			const { data, error: insertError } = await supabase
				.from('search_configuration')
				.insert({
					default_search_type: config.default_search_type || 'keyword',
					enable_spell_correction: config.enable_spell_correction !== false,
					spell_correction_threshold: config.spell_correction_threshold || 0.4,
					min_results_for_suggestion: config.min_results_for_suggestion || 5,
					results_per_page: config.results_per_page || 20,
					results_layout: config.results_layout || 'list',
					show_covers: config.show_covers !== false,
					show_availability: config.show_availability !== false,
					show_call_number: config.show_call_number !== false,
					enable_facets: config.enable_facets !== false,
					facet_material_types: config.facet_material_types !== false,
					facet_languages: config.facet_languages !== false,
					facet_publication_years: config.facet_publication_years !== false,
					facet_locations: config.facet_locations !== false,
					facet_availability: config.facet_availability !== false,
					max_facet_values: config.max_facet_values || 10,
					enable_advanced_search: config.enable_advanced_search !== false,
					enable_boolean_operators: config.enable_boolean_operators !== false,
					default_sort: config.default_sort || 'relevance',
					available_sort_options: config.available_sort_options || [
						'relevance',
						'title',
						'author',
						'date_newest',
						'date_oldest'
					],
					is_active: true,
					updated_by: session.user.id
				})
				.select()
				.single();

			if (insertError) {
				console.error('Error creating search configuration:', insertError);
				throw error(500, 'Failed to create search configuration');
			}

			result = data;
		}

		return json({ success: true, config: result });
	} catch (err) {
		console.error('Search config API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
