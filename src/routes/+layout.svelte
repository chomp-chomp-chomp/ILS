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

	// Show custom header on all non-admin pages if enabled
	let showCustomHeader = $derived(branding?.show_header === true && !$page.url.pathname.startsWith('/admin'));

	// Show footer on non-admin pages if enabled
	let showFooter = $derived(
		branding?.show_powered_by === true &&
			!!branding?.footer_text &&
			!$page.url.pathname.startsWith('/admin')
	);

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
	<!-- Custom Header (if enabled in branding) -->
	{#if showCustomHeader}
		<nav class="custom-header">
			<div class="header-container">
				{#if branding?.logo_url}
					<img src={branding.logo_url} alt={branding?.library_name || 'Library'} class="header-logo" />
				{/if}
				<div class="header-links">
					{#each [...(branding?.header_links || [])].sort((a, b) => a.order - b.order) as link}
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

	<!-- Footer (if enabled in branding, shown on non-admin pages) -->
	{#if showFooter}
		<footer class="site-footer">
			<div class="footer-container">
				<div class="footer-content">
					<!-- Main Footer Text -->
					{#if branding?.footer_text}
						<p class="footer-text">{branding.footer_text}</p>
					{/if}

					<!-- Contact Information -->
					{#if branding?.contact_email || branding?.contact_phone || branding?.contact_address}
						<div class="footer-contact">
							{#if branding?.contact_email}
								<a href="mailto:{branding.contact_email}" class="footer-link">
									✉️ {branding.contact_email}
								</a>
							{/if}
							{#if branding?.contact_phone}
								<a href="tel:{branding.contact_phone}" class="footer-link">
									📞 {branding.contact_phone}
								</a>
							{/if}
							{#if branding?.contact_address}
								<p class="footer-address">📍 {branding.contact_address}</p>
							{/if}
						</div>
					{/if}

					<!-- Social Media Links -->
					{#if branding?.facebook_url || branding?.twitter_url || branding?.instagram_url}
						<div class="footer-social">
							{#if branding?.facebook_url}
								<a href={branding.facebook_url} target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Facebook">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
										<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
									</svg>
								</a>
							{/if}
							{#if branding?.twitter_url}
								<a href={branding.twitter_url} target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Twitter/X">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
										<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
									</svg>
								</a>
							{/if}
							{#if branding?.instagram_url}
								<a href={branding.instagram_url} target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Instagram">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
									</svg>
								</a>
							{/if}
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

	.footer-contact {
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
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.footer-link:hover {
		color: var(--primary-color, #e73b42);
	}

	.footer-address {
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.9rem;
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.footer-social {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		align-items: center;
	}

	.social-link {
		color: rgba(255, 255, 255, 0.9);
		transition: all 0.2s;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
	}

	.social-link:hover {
		color: var(--primary-color, #e73b42);
		background: rgba(255, 255, 255, 0.2);
		transform: translateY(-2px);
	}

	.social-link svg {
		width: 20px;
		height: 20px;
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

		.footer-contact {
			flex-direction: column;
			gap: 1rem;
		}

		.footer-social {
			gap: 1rem;
		}

		.social-link {
			width: 36px;
			height: 36px;
		}

		.social-link svg {
			width: 18px;
			height: 18px;
		}
	}
</style>
