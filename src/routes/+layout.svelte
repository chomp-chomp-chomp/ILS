<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Site configuration (single source of truth for header/footer/homepage/theme)
	const siteConfig = $derived((data as any).siteConfig || {
		header_enabled: false,
		header_logo_url: null,
		header_links: [],
		footer_enabled: false,
		footer_text: '',
		footer_links: [],
		theme_mode: 'system',
		theme_light: {
			primary: '#e73b42',
			secondary: '#667eea',
			accent: '#2c3e50',
			background: '#ffffff',
			text: '#333333',
			font: 'system-ui, -apple-system, sans-serif'
		},
		theme_dark: {
			primary: '#ff6b72',
			secondary: '#8b9eff',
			accent: '#3d5a7f',
			background: '#1a1a1a',
			text: '#e5e5e5',
			font: 'system-ui, -apple-system, sans-serif'
		},
		page_themes: {},
		favicon_url: null,
		apple_touch_icon_url: null,
		android_chrome_192_url: null,
		android_chrome_512_url: null,
		og_image_url: null,
		twitter_card_image_url: null
	});

	// Debug logging for siteConfig
	$effect(() => {
		if (browser) {
			console.log('🔍 [Layout Debug] Current page:', $page.url.pathname);
			console.log('🔍 [Layout Debug] siteConfig object:', siteConfig);
			console.log('🔍 [Layout Debug] siteConfig.footer_enabled:', siteConfig?.footer_enabled);
			console.log('🔍 [Layout Debug] siteConfig.footer_text:', siteConfig?.footer_text);
			console.log('🔍 [Layout Debug] siteConfig.footer_links:', siteConfig?.footer_links);
			console.log('🔍 [Layout Debug] siteConfig.header_enabled:', siteConfig?.header_enabled);
			console.log('🔍 [Layout Debug] siteConfig.homepage_hero_enabled:', siteConfig?.homepage_hero_enabled);
			console.log('🔍 [Layout Debug] Raw data.siteConfig:', (data as any).siteConfig);
		}
	});

	// Keep branding for backward compatibility (title, favicon, etc.)
	const branding = $derived((data as any).branding || {
		library_name: 'Chomp Chomp Library Catalog',
		favicon_url: null,
		custom_head_html: null,
		custom_css: null
	});

	// Compute effective favicon URL (siteConfig takes precedence)
	const effectiveFaviconUrl = $derived(siteConfig.favicon_url || branding?.favicon_url || favicon);
	
	// Compute effective OG image (for social sharing)
	const effectiveOgImage = $derived(siteConfig.og_image_url || null);
	
	// Compute effective Twitter image (fallback to OG image)
	const effectiveTwitterImage = $derived(siteConfig.twitter_card_image_url || siteConfig.og_image_url || null);

	// Determine if we should show the default navigation
	let showNav = $derived($page.url.pathname !== '/' && !$page.url.pathname.startsWith('/admin'));

	// Show custom header on all non-admin pages if enabled (from siteConfig)
	// ROBUST: Explicit boolean check with fallback
	let showCustomHeader = $derived(
		Boolean(siteConfig?.header_enabled) === true && !$page.url.pathname.startsWith('/admin')
	);

	// Show footer on non-admin pages if enabled (from siteConfig)
	// ROBUST: Explicit boolean check with fallback
	let showFooter = $derived(
		Boolean(siteConfig?.footer_enabled) === true && !$page.url.pathname.startsWith('/admin')
	);

	// Debug logging for computed show flags
	$effect(() => {
		if (browser) {
			console.log('🔍 [Layout Debug] showCustomHeader:', showCustomHeader);
			console.log('🔍 [Layout Debug] showFooter:', showFooter);
			console.log('🔍 [Layout Debug] Is admin page:', $page.url.pathname.startsWith('/admin'));
		}
	});

	// Theme management
	let manualTheme = $state<'light' | 'dark' | null>(null);
	let systemTheme = $state<'light' | 'dark'>('light');
	let currentTheme = $derived(manualTheme || (siteConfig.theme_mode === 'system' ? systemTheme : siteConfig.theme_mode));

	// Determine page type for theme overrides
	function getPageType(pathname: string): string {
		if (pathname === '/') return 'home';
		if (pathname === '/catalog/search/results') return 'search_results';
		if (pathname === '/catalog/search/advanced') return 'search_advanced';
		if (pathname === '/catalog/browse') return 'catalog_browse';
		if (pathname.startsWith('/catalog/record/')) return 'record_details';
		return 'public_default';
	}

	const pageType = $derived(getPageType($page.url.pathname));

	// Get active theme with page-type overrides
	const activeTheme = $derived(() => {
		const baseTheme = currentTheme === 'dark' ? siteConfig.theme_dark : siteConfig.theme_light;
		const pageOverride = siteConfig.page_themes?.[pageType] || {};
		return { ...baseTheme, ...pageOverride };
	});

	// Load manual theme preference from localStorage
	onMount(() => {
		const stored = localStorage.getItem('theme-preference');
		if (stored === 'light' || stored === 'dark') {
			manualTheme = stored;
		}

		// Detect system theme preference
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		systemTheme = mediaQuery.matches ? 'dark' : 'light';

		const handleChange = (e: MediaQueryListEvent) => {
			systemTheme = e.matches ? 'dark' : 'light';
		};

		mediaQuery.addEventListener('change', handleChange);

		const { data: authData } = data.supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			mediaQuery.removeEventListener('change', handleChange);
			authData.subscription.unsubscribe();
		};
	});

	// Toggle theme function (exposed via window for theme toggle button)
	function toggleTheme() {
		if (manualTheme === 'light') {
			manualTheme = 'dark';
		} else if (manualTheme === 'dark') {
			manualTheme = null; // Back to system
		} else {
			manualTheme = 'light';
		}

		if (browser) {
			if (manualTheme) {
				localStorage.setItem('theme-preference', manualTheme);
			} else {
				localStorage.removeItem('theme-preference');
			}
		}
	}

	// Expose theme toggle globally
	if (browser) {
		(window as any).toggleTheme = toggleTheme;
	}
