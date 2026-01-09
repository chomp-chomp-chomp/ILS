<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let query = $state('');

	// Use branding for library name, tagline, logo (kept for backward compatibility)
	const branding = $derived(data.branding);

	// Use siteConfig for homepage info section and hero
	const siteConfig = $derived((data as any).siteConfig || {
		homepage_info_enabled: false,
		homepage_info_title: 'Quick Links',
		homepage_info_content: '',
		homepage_info_links: [],
		homepage_hero_enabled: false,
		homepage_hero_title: '',
		homepage_hero_tagline: '',
		homepage_hero_image_url: null,
		homepage_hero_links: []
	});

	// Debug logging for homepage
	$effect(() => {
		if (browser) {
			console.log('🏠 [Homepage Debug] siteConfig:', siteConfig);
			console.log('🏠 [Homepage Debug] homepage_hero_enabled:', siteConfig?.homepage_hero_enabled);
			console.log('🏠 [Homepage Debug] homepage_hero_title:', siteConfig?.homepage_hero_title);
			console.log('🏠 [Homepage Debug] homepage_info_enabled:', siteConfig?.homepage_info_enabled);
			console.log('🏠 [Homepage Debug] Raw data.siteConfig:', (data as any).siteConfig);
		}
	});

	function handleSearch() {
		if (query.trim()) {
			goto(`/catalog/search?q=${encodeURIComponent(query)}`);
		}
	}
</script>

