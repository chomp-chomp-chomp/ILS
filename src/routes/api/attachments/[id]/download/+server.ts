import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { supabase } }) => {
	const { data: attachment, error: fetchError } = await supabase
		.from('marc_attachments')
		.select('*')
		.eq('id', params.id)
		.single();

	if (fetchError) {
		console.error('Error loading attachment', fetchError);
		throw error(404, 'Attachment not found');
	}

	if (!attachment) {
		throw error(404, 'Attachment not found');
	}

	if (attachment.external_expires_at && new Date(attachment.external_expires_at) < new Date()) {
		return json({ error: 'Attachment link has expired' }, { status: 410 });
	}

	await supabase.rpc('increment_attachment_download', { p_attachment_id: attachment.id });

	return new Response(null, {
		status: 302,
		headers: {
			Location: attachment.external_url,
			'Cache-Control': 'no-store'
		}
	});
};
