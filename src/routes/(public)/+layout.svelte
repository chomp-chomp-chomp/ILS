<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import FloatingAdminButton from '$lib/components/FloatingAdminButton.svelte';
	import { supabase } from '$lib/supabase';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Site settings with safe defaults (merged from both branches)
	const siteSettings = $derived((data as any).siteSettings || {
		header: { links: [] },
		footer: { 
			text: '', 
			link: '',
			links: [],
			backgroundColor: '#2c3e50',
			textColor: 'rgba(255, 255, 255, 0.9)',
			linkColor: 'rgba(255, 255, 255, 0.9)',
			linkHoverColor: '#e73b42',
			padding: '2rem 0'
		},
		hero: { 
			title: '', 
			subhead: '', 
			imageUrl: '',
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
	});

	// Branding for library name, favicon, typography from branding_configuration
	const branding = $derived((data as any).branding || {
		library_name: 'Chomp Chomp Library Catalog',
		favicon_url: null,
		custom_head_html: null,
		custom_css: null,
		primary_color: '#e73b42',
		secondary_color: '#667eea',
		accent_color: '#2c3e50',
		background_color: '#ffffff',
		text_color: '#333333',
		font_family: 'system-ui, -apple-system, sans-serif',
		heading_font: null,
		// Typography from branding_configuration table
		font_size_h1: '2.5rem',
		font_size_h2: '2rem',
		font_size_h3: '1.5rem',
		font_size_h4: '1.25rem',
		font_size_p: '1rem',
		font_size_small: '0.875rem',
		// Footer styling from branding_configuration table
		footer_background_color: '#2c3e50',
		footer_text_color: '#ffffff',
		footer_link_color: '#ff6b72',
		footer_padding: '2rem 0',
		footer_content: null
	});

	// Determine if we should show the navigation bar (not on homepage)
	let showNav = $derived($page.url.pathname !== '/');

	// Hero disabled - homepage has its own logo/tagline display
	let showHero = $derived(false);

	// Check if user is authenticated (for floating admin button)
	let isAuthenticated = $derived(!!data.session);

	// Theme management (simple light/dark toggle)
	let theme = $state<'light' | 'dark'>('light');

	onMount(() => {
		// Detect system theme preference
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		theme = mediaQuery.matches ? 'dark' : 'light';

		const handleChange = (e: MediaQueryListEvent) => {
			theme = e.matches ? 'dark' : 'light';
		};

		mediaQuery.addEventListener('change', handleChange);

		const { data: authData } = supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			mediaQuery.removeEventListener('change', handleChange);
			authData.subscription.unsubscribe();
		};
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
	}

	// Expose theme toggle globally
	if (browser) {
		(window as any).toggleTheme = toggleTheme;
	}

	// Sanitize and parse footer content (memoized) - for branding.footer_content
	const parsedFooterContent = $derived(
		branding.footer_content
			? (() => {
				// Escape HTML to prevent XSS
				const escaped = branding.footer_content
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#039;');
				
				// Now safely parse markdown links
				return escaped
					.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="footer-link">$1</a>')
					.replace(/\n/g, '<br>');
			})()
			: ''
	);
</script>

<svelte:head>
	<!-- 
		FAVICON AND METADATA CONFIGURATION:
		To update favicons, replace files in /static folder:
		- /favicon.ico
		- /favicon-16x16.png
		- /favicon-32x32.png
		- /apple-touch-icon.png
		- /android-chrome-192x192.png
		- /android-chrome-512x512.png
	-->
	
	<!-- Primary Favicon -->
	<link rel="icon" href={branding?.favicon_url || '/favicon.ico'} />
	
	<!-- Standard Favicon Sizes -->
	<link rel="icon" type="image/x-icon" href="/favicon.ico" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	
	<!-- Apple Touch Icon -->
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	
	<!-- Android Chrome Icons -->
	<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
	<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />

	<!-- Page Title -->
	<title>{branding?.library_name || 'Chomp Chomp Library Catalog'}</title>

	<!-- Custom Head HTML (from admin configuration) -->
	{#if branding?.custom_head_html}
		{@html branding.custom_head_html}
	{/if}

	<!-- Custom CSS (from admin configuration) -->
	{#if branding?.custom_css}
		<style>
			{branding.custom_css}
		</style>
	{/if}
	
	<!-- Typography and Footer CSS Variables (supports both siteSettings and branding) -->
	<style>
		:root {
			--typography-h1-size: {siteSettings.typography?.h1Size || branding.font_size_h1 || '2.5rem'};
			--typography-h2-size: {siteSettings.typography?.h2Size || branding.font_size_h2 || '2rem'};
			--typography-h3-size: {siteSettings.typography?.h3Size || branding.font_size_h3 || '1.75rem'};
			--typography-h4-size: {siteSettings.typography?.h4Size || branding.font_size_h4 || '1.5rem'};
			--typography-h5-size: {siteSettings.typography?.h5Size || '1.25rem'};
			--typography-h6-size: {siteSettings.typography?.h6Size || '1rem'};
			--typography-p-size: {siteSettings.typography?.pSize || branding.font_size_p || '1rem'};
			--typography-small-size: {siteSettings.typography?.smallSize || branding.font_size_small || '0.875rem'};
			--typography-line-height: {siteSettings.typography?.lineHeight || '1.6'};
			
			--footer-background-color: {siteSettings.footer?.backgroundColor || branding.footer_background_color || '#2c3e50'};
			--footer-text-color: {siteSettings.footer?.textColor || branding.footer_text_color || 'rgba(255, 255, 255, 0.9)'};
			--footer-link-color: {siteSettings.footer?.linkColor || branding.footer_link_color || 'rgba(255, 255, 255, 0.9)'};
			--footer-link-hover-color: {siteSettings.footer?.linkHoverColor || '#e73b42'};
			--footer-padding: {siteSettings.footer?.padding || branding.footer_padding || '2rem 0'};
			
			--hero-min-height: {siteSettings.hero?.minHeight || '250px'};
			--hero-mobile-min-height: {siteSettings.hero?.mobileMinHeight || '200px'};
		}
	</style>
</svelte:head>

<AccessibilitySettings />

<div 
	class="public-layout theme-{theme}"
	style="
		--primary-color: {branding.primary_color};
		--secondary-color: {branding.secondary_color};
		--accent-color: {branding.accent_color};
		--background-color: {branding.background_color};
		--text-color: {branding.text_color};
		--font-family: {branding.font_family};
		--heading-font: {branding.heading_font || branding.font_family};
		--font-size-h1: {branding.font_size_h1};
		--font-size-h2: {branding.font_size_h2};
		--font-size-h3: {branding.font_size_h3};
		--font-size-h4: {branding.font_size_h4};
		--font-size-p: {branding.font_size_p};
		--font-size-small: {branding.font_size_small};
		--footer-bg: {branding.footer_background_color};
		--footer-text: {branding.footer_text_color};
		--footer-link: {branding.footer_link_color};
		--footer-padding: {branding.footer_padding};
		--typography-h1-size: {siteSettings.typography.h1Size};
		--typography-h2-size: {siteSettings.typography.h2Size};
		--typography-h3-size: {siteSettings.typography.h3Size};
		--typography-h4-size: {siteSettings.typography.h4Size};
		--typography-h5-size: {siteSettings.typography.h5Size};
		--typography-h6-size: {siteSettings.typography.h6Size};
		--typography-p-size: {siteSettings.typography.pSize};
		--typography-small-size: {siteSettings.typography.smallSize};
		--typography-line-height: {siteSettings.typography.lineHeight};
	"
>
	<!-- Header Navigation -->
	{#if showNav && siteSettings.header.links.length > 0}
		<nav class="site-header">
			<div class="header-container">
				<!-- Hamburger Menu (Mobile) -->
				<HamburgerMenu links={siteSettings.header.links} />
				
				<!-- Desktop Links -->
				<div class="header-links">
					{#each siteSettings.header.links as link}
						<a href={link.url} class="header-link">{link.title}</a>
					{/each}
				</div>
				
				<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
					{theme === 'light' ? '🌙' : '☀️'}
				</button>
			</div>
		</nav>
	{/if}

	<!-- Hero Section (on homepage ONLY - consolidated, no duplicates) -->
	{#if showHero}
		<section class="homepage-hero" style="background-image: url('{siteSettings.hero.imageUrl}');">
			<div class="hero-overlay">
				<div class="hero-content">
					{#if siteSettings.hero.title}
						<h1 class="hero-title">{siteSettings.hero.title}</h1>
					{/if}
					{#if siteSettings.hero.subhead}
						<p class="hero-tagline">{siteSettings.hero.subhead}</p>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	<!-- Main Content -->
	<main id="main-content">
		{@render children()}
	</main>

	<!-- Footer -->
	{#if branding.footer_content || siteSettings.footer.text || (siteSettings.footer.links && siteSettings.footer.links.length > 0)}
		<footer class="site-footer">
			<div class="footer-container">
				{#if branding.footer_content}
					<!-- Sanitized footer content with markdown links from branding -->
					<div class="footer-content">
						{@html parsedFooterContent}
					</div>
				{:else if siteSettings.footer.links && siteSettings.footer.links.length > 0}
					<div class="footer-links">
						{#each siteSettings.footer.links.sort((a, b) => (a.order || 0) - (b.order || 0)) as link}
							<a href={link.url} class="footer-link">
								{link.title}
							</a>
						{/each}
					</div>
				{:else if siteSettings.footer.link}
					<a href={siteSettings.footer.link} class="footer-link">
						{siteSettings.footer.text}
					</a>
				{:else}
					<p class="footer-text">{siteSettings.footer.text}</p>
				{/if}
			</div>
		</footer>
	{/if}
	
	<!-- Floating Admin Button (only for authenticated users) -->
	<FloatingAdminButton show={isAuthenticated} />
</div>

<style>
	/* CSS Variables for theming - can be customized in global.css or here */
	:global(:root) {
		--primary-color: #e73b42;
		--secondary-color: #667eea;
		--accent-color: #2c3e50;
		--background-color: #ffffff;
		--text-color: #333333;
		--font-family: system-ui, -apple-system, sans-serif;
		--heading-font: system-ui, -apple-system, sans-serif;
		--font-size-h1: 2.5rem;
		--font-size-h2: 2rem;
		--font-size-h3: 1.5rem;
		--font-size-h4: 1.25rem;
		--font-size-p: 1rem;
		--font-size-small: 0.875rem;
		--footer-bg: #2c3e50;
		--footer-text: #ffffff;
		--footer-link: #ff6b72;
		--footer-padding: 2rem 0;
	}

	:global(.theme-dark) {
		--primary-color: #ff6b72;
		--secondary-color: #8b9eff;
		--accent-color: #3d5a7f;
		--background-color: #1a1a1a;
		--text-color: #e5e5e5;
	}
	
	/* Apply typography CSS variables globally */
	:global(h1) {
		font-size: var(--typography-h1-size, 2.5rem);
		line-height: 1.2;
	}
	
	:global(h2) {
		font-size: var(--typography-h2-size, 2rem);
		line-height: 1.3;
	}
	
	:global(h3) {
		font-size: var(--typography-h3-size, 1.75rem);
		line-height: 1.3;
	}
	
	:global(h4) {
		font-size: var(--typography-h4-size, 1.5rem);
		line-height: 1.4;
	}
	
	:global(h5) {
		font-size: var(--typography-h5-size, 1.25rem);
		line-height: 1.4;
	}
	
	:global(h6) {
		font-size: var(--typography-h6-size, 1rem);
		line-height: 1.4;
	}
	
	:global(p) {
		font-size: var(--typography-p-size, 1rem);
		line-height: var(--typography-line-height, 1.6);
	}
	
	:global(small), :global(.small) {
		font-size: var(--typography-small-size, 0.875rem);
	}

	/* Apply typography globally - supports both branding and siteSettings */
	:global(h1) {
		font-size: var(--typography-h1-size, var(--font-size-h1, 2.5rem));
		font-family: var(--heading-font);
		line-height: 1.2;
	}

	:global(h2) {
		font-size: var(--typography-h2-size, var(--font-size-h2, 2rem));
		font-family: var(--heading-font);
		line-height: 1.3;
	}

	:global(h3) {
		font-size: var(--typography-h3-size, var(--font-size-h3, 1.5rem));
		font-family: var(--heading-font);
		line-height: 1.3;
	}

	:global(h4) {
		font-size: var(--typography-h4-size, var(--font-size-h4, 1.25rem));
		font-family: var(--heading-font);
		line-height: 1.4;
	}

	:global(h5) {
		font-size: var(--typography-h5-size, 1.25rem);
		font-family: var(--heading-font);
		line-height: 1.4;
	}

	:global(h6) {
		font-size: var(--typography-h6-size, 1rem);
		font-family: var(--heading-font);
		line-height: 1.4;
	}

	:global(p) {
		font-size: var(--typography-p-size, var(--font-size-p, 1rem));
		line-height: var(--typography-line-height, 1.6);
	}

	:global(small), :global(.small-text) {
		font-size: var(--typography-small-size, var(--font-size-small, 0.875rem));
	}

	.public-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--background-color);
		color: var(--text-color);
		font-family: var(--font-family);
		font-size: var(--font-size-p);
		transition: background-color 0.3s, color 0.3s;
		overflow-x: hidden;
		position: relative;
	}

	/* Header Navigation Styles */
	.site-header {
		background: var(--primary-color);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		padding: 0.75rem 0;
	}

	.header-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
		gap: 2rem;
		align-items: center;
		justify-content: space-between;
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

	/* Homepage Hero Styles */
	.homepage-hero {
		position: relative;
		min-height: var(--hero-min-height, 250px);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		background-color: var(--accent-color);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, rgba(231, 59, 66, 0.85), rgba(44, 62, 80, 0.85));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hero-content {
		position: relative;
		z-index: 1;
		text-align: center;
		color: white;
		max-width: 900px;
		padding: 2rem;
	}

	.hero-title {
		font-size: var(--typography-h1-size, 2.5rem);
		font-weight: 700;
		margin: 0 0 1rem 0;
		color: white;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		line-height: 1.2;
	}

	.hero-tagline {
		font-size: var(--typography-h3-size, 1.5rem);
		margin: 0;
		color: #ffffff;
		font-weight: 300;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
	}

	/* Main Content */
	#main-content {
		flex: 1;
	}

	/* Footer Styles - using CSS variables */
	.site-footer {
		background: var(--footer-background-color, #2c3e50);
		color: var(--footer-text-color, rgba(255, 255, 255, 0.9));
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: var(--footer-padding, 2rem 0);
		margin-top: 4rem;
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		text-align: center;
	}

	.footer-content {
		font-size: var(--font-size-small);
		color: var(--footer-text);
		line-height: 1.6;
	}

	.footer-content :global(br) {
		display: block;
		margin: 0.5rem 0;
	}

	.footer-text {
		font-size: 0.9rem;
		color: var(--footer-text-color, rgba(255, 255, 255, 0.8));
		margin: 0;
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		justify-content: center;
		align-items: center;
	}

	.footer-link {
		color: var(--footer-link-color, rgba(255, 255, 255, 0.9));
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s;
	}

	.footer-link:hover {
		color: var(--footer-link-hover-color, var(--primary-color));
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: center;
		align-items: center;
	}

	.footer-links .footer-link {
		color: var(--footer-link);
		text-decoration: none;
		font-size: var(--font-size-small);
		transition: opacity 0.2s;
	}

	.footer-links .footer-link:hover {
		opacity: 0.8;
		text-decoration: underline;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.header-container {
			padding: 0 1rem;
		}

		/* Hide desktop links on mobile (hamburger menu shows instead) */
		.header-links {
			display: none;
		}

		.homepage-hero {
			min-height: var(--hero-mobile-min-height, 200px);
		}

		.hero-title {
			font-size: calc(var(--typography-h1-size, 2.5rem) * 0.7);
		}

		.hero-tagline {
			font-size: calc(var(--typography-h3-size, 1.5rem) * 0.8);
		}

		.hero-content {
			padding: 1.5rem 1rem;
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
