import type { SupabaseClient } from '@supabase/supabase-js';
import type { SearchParams } from '../../routes/catalog/search/results/+page.server';

export interface FacetConfig {
	id: string;
	facet_key: string;
	facet_label: string;
	source_type: 'database_column' | 'marc_field' | 'items_field' | 'computed';
	source_field: string;
	source_subfield?: string;
	display_type: 'checkbox_list' | 'date_range' | 'numeric_range' | 'tag_cloud';
	aggregation_method: 'distinct_values' | 'decade_buckets' | 'year_buckets' | 'custom_ranges';
	bucket_size?: number;
	custom_ranges?: any;
	sort_by: 'count_desc' | 'count_asc' | 'label_asc' | 'label_desc' | 'custom';
	custom_sort_order?: string[];
	value_formatter?: string;
	value_format_mapping?: Record<string, string>;
	filter_param_name: string;
	max_items: number;
	show_count: boolean;
	is_enabled: boolean;
	is_active: boolean;
}

export interface Facet {
	value: string;
	label: string;
	count: number;
}

export interface DynamicFacetGroup {
	[facetKey: string]: Facet[];
}

/**
 * Load enabled facet configurations from database
 */
export async function loadFacetConfigs(supabase: SupabaseClient): Promise<FacetConfig[]> {
	const { data, error } = await supabase
		.from('facet_configuration')
		.select('*')
		.eq('is_enabled', true)
		.eq('is_active', true)
		.order('display_order', { ascending: true });

	if (error) {
		console.error('Error loading facet configs:', error);
		return [];
	}

	return data || [];
}

/**
 * Compute all facets based on configurations
 */
export async function computeDynamicFacets(
	supabase: SupabaseClient,
	configs: FacetConfig[],
	params: SearchParams
): Promise<DynamicFacetGroup> {
	const facets: DynamicFacetGroup = {};

	// Compute each facet in parallel
	await Promise.all(
		configs.map(async (config) => {
			const facetValues = await computeSingleFacet(supabase, config, params);
			facets[config.facet_key] = facetValues;
		})
	);

	return facets;
}

/**
 * Compute a single facet based on its configuration
 */
async function computeSingleFacet(
	supabase: SupabaseClient,
	config: FacetConfig,
	params: SearchParams
): Promise<Facet[]> {
	try {
		switch (config.source_type) {
			case 'database_column':
				return await computeDatabaseColumnFacet(supabase, config, params);
			case 'marc_field':
				return await computeMarcFieldFacet(supabase, config, params);
			case 'items_field':
				return await computeItemsFieldFacet(supabase, config, params);
			case 'computed':
				return await computeComputedFacet(supabase, config, params);
			default:
				console.warn(`Unknown source type: ${config.source_type}`);
				return [];
		}
	} catch (error) {
		console.error(`Error computing facet ${config.facet_key}:`, error);
		return [];
	}
}

/**
 * Compute facet from a direct database column
 */
async function computeDatabaseColumnFacet(
	supabase: SupabaseClient,
	config: FacetConfig,
	params: SearchParams
): Promise<Facet[]> {
	// Build base query without this facet's filter
	let query = supabase.from('marc_records').select(config.source_field);

	// Apply other filters
	query = applyBaseFilters(query, params, [config.filter_param_name]);

	const { data, error } = await query;

	if (error || !data) return [];

	// Count occurrences
	const counts = new Map<string, number>();
	data.forEach((record: any) => {
		const value = record[config.source_field];
		if (value) {
			counts.set(value, (counts.get(value) || 0) + 1);
		}
	});

	return formatFacetValues(counts, config);
}

/**
 * Compute facet from a MARC field
 */
