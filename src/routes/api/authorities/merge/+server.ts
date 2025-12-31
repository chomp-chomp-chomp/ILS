import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Merge duplicate authorities into a single canonical record.
 * - Reassigns MARC links to the target authority
 * - Moves cross-references
 * - Merges variant forms (deduped)
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const { source_id, target_id } = await request.json();

	if (!source_id || !target_id) {
		throw error(400, 'source_id and target_id are required');
	}

	if (source_id === target_id) {
		throw error(400, 'Source and target authorities must be different');
	}

	try {
		const [{ data: source }, { data: target }] = await Promise.all([
			supabase.from('authorities').select('*').eq('id', source_id).single(),
			supabase.from('authorities').select('*').eq('id', target_id).single()
		]);

		if (!source || !target) {
			throw error(404, 'Authority not found');
		}

		// Merge variant forms and ensure the source heading is preserved as a variant
		const mergedVariants = Array.from(
			new Set(
				[
					...(target.variant_forms || []),
					...(source.variant_forms || []),
					source.heading !== target.heading ? source.heading : null
				].filter(Boolean) as string[]
			)
		);

		// Move cross references from source to target (deduping by ref_type + text)
		const { data: targetRefs } = await supabase
			.from('authority_cross_refs')
			.select('ref_type, reference_text')
			.eq('authority_id', target_id);

		const existingRefKeys = new Set(
			(targetRefs || []).map((ref: any) => `${ref.ref_type}:${ref.reference_text}`)
		);

		const { data: sourceRefs } = await supabase
			.from('authority_cross_refs')
			.select('*')
			.eq('authority_id', source_id);

		if (sourceRefs && sourceRefs.length > 0) {
			const refsToMove = sourceRefs
				.filter(
					(ref) => !existingRefKeys.has(`${ref.ref_type}:${ref.reference_text}`)
				)
				.map((ref) => ({
					ref_type: ref.ref_type,
					reference_text: ref.reference_text,
					related_authority_id: ref.related_authority_id,
					note: ref.note,
					authority_id: target_id
				}));

			if (refsToMove.length > 0) {
				const { error: moveRefsError } = await supabase.from('authority_cross_refs').insert(refsToMove);
				if (moveRefsError) throw moveRefsError;
			}
		}

		// Reassign MARC authority links
		const { data: sourceLinks } = await supabase
			.from('marc_authority_links')
			.select('*')
			.eq('authority_id', source_id);

		for (const link of sourceLinks || []) {
			const { error: upsertError } = await supabase
				.from('marc_authority_links')
				.upsert(
					{
						marc_record_id: link.marc_record_id,
						marc_field: link.marc_field,
						field_index: link.field_index ?? 0,
						authority_id: target_id,
						is_automatic: link.is_automatic,
						confidence: link.confidence,
						created_by: link.created_by
					},
					{ onConflict: 'marc_record_id,marc_field,field_index' }
				);

			if (upsertError) throw upsertError;
		}

		// Update the target authority with merged variants
		const { data: updatedTarget, error: updateError } = await supabase
			.from('authorities')
			.update({
				variant_forms: mergedVariants,
				updated_by: session.user.id
			})
			.eq('id', target_id)
			.select()
			.single();

		if (updateError) throw updateError;

		// Delete the source authority now that links and refs are moved
		const { error: deleteError } = await supabase.from('authorities').delete().eq('id', source_id);
		if (deleteError) throw deleteError;

		// Log merge for both records
		await supabase.from('authority_update_log').insert([
			{
				authority_id: target_id,
				action: 'merged',
				old_value: source,
				new_value: updatedTarget,
				performed_by: session.user.id,
				note: `Merged authority ${source.heading} into ${target.heading}`
			},
			{
				authority_id: source_id,
				action: 'merged',
				old_value: source,
				new_value: { merged_into: target_id },
				performed_by: session.user.id,
				note: `Merged into ${target.heading}`
			}
		]);

		return json({
			merged: true,
			target: updatedTarget
		});
	} catch (err: any) {
		console.error('Error merging authorities:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to merge authorities');
	}
};
