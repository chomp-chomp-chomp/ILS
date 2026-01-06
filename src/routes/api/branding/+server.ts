import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Validation function for hex color format
function isValidHexColor(color: string | null | undefined): boolean {
	if (!color) return true; // Allow null/undefined
	return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// Validate branding data
function validateBrandingData(body: any): string[] {
	const errors: string[] = [];

	// Validate required field
	if (!body.library_name || body.library_name.trim() === '') {
		errors.push('Library name is required');
	}

	// Validate footer text (if show_powered_by is true, footer_text should not be empty)
	if (body.show_powered_by && (!body.footer_text || body.footer_text.trim() === '')) {
		errors.push('Footer text is required when "show_powered_by" is enabled');
	}

	// Validate color fields
	const colorFields = [
		{ key: 'primary_color', label: 'Primary Color' },
		{ key: 'secondary_color', label: 'Secondary Color' },
		{ key: 'accent_color', label: 'Accent Color' },
		{ key: 'background_color', label: 'Background Color' },
		{ key: 'text_color', label: 'Text Color' }
	];

	for (const field of colorFields) {
		const color = body[field.key];
		if (color && !isValidHexColor(color)) {
			errors.push(`${field.label} must be in hex format (#rrggbb)`);
		}
	}

	// Validate items per page
	if (body.items_per_page !== undefined && body.items_per_page !== null) {
		const itemsPerPage = Number(body.items_per_page);
		if (isNaN(itemsPerPage) || itemsPerPage < 5 || itemsPerPage > 100) {
			errors.push('Items per page must be between 5 and 100');
		}
	}

	// Validate URLs if provided
	const urlFields = ['logo_url', 'homepage_logo_url', 'favicon_url', 'facebook_url', 'twitter_url', 'instagram_url'];
	for (const field of urlFields) {
		const url = body[field];
		if (url && typeof url === 'string' && url.trim() !== '') {
			try {
				new URL(url);
			} catch {
				errors.push(`${field.replace('_', ' ')} must be a valid URL`);
			}
		}
	}

	return errors;
}

export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized - Authentication required');
		}

		const body = await request.json();

		// Validate the branding data
		const validationErrors = validateBrandingData(body);
		if (validationErrors.length > 0) {
			return json(
				{ 
					success: false,
					message: 'Validation failed', 
					errors: validationErrors 
				},
				{ status: 400 }
			);
		}

		// Check if an active configuration exists
		const { data: existing } = await supabase
			.from('branding_configuration')
			.select('id')
			.eq('is_active', true)
			.single();

		let result;

		if (existing) {
			// Update existing configuration
			const { data, error: updateError } = await supabase
				.from('branding_configuration')
				.update({
					library_name: body.library_name,
					library_tagline: body.library_tagline || null,
					logo_url: body.logo_url || null,
					homepage_logo_url: body.homepage_logo_url || null,
					favicon_url: body.favicon_url || null,
					primary_color: body.primary_color || '#e73b42',
					secondary_color: body.secondary_color || '#667eea',
					accent_color: body.accent_color || '#2c3e50',
					background_color: body.background_color || '#ffffff',
					text_color: body.text_color || '#333333',
					font_family: body.font_family || 'system-ui, -apple-system, sans-serif',
					heading_font: body.heading_font || null,
					custom_css: body.custom_css || null,
					custom_head_html: body.custom_head_html || null,
					footer_text: body.footer_text ?? 'Powered by Open Library System',
					show_powered_by: body.show_powered_by === true,
					contact_email: body.contact_email || null,
					contact_phone: body.contact_phone || null,
					contact_address: body.contact_address || null,
					facebook_url: body.facebook_url || null,
					twitter_url: body.twitter_url || null,
					instagram_url: body.instagram_url || null,
					show_covers: body.show_covers !== false,
					show_facets: body.show_facets !== false,
					items_per_page: body.items_per_page || 20,
					show_header: body.show_header === true,
					header_links: body.header_links || [],
					show_homepage_info: body.show_homepage_info === true,
					homepage_info_title: body.homepage_info_title || 'Quick Links',
					homepage_info_content: body.homepage_info_content || null,
					homepage_info_links: body.homepage_info_links || [],
					updated_by: session.user.id
				})
				.eq('id', existing.id)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating branding:', updateError);
				throw error(500, 'Failed to update branding');
			}

			result = data;
		} else {
			// Create new configuration
			const { data, error: insertError } = await supabase
				.from('branding_configuration')
				.insert({
					library_name: body.library_name,
					library_tagline: body.library_tagline || null,
					logo_url: body.logo_url || null,
					homepage_logo_url: body.homepage_logo_url || null,
					favicon_url: body.favicon_url || null,
					primary_color: body.primary_color || '#e73b42',
					secondary_color: body.secondary_color || '#667eea',
					accent_color: body.accent_color || '#2c3e50',
					background_color: body.background_color || '#ffffff',
					text_color: body.text_color || '#333333',
					font_family: body.font_family || 'system-ui, -apple-system, sans-serif',
					heading_font: body.heading_font || null,
					custom_css: body.custom_css || null,
					custom_head_html: body.custom_head_html || null,
					footer_text: body.footer_text ?? 'Powered by Open Library System',
					show_powered_by: body.show_powered_by === true,
					contact_email: body.contact_email || null,
					contact_phone: body.contact_phone || null,
					contact_address: body.contact_address || null,
					facebook_url: body.facebook_url || null,
					twitter_url: body.twitter_url || null,
					instagram_url: body.instagram_url || null,
					show_covers: body.show_covers !== false,
					show_facets: body.show_facets !== false,
					items_per_page: body.items_per_page || 20,
					show_header: body.show_header === true,
					header_links: body.header_links || [],
					show_homepage_info: body.show_homepage_info === true,
					homepage_info_title: body.homepage_info_title || 'Quick Links',
					homepage_info_content: body.homepage_info_content || null,
					homepage_info_links: body.homepage_info_links || [],
					is_active: true,
					updated_by: session.user.id
				})
				.select()
				.single();

			if (insertError) {
				console.error('Error creating branding:', insertError);
				throw error(500, 'Failed to create branding');
			}

			result = data;
		}

		return json({ success: true, branding: result });
	} catch (err) {
		console.error('Branding API error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
