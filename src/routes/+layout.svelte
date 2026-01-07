<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { defaultSiteConfig } from '$lib/types/site-config';
	import { getPageType, getMergedThemeTokens } from '$lib/types/site-config';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Determine if we should show the default navigation
	let showNav = $derived($page.url.pathname !== '/' && !$page.url.pathname.startsWith('/admin'));

	// Use branding directly from data (already merged with defaults on server)
	// Add safety check in case data.branding is somehow undefined
	const branding = $derived((data as any).branding || {
		library_name: 'Chomp Chomp Library Catalog',
		primary_color: '#e73b42',
		secondary_color: '#667eea',
		accent_color: '#2c3e50',
		background_color: '#ffffff',
		text_color: '#333333',
		font_family: 'system-ui, -apple-system, sans-serif',
		show_header: false,
		show_powered_by: false,
		footer_text: '',
		header_links: []
	});

	// Get site config with defaults
	const siteConfig = $derived((data as any).siteConfig || defaultSiteConfig);

	// Determine if we're on admin pages
	const isAdminPage = $derived($page.url.pathname.startsWith('/admin'));

	// Show custom header from siteConfig on non-admin pages if enabled
	let showCustomHeader = $derived(siteConfig.header_enabled && !isAdminPage);

	// Show footer from siteConfig on non-admin pages if enabled
	let showFooter = $derived(siteConfig.footer_enabled && !isAdminPage);

	// Theme management
	let userTheme = $state<'light' | 'dark' | 'system'>('system');
	let resolvedTheme = $state<'light' | 'dark'>('light');

	function getSystemTheme(): 'light' | 'dark' {
		if (typeof window === 'undefined') return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
		return theme === 'system' ? getSystemTheme() : theme;
	}

	function applyTheme() {
		if (typeof window === 'undefined') return;
		
		const pageType = getPageType($page.url.pathname);
		const tokens = getMergedThemeTokens(siteConfig, pageType, resolvedTheme);
		
		// Update data attribute
		document.documentElement.setAttribute('data-theme', resolvedTheme);
		
		// Apply theme tokens as CSS variables
		Object.entries(tokens).forEach(([key, value]) => {
			if (value) {
				document.documentElement.style.setProperty(`--theme-${key}`, value);
			}
		});
	}

	onMount(() => {
		// Load theme preference
		const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (stored && (stored === 'light' || stored === 'dark')) {
			userTheme = stored;
		} else {
			userTheme = siteConfig.theme_mode;
		}
		resolvedTheme = resolveTheme(userTheme);
		applyTheme();

		// Listen for system theme changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (userTheme === 'system') {
				resolvedTheme = resolveTheme('system');
				applyTheme();
			}
		};
		mediaQuery.addEventListener('change', handleChange);

		// Listen for theme toggle events
		const handleThemeChange = (e: Event) => {
			const customEvent = e as CustomEvent;
			userTheme = customEvent.detail;
			resolvedTheme = resolveTheme(userTheme);
			applyTheme();
		};
		window.addEventListener('themechange', handleThemeChange);

		const { data: authData } = data.supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			authData.subscription.unsubscribe();
			mediaQuery.removeEventListener('change', handleChange);
			window.removeEventListener('themechange', handleThemeChange);
		};
	});

	// Re-apply theme when page changes
	$effect(() => {
		$page.url.pathname;
		applyTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href={branding?.favicon_url || favicon} />
	<title>{branding?.library_name || 'Chomp Chomp Library Catalog'}</title>

	{#if branding?.custom_head_html}
		{@html branding.custom_head_html}
	{/if}

	{#if branding?.custom_css}
		<style>
			{branding.custom_css}
		</style>
	{/if}
</svelte:head>

<AccessibilitySettings />

<main
	id="main-content"
	style="
		--primary-color: {branding?.primary_color || '#e73b42'};
		--secondary-color: {branding?.secondary_color || '#667eea'};
		--accent-color: {branding?.accent_color || '#2c3e50'};
		--background-color: {branding?.background_color || '#ffffff'};
		--text-color: {branding?.text_color || '#333333'};
		--font-family: {branding?.font_family || 'system-ui, -apple-system, sans-serif'};
		--heading-font: {branding?.heading_font || branding?.font_family || 'system-ui, -apple-system, sans-serif'};
	"
>
	<!-- Custom Header from Site Config (if enabled in siteConfig) -->
	{#if showCustomHeader}
		<nav class="custom-header">
			<div class="header-container">
				{#if siteConfig.header_logo_url}
					<img src={siteConfig.header_logo_url} alt={branding?.library_name || 'Library'} class="header-logo" />
				{/if}
				<div class="header-links">
					{#each [...siteConfig.header_links].sort((a, b) => a.order - b.order) as link}
						<a href={link.url} class="header-link">{link.title}</a>
					{/each}
				</div>
				<div class="header-actions">
					<ThemeToggle siteConfig={siteConfig} />
				</div>
			</div>
		</nav>
	{/if}

	<!-- Default Navigation (shown on non-admin, non-home pages when custom header is off) -->
	{#if showNav && !showCustomHeader}
		<nav class="site-nav">
			<div class="nav-container">
				<a href="/" class="nav-link">Home</a>
				<a href="/catalog/search/advanced" class="nav-link">Advanced Search</a>
				<div class="nav-actions">
					<ThemeToggle siteConfig={siteConfig} />
				</div>
			</div>
		</nav>
	{/if}
	{@render children()}

	<!-- Footer from Site Config (if enabled in siteConfig, shown on non-admin pages) -->
	{#if showFooter}
		<footer class="site-footer">
			<div class="footer-container">
				<div class="footer-content">
					<!-- Main Footer Text -->
					{#if siteConfig.footer_text}
						<p class="footer-text">{siteConfig.footer_text}</p>
					{/if}

					<!-- Footer Links -->
					{#if siteConfig.footer_links && siteConfig.footer_links.length > 0}
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

	.nav-actions {
		margin-left: auto;
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

	.header-actions {
		margin-left: auto;
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
		background: var(--accent-color, #2c3e50);
		color: rgba(255, 255, 255, 0.9);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: 2rem 0;
		margin-top: auto;
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	.footer-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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
		color: var(--primary-color, #e73b42);
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
