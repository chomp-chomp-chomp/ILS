import type { PageServerLoad } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	loadFacetConfigs,
	computeDynamicFacets,
	type DynamicFacetGroup
} from '$lib/utils/facets';
import { normalizeSearchQuery } from '$lib/utils/text-normalize';

export interface SearchParams {
	q?: string;
	title?: string;
	author?: string;
	subject?: string;
	isbn?: string;
	publisher?: string;
	year_from?: string;
	year_to?: string;
	type?: string;
	op?: 'AND' | 'OR';
	// Facet filters
	material_types?: string[];
	languages?: string[];
	availability?: string[];
	locations?: string[];
	// Pagination & sorting
	page?: number;
	per_page?: number;
	sort?: 'relevance' | 'title' | 'date_new' | 'date_old' | 'author';
}

export interface Facet {
	value: string;
	label: string;
	count: number;
}

export interface FacetGroup {
	material_types?: Facet[];
	languages?: Facet[];
	publication_years?: Facet[];
	availability?: Facet[];
	locations?: Facet[];
	[key: string]: Facet[] | undefined; // Allow dynamic facet keys
}

export interface SpellSuggestion {
	suggested_query: string;
	confidence: number;
}

export interface SearchConfiguration {
	enable_facets: boolean;
	enable_spell_correction: boolean;
	enable_advanced_search: boolean;
	results_per_page: number;
	enable_boolean_operators?: boolean;
	default_sort?: string;
	[key: string]: any; // Allow additional properties
}

export interface SearchResult {
	results: any[];
	facets: FacetGroup | DynamicFacetGroup;
	facetConfigs: any[];
	total: number;
	page: number;
	per_page: number;
	query: SearchParams;
	spellSuggestion?: SpellSuggestion;
}

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const supabase = locals.supabase as SupabaseClient;
	
	// Get parent layout data (includes branding)
	const parentData = await parent();

	// Parse query parameters
	const params: SearchParams = {
		q: url.searchParams.get('q') || undefined,
		title: url.searchParams.get('title') || undefined,
		author: url.searchParams.get('author') || undefined,
		subject: url.searchParams.get('subject') || undefined,
		isbn: url.searchParams.get('isbn') || undefined,
		publisher: url.searchParams.get('publisher') || undefined,
		year_from: url.searchParams.get('year_from') || undefined,
		year_to: url.searchParams.get('year_to') || undefined,
		type: url.searchParams.get('type') || undefined,
		op: (url.searchParams.get('op') as 'AND' | 'OR') || 'AND',
		material_types: url.searchParams.getAll('material_types'),
		languages: url.searchParams.getAll('languages'),
		availability: url.searchParams.getAll('availability'),
		locations: url.searchParams.getAll('locations'),
		page: parseInt(url.searchParams.get('page') || '1'),
		per_page: parseInt(url.searchParams.get('per_page') || '20'),
		sort: (url.searchParams.get('sort') as any) || 'relevance'
	};

	// Load search configuration safely (non-fatal if missing)
	const searchConfig = await loadSearchConfig(supabase);

	try {
		// Load facet configurations
		const facetConfigs = await loadFacetConfigs(supabase);

		// Perform search with dynamic facets
		const [results, facets] = await Promise.all([
			performSearch(supabase, params),
			computeDynamicFacets(supabase, facetConfigs, params)
		]);

		// Check if we should suggest spell corrections
		let spellSuggestion: SpellSuggestion | undefined;

		// Only suggest corrections for keyword searches with few/no results
		if (params.q && results.total < 5) {
			const suggestion = await getSpellSuggestion(supabase, params.q);
			if (suggestion) {
				spellSuggestion = suggestion;
			}
		}

		return {
			...results,
			facets,
			facetConfigs,
			query: params,
			spellSuggestion,
			branding: parentData.branding,
			searchConfig
		};
	} catch (error) {
		console.error('Search error:', error);
		return {
			results: [],
			facets: {},
			facetConfigs: [],
			total: 0,
			page: params.page || 1,
			per_page: params.per_page || 20,
			query: params,
			branding: parentData.branding,
			searchConfig,
			error: error instanceof Error ? error.message : 'Search failed'
		};
	}
};

