import { getSiteSettings, updateSiteSettings } from '$lib/server/siteSettings';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Load current site settings
	const siteSettings = await getSiteSettings(supabase);
	
	return {
		siteSettings
	};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		
		if (!session) {
			return fail(401, { error: 'Unauthorized' });
		}
		
		const formData = await request.formData();
		
		// Parse header links from form data
		const headerLinks = [];
		let linkIndex = 0;
		while (formData.has(`header_link_${linkIndex}_title`)) {
			const title = formData.get(`header_link_${linkIndex}_title`) as string;
			const url = formData.get(`header_link_${linkIndex}_url`) as string;
			
			if (title && url) {
				// Basic URL validation
				try {
					new URL(url);
					headerLinks.push({ title, url });
				} catch (error) {
					return fail(400, { 
						error: `Invalid URL for link "${title}": ${url}` 
					});
				}
			}
			
			linkIndex++;
		}
		
		// Get footer data
		const footerText = formData.get('footer_text') as string;
		const footerLink = formData.get('footer_link') as string;
		
		// Validate footer link if provided
		if (footerLink) {
			try {
				new URL(footerLink);
			} catch (error) {
				return fail(400, { 
					error: `Invalid footer URL: ${footerLink}` 
				});
			}
		}
		
		// Get hero data
		const heroTitle = formData.get('hero_title') as string;
		const heroSubhead = formData.get('hero_subhead') as string;
		const heroImageUrl = formData.get('hero_image_url') as string;
		
		// Validate hero image URL if provided
		if (heroImageUrl) {
			try {
				new URL(heroImageUrl);
			} catch (error) {
				return fail(400, { 
					error: `Invalid hero image URL: ${heroImageUrl}` 
				});
			}
		}
		
		// Validate required fields
		if (!heroTitle) {
			return fail(400, { error: 'Hero title is required' });
		}
		
		// Update site settings
		const result = await updateSiteSettings(
			supabase,
			{
				header: { links: headerLinks },
				footer: { text: footerText, link: footerLink },
				hero: { title: heroTitle, subhead: heroSubhead, imageUrl: heroImageUrl }
			},
			session.user.id
		);
		
		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update settings' });
		}
		
		return { success: true, message: 'Site settings updated successfully' };
	}
};
