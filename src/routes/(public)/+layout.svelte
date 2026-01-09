<script lang="ts">
	import type { LayoutData } from './$types';
	import type { SiteSettings } from '$lib/siteDefaults';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Site settings with robust defaults
	const siteSettings: SiteSettings = $derived((data as any).siteSettings);
</script>

<svelte:head>
	<!-- Favicon and metadata links -->
	<link rel="icon" type="image/x-icon" href={siteSettings.metadata.favicon} />
	<link rel="icon" type="image/png" sizes="16x16" href={siteSettings.metadata.favicon16} />
	<link rel="icon" type="image/png" sizes="32x32" href={siteSettings.metadata.favicon32} />
	<link rel="apple-touch-icon" sizes="180x180" href={siteSettings.metadata.appleTouchIcon} />
	<link rel="icon" type="image/png" sizes="192x192" href={siteSettings.metadata.androidChrome192} />
	<link rel="icon" type="image/png" sizes="512x512" href={siteSettings.metadata.androidChrome512} />
	<title>Chomp Chomp Library Catalog</title>
</svelte:head>

<div class="public-layout">
	<!-- Header Navigation -->
	<header class="site-header">
		<nav class="header-nav">
			<div class="nav-container">
				{#each siteSettings.header.links as link}
					<a href={link.url} class="nav-link">{link.title}</a>
				{/each}
			</div>
		</nav>
	</header>

	<!-- Main Content -->
	<main class="site-content">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="site-footer">
		<div class="footer-container">
			<p class="footer-text">
				<a href={siteSettings.footer.linkUrl} class="footer-link">
					{siteSettings.footer.text}
				</a>
			</p>
		</div>
	</footer>
</div>

<style>
	.public-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* Header Styles */
	.site-header {
		background: var(--primary-color, #e73b42);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		padding: 1rem 0;
		position: sticky;
		top: 0;
		z-index: 100;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.header-nav {
		width: 100%;
	}

	.nav-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
		gap: 2rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.nav-link {
		color: white;
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.nav-link:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
	}

	/* Main Content */
	.site-content {
		flex: 1;
		background: #f5f5f5;
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
		text-align: center;
	}

	.footer-text {
		font-size: 0.9rem;
		margin: 0;
	}

	.footer-link {
		color: rgba(255, 255, 255, 0.9);
		text-decoration: none;
		transition: color 0.2s;
	}

	.footer-link:hover {
		color: var(--primary-color, #e73b42);
	}

	/* Responsive Styles */
	@media (max-width: 768px) {
		.nav-container {
			padding: 0 1rem;
			gap: 1rem;
		}

		.nav-link {
			font-size: 0.85rem;
			padding: 0.4rem 0.8rem;
		}

		.footer-container {
			padding: 0 1rem;
		}
	}
</style>
