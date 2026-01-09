import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const authorityId = params.id;

	const { data: authority, error: fetchError } = await supabase
		.from('authorities')
		.select(
			`
			*,
			authority_cross_refs (*),
			marc_authority_links (
				marc_field,
				field_index,
				confidence,
				is_automatic,
				marc_records:marc_record_id (
					id,
					title_statement,
					material_type
				)
			)
		`
		)
		.eq('id', authorityId)
		.single();

	if (fetchError || !authority) {
		throw error(404, 'Authority not found');
	}

	const { data: candidates } = await supabase.rpc('search_authorities', {
		search_term: authority.heading,
		authority_type: authority.type,
		limit_count: 6
	});

	const mergeCandidates = (candidates || []).filter((candidate: any) => candidate.id !== authorityId);

	return {
		authority,
		authorityId,
		mergeCandidates
	};
};
