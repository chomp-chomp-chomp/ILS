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
	order?: number;
}

export interface FooterLink {
	title: string;
	url: string;
	order?: number;
}

export interface Typography {
	h1Size: string;
	h2Size: string;
	h3Size: string;
	h4Size: string;
	h5Size: string;
	h6Size: string;
	pSize: string;
	smallSize: string;
	lineHeight: string;
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
		links?: FooterLink[];
		backgroundColor?: string;
		textColor?: string;
		linkColor?: string;
		linkHoverColor?: string;
		padding?: string;
	};
	
	// Homepage Hero Section
	hero: {
		title: string;
		subhead: string;
		imageUrl: string;
		minHeight?: string;
		mobileMinHeight?: string;
	};
	
	// Typography
	typography?: Typography;
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
				url: 'https://library.chompchomp.cc/',
				order: 1
			},
			{
				title: 'Advanced Search',
				url: 'https://library.chompchomp.cc/catalog/search/advanced',
				order: 2
			},
			{
				title: 'Chomp Chomp Tools',
				url: 'https://chompchomp.cc/tools/',
				order: 3
			},
			{
				title: 'Chomp Chomp Recipes',
				url: 'https://chompchomp.cc/',
				order: 4
			}
		]
	},
	
	footer: {
		text: 'Powered by Chomp Chomp',
		link: 'https://chompchomp.cc',
		links: [],
		backgroundColor: '#2c3e50',
		textColor: 'rgba(255, 255, 255, 0.9)',
		linkColor: 'rgba(255, 255, 255, 0.9)',
		linkHoverColor: '#e73b42',
		padding: '2rem 0'
	},
	
	hero: {
		title: 'Welcome to the Chomp Chomp Library',
		subhead: 'Explore our collection',
		imageUrl: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516',
		minHeight: '250px',
		mobileMinHeight: '200px'
	},
	
	typography: {
		h1Size: '2.5rem',
		h2Size: '2rem',
		h3Size: '1.75rem',
		h4Size: '1.5rem',
		h5Size: '1.25rem',
		h6Size: '1rem',
		pSize: '1rem',
		smallSize: '0.875rem',
		lineHeight: '1.6'
	}
};