</script>

<svelte:head>
	<!-- Favicon -->
	<link rel="icon" href={effectiveFaviconUrl} />
	<title>{branding?.library_name || 'Chomp Chomp Library Catalog'}</title>

	<!-- Apple Touch Icon -->
	{#if siteConfig.apple_touch_icon_url}
		<link rel="apple-touch-icon" href={siteConfig.apple_touch_icon_url} />
	{/if}

	<!-- Android Chrome Icons -->
	{#if siteConfig.android_chrome_192_url}
		<link rel="icon" type="image/png" sizes="192x192" href={siteConfig.android_chrome_192_url} />
	{/if}
	{#if siteConfig.android_chrome_512_url}
		<link rel="icon" type="image/png" sizes="512x512" href={siteConfig.android_chrome_512_url} />
	{/if}

	<!-- Open Graph Tags -->
	{#if effectiveOgImage}
		<meta property="og:image" content={effectiveOgImage} />
		<meta property="og:image:type" content="image/jpeg" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}
	<meta property="og:title" content={branding?.library_name || 'Chomp Chomp Library Catalog'} />
	<meta property="og:type" content="website" />

	<!-- Twitter Card Tags -->
	<meta name="twitter:card" content="summary_large_image" />
	{#if effectiveTwitterImage}
		<meta name="twitter:image" content={effectiveTwitterImage} />
	{/if}
	<meta name="twitter:title" content={branding?.library_name || 'Chomp Chomp Library Catalog'} />

	<!-- Custom Head HTML -->
	{#if branding?.custom_head_html}
		{@html branding.custom_head_html}
	{/if}

	<!-- Custom CSS -->
	{#if branding?.custom_css}
		<style>
			{branding.custom_css}
		</style>
	{/if}
</svelte:head>

<AccessibilitySettings />

<main
	id="main-content"
	class="theme-{currentTheme}"
	data-page-type={pageType}
	style="
		--primary-color: {activeTheme().primary};
		--secondary-color: {activeTheme().secondary};
		--accent-color: {activeTheme().accent};
		--background-color: {activeTheme().background};
		--text-color: {activeTheme().text};
		--font-family: {activeTheme().font};
	"
>
	<!-- Custom Header (if enabled in siteConfig) -->
	{#if showCustomHeader}
		<nav class="custom-header">
			<div class="header-container">
				{#if siteConfig?.header_logo_url}
					<img
						src={siteConfig.header_logo_url}
						alt={branding?.library_name || 'Library'}
						class="header-logo"
					/>
				{/if}
				<div class="header-links">
					{#each [...(siteConfig?.header_links || [])].sort((a, b) => a.order - b.order) as link}
						<a href={link.url} class="header-link">{link.title}</a>
					{/each}
				</div>
				<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
					{#if manualTheme === 'light'}
						☀️
					{:else if manualTheme === 'dark'}
						🌙
					{:else}
						🔄
					{/if}
				</button>
			</div>
		</nav>
	{/if}

	<!-- Default Navigation (shown on non-admin, non-home pages when custom header is off) -->
	{#if showNav && !showCustomHeader}
		<nav class="site-nav">
			<div class="nav-container">
				<a href="/" class="nav-link">Home</a>
				<a href="/catalog/search/advanced" class="nav-link">Advanced Search</a>
				<button class="theme-toggle nav-theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
					{#if manualTheme === 'light'}
						☀️
					{:else if manualTheme === 'dark'}
						🌙
					{:else}
						🔄
					{/if}
				</button>
			</div>
		</nav>
	{/if}
	{@render children()}

	<!-- Footer (if enabled in siteConfig, shown on non-admin pages) -->
	{#if showFooter}
		<footer class="site-footer">
			<div class="footer-container">
				<div class="footer-content">
					<!-- Main Footer Text -->
					{#if siteConfig?.footer_text}
						<p class="footer-text">{siteConfig.footer_text}</p>
					{/if}

					<!-- Footer Links -->
					{#if siteConfig?.footer_links && siteConfig.footer_links.length > 0}
						<div class="footer-links">
							{#each [...siteConfig.footer_links].sort((a, b) => a.order - b.order) as link}
								<a href={link.url} class="footer-link">{link.title}</a>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</footer>
	{/if}
</main>

<style>
	/* Base theme support */
	main {
		background: var(--background-color);
		color: var(--text-color);
		font-family: var(--font-family);
		min-height: 100vh;
		transition: background-color 0.3s, color 0.3s;
	}

	/* Theme toggle button */
	.theme-toggle {
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		padding: 0.5rem 0.75rem;
		font-size: 1.2rem;
		cursor: pointer;
		transition: all 0.2s;
		color: white;
	}

	.theme-toggle:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: scale(1.05);
	}

	.nav-theme-toggle {
		margin-left: auto;
	}

	.site-nav {
		background: var(--primary-color);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		padding: 0.75rem 0;
	}

	.nav-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
		gap: 2rem;
		align-items: center;
	}

	.nav-link {
		color: white;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.nav-link:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Custom Header Styles */
	.custom-header {
		background: var(--primary-color);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		padding: 1rem 0;
	}

	.header-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
		gap: 2rem;
		align-items: center;
	}

	.header-logo {
		height: 40px;
		width: auto;
	}

	.header-links {
		display: flex;
		gap: 1.5rem;
		flex: 1;
		align-items: center;
	}

	.header-link {
		color: white;
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.header-link:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Footer Styles */
	.site-footer {
		background: var(--accent-color);
		color: rgba(255, 255, 255, 0.9);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: 2rem 0;
		margin-top: 4rem;
		width: 100%;
		/* ROBUST: Ensure footer always renders and is visible */
		display: block !important;
		position: relative;
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	.footer-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		text-align: center;
	}

	.footer-text {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.8);
		margin: 0;
		line-height: 1.6;
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: center;
		align-items: center;
	}

	.footer-link {
		color: rgba(255, 255, 255, 0.9);
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s;
	}

	.footer-link:hover {
		color: var(--primary-color);
	}

	@media (max-width: 768px) {
		.nav-container {
			padding: 0 1rem;
			gap: 1rem;
		}

		.nav-link {
			font-size: 0.85rem;
			padding: 0.4rem 0.8rem;
		}

		.header-container {
			padding: 0 1rem;
			flex-wrap: wrap;
		}

		.header-logo {
			height: 30px;
		}

		.header-links {
			flex-wrap: wrap;
			gap: 0.75rem;
		}

		.header-link {
			font-size: 0.85rem;
			padding: 0.4rem 0.8rem;
		}

		.footer-container {
			padding: 0 1rem;
		}

		.footer-links {
			flex-direction: column;
			gap: 1rem;
		}
	}
</style>
