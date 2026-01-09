import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (!session) {
		throw new Error('Unauthorized');
	}

	try {
		// Get database statistics
		const { count: totalRecords } = await supabase
			.from('marc_records')
			.select('*', { count: 'exact', head: true });

		const { count: totalItems } = await supabase
			.from('items')
			.select('*', { count: 'exact', head: true });

		const { count: totalPatrons } = await supabase
			.from('patrons')
			.select('*', { count: 'exact', head: true });

		const { count: totalCheckouts } = await supabase
			.from('checkouts')
			.select('*', { count: 'exact', head: true })
			.is('returned_at', null);

		// Get recent records
		const { data: recentRecords } = await supabase
			.from('marc_records')
			.select('id, title_statement, created_at')
			.order('created_at', { ascending: false })
			.limit(5);

		// Get facet cache stats
		const { count: cachedFacets } = await supabase
			.from('facet_values_cache')
			.select('*', { count: 'exact', head: true });

		// Get facet configuration count
		const { count: facetConfigs } = await supabase
			.from('facet_configuration')
			.select('*', { count: 'exact', head: true })
			.eq('is_enabled', true);

		// Get active site configuration
		const { data: siteConfig } = await supabase
			.from('site_configuration')
			.select('id, updated_at, updated_by')
			.eq('is_active', true)
			.single();

		return {
			stats: {
				totalRecords: totalRecords || 0,
				totalItems: totalItems || 0,
				totalPatrons: totalPatrons || 0,
				totalCheckouts: totalCheckouts || 0,
				cachedFacets: cachedFacets || 0,
				facetConfigs: facetConfigs || 0
			},
			recentRecords: recentRecords || [],
			siteConfig
		};
	} catch (error) {
		console.error('Error loading maintenance data:', error);
		return {
			stats: {
				totalRecords: 0,
				totalItems: 0,
				totalPatrons: 0,
				totalCheckouts: 0,
				cachedFacets: 0,
				facetConfigs: 0
			},
			recentRecords: [],
			siteConfig: null
		};
	}
};
