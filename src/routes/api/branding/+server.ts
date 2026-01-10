import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	loadUnifiedSiteSettings,
	updateUnifiedSiteSettings
} from '$lib/server/unifiedSiteSettings';

// Validation function for hex color format
function isValidHexColor(color: string | null | undefined): boolean {
	if (!color) return true; // Allow null/undefined
	return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// TypeScript interface for branding request body
interface BrandingRequestBody {
	library_name: string;
	library_tagline?: string | null;
	logo_url?: string | null;
	homepage_logo_url?: string | null;
	favicon_url?: string | null;
	primary_color?: string;
	secondary_color?: string;
	accent_color?: string;
	background_color?: string;
	text_color?: string;
	font_family?: string;
	heading_font?: string | null;
	custom_css?: string | null;
	custom_head_html?: string | null;
	footer_text?: string | null;
	show_powered_by?: boolean;
	contact_email?: string | null;
	contact_phone?: string | null;
	contact_address?: string | null;
	facebook_url?: string | null;
	twitter_url?: string | null;
	instagram_url?: string | null;
	show_covers?: boolean;
	items_per_page?: number;
	show_header?: boolean;
	header_links?: Array<{ title: string; url: string; order: number }>;
	show_homepage_info?: boolean;
	homepage_info_title?: string;
	homepage_info_content?: string | null;
	homepage_info_links?: Array<{ title: string; url: string; order: number }>;
}

// Validate branding data
function validateBrandingData(body: BrandingRequestBody): string[] {
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
			console.error('[Branding API] Unauthorized access attempt');
			throw error(401, 'Unauthorized - Authentication required');
		}

		console.log('[Branding API] User authenticated:', session.user.id);

		const body = await request.json() as BrandingRequestBody;

		// Log sanitized payload (exclude potentially sensitive custom HTML/CSS)
		const sanitizedBody = {
			...body,
			custom_css: body.custom_css ? '[REDACTED]' : null,
			custom_head_html: body.custom_head_html ? '[REDACTED]' : null
		};

		console.log('[Branding API] Received update payload:', JSON.stringify(sanitizedBody, null, 2));

		// Validate the branding data
		const validationErrors = validateBrandingData(body);
		if (validationErrors.length > 0) {
			console.error('[Branding API] Validation failed:', validationErrors);
			return json(
				{
					success: false,
					message: 'Validation failed',
					errors: validationErrors
				},
				{ status: 400 }
			);
		}

		console.log('[Branding API] Updating unified site settings...');

		// Update using unified helper
		const result = await updateUnifiedSiteSettings(supabase, body, session.user.id);

		if (!result.success) {
			console.error('[Branding API] Update failed:', result.error);
			throw error(500, result.error || 'Failed to update branding');
		}

		// Reload settings to return updated data
		const updatedSettings = await loadUnifiedSiteSettings(supabase);

		console.log('[Branding API] Operation completed successfully');
		return json({ success: true, branding: updatedSettings });
	} catch (err) {
		console.error('[Branding API] Caught exception:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
