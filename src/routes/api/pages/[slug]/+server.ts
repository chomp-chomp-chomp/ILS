import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const { slug } = params;
		const body = await request.json();

		const {
			title,
			slug: newSlug,
			content,
			excerpt,
			meta_description,
			meta_keywords,
			is_published,
			show_in_menu,
			menu_order,
			menu_label,
			layout
		} = body;

		// Validate required fields
		if (!title || !newSlug) {
			throw error(400, 'Title and slug are required');
		}

		// Update the page
		const { data, error: updateError } = await supabase
			.from('pages')
			.update({
				title,
				slug: newSlug,
				content: content || null,
				excerpt: excerpt || null,
				meta_description: meta_description || null,
				meta_keywords: meta_keywords || null,
				is_published: is_published || false,
				show_in_menu: show_in_menu || false,
				menu_order: menu_order || 0,
				menu_label: menu_label || null,
				layout: layout || 'default',
				updated_by: session.user.id
			})
			.eq('slug', slug)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating page:', updateError);

			// Check for unique constraint violation
			if (updateError.code === '23505') {
				throw error(400, 'A page with this slug already exists');
			}

			throw error(500, 'Failed to update page');
		}

		return json({ success: true, ...data });
	} catch (err) {
		console.error('Update page API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};

export const DELETE: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const { slug } = params;

		if (!slug) {
			throw error(400, 'Slug is required');
		}

		const { error: deleteError } = await supabase.from('pages').delete().eq('slug', slug);

		if (deleteError) {
			console.error('Error deleting page:', deleteError);
			throw error(500, 'Failed to delete page');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Delete page API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
