import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Authority Suggestion API
 *
 * Suggests authorized headings for cataloging workflow
 * Matches against existing authorities with fuzzy matching
 */

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const heading = url.searchParams.get('heading');
	const type = url.searchParams.get('type');
	const limit = parseInt(url.searchParams.get('limit') || '10');

	if (!heading) {
		throw error(400, 'Heading parameter is required');
	}

	try {
		// Use fuzzy search function
		const { data: suggestions, error: searchError } = await supabase.rpc('search_authorities', {
			search_term: heading,
			authority_type: type,
			limit_count: limit
		});

		if (searchError) throw searchError;

		// Get full records with cross-references
		if (suggestions && suggestions.length > 0) {
			const ids = suggestions.map((s: any) => s.id);
			const { data: fullRecords, error: fullError } = await supabase
				.from('authorities')
				.select(
					`
					*,
					authority_cross_refs (
						id,
						ref_type,
						reference_text,
						note
					)
				`
				)
				.in('id', ids);

			if (fullError) throw fullError;

			// Combine similarity scores with full records
			const results = fullRecords?.map((record) => {
				const suggestion = suggestions.find((s: any) => s.id === record.id);
				return {
					...record,
					similarity_score: suggestion?.similarity_score || 0
				};
			});

			// Sort by similarity score
			results?.sort((a, b) => b.similarity_score - a.similarity_score);

			return json({
				suggestions: results || [],
				count: results?.length || 0
			});
		}

		return json({
			suggestions: [],
			count: 0
		});
	} catch (err) {
		console.error('Error fetching authority suggestions:', err);
		throw error(500, 'Failed to fetch suggestions');
	}
};

/**
 * POST - Check if heading is authorized and link to MARC record
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { marc_record_id, heading, marc_field, field_index = 0, authority_id, type } = body;

		if (!marc_record_id || !marc_field) {
			throw error(400, 'MARC record ID and field are required');
		}

		let authorityIdToLink = authority_id;

		// If no authority_id provided, try to find matching authority
		if (!authorityIdToLink && heading) {
			const { data: matches } = await supabase.rpc('search_authorities', {
				search_term: heading,
				authority_type: type,
				limit_count: 1
			});

			if (matches && matches.length > 0 && matches[0].similarity_score > 0.9) {
				// High confidence match
				authorityIdToLink = matches[0].id;
			}
		}

		if (!authorityIdToLink) {
			return json({
				linked: false,
				message: 'No matching authority found'
			});
		}

		// Create or update link
		const { data: link, error: linkError } = await supabase
			.from('marc_authority_links')
			.upsert(
				{
					marc_record_id,
					authority_id: authorityIdToLink,
					marc_field,
					field_index,
					is_automatic: !authority_id, // If we found it automatically
					confidence: authority_id ? 1.0 : 0.9,
					created_by: session.user.id
				},
				{
					onConflict: 'marc_record_id,marc_field,field_index'
				}
			)
			.select()
			.single();

		if (linkError) throw linkError;

		return json({
			linked: true,
			link
		});
	} catch (err: any) {
		console.error('Error linking authority:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to link authority');
	}
};
