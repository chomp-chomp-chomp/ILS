/**
 * Site Defaults Configuration
 * 
 * This is the single source of truth for default site configuration values.
 * These defaults are used when database settings are not available or as fallbacks.
 * 
 * To customize the site:
 * 1. Edit values here for default configuration
 * 2. Override via admin UI at /admin/site (persists to database)
 * 3. Database values always take precedence over these defaults
 */

export interface SiteSettings {
	// Header navigation
	header: {
		links: Array<{
			title: string;
			url: string;
		}>;
	};

	// Footer
	footer: {
		text: string;
		linkUrl: string;
	};

	// Homepage hero section
	hero: {
		title: string;
		subhead: string;
		imageUrl: string;
	};

	// Metadata/favicon paths (relative to static/ or absolute URLs)
	metadata: {
		favicon: string;
		favicon16: string;
		favicon32: string;
		appleTouchIcon: string;
		androidChrome192: string;
		androidChrome512: string;
	};
}

/**
 * Default site configuration
 * Edit these values to change site-wide defaults
 */
export const siteDefaults: SiteSettings = {
	header: {
		links: [
			{ title: 'Home', url: 'https://library.chompchomp.cc/' },
			{ title: 'Advanced Search', url: 'https://library.chompchomp.cc/catalog/search/advanced' },
			{ title: 'Chomp Chomp Tools', url: 'https://chompchomp.cc/tools/' },
			{ title: 'Chomp Chomp Recipes', url: 'https://chompchomp.cc/' }
		]
	},

	footer: {
		text: 'Powered by Chomp Chomp',
		linkUrl: 'https://chompchomp.cc'
	},

	hero: {
		title: 'Welcome to the Chomp Chomp Library',
		subhead: 'Explore our collection',
		imageUrl: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516'
	},

	metadata: {
		favicon: '/favicon.ico',
		favicon16: '/favicon-16x16.png',
		favicon32: '/favicon-32x32.png',
		appleTouchIcon: '/apple-touch-icon.png',
		androidChrome192: '/android-chrome-192x192.png',
		androidChrome512: '/android-chrome-512x512.png'
	}
};

/**
 * Merge database settings with defaults
 * Database values override defaults where present
 */
export function mergeSiteSettings(dbSettings: Partial<SiteSettings> | null): SiteSettings {
	if (!dbSettings) {
		return siteDefaults;
	}

	return {
		header: {
			links: dbSettings.header?.links || siteDefaults.header.links
		},
		footer: {
			text: dbSettings.footer?.text || siteDefaults.footer.text,
			linkUrl: dbSettings.footer?.linkUrl || siteDefaults.footer.linkUrl
		},
		hero: {
			title: dbSettings.hero?.title || siteDefaults.hero.title,
			subhead: dbSettings.hero?.subhead || siteDefaults.hero.subhead,
			imageUrl: dbSettings.hero?.imageUrl || siteDefaults.hero.imageUrl
		},
		metadata: {
			favicon: dbSettings.metadata?.favicon || siteDefaults.metadata.favicon,
			favicon16: dbSettings.metadata?.favicon16 || siteDefaults.metadata.favicon16,
			favicon32: dbSettings.metadata?.favicon32 || siteDefaults.metadata.favicon32,
			appleTouchIcon: dbSettings.metadata?.appleTouchIcon || siteDefaults.metadata.appleTouchIcon,
			androidChrome192: dbSettings.metadata?.androidChrome192 || siteDefaults.metadata.androidChrome192,
			androidChrome512: dbSettings.metadata?.androidChrome512 || siteDefaults.metadata.androidChrome512
		}
	};
}