async function computeMarcFieldFacet(
	supabase: SupabaseClient,
	config: FacetConfig,
	params: SearchParams
): Promise<Facet[]> {
	let query = supabase.from('marc_records').select(config.source_field);

	query = applyBaseFilters(query, params, [config.filter_param_name]);

	const { data, error } = await query;

	if (error || !data) return [];

	const counts = new Map<string, number>();

	data.forEach((record: any) => {
		const fieldData = record[config.source_field];

		if (!fieldData) return;

		// Handle JSONB fields
		let values: any[] = [];

		if (Array.isArray(fieldData)) {
			// Array of JSONB objects (e.g., subject_topical)
			values = fieldData.map((item) =>
				config.source_subfield ? item[config.source_subfield] : item
			);
		} else if (typeof fieldData === 'object') {
			// Single JSONB object (e.g., publication_info)
			const value = config.source_subfield ? fieldData[config.source_subfield] : fieldData;
			values = [value];
		} else {
			values = [fieldData];
		}

		values.forEach((value) => {
			if (value) {
				// Apply aggregation method
				const processedValue = applyAggregation(value, config);
				if (processedValue) {
					counts.set(processedValue, (counts.get(processedValue) || 0) + 1);
				}
			}
		});
	});

	return formatFacetValues(counts, config);
}

/**
 * Compute facet from items table field
 */
async function computeItemsFieldFacet(
	supabase: SupabaseClient,
	config: FacetConfig,
	params: SearchParams
): Promise<Facet[]> {
	// Special handling for items fields (like location, status)
	const fieldName = config.source_field;

	let query = supabase.from('marc_records').select(`
		id,
		items:items(${fieldName})
	`);

	query = applyBaseFilters(query, params, [config.filter_param_name]);

	const { data, error } = await query;

	if (error || !data) return [];

	const counts = new Map<string, number>();

	data.forEach((record: any) => {
		const items = record.items || [];

		if (fieldName === 'status') {
			// Special aggregation for availability
			const hasAvailable = items.some((item: any) => item.status === 'available');
			const hasCheckedOut = items.some((item: any) => item.status === 'checked_out');

			if (hasAvailable) {
				counts.set('available', (counts.get('available') || 0) + 1);
			} else if (hasCheckedOut) {
				counts.set('checked_out', (counts.get('checked_out') || 0) + 1);
			} else {
				counts.set('unavailable', (counts.get('unavailable') || 0) + 1);
			}
		} else {
			// For other fields like location, count distinct values
			const values = new Set(items.map((item: any) => item[fieldName]).filter(Boolean));
			values.forEach((value) => {
				counts.set(value as string, (counts.get(value as string) || 0) + 1);
			});
		}
	});

	return formatFacetValues(counts, config);
}

/**
 * Compute facet with custom logic (placeholder)
 */
async function computeComputedFacet(
	supabase: SupabaseClient,
	config: FacetConfig,
	params: SearchParams
): Promise<Facet[]> {
	// Placeholder for custom computed facets
	// Can be extended with custom logic based on facet_key
	console.warn(`Computed facets not yet implemented for: ${config.facet_key}`);
	return [];
}

/**
 * Apply aggregation method to a value
 */
function applyAggregation(value: any, config: FacetConfig): string | null {
	switch (config.aggregation_method) {
		case 'decade_buckets':
			if (/^\d{4}/.test(value)) {
				const year = parseInt(value.substring(0, 4));
				const decade = Math.floor(year / 10) * 10;
				return `${decade}s`;
			}
			return null;

		case 'year_buckets':
			if (/^\d{4}/.test(value)) {
				return value.substring(0, 4);
			}
			return null;

		case 'custom_ranges':
			// Would need to implement range matching based on config.custom_ranges
			return value;

		case 'distinct_values':
		default:
			return value;
	}
}

/**
 * Format facet values with labels and sorting
 */
function formatFacetValues(counts: Map<string, number>, config: FacetConfig): Facet[] {
	let facets: Facet[] = Array.from(counts.entries())
		.map(([value, count]) => {
			const stringValue = String(value ?? '').trim();

			const formattedLabel = formatValue(stringValue, config);
			const safeLabel = formattedLabel?.trim()?.length
				? formattedLabel
				: stringValue || 'Unknown';

			return {
				value: stringValue || 'Unknown',
				label: safeLabel,
				count
			};
		})
		.filter((facet): facet is Facet => facet !== null);

	// Apply sorting
	facets = sortFacets(facets, config);

	// Apply max items limit
	if (config.max_items) {
		facets = facets.slice(0, config.max_items);
	}

	// Filter out zero counts
	facets = facets.filter((f) => f.count > 0);

	return facets;
}