<div class="catalog-home">
	<!-- Homepage Hero Section (if enabled in siteConfig) -->
	<!-- Single hero: image on top, content below -->
	{#if Boolean(siteConfig?.homepage_hero_enabled) === true}
		<section class="homepage-hero-section">
			<!-- Hero Image (if provided) -->
			{#if siteConfig.homepage_hero_image_url}
				<div class="hero-image-container">
					<img 
						src={siteConfig.homepage_hero_image_url} 
						alt={siteConfig.homepage_hero_title || 'Library Hero'}
						class="hero-image"
					/>
				</div>
			{/if}
			
			<!-- Hero Content (below image, no overlay) -->
			<div class="hero-text-content">
				{#if siteConfig.homepage_hero_title}
					<h1 class="hero-title">{siteConfig.homepage_hero_title}</h1>
				{/if}
				
				{#if siteConfig.homepage_hero_tagline}
					<p class="hero-tagline">{siteConfig.homepage_hero_tagline}</p>
				{/if}

				{#if siteConfig.homepage_hero_links && siteConfig.homepage_hero_links.length > 0}
					<div class="hero-links">
						{#each [...siteConfig.homepage_hero_links].sort((a, b) => a.order - b.order) as link}
							<a href={link.url} class="hero-link-button">{link.title}</a>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<header class="hero">
		<!-- Removed duplicate admin link from here -->
		
		<div class="hero-content">
			{#if branding.homepage_logo_url}
				<img
					src={branding.homepage_logo_url}
					alt={branding.library_name}
					class="main-logo"
				/>
			{/if}
			<p class="tagline">{branding.library_tagline || 'Search our collection'}</p>

			<div class="search-box">
				<input
					type="search"
					bind:value={query}
					placeholder="Search by title, author, subject, ISBN..."
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>
				<button onclick={handleSearch}>Search</button>
			</div>

			<div class="search-links">
				<a href="/catalog/search/advanced">Advanced Search</a>
				<span>|</span>
				<a href="/catalog/browse">Browse Collection</a>
			</div>

			<!-- Homepage Info Section (if enabled in siteConfig) -->
			<!-- ROBUST: Explicit boolean check -->
			{#if Boolean(siteConfig?.homepage_info_enabled) === true}
				<section class="homepage-info">
					<h2>{siteConfig.homepage_info_title || 'Quick Links'}</h2>
					{#if siteConfig.homepage_info_content}
						<div class="info-content">
							<p>{siteConfig.homepage_info_content}</p>
						</div>
					{/if}
					{#if siteConfig.homepage_info_links && siteConfig.homepage_info_links.length > 0}
						<div class="info-links">
							{#each [...siteConfig.homepage_info_links].sort((a, b) => a.order - b.order) as link}
								<a href={link.url} class="info-link">{link.title}</a>
							{/each}
						</div>
					{/if}
				</section>
			{:else}
				<!-- Default catalog info (shown when homepage info is disabled) -->
				<section class="catalog-info">
					<h2>What's in this catalog?</h2>
					<p>
						This catalog contains bibliographic records for books, serials, audiovisual materials, and electronic resources.
						Use the search box above to find items by title, author, subject headings, or ISBN.
						Advanced search options allow for more precise queries using multiple criteria.
					</p>
				</section>
			{/if}
		</div>
	</header>
</div>

<style>
	.catalog-home {
		min-height: 100vh;
		background: #f5f5f5;
		padding: 0;
	}

	/* Removed .header-top and duplicate .admin-link styles - now using floating button */

	.hero {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
		padding: 2rem;
		min-height: calc(100vh - 60px);
		display: flex;
		flex-direction: column;
	}

	.hero-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 4rem 2rem;
	}

	.main-logo {
		max-width: 300px;
		width: 100%;
		height: auto;
		margin-bottom: 2rem;
		border-radius: var(--radius-md);
	}

	.tagline {
		font-size: 1.5rem;
		margin-bottom: 3rem;
		color: #666;
		font-weight: 300;
	}

	.search-box {
		display: flex;
		max-width: 600px;
		width: 100%;
		margin: 0 auto 1.5rem;
		background: rgba(255, 255, 255, 0.9);
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		border: 2px solid rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(10px);
	}

	.search-box:focus-within {
		border-color: #e73b42;
		box-shadow: 0 4px 20px rgba(231, 59, 66, 0.4);
	}

	.search-box input {
		flex: 1;
		padding: 1rem 1.5rem;
		border: none;
		font-size: 1.125rem;
		color: #333;
		background: transparent;
	}

	.search-box input::placeholder {
		color: rgba(0, 0, 0, 0.4);
	}

	.search-box input:focus {
		outline: none;
	}

	.search-box button {
		padding: 1rem 2rem;
		background: #e73b42;
		color: white;
		border: none;
		font-size: 1.125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.search-box button:hover {
		background: #d12d34;
		box-shadow: 0 0 20px rgba(231, 59, 66, 0.5);
	}

	.search-links {
		display: flex;
		gap: 1rem;
		justify-content: center;
		font-size: 1rem;
		padding: 1rem 1.5rem;
		background: rgba(255, 255, 255, 0.8);
		border-radius: var(--radius-md);
		max-width: 600px;
		width: 100%;
		margin: 0 auto;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.search-links a {
		color: #e73b42;
		text-decoration: none;
		font-weight: 500;
		transition: all 0.2s;
	}

	.search-links a:hover {
		color: #ff5a61;
		text-shadow: 0 0 8px rgba(231, 59, 66, 0.5);
	}

	.search-links span {
		opacity: 0.3;
		color: #888;
	}

	.catalog-info {
		max-width: 700px;
		width: 100%;
		margin: 3rem auto 0;
		padding: 2rem;
		background: rgba(255, 255, 255, 0.7);
		border-radius: var(--radius-md);
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.catalog-info h2 {
		font-size: 1.125rem;
		color: rgba(0, 0, 0, 0.7);
		margin: 0 0 1rem 0;
		font-weight: 500;
		text-transform: none;
	}

	.catalog-info p {
		color: rgba(0, 0, 0, 0.6);
		font-size: 0.95rem;
		line-height: 1.6;
		margin: 0;
	}

	/* Homepage Info Section Styles */
	.homepage-info {
		max-width: 700px;
		width: 100%;
		margin: 3rem auto 0;
		padding: 2rem;
		background: rgba(255, 255, 255, 0.85);
		border-radius: var(--radius-md);
		border: 1px solid rgba(231, 59, 66, 0.15);
	}

	.homepage-info h2 {
		font-size: 1.25rem;
		color: #e73b42;
		margin: 0 0 1rem 0;
		font-weight: 600;
	}

	.info-content {
		color: rgba(0, 0, 0, 0.7);
		font-size: 0.95rem;
		line-height: 1.6;
		margin-bottom: 1.5rem;
	}

	.info-content p {
		margin: 0.5rem 0;
	}

	.info-links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.info-link {
		display: block;
		padding: 0.75rem 1rem;
		background: white;
		color: #e73b42;
		text-decoration: none;
		border-radius: 6px;
		border: 1px solid rgba(231, 59, 66, 0.3);
		font-weight: 500;
		transition: all 0.2s;
		text-align: center;
	}

	.info-link:hover {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
		box-shadow: 0 2px 8px rgba(231, 59, 66, 0.3);
	}

	/* Homepage Hero Styles - NEW DESIGN
	 * Image on top, text content below (no overlay)
	 * Compact and responsive
	 */
	.homepage-hero-section {
		width: 100%;
		background: white;
		margin-bottom: 2rem;
	}

	.hero-image-container {
		width: 100%;
		max-height: 300px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f5f5;
	}

	.hero-image {
		width: 100%;
		height: auto;
		max-height: 300px;
		object-fit: cover;
		display: block;
	}

	.hero-text-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		text-align: center;
	}

	.hero-title {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0 0 1rem 0;
		color: #e73b42;
		line-height: 1.2;
	}

	.hero-tagline {
		font-size: 1.25rem;
		margin: 0 0 1.5rem 0;
		color: #666;
		font-weight: 300;
	}

	.hero-links {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
		margin-top: 1.5rem;
	}

	.hero-link-button {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: #e73b42;
		color: white;
		text-decoration: none;
		border-radius: 6px;
		font-weight: 600;
		font-size: 1rem;
		transition: all 0.3s;
		box-shadow: 0 2px 8px rgba(231, 59, 66, 0.2);
	}

	.hero-link-button:hover {
		background: #d12d34;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(231, 59, 66, 0.3);
	}

	@media (max-width: 768px) {
		.hero-image-container {
			max-height: 200px;
		}

		.hero-image {
			max-height: 200px;
		}

		.hero-text-content {
			padding: 1.5rem 1rem;
		}

		.hero-title {
			font-size: 1.75rem;
		}

		.hero-tagline {
			font-size: 1.1rem;
		}

		.hero-link-button {
			padding: 0.625rem 1.25rem;
			font-size: 0.95rem;
		}
	}

		.tagline {
			font-size: 1.25rem;
		}

		.hero-content {
			padding: 2rem 1rem;
		}

		.hero-title {
			font-size: 2rem;
		}

		.hero-tagline {
			font-size: 1.2rem;
		}

		.hero-content-wrapper {
			padding: 2rem 1rem;
		}

	}
</style>
