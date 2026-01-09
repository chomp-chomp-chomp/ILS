<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Site settings with safe defaults
	const siteSettings = $derived((data as any).siteSettings || {
		header: { links: [] },
		footer: { text: '', link: '' },
		hero: { title: '', subhead: '', imageUrl: '' }
	});

	// Branding for library name, favicon
	const branding = $derived((data as any).branding || {
		library_name: 'Chomp Chomp Library Catalog',
		favicon_url: null,
		custom_head_html: null,
		custom_css: null
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

		const { data: authData } = data.supabase.auth.onAuthStateChange(() => {
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

<div class="public-layout theme-{theme}">
	<!-- Header Navigation -->
	{#if showNav && siteSettings.header.links.length > 0}
		<nav class="site-header">
			<div class="header-container">
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

	<!-- Hero Section (on homepage) -->
	{#if showHero && siteSettings.hero.imageUrl}
		<section class="homepage-hero" style="background-image: url('{siteSettings.hero.imageUrl}');">
			<div class="hero-overlay">
				<div class="hero-content">
					{#if data.session}
						<div class="admin-link-wrapper">
							<a href="/admin" class="admin-link">Admin</a>
						</div>
					{/if}
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
	{#if siteSettings.footer.text}
		<footer class="site-footer">
			<div class="footer-container">
				{#if siteSettings.footer.link}
					<a href={siteSettings.footer.link} class="footer-link">
						{siteSettings.footer.text}
					</a>
				{:else}
					<p class="footer-text">{siteSettings.footer.text}</p>
				{/if}
			</div>
		</footer>
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
	}

	:global(.theme-dark) {
		--primary-color: #ff6b72;
		--secondary-color: #8b9eff;
		--accent-color: #3d5a7f;
		--background-color: #1a1a1a;
		--text-color: #e5e5e5;
	}

	.public-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--background-color);
		color: var(--text-color);
		font-family: var(--font-family);
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
		background: var(--accent-color);
		color: rgba(255, 255, 255, 0.9);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: 2rem 0;
		margin-top: 4rem;
	}

	.footer-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		text-align: center;
	}

	.footer-text {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.8);
		margin: 0;
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
		.header-container {
			padding: 0 1rem;
			flex-wrap: wrap;
		}

		.header-links {
			flex-wrap: wrap;
			gap: 0.75rem;
		}

		.header-link {
			font-size: 0.85rem;
			padding: 0.4rem 0.8rem;
		}

		.hero-title {
			font-size: 2rem;
		}

		.hero-tagline {
			font-size: 1.2rem;
		}

		.hero-content {
			padding: 2rem 1rem;
		}

		.admin-link-wrapper {
			right: 1rem;
		}

		.footer-container {
			padding: 0 1rem;
		}
	}
</style>
