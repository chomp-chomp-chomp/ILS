<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';
	import { supabase } from '$lib/supabase';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Site settings with safe defaults
	const siteSettings = $derived((data as any).siteSettings || {
		header: { links: [] },
		footer: { text: '', link: '' },
		hero: { title: '', subhead: '', imageUrl: '' }
	});

	// Branding for library name, favicon, typography, and footer
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
		font_size_h1: '2.5rem',
		font_size_h2: '2rem',
		font_size_h3: '1.5rem',
		font_size_h4: '1.25rem',
		font_size_p: '1rem',
		font_size_small: '0.875rem',
		footer_background_color: '#2c3e50',
		footer_text_color: '#ffffff',
		footer_link_color: '#ff6b72',
		footer_padding: '2rem 0'
	});

	// Determine if we should show the navigation bar (not on homepage)
	let showNav = $derived($page.url.pathname !== '/');

	// Show hero on homepage
	let showHero = $derived($page.url.pathname === '/');

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

	// Mobile menu state
	let mobileMenuOpen = $state(false);
	
	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
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
	"
>
	<!-- Header Navigation -->
	{#if showNav && siteSettings.header.links.length > 0}
		<nav class="site-header">
			<div class="header-container">
				<!-- Mobile hamburger menu (left side) -->
				<button class="hamburger-menu" onclick={toggleMobileMenu} aria-label="Toggle menu">
					<span class="hamburger-icon"></span>
					<span class="hamburger-icon"></span>
					<span class="hamburger-icon"></span>
				</button>
				
				<!-- Desktop links -->
				<div class="header-links desktop-only">
					{#each siteSettings.header.links as link}
						<a href={link.url} class="header-link">{link.title}</a>
					{/each}
				</div>
				
				<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
					{theme === 'light' ? '🌙' : '☀️'}
				</button>
			</div>
		</nav>
		
		<!-- Mobile drawer menu -->
		{#if mobileMenuOpen}
			<div class="mobile-drawer-overlay" onclick={closeMobileMenu}></div>
			<div class="mobile-drawer">
				<div class="mobile-drawer-header">
					<h3>Menu</h3>
					<button class="close-drawer" onclick={closeMobileMenu} aria-label="Close menu">×</button>
				</div>
				<nav class="mobile-nav">
					{#each siteSettings.header.links as link}
						<a href={link.url} class="mobile-link" onclick={closeMobileMenu}>{link.title}</a>
					{/each}
				</nav>
			</div>
		{/if}
	{/if}

	<!-- Main Content -->
	<main id="main-content">
		{@render children()}
	</main>

	<!-- Footer -->
	{#if branding.footer_content || siteSettings.footer.text}
		<footer class="site-footer">
			<div class="footer-container">
				{#if branding.footer_content}
					<!-- Parse simple markdown-style links: [text](url) -->
					<div class="footer-content">
						{@html branding.footer_content
							.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="footer-link">$1</a>')
							.replace(/\n/g, '<br>')}
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
	
	<!-- Floating Admin Button (only for authenticated users on public pages) -->
	{#if data.session}
		<a href="/admin" class="floating-admin-button" title="Admin Panel">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
				<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
			</svg>
		</a>
	{/if}
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

	/* Apply typography globally */
	:global(h1) {
		font-size: var(--font-size-h1);
		font-family: var(--heading-font);
	}

	:global(h2) {
		font-size: var(--font-size-h2);
		font-family: var(--heading-font);
	}

	:global(h3) {
		font-size: var(--font-size-h3);
		font-family: var(--heading-font);
	}

	:global(h4) {
		font-size: var(--font-size-h4);
		font-family: var(--heading-font);
	}

	:global(p) {
		font-size: var(--font-size-p);
	}

	:global(small), :global(.small-text) {
		font-size: var(--font-size-small);
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
		min-height: 400px;
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
		padding: 3rem 2rem;
	}

	.admin-link-wrapper {
		position: absolute;
		top: 1rem;
		right: 2rem;
	}

	.admin-link {
		color: white;
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.4);
		padding: 0.5rem 1rem;
		border-radius: 4px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.admin-link:hover {
		background: white;
		color: var(--primary-color);
	}

	.hero-title {
		font-size: 3rem;
		font-weight: 700;
		margin: 0 0 1rem 0;
		color: white;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		line-height: 1.2;
	}

	.hero-tagline {
		font-size: 1.5rem;
		margin: 0;
		color: rgba(255, 255, 255, 0.95);
		font-weight: 300;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	/* Main Content */
	#main-content {
		flex: 1;
	}

	/* Footer Styles */
	.site-footer {
		background: var(--footer-bg);
		color: var(--footer-text);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: var(--footer-padding);
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
		font-size: var(--font-size-small);
		color: var(--footer-text);
		margin: 0;
	}

	.footer-link {
		color: var(--footer-link);
		text-decoration: underline;
		font-size: var(--font-size-small);
		transition: opacity 0.2s;
	}

	.footer-link:hover {
		opacity: 0.8;
	}

	/* Hamburger Menu Button */
	.hamburger-menu {
		display: none;
		flex-direction: column;
		gap: 4px;
		background: transparent;
		border: none;
		padding: 0.5rem;
		cursor: pointer;
		z-index: 1001;
	}

	.hamburger-icon {
		display: block;
		width: 24px;
		height: 2px;
		background: white;
		border-radius: 2px;
		transition: all 0.3s;
	}

	/* Mobile Drawer */
	.mobile-drawer-overlay {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
	}

	.mobile-drawer {
		display: none;
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px;
		background: white;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
		z-index: 1001;
		overflow-y: auto;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.mobile-drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e0e0e0;
		background: var(--primary-color);
		color: white;
	}

	.mobile-drawer-header h3 {
		margin: 0;
		font-size: 1.2rem;
	}

	.close-drawer {
		background: transparent;
		border: none;
		color: white;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		line-height: 1;
	}

	.mobile-nav {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
	}

	.mobile-link {
		color: var(--text-color);
		text-decoration: none;
		padding: 1rem 1.5rem;
		font-size: 1rem;
		border-bottom: 1px solid #f0f0f0;
		transition: background 0.2s;
	}

	.mobile-link:hover {
		background: #f5f5f5;
	}

	/* Floating Admin Button */
	.floating-admin-button {
		position: fixed;
		bottom: 20px;
		right: 20px;
		width: 56px;
		height: 56px;
		background: var(--primary-color);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		text-decoration: none;
		transition: all 0.3s;
		z-index: 999;
	}

	.floating-admin-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
		background: #d12d34;
	}

	.floating-admin-button svg {
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
	}

	/* Desktop: Hide hamburger, show desktop links */
	@media (min-width: 769px) {
		.hamburger-menu {
			display: none !important;
		}
		
		.desktop-only {
			display: flex !important;
		}
	}

	/* Mobile: Show hamburger, hide desktop links */
	@media (max-width: 768px) {
		.header-container {
			padding: 0 1rem;
		}

		.hamburger-menu {
			display: flex;
		}

		.desktop-only {
			display: none !important;
		}

		.mobile-drawer-overlay {
			display: block;
		}

		.mobile-drawer {
			display: block;
		}

		.footer-container {
			padding: 0 1rem;
		}

		.floating-admin-button {
			bottom: 16px;
			right: 16px;
			width: 48px;
			height: 48px;
		}

		.floating-admin-button svg {
			width: 18px;
			height: 18px;
		}
	}
</style>
