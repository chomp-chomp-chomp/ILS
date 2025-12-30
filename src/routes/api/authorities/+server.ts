import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Authority Control API Endpoint
 *
 * GET    - Search/list authorities
 * POST   - Create new authority
 * PUT    - Update authority
 * DELETE - Delete authority
 */

// GET - Search authorities
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const query = url.searchParams.get('q') || '';
	const type = url.searchParams.get('type');
	const source = url.searchParams.get('source');
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');
	const offset = (page - 1) * limit;

	try {
		let dbQuery = supabase
			.from('authorities')
			.select('*, authority_cross_refs(*)', { count: 'exact' });

		// Filter by type if specified
		if (type) {
			dbQuery = dbQuery.eq('type', type);
		}

		// Filter by source if specified
		if (source) {
			dbQuery = dbQuery.eq('source', source);
		}

		// Search query
		if (query) {
			// Use the search_authorities function for fuzzy matching
			const { data: searchResults, error: searchError } = await supabase.rpc(
				'search_authorities',
				{
					search_term: query,
					authority_type: type,
					limit_count: limit
				}
			);

			if (searchError) throw searchError;

			// Get full authority records with cross-references
			if (searchResults && searchResults.length > 0) {
				const ids = searchResults.map((r: any) => r.id);
				const { data: fullRecords, error: fullError } = await supabase
					.from('authorities')
					.select('*, authority_cross_refs(*)')
					.in('id', ids);

				if (fullError) throw fullError;

				// Sort by similarity score from search results
				const sortedRecords = fullRecords?.sort((a, b) => {
					const scoreA = searchResults.find((r: any) => r.id === a.id)?.similarity_score || 0;
					const scoreB = searchResults.find((r: any) => r.id === b.id)?.similarity_score || 0;
					return scoreB - scoreA;
				});

				return json({
					authorities: sortedRecords || [],
					total: sortedRecords?.length || 0,
					page,
					limit
				});
			}

			return json({
				authorities: [],
				total: 0,
				page,
				limit
			});
		}

		// No search query - just list with pagination
		dbQuery = dbQuery
			.order('usage_count', { ascending: false })
			.order('heading', { ascending: true })
			.range(offset, offset + limit - 1);

		const { data, error: dbError, count } = await dbQuery;

		if (dbError) throw dbError;

		return json({
			authorities: data || [],
			total: count || 0,
			page,
			limit
		});
	} catch (err) {
		console.error('Error fetching authorities:', err);
		throw error(500, 'Failed to fetch authorities');
	}
};

// POST - Create new authority
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const {
			heading,
			type,
			source = 'local',
			lccn,
			viaf_id,
			fast_id,
			note,
			birth_date,
			death_date,
			variant_forms,
			marc_authority,
			cross_references
		} = body;

		// Validate required fields
		if (!heading || !type) {
			throw error(400, 'Heading and type are required');
		}

		// Create authority record
		const { data: authority, error: authError } = await supabase
			.from('authorities')
			.insert({
				heading,
				type,
				source,
				lccn,
				viaf_id,
				fast_id,
				note,
				birth_date,
				death_date,
				variant_forms,
				marc_authority,
				created_by: session.user.id,
				updated_by: session.user.id
			})
			.select()
			.single();

		if (authError) throw authError;

		// Create cross-references if provided
		if (cross_references && cross_references.length > 0) {
			const refs = cross_references.map((ref: any) => ({
				authority_id: authority.id,
				ref_type: ref.ref_type,
				reference_text: ref.reference_text,
				related_authority_id: ref.related_authority_id,
				note: ref.note
			}));

			const { error: refError } = await supabase
				.from('authority_cross_refs')
				.insert(refs);

			if (refError) throw refError;
		}

		// Create "see_from" references for variant forms
		if (variant_forms && variant_forms.length > 0) {
			const variantRefs = variant_forms.map((variant: string) => ({
				authority_id: authority.id,
				ref_type: 'see_from',
				reference_text: variant,
				note: 'Non-authorized form'
			}));

			const { error: variantError } = await supabase
				.from('authority_cross_refs')
				.insert(variantRefs);

			if (variantError) throw variantError;
		}

		// Log the creation
		await supabase.from('authority_update_log').insert({
			authority_id: authority.id,
			action: 'created',
			new_value: authority,
			performed_by: session.user.id
		});

		return json({ authority }, { status: 201 });
	} catch (err: any) {
		console.error('Error creating authority:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to create authority');
	}
};

// PUT - Update authority
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { id, ...updates } = body;

		if (!id) {
			throw error(400, 'Authority ID is required');
		}

		// Get old value for logging
		const { data: oldAuthority } = await supabase
			.from('authorities')
			.select('*')
			.eq('id', id)
			.single();

		// Update authority
		const { data: authority, error: authError } = await supabase
			.from('authorities')
			.update({
				...updates,
				updated_by: session.user.id
			})
			.eq('id', id)
			.select()
			.single();

		if (authError) throw authError;

		// Log the update
		await supabase.from('authority_update_log').insert({
			authority_id: id,
			action: 'updated',
			old_value: oldAuthority,
			new_value: authority,
			performed_by: session.user.id
		});

		return json({ authority });
	} catch (err: any) {
		console.error('Error updating authority:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to update authority');
	}
};

// DELETE - Delete authority
export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const id = url.searchParams.get('id');
	if (!id) {
		throw error(400, 'Authority ID is required');
	}

	try {
		// Check if authority is in use
		const { count } = await supabase
			.from('marc_authority_links')
			.select('*', { count: 'exact', head: true })
			.eq('authority_id', id);

		if (count && count > 0) {
			throw error(400, `Cannot delete authority: in use by ${count} bibliographic record(s)`);
		}

		// Get authority for logging
		const { data: authority } = await supabase
			.from('authorities')
			.select('*')
			.eq('id', id)
			.single();

		// Delete authority (cascade will delete cross-references)
		const { error: deleteError } = await supabase
			.from('authorities')
			.delete()
			.eq('id', id);

		if (deleteError) throw deleteError;

		// Log the deletion
		await supabase.from('authority_update_log').insert({
			authority_id: id,
			action: 'deleted',
			old_value: authority,
			performed_by: session.user.id
		});

		return json({ success: true });
	} catch (err: any) {
		console.error('Error deleting authority:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to delete authority');
	}
};
