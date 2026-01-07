/**
 * Site Configuration Types
 * 
 * Defines the structure for site-wide configuration including
 * header, footer, homepage info, and theming system.
 */

export interface HeaderLink {
  title: string;
  url: string;
  order: number;
}

export interface FooterLink {
  title: string;
  url: string;
  order: number;
}

export interface HomepageInfoLink {
  title: string;
  url: string;
  order: number;
}

export interface ThemeTokens {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  'text-muted'?: string;
  border?: string;
  [key: string]: string | undefined; // Allow additional custom tokens
}

export type PageType = 
  | 'home' 
  | 'search_results' 
  | 'search_advanced' 
  | 'catalog_browse' 
  | 'record_details' 
  | 'public_default';

export interface PageThemes {
  home?: {
    light?: ThemeTokens;
    dark?: ThemeTokens;
  };
  search_results?: {
    light?: ThemeTokens;
    dark?: ThemeTokens;
  };
  search_advanced?: {
    light?: ThemeTokens;
    dark?: ThemeTokens;
  };
  catalog_browse?: {
    light?: ThemeTokens;
    dark?: ThemeTokens;
  };
  record_details?: {
    light?: ThemeTokens;
    dark?: ThemeTokens;
  };
  public_default?: {
    light?: ThemeTokens;
    dark?: ThemeTokens;
  };
}

export interface SiteConfiguration {
  id?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  is_active?: boolean;

  // Header
  header_enabled: boolean;
  header_logo_url: string | null;
  header_links: HeaderLink[];

  // Footer
  footer_enabled: boolean;
  footer_text: string;
  footer_links: FooterLink[];

  // Homepage Info
  homepage_info_enabled: boolean;
  homepage_info_title: string;
  homepage_info_content: string;
  homepage_info_links: HomepageInfoLink[];

  // Theme
  theme_mode: 'system' | 'light' | 'dark';
  theme_light: ThemeTokens;
  theme_dark: ThemeTokens;
  page_themes: PageThemes;
}

/**
 * Default site configuration with sensible defaults
 */
export const defaultSiteConfig: SiteConfiguration = {
  header_enabled: false,
  header_logo_url: null,
  header_links: [],
  
  footer_enabled: false,
  footer_text: '',
  footer_links: [],
  
  homepage_info_enabled: false,
  homepage_info_title: '',
  homepage_info_content: '',
  homepage_info_links: [],
  
  theme_mode: 'system',
  theme_light: {
    primary: '#e73b42',
    secondary: '#667eea',
    accent: '#2c3e50',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    'text-muted': '#666666',
    border: '#e0e0e0'
  },
  theme_dark: {
    primary: '#ff5a61',
    secondary: '#7c8ffa',
    accent: '#4a5f7f',
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#e0e0e0',
    'text-muted': '#a0a0a0',
    border: '#404040'
  },
  page_themes: {
    home: {},
    search_results: {},
    search_advanced: {},
    catalog_browse: {},
    record_details: {},
    public_default: {}
  }
};

/**
 * Safely coerce JSONB value to typed array
 */
export function coerceToArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

/**
 * Safely coerce JSONB value to object
 */
export function coerceToObject<T>(value: unknown, defaultValue: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return defaultValue;
}

/**
 * Merge site configuration with defaults
 */
export function mergeSiteConfig(data: Partial<SiteConfiguration> | null): SiteConfiguration {
  if (!data) {
    return defaultSiteConfig;
  }

  return {
    ...defaultSiteConfig,
    ...data,
    header_links: coerceToArray<HeaderLink>(data.header_links),
    footer_links: coerceToArray<FooterLink>(data.footer_links),
    homepage_info_links: coerceToArray<HomepageInfoLink>(data.homepage_info_links),
    theme_light: coerceToObject(data.theme_light, defaultSiteConfig.theme_light),
    theme_dark: coerceToObject(data.theme_dark, defaultSiteConfig.theme_dark),
    page_themes: coerceToObject(data.page_themes, defaultSiteConfig.page_themes)
  };
}

/**
 * Determine page type from pathname
 */
export function getPageType(pathname: string): PageType {
  if (pathname === '/') {
    return 'home';
  }
  if (pathname.startsWith('/catalog/search/results')) {
    return 'search_results';
  }
  if (pathname.startsWith('/catalog/search/advanced')) {
    return 'search_advanced';
  }
  if (pathname.startsWith('/catalog/browse')) {
    return 'catalog_browse';
  }
  if (pathname.startsWith('/catalog/record/') || pathname.startsWith('/catalog/item/')) {
    return 'record_details';
  }
  return 'public_default';
}

/**
 * Get merged theme tokens for a specific page type and theme mode
 */
export function getMergedThemeTokens(
  config: SiteConfiguration,
  pageType: PageType,
  themeMode: 'light' | 'dark'
): ThemeTokens {
  // Start with base theme
  const baseTheme = themeMode === 'light' ? config.theme_light : config.theme_dark;
  
  // Get page-specific overrides
  const pageTheme = config.page_themes[pageType];
  const pageOverride = pageTheme && themeMode === 'light' ? pageTheme.light : pageTheme?.dark;
  
  // Merge base theme with page overrides
  return {
    ...baseTheme,
    ...(pageOverride || {})
  };
}
