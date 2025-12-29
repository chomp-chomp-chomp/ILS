import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const body = await request.json();

		const {
			title,
			slug,
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
		if (!title || !slug) {
			throw error(400, 'Title and slug are required');
		}

		// Insert the page
		const { data, error: insertError } = await supabase
			.from('pages')
			.insert({
				title,
				slug,
				content: content || null,
				excerpt: excerpt || null,
				meta_description: meta_description || null,
				meta_keywords: meta_keywords || null,
				is_published: is_published || false,
				show_in_menu: show_in_menu || false,
				menu_order: menu_order || 0,
				menu_label: menu_label || null,
				layout: layout || 'default',
				created_by: session.user.id,
				updated_by: session.user.id
			})
			.select()
			.single();

		if (insertError) {
			console.error('Error inserting page:', insertError);

			// Check for unique constraint violation
			if (insertError.code === '23505') {
				throw error(400, 'A page with this slug already exists');
			}

			throw error(500, 'Failed to create page');
		}

		return json({ success: true, ...data });
	} catch (err) {
		console.error('Pages API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
