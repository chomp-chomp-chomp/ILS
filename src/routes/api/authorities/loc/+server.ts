import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Library of Congress Authority Integration
 *
 * Searches and imports authority records from:
 * - LCNAF (Library of Congress Name Authority File)
 * - LCSH (Library of Congress Subject Headings)
 *
 * Uses the LoC Linked Data Service API:
 * https://id.loc.gov/authorities/names.html
 * https://id.loc.gov/authorities/subjects.html
 */

interface LocAuthority {
	uri: string;
	label: string;
	lccn?: string;
	broader?: string[];
	narrower?: string[];
	related?: string[];
	variants?: string[];
	note?: string;
	birthDate?: string;
	deathDate?: string;
}

/**
 * GET - Search Library of Congress authorities
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const type = url.searchParams.get('type') || 'names'; // 'names' or 'subjects'
	const limit = parseInt(url.searchParams.get('limit') || '10');

	if (!query) {
		throw error(400, 'Query parameter is required');
	}

	try {
		// Determine LoC authority file to search
		const authorityType = type === 'subjects' ? 'subjects' : 'names';

		// Search LoC using their suggest API
		const searchUrl = `https://id.loc.gov/authorities/${authorityType}/suggest2/?q=${encodeURIComponent(
			query
		)}&count=${limit}`;

		const response = await fetch(searchUrl);

		if (!response.ok) {
			throw new Error(`LoC API error: ${response.statusText}`);
		}

		const data = await response.json();

		// Parse LoC response
		// Format: { query: "...", hits: [{ uri: "...", suggestLabel: "..." }] }
		const results = data.hits || [];

		// Fetch full details for each result
		const authorities = await Promise.all(
			results.slice(0, limit).map(async (hit: any) => {
				try {
					return await fetchLocAuthorityDetails(hit.uri);
				} catch (err) {
					console.error(`Error fetching details for ${hit.uri}:`, err);
					return {
						uri: hit.uri,
						label: hit.suggestLabel || hit.aLabel || 'Unknown',
						lccn: extractLccn(hit.uri)
					};
				}
			})
		);

		return json({
			authorities: authorities.filter((a) => a !== null),
			count: authorities.length,
			source: 'loc',
			bulkDownloads: {
				names: 'https://id.loc.gov/static/data/lcnaf.madsrdf.nt.gz',
				subjects: 'https://id.loc.gov/static/data/authoritiessubjects.madsrdf.nt.gz'
			}
		});
	} catch (err: any) {
		console.error('Error searching LoC authorities:', err);
		throw error(500, err.message || 'Failed to search Library of Congress');
	}
};

/**
 * POST - Import authority from Library of Congress
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { uri, lccn } = body;

		if (!uri && !lccn) {
			throw error(400, 'URI or LCCN is required');
		}

		// Fetch details from LoC
		const locAuthority = await fetchLocAuthorityDetails(uri || `https://id.loc.gov/authorities/names/${lccn}`);

		if (!locAuthority) {
			throw error(404, 'Authority not found at Library of Congress');
		}

		// Determine authority type
		const authorityType = determineAuthorityType(locAuthority.uri);

		// Check if already exists
		const { data: existing } = await supabase
			.from('authorities')
			.select('id')
			.eq('lccn', locAuthority.lccn)
			.single();

		if (existing) {
			return json({
				imported: false,
				message: 'Authority already exists',
				authority_id: existing.id
			});
		}

		// Create authority record
		const { data: authority, error: authError } = await supabase
			.from('authorities')
			.insert({
				heading: locAuthority.label,
				type: authorityType,
				source: authorityType.includes('subject') ? 'lcsh' : 'lcnaf',
				lccn: locAuthority.lccn,
				note: locAuthority.note,
				birth_date: locAuthority.birthDate,
				death_date: locAuthority.deathDate,
				variant_forms: locAuthority.variants || [],
				marc_authority: {
					uri: locAuthority.uri,
					broader: locAuthority.broader,
					narrower: locAuthority.narrower,
					related: locAuthority.related
				},
				last_sync_at: new Date().toISOString(),
				created_by: session.user.id,
				updated_by: session.user.id
			})
			.select()
			.single();

		if (authError) throw authError;

		// Create cross-references for variants
		if (locAuthority.variants && locAuthority.variants.length > 0) {
			const refs = locAuthority.variants.map((variant) => ({
				authority_id: authority.id,
				ref_type: 'see_from',
				reference_text: variant,
				note: 'Variant form from LoC'
			}));

			await supabase.from('authority_cross_refs').insert(refs);
		}

		// Create "see also" references for related terms
		if (locAuthority.related && locAuthority.related.length > 0) {
			const relatedRefs = locAuthority.related.map((related) => ({
				authority_id: authority.id,
				ref_type: 'see_also',
				reference_text: related,
				note: 'Related term from LoC'
			}));

			await supabase.from('authority_cross_refs').insert(relatedRefs);
		}

		// Log the import
		await supabase.from('authority_update_log').insert({
			authority_id: authority.id,
			action: 'synced_from_loc',
			new_value: authority,
			performed_by: session.user.id,
			note: `Imported from ${locAuthority.uri}`
		});

		return json({
			imported: true,
			authority
		});
	} catch (err: any) {
		console.error('Error importing LoC authority:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to import authority from Library of Congress');
	}
};

/**
 * Fetch detailed authority information from LoC
 */
