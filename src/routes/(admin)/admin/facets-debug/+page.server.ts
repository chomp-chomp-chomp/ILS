import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Load search configuration
	const { data: searchConfig, error: searchError } = await supabase
		.from('search_configuration')
		.select('*')
		.eq('is_active', true)
		.maybeSingle();

	// Load facet configurations
	const { data: facetConfigs, error: facetError } = await supabase
		.from('facet_configuration')
		.select('*')
		.order('display_order');

	// Try to get a sample of search results to compute facets
	const { data: sampleResults, error: resultsError } = await supabase
		.from('marc_records')
		.select('material_type, language_code')
		.limit(100);

	// Count material types
	const materialTypeCounts = new Map<string, number>();
	sampleResults?.forEach((record) => {
		const type = record.material_type || 'unknown';
		materialTypeCounts.set(type, (materialTypeCounts.get(type) || 0) + 1);
	});

	// Count languages
	const languageCounts = new Map<string, number>();
	sampleResults?.forEach((record) => {
		const lang = record.language_code || 'unknown';
		languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
	});

	return {
		searchConfig,
		searchError: searchError?.message || null,
		facetConfigs: facetConfigs || [],
		facetError: facetError?.message || null,
		sampleResults: {
			total: sampleResults?.length || 0,
			materialTypes: Array.from(materialTypeCounts.entries()).map(([type, count]) => ({ type, count })),
			languages: Array.from(languageCounts.entries()).map(([lang, count]) => ({ lang, count }))
		},
		resultsError: resultsError?.message || null
	};
};