/**
 * Format a value for display
 */
function formatValue(value: string, config: FacetConfig): string {
	// First check custom mapping
	if (config.value_format_mapping && config.value_format_mapping[value]) {
		return config.value_format_mapping[value];
	}

	// Then check formatter type
	if (config.value_formatter) {
		switch (config.value_formatter) {
			case 'material_type':
				return formatMaterialType(value);
			case 'language_code':
				return formatLanguage(value);
			case 'year':
				return value;
			default:
				return value;
		}
	}

	return value;
}

/**
 * Sort facets based on configuration
 */
function sortFacets(facets: Facet[], config: FacetConfig): Facet[] {
	switch (config.sort_by) {
		case 'count_desc':
			return facets.sort((a, b) => b.count - a.count);
		case 'count_asc':
			return facets.sort((a, b) => a.count - b.count);
		case 'label_asc':
			return facets.sort((a, b) => a.label.localeCompare(b.label));
		case 'label_desc':
			return facets.sort((a, b) => b.label.localeCompare(a.label));
		case 'custom':
			if (config.custom_sort_order) {
				return facets.sort((a, b) => {
					const aIndex = config.custom_sort_order!.indexOf(a.value);
					const bIndex = config.custom_sort_order!.indexOf(b.value);
					if (aIndex === -1) return 1;
					if (bIndex === -1) return -1;
					return aIndex - bIndex;
				});
			}
			return facets;
		default:
			return facets;
	}
}

/**
 * Apply base search filters (excluding the facet being computed)
 */
function applyBaseFilters(query: any, params: SearchParams, excludeParams: string[]): any {
	// Apply all filters except the ones we're faceting on
	if (params.q && !excludeParams.includes('q')) {
		query = query.textSearch('search_vector', params.q, {
			type: 'websearch',
			config: 'english'
		});
	}

	if (params.title && !excludeParams.includes('title')) {
		query = query.ilike('title_statement->>a', `%${params.title}%`);
	}

	if (params.author && !excludeParams.includes('author')) {
		query = query.ilike('main_entry_personal_name->>a', `%${params.author}%`);
	}

	if (params.isbn && !excludeParams.includes('isbn')) {
		query = query.ilike('isbn', `%${params.isbn.replace(/-/g, '')}%`);
	}

	if (params.publisher && !excludeParams.includes('publisher')) {
		query = query.ilike('publication_info->>b', `%${params.publisher}%`);
	}

	// Year filter
	if (!excludeParams.includes('year_from') && params.year_from) {
		query = query.gte('publication_info->>c', params.year_from);
	}
	if (!excludeParams.includes('year_to') && params.year_to) {
		query = query.lte('publication_info->>c', params.year_to);
	}

	// Dynamic facet filters
	if (!excludeParams.includes('material_types') && params.material_types?.length) {
		query = query.in('material_type', params.material_types);
	}

	if (!excludeParams.includes('languages') && params.languages?.length) {
		query = query.in('language_code', params.languages);
	}

	return query;
}

/**
 * Format material type for display
 */
function formatMaterialType(type: string): string {
	const typeMap: Record<string, string> = {
		book: 'Books',
		ebook: 'E-Books',
		serial: 'Serials/Journals',
		audiobook: 'Audiobooks',
		dvd: 'DVDs',
		cdrom: 'CD-ROMs',
		electronic: 'Electronic Resources',
		manuscript: 'Manuscripts',
		map: 'Maps',
		music: 'Music',
		'visual-material': 'Visual Materials'
	};
	return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format language code for display
 */
function formatLanguage(code: string): string {
	const languageMap: Record<string, string> = {
		eng: 'English',
		spa: 'Spanish',
		fre: 'French',
		ger: 'German',
		ita: 'Italian',
		rus: 'Russian',
		chi: 'Chinese',
		jpn: 'Japanese',
		ara: 'Arabic',
		por: 'Portuguese'
	};
	return languageMap[code] || code.toUpperCase();
}
