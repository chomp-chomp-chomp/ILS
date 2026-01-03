import type { PageServerLoad } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	loadFacetConfigs,
	computeDynamicFacets,
	type DynamicFacetGroup
} from '$lib/utils/facets';

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

export const load: PageServerLoad = async ({ url, locals }) => {
	const supabase = locals.supabase as SupabaseClient;

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
			spellSuggestion
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
			error: error instanceof Error ? error.message : 'Search failed'
		};
	}
};

async function performSearch(
	supabase: SupabaseClient,
	params: SearchParams
): Promise<{ results: any[]; total: number }> {
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
		);

	// Apply search filters
	const filters: string[] = [];

	// Basic keyword search using full-text search with relevance boosting
	if (params.q) {
		// Use PostgreSQL full-text search for relevance ranking
		query = query.textSearch('search_vector', params.q, {
			type: 'websearch',
			config: 'english'
		});

		// Add custom relevance scoring with field weights
		// This requires using .order() with a raw SQL expression
		// Higher weight = more important field
		// Format: setweight(to_tsvector(field), 'A') for highest priority
		// We'll order by ts_rank which already considers the search_vector
	}

	// Advanced search fields
	if (params.title) {
		filters.push(`title_statement->>a.ilike.%${params.title}%`);
	}
	if (params.author) {
		filters.push(`main_entry_personal_name->>a.ilike.%${params.author}%`);
	}
	if (params.isbn) {
		filters.push(`isbn.ilike.%${params.isbn.replace(/-/g, '')}%`);
	}
	if (params.publisher) {
		filters.push(`publication_info->>b.ilike.%${params.publisher}%`);
	}

	// Apply filters based on operator
	if (filters.length > 0) {
		if (params.op === 'OR') {
			query = query.or(filters.join(','));
		} else {
			// For AND, apply each filter separately
			filters.forEach((filter) => {
				const [field, op, value] = filter.split('.');
				if (op === 'ilike') {
					query = query.ilike(field, value);
				}
			});
		}
	}

	// Handle subject search separately (JSONB array requires special handling)
	if (params.subject) {
		// Use full-text search on search_vector since subjects are already indexed there
		// This provides better matching (partial words, relevance ranking)
		query = query.textSearch('search_vector', params.subject, {
			type: 'websearch',
			config: 'english'
		});
	}

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
