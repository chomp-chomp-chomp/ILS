/**
 * Site Configuration Defaults
 * 
 * This file defines the default settings for the public-facing library site.
 * These defaults are used as fallbacks when the database is unavailable or
 * settings haven't been configured yet.
 * 
 * The settings stored here are merged with database values at runtime.
 * Database values take precedence over these defaults.
 * 
 * To customize your site's appearance:
 * 1. Use the admin UI at /admin/site to update settings (recommended)
 * 2. OR modify these defaults directly in this file
 */

export interface HeaderLink {
	title: string;
	url: string;
}

export interface SiteSettings {
	// Header Navigation
	header: {
		links: HeaderLink[];
	};
	
	// Footer
	footer: {
		text: string;
		link: string;
	};
	
	// Homepage Hero Section
	hero: {
		title: string;
		subhead: string;
		imageUrl: string;
	};
}

/**
 * Default site settings
 * 
 * These are the fallback values used when:
 * - The database is unavailable
 * - No site settings have been configured
 * - Individual settings are missing
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
	header: {
		links: [
			{
				title: 'Home',
				url: 'https://library.chompchomp.cc/'
			},
			{
				title: 'Advanced Search',
				url: 'https://library.chompchomp.cc/catalog/search/advanced'
			},
			{
				title: 'Chomp Chomp Tools',
				url: 'https://chompchomp.cc/tools/'
			},
			{
				title: 'Chomp Chomp Recipes',
				url: 'https://chompchomp.cc/'
			}
		]
	},
	
	footer: {
		text: 'Powered by Chomp Chomp',
		link: 'https://chompchomp.cc'
	},
	
	hero: {
		title: 'Welcome to the Chomp Chomp Library',
		subhead: 'Explore our collection',
		imageUrl: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516'
	}
};
