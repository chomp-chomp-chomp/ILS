import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { session } = await safeGetSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const recordId = formData.get('recordId') as string;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!recordId) {
			return json({ error: 'No record ID provided' }, { status: 400 });
		}

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowedTypes.includes(file.type)) {
			return json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' }, { status: 400 });
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
		}

		// Generate unique filename
		const fileExt = file.name.split('.').pop();
		const fileName = `${recordId}-${Date.now()}.${fileExt}`;
		const filePath = `covers/${fileName}`;

		// Convert File to ArrayBuffer
		const arrayBuffer = await file.arrayBuffer();
		const fileBuffer = new Uint8Array(arrayBuffer);

		// Upload to Supabase Storage
		const { data: uploadData, error: uploadError } = await supabase.storage
			.from('cover-images')
			.upload(filePath, fileBuffer, {
				contentType: file.type,
				upsert: false
			});

		if (uploadError) {
			console.error('Upload error:', uploadError);
			return json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
		}

		// Get public URL
		const { data: urlData } = supabase.storage
			.from('cover-images')
			.getPublicUrl(filePath);

		const publicUrl = urlData.publicUrl;

		// Update marc_records with cover URL
		const { error: updateError } = await supabase
			.from('marc_records')
			.update({ cover_image_url: publicUrl })
			.eq('id', recordId);

		if (updateError) {
			console.error('Database update error:', updateError);
			// Try to delete the uploaded file if database update fails
			await supabase.storage.from('cover-images').remove([filePath]);
			return json({ error: 'Failed to update record' }, { status: 500 });
		}

		return json({
			success: true,
			coverUrl: publicUrl,
			message: 'Cover uploaded successfully'
		});

	} catch (error) {
		console.error('Cover upload error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { session } = await safeGetSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { recordId } = await request.json();

		if (!recordId) {
			return json({ error: 'No record ID provided' }, { status: 400 });
		}

		// Get current cover URL to extract filename
		const { data: record } = await supabase
			.from('marc_records')
			.select('cover_image_url')
			.eq('id', recordId)
			.single();

		if (record?.cover_image_url) {
			// Extract filename from URL
			const url = new URL(record.cover_image_url);
			const pathParts = url.pathname.split('/');
			const fileName = pathParts[pathParts.length - 1];
			const filePath = `covers/${fileName}`;

			// Delete from storage
			await supabase.storage.from('cover-images').remove([filePath]);
		}

		// Remove cover URL from database
		const { error: updateError } = await supabase
			.from('marc_records')
			.update({ cover_image_url: null })
			.eq('id', recordId);

		if (updateError) {
			return json({ error: 'Failed to remove cover from record' }, { status: 500 });
		}

		return json({
			success: true,
			message: 'Cover removed successfully'
		});

	} catch (error) {
		console.error('Cover delete error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
