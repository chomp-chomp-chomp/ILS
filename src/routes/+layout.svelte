<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Determine if we should show the default navigation
	let showNav = $derived($page.url.pathname !== '/' && !$page.url.pathname.startsWith('/admin'));

	// Get branding configuration with defaults
	const branding = $derived(
		(data as any).branding || {
			library_name: 'Chomp Chomp Library Catalog',
			logo_url: null,
			homepage_logo_url: 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library',
			primary_color: '#e73b42',
			secondary_color: '#667eea',
			accent_color: '#2c3e50',
			background_color: '#ffffff',
			text_color: '#333333',
			font_family: 'system-ui, -apple-system, sans-serif',
			heading_font: null,
			favicon_url: null,
			custom_css: null,
			custom_head_html: null,
			show_header: false,
			header_links: []
		}
	);

	// Show custom header on all non-admin pages if enabled
	let showCustomHeader = $derived(branding.show_header && !$page.url.pathname.startsWith('/admin'));

	onMount(() => {
		const { data: authData } = data.supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			authData.subscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={branding.favicon_url || favicon} />
	<title>{branding.library_name}</title>

	{#if branding.custom_head_html}
		{@html branding.custom_head_html}
	{/if}

	{#if branding.custom_css}
		<style>
			{branding.custom_css}
		</style>
	{/if}
</svelte:head>

<AccessibilitySettings />

<main
	id="main-content"
	style="
		--primary-color: {branding.primary_color};
		--secondary-color: {branding.secondary_color};
		--accent-color: {branding.accent_color};
		--background-color: {branding.background_color};
		--text-color: {branding.text_color};
		--font-family: {branding.font_family};
		--heading-font: {branding.heading_font || branding.font_family};
	"
>
	<!-- Custom Header (if enabled in branding) -->
	{#if showCustomHeader}
		<nav class="custom-header">
			<div class="header-container">
				{#if branding.logo_url}
					<img src={branding.logo_url} alt={branding.library_name} class="header-logo" />
				{/if}
				<div class="header-links">
					{#each (branding.header_links || []).sort((a, b) => a.order - b.order) as link}
						<a href={link.url} class="header-link">{link.title}</a>
					{/each}
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
			</div>
		</nav>
	{/if}
	{@render children()}
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
	}
</style>