async function fetchLocAuthorityDetails(uri: string): Promise<LocAuthority | null> {
	try {
		// Request JSON-LD format
		const response = await fetch(`${uri}.json`);

		if (!response.ok) {
			throw new Error(`LoC fetch error: ${response.status}`);
		}

		const data = await response.json();

		// Parse JSON-LD response
		// LoC returns an array with the main resource first
		const mainResource = Array.isArray(data) ? data[0] : data;

		const authority: LocAuthority = {
			uri,
			label: extractLabel(mainResource),
			lccn: extractLccn(uri)
		};

		// Extract variants (alternative labels)
		if (mainResource['skos:altLabel']) {
			authority.variants = Array.isArray(mainResource['skos:altLabel'])
				? mainResource['skos:altLabel'].map((v: any) => v['@value'] || v)
				: [mainResource['skos:altLabel']['@value'] || mainResource['skos:altLabel']];
		}

		// Extract broader terms
		if (mainResource['skos:broader']) {
			authority.broader = Array.isArray(mainResource['skos:broader'])
				? mainResource['skos:broader'].map((b: any) => b['@id'] || b)
				: [mainResource['skos:broader']['@id'] || mainResource['skos:broader']];
		}

		// Extract narrower terms
		if (mainResource['skos:narrower']) {
			authority.narrower = Array.isArray(mainResource['skos:narrower'])
				? mainResource['skos:narrower'].map((n: any) => n['@id'] || n)
				: [mainResource['skos:narrower']['@id'] || mainResource['skos:narrower']];
		}

		// Extract related terms
		if (mainResource['skos:related']) {
			authority.related = Array.isArray(mainResource['skos:related'])
				? mainResource['skos:related'].map((r: any) => r['@id'] || r)
				: [mainResource['skos:related']['@id'] || mainResource['skos:related']];
		}

		// Extract note
		if (mainResource['skos:note']) {
			const noteValue = Array.isArray(mainResource['skos:note'])
				? mainResource['skos:note'][0]
				: mainResource['skos:note'];
			authority.note = noteValue['@value'] || noteValue;
		}

		// Extract birth/death dates for personal names
		if (mainResource['schema:birthDate']) {
			authority.birthDate = mainResource['schema:birthDate'];
		}
		if (mainResource['schema:deathDate']) {
			authority.deathDate = mainResource['schema:deathDate'];
		}

		return authority;
	} catch (err) {
		console.error('Error fetching LoC authority details:', err);
		return null;
	}
}

/**
 * Extract primary label from LoC resource
 */
function extractLabel(resource: any): string {
	if (resource['skos:prefLabel']) {
		const label = Array.isArray(resource['skos:prefLabel'])
			? resource['skos:prefLabel'][0]
			: resource['skos:prefLabel'];
		return label['@value'] || label;
	}

	if (resource['rdfs:label']) {
		const label = Array.isArray(resource['rdfs:label'])
			? resource['rdfs:label'][0]
			: resource['rdfs:label'];
		return label['@value'] || label;
	}

	if (resource['@id']) {
		return resource['@id'].split('/').pop() || 'Unknown';
	}

	return 'Unknown';
}

/**
 * Extract LCCN from URI
 */
function extractLccn(uri: string): string {
	// URI format: https://id.loc.gov/authorities/names/n79021164
	const parts = uri.split('/');
	return parts[parts.length - 1];
}

/**
 * Determine authority type from URI
 */
function determineAuthorityType(uri: string): string {
	if (uri.includes('/names/')) {
		return 'personal_name'; // Default, could be refined based on MARC data
	}
	if (uri.includes('/subjects/')) {
		return 'topical_subject';
	}
	if (uri.includes('/genreForms/')) {
		return 'genre_form';
	}
	return 'personal_name'; // Default fallback
}