async function performAdvancedSearch(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<{ results: any[]; total: number }> {
	// Use the RPC function for diacritic-insensitive advanced search
	const { data, error } = await supabase.rpc('search_marc_records_advanced', {
		search_title: params.title || null,
		search_author: params.author || null,
		search_subject: params.subject || null,
		search_isbn: params.isbn || null,
		search_publisher: params.publisher || null,
		search_year_from: params.year_from || null,
		search_year_to: params.year_to || null,
		search_material_type: params.type || null,
		search_operator: params.op || 'AND'
	});

	if (error) {
		console.error('Advanced search RPC error:', error);
		throw error;
	}

	let results = data || [];

	// Apply additional filters that aren't in the RPC function
	// Material type filter (from facets, in addition to the type param)
	const materialTypes = [...(params.material_types || [])];
	if (params.type && !materialTypes.includes(params.type)) {
		materialTypes.push(params.type);
	}
	if (materialTypes.length > 0) {
		results = results.filter((record: any) => materialTypes.includes(record.material_type));
	}

	// Language filter (from facets)
	if (params.languages && params.languages.length > 0) {
		results = results.filter((record: any) => params.languages?.includes(record.language_code));
	}

	// Fetch items for each record (the RPC doesn't include items)
	const recordIds = results.map((r: any) => r.id);
	if (recordIds.length > 0) {
		const { data: itemsData } = await supabase
			.from('items')
			.select('*')
			.in('marc_record_id', recordIds);

		// Attach items to records
		results = results.map((record: any) => ({
			...record,
			items: itemsData?.filter((item) => item.marc_record_id === record.id) || []
		}));
	}

	// Apply availability filter (post-process)
	if (params.availability && params.availability.length > 0) {
		results = results.filter((record: any) => {
			const items = record.items || [];
			if (params.availability?.includes('available')) {
				return items.some((item: any) => item.status === 'available');
			}
			if (params.availability?.includes('checked_out')) {
				return items.some((item: any) => item.status === 'checked_out');
			}
			if (params.availability?.includes('unavailable')) {
				return items.every((item: any) => item.status !== 'available');
			}
			return true;
		});
	}

	// Apply location filter (post-process)
	if (params.locations && params.locations.length > 0) {
		results = results.filter((record: any) => {
			const items = record.items || [];
			return items.some((item: any) => params.locations?.includes(item.location));
		});
	}

	// Apply sorting
	results = applySorting(results, params);

	// Apply pagination
	const page = params.page || 1;
	const perPage = params.per_page || 20;
	const total = results.length;
	const from = (page - 1) * perPage;
	const to = from + perPage;

	results = results.slice(from, to);

	return {
		results,
		total
	};
}

function applySorting(results: any[], params: SearchParams): any[] {
	switch (params.sort) {
		case 'title':
			return results.sort((a, b) => {
				const titleA = (a.title_statement?.a || '').toLowerCase();
				const titleB = (b.title_statement?.a || '').toLowerCase();
				return titleA.localeCompare(titleB);
			});
		case 'author':
			return results.sort((a, b) => {
				const authorA = (a.main_entry_personal_name?.a || '').toLowerCase();
				const authorB = (b.main_entry_personal_name?.a || '').toLowerCase();
				return authorA.localeCompare(authorB);
			});
		case 'date_new':
			return results.sort((a, b) => {
				const yearA = parseInt(a.publication_info?.c || '0');
				const yearB = parseInt(b.publication_info?.c || '0');
				return yearB - yearA;
			});
		case 'date_old':
			return results.sort((a, b) => {
				const yearA = parseInt(a.publication_info?.c || '0');
				const yearB = parseInt(b.publication_info?.c || '0');
				return yearA - yearB;
			});
		case 'relevance':
		default:
			// For advanced search, relevance sorting is not applicable
			// Default to title sort
			return results.sort((a, b) => {
				const titleA = (a.title_statement?.a || '').toLowerCase();
				const titleB = (b.title_statement?.a || '').toLowerCase();
				return titleA.localeCompare(titleB);
			});
	}
}

async function performSearch(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<{ results: any[]; total: number }> {
	// Check if this is an advanced search (has any advanced search fields)
	const isAdvancedSearch =
		params.title || params.author || params.subject || params.isbn || params.publisher;

	// If advanced search, use the RPC function for diacritic-insensitive field matching
	if (isAdvancedSearch) {
		return await performAdvancedSearch(supabase, params);
	}

	// Otherwise, use the standard basic keyword search
	// For diacritic-insensitive search, use RPC function
	if (params.q) {
		// Use RPC function for diacritic-insensitive search
		// This function normalizes the query and searches against the normalized search_vector
		const { data: searchResults, error: searchError } = await supabase.rpc(
			'search_marc_records_basic',
			{ search_query: params.q }
		);

		if (searchError) {
			console.error('Basic search RPC error:', searchError);
			throw searchError;
		}

		let results = searchResults || [];

		// Fetch items for each record (RPC doesn't include items)
		const recordIds = results.map((r: any) => r.id);
		if (recordIds.length > 0) {
			const { data: itemsData } = await supabase
				.from('items')
				.select('*')
				.in('marc_record_id', recordIds);

			// Attach items to records
			results = results.map((record: any) => ({
				...record,
				items: itemsData?.filter((item) => item.marc_record_id === record.id) || []
			}));
		}

		// Apply additional filters
		// Material type filter
		const materialTypes = [...(params.material_types || [])];
		if (params.type && !materialTypes.includes(params.type)) {
			materialTypes.push(params.type);
		}
		if (materialTypes.length > 0) {
			results = results.filter((record: any) => materialTypes.includes(record.material_type));
		}

		// Language filter
		if (params.languages && params.languages.length > 0) {
			results = results.filter((record: any) => params.languages?.includes(record.language_code));
		}

		// Year range filter
		if (params.year_from || params.year_to) {
			results = results.filter((record: any) => {
				const year = record.publication_info?.c;
				if (!year) return false;
				const yearNum = parseInt(year);
				if (params.year_from && yearNum < parseInt(params.year_from)) return false;
				if (params.year_to && yearNum > parseInt(params.year_to)) return false;
				return true;
			});
		}

		// Apply availability filter (post-process)
		if (params.availability && params.availability.length > 0) {
			results = results.filter((record: any) => {
				const items = record.items || [];
				if (params.availability?.includes('available')) {
					return items.some((item: any) => item.status === 'available');
				}
				if (params.availability?.includes('checked_out')) {
					return items.some((item: any) => item.status === 'checked_out');
				}
				if (params.availability?.includes('unavailable')) {
					return items.every((item: any) => item.status !== 'available');
				}
				return true;
			});
		}

		// Apply location filter (post-process)
		if (params.locations && params.locations.length > 0) {
			results = results.filter((record: any) => {
				const items = record.items || [];
				return items.some((item: any) => params.locations?.includes(item.location));
			});
		}

		// Apply sorting (RPC already sorts by relevance, but allow other sorts)
		results = applySorting(results, params);

		// Apply pagination
		const page = params.page || 1;
		const perPage = params.per_page || 20;
		const total = results.length;
		const from = (page - 1) * perPage;
		const to = from + perPage;

		results = results.slice(from, to);

		return {
			results,
			total
		};
	}

	// If no keyword search, build standard query
	let query = supabase
		.from('marc_records')
		.select(
			`
			*,
			items:items(
				id,
				barcode,
				status,
				location,
				collection,
				material_type,
				call_number,
				is_electronic,
				url,
				access_restrictions
			)
		`,
			{ count: 'exact' }
		)
		// IMPORTANT: Only show active, public records in the OPAC
		.eq('status', 'active')
		.eq('visibility', 'public');

	// Year range filter
	if (params.year_from || params.year_to) {
		if (params.year_from) {
			query = query.gte('publication_info->>c', params.year_from);
		}
		if (params.year_to) {
			query = query.lte('publication_info->>c', params.year_to);
		}
	}

	// Material type filter (from advanced search OR facet)
	const materialTypes = [...(params.material_types || [])];
	if (params.type && !materialTypes.includes(params.type)) {
		materialTypes.push(params.type);
	}
	if (materialTypes.length > 0) {
		query = query.in('material_type', materialTypes);
	}

	// Language filter (from facets)
	if (params.languages && params.languages.length > 0) {
		query = query.in('language_code', params.languages);
	}

	// Location filter (from facets)
	// Note: This requires filtering on items, which is tricky with Supabase
	// For now, we'll handle this in post-processing

	// Sorting
	switch (params.sort) {
		case 'title':
			query = query.order('title_statement->a', { ascending: true });
			break;
		case 'author':
			query = query.order('main_entry_personal_name->a', { ascending: true });
			break;
		case 'date_new':
			query = query.order('publication_info->c', { ascending: false, nullsFirst: false });
			break;
		case 'date_old':
			query = query.order('publication_info->c', { ascending: true, nullsFirst: false });
			break;
		case 'relevance':
		default:
			// For full-text search, results are already sorted by ts_rank (relevance)
			// The search_vector trigger uses these weights:
			// - 'A' (highest): title, author
			// - 'B' (high): subtitle, subjects
			// - 'C' (medium): publisher
			// - 'D' (low): summary

			// For non-full-text searches, sort by title
			if (!params.q) {
				query = query.order('title_statement->a', { ascending: true });
			}
			// Note: You can't easily boost by recency in Supabase without RPC
			// For advanced relevance, consider creating a custom RPC function
			break;
	}

	// Pagination
	const page = params.page || 1;
	const perPage = params.per_page || 20;
	const from = (page - 1) * perPage;
	const to = from + perPage - 1;

	query = query.range(from, to);

	const { data, error, count } = await query;

	if (error) {
		console.error('Search query error:', error);
		throw error;
	}

	// Post-process for availability and location filters
	let results = data || [];

	// Filter by availability
	if (params.availability && params.availability.length > 0) {
		results = results.filter((record) => {
			const items = record.items || [];
			if (params.availability?.includes('available')) {
				return items.some((item: any) => item.status === 'available');
			}
			if (params.availability?.includes('checked_out')) {
				return items.some((item: any) => item.status === 'checked_out');
			}
			if (params.availability?.includes('unavailable')) {
				return items.every((item: any) => item.status !== 'available');
			}
			return true;
		});
	}

	// Filter by location
	if (params.locations && params.locations.length > 0) {
		results = results.filter((record) => {
			const items = record.items || [];
			return items.some((item: any) => params.locations?.includes(item.location));
		});
	}

	return {
		results,
		total: count || 0
	};
}

async function computeFacets(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<FacetGroup> {
	// For facets, we need to run the same base query but without the facet filters
	// and without pagination, then aggregate the results

	// Material Type Facet
	const materialTypeFacet = await computeMaterialTypeFacet(supabase, params);

	// Language Facet
	const languageFacet = await computeLanguageFacet(supabase, params);

	// Publication Year Facet (bucketed by decade)
	const yearFacet = await computeYearFacet(supabase, params);

	// Availability Facet
	const availabilityFacet = await computeAvailabilityFacet(supabase, params);

	// Location Facet
	const locationFacet = await computeLocationFacet(supabase, params);

	return {
		material_types: materialTypeFacet,
		languages: languageFacet,
		publication_years: yearFacet,
		availability: availabilityFacet,
		locations: locationFacet
	};
}

async function computeMaterialTypeFacet(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<Facet[]> {
	// Build base query without material_type filter
	let query = supabase.from('marc_records').select('material_type');

	query = applyBaseFilters(query, params, ['material_types', 'type']);

	const { data, error } = await query;

	if (error || !data) return [];

	// Count occurrences
	const counts = new Map<string, number>();
	data.forEach((record) => {
		if (record.material_type) {
			counts.set(record.material_type, (counts.get(record.material_type) || 0) + 1);
		}
	});

	// Convert to facet format
	const facets: Facet[] = Array.from(counts.entries())
		.map(([value, count]) => ({
			value,
			label: formatMaterialType(value),
			count
		}))
		.sort((a, b) => b.count - a.count);

	return facets;
}

async function computeLanguageFacet(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<Facet[]> {
	let query = supabase.from('marc_records').select('language_code');

	query = applyBaseFilters(query, params, ['languages']);

	const { data, error } = await query;

	if (error || !data) return [];

	const counts = new Map<string, number>();
	data.forEach((record) => {
		if (record.language_code) {
			counts.set(record.language_code, (counts.get(record.language_code) || 0) + 1);
		}
	});

	const facets: Facet[] = Array.from(counts.entries())
		.map(([value, count]) => ({
			value,
			label: formatLanguage(value),
			count
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10); // Top 10 languages

	return facets;
}

async function computeYearFacet(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<Facet[]> {
	let query = supabase.from('marc_records').select('publication_info');

	query = applyBaseFilters(query, params, ['year_from', 'year_to']);

	const { data, error } = await query;

	if (error || !data) return [];

	// Extract years and bucket by decade
	const decades = new Map<string, number>();
	data.forEach((record) => {
		const year = record.publication_info?.c;
		if (year && /^\d{4}/.test(year)) {
			const yearNum = parseInt(year.substring(0, 4));
			const decade = Math.floor(yearNum / 10) * 10;
			const decadeLabel = `${decade}s`;
			decades.set(decadeLabel, (decades.get(decadeLabel) || 0) + 1);
		}
	});

	const facets: Facet[] = Array.from(decades.entries())
		.map(([value, count]) => ({
			value,
			label: value,
			count
		}))
		.sort((a, b) => {
			// Sort by decade descending (newest first)
			const aDecade = parseInt(a.value);
			const bDecade = parseInt(b.value);
			return bDecade - aDecade;
		})
		.slice(0, 10); // Top 10 decades

	return facets;
}

async function computeAvailabilityFacet(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<Facet[]> {
	// This requires joining with items table
	let query = supabase.from('marc_records').select(
		`
		id,
		items:items(status)
	`
	);

	query = applyBaseFilters(query, params, ['availability']);

	const { data, error } = await query;

	if (error || !data) return [];

	// Count availability
	let availableCount = 0;
	let checkedOutCount = 0;
	let unavailableCount = 0;

	data.forEach((record) => {
		const items = (record as any).items || [];
		const hasAvailable = items.some((item: any) => item.status === 'available');
		const hasCheckedOut = items.some((item: any) => item.status === 'checked_out');

		if (hasAvailable) {
			availableCount++;
		} else if (hasCheckedOut) {
			checkedOutCount++;
		} else {
			unavailableCount++;
		}
	});

	return [
		{ value: 'available', label: 'Available Now', count: availableCount },
		{ value: 'checked_out', label: 'Checked Out', count: checkedOutCount },
		{ value: 'unavailable', label: 'Unavailable', count: unavailableCount }
	].filter((f) => f.count > 0);
}

async function computeLocationFacet(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<Facet[]> {
	// Get all items for matching records
	let query = supabase.from('marc_records').select(
		`
		id,
		items:items(location)
	`
	);

	query = applyBaseFilters(query, params, ['locations']);

	const { data, error } = await query;

	if (error || !data) return [];

	const counts = new Map<string, number>();
	data.forEach((record) => {
		const items = (record as any).items || [];
		const locations = new Set(items.map((item: any) => item.location).filter(Boolean));
		locations.forEach((location) => {
			counts.set(location as string, (counts.get(location as string) || 0) + 1);
		});
	});

	const facets: Facet[] = Array.from(counts.entries())
		.map(([value, count]) => ({
			value,
			label: value,
			count
		}))
		.sort((a, b) => b.count - a.count);

	return facets;
}

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

	// Material type filter
	if (!excludeParams.includes('material_types') && !excludeParams.includes('type')) {
		const materialTypes = [...(params.material_types || [])];
		if (params.type && !materialTypes.includes(params.type)) {
			materialTypes.push(params.type);
		}
		if (materialTypes.length > 0) {
			query = query.in('material_type', materialTypes);
		}
	}

	// Language filter
	if (!excludeParams.includes('languages') && params.languages && params.languages.length > 0) {
		query = query.in('language_code', params.languages);
	}

	return query;
}

// Helper functions for formatting
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
		// Add more as needed
	};
	return languageMap[code] || code.toUpperCase();
}

async function getSpellSuggestion(
	supabase: SupabaseClient,
	query: string
): Promise<SpellSuggestion | null> {
	try {
		// Call the PostgreSQL function for spell correction
		const { data, error } = await supabase.rpc('suggest_query_correction', {
			search_query: query
		});

		if (error) {
			console.error('Spell suggestion error:', error);
			return null;
		}

		// Return the first suggestion if available and confidence is reasonable
		if (data && data.length > 0) {
			const suggestion = data[0];
			// Only suggest if confidence is above threshold (40%)
			if (suggestion.confidence >= 0.4) {
				return {
					suggested_query: suggestion.suggested_query,
					confidence: suggestion.confidence
				};
			}
		}

		return null;
	} catch (error) {
		console.error('Spell suggestion exception:', error);
		return null;
	}
}

// Load search configuration safely (non-fatal if table/row missing)
async function loadSearchConfig(
	supabase: SupabaseClient
): Promise<SearchConfiguration> {
	try {
		const { data, error } = await supabase
			.from('search_configuration')
			.select('*')
			.eq('is_active', true)
			.maybeSingle();

		if (error) {
			console.warn('Search configuration not found, using defaults:', error);
		}

		// Return data or defaults if not found
		return data || {
			enable_facets: true,
			enable_spell_correction: true,
			enable_advanced_search: true,
			results_per_page: 20
		};
	} catch (error) {
		console.error('Error loading search configuration:', error);
		// Return safe defaults
		return {
			enable_facets: true,
			enable_spell_correction: true,
			enable_advanced_search: true,
			results_per_page: 20
		};
	}
}
