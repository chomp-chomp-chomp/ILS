<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let query = $state('');

	// Use branding for library name, tagline, logo
	const branding = $derived(data.branding);

	function handleSearch() {
		if (query.trim()) {
			goto(`/catalog/search?q=${encodeURIComponent(query)}`);
		}
	}
</script>

<div class="catalog-home">
	<!-- Main Search Section -->
	<section class="search-section">
		<div class="search-content">
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

			<!-- Default catalog info -->
			<section class="catalog-info">
				<h2>What's in this catalog?</h2>
				<p>
					This catalog contains bibliographic records for books, serials, audiovisual materials, and electronic resources.
					Use the search box above to find items by title, author, subject headings, or ISBN.
					Advanced search options allow for more precise queries using multiple criteria.
				</p>
			</section>
		</div>
	</section>
</div>

<style>
	.catalog-home {
		min-height: calc(100vh - 400px);
		background: #f5f5f5;
		padding: 0;
	}

	.search-section {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
		padding: 2rem;
		min-height: calc(100vh - 400px);
		display: flex;
		flex-direction: column;
	}

	.search-content {
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
		border-radius: var(--radius-md, 8px);
	}

	.tagline {
		font-size: var(--typography-h3-size, 1.5rem);
		margin-bottom: 3rem;
		color: #333;
		font-weight: 400;
	}

	.search-box {
		display: flex;
		max-width: 600px;
		width: 100%;
		margin: 0 auto 1.5rem;
		background: rgba(255, 255, 255, 0.9);
		border-radius: var(--radius-md, 8px);
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		border: 2px solid rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(10px);
	}

	.search-box:focus-within {
		border-color: var(--primary-color, #e73b42);
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
		background: var(--primary-color, #e73b42);
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
		border-radius: var(--radius-md, 8px);
		max-width: 600px;
		width: 100%;
		margin: 0 auto;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.search-links a {
		color: var(--primary-color, #e73b42);
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
		border-radius: var(--radius-md, 8px);
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.catalog-info h2 {
		font-size: var(--typography-h4-size, 1.125rem);
		color: rgba(0, 0, 0, 0.7);
		margin: 0 0 1rem 0;
		font-weight: 500;
		text-transform: none;
	}

	.catalog-info p {
		color: rgba(0, 0, 0, 0.6);
		font-size: var(--typography-p-size, 0.95rem);
		line-height: var(--typography-line-height, 1.6);
		margin: 0;
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

		.main-logo {
			max-width: 250px;
		}

		.tagline {
			font-size: calc(var(--typography-h3-size, 1.5rem) * 0.8);
		}

		.search-content {
			padding: 2rem 1rem;
		}
		
		.search-box input {
			font-size: 1rem;
			padding: 0.875rem 1rem;
		}
		
		.search-box button {
			padding: 0.875rem 1.5rem;
			font-size: 1rem;
		}
	}
</style>
