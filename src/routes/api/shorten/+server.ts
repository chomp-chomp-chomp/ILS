import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const supabase = locals.supabase;

	try {
		const { fullUrl, resourceType, resourceId } = await request.json();

		if (!fullUrl) {
			return json({ error: 'Missing fullUrl parameter' }, { status: 400 });
		}

		// Create short URL using database function
		const { data, error } = await supabase.rpc('create_short_url', {
			p_full_url: fullUrl,
			p_resource_type: resourceType || null,
			p_resource_id: resourceId || null
		});

		if (error) {
			console.error('Short URL creation error:', error);
			return json({ error: 'Failed to create short URL' }, { status: 500 });
		}

		// Build short URL
		const origin = url.origin;
		const shortUrl = `${origin}/r/${data}`;

		return json({
			code: data,
			shortUrl,
			fullUrl
		});
	} catch (error) {
		console.error('API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
