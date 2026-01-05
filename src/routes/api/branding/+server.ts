import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const body = await request.json();

		// Validate required fields
		if (!body.library_name) {
			throw error(400, 'Library name is required');
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
					footer_text: body.footer_text || 'Powered by Open Library System',
					show_powered_by: body.show_powered_by !== false,
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
					footer_text: body.footer_text || 'Powered by Open Library System',
					show_powered_by: body.show_powered_by !== false,
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
