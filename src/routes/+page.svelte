<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let query = $state('');

	function handleSearch() {
		if (query.trim()) {
			goto(`/catalog/search?q=${encodeURIComponent(query)}`);
		}
	}
</script>

<div class="catalog-home">
	<header class="hero">
		<div class="header-top">
			{#if data.session}
				<a href="/admin" class="admin-link">Admin</a>
			{/if}
		</div>

		<div class="hero-content">
			<img
				src="https://ik.imagekit.io/chompchomp/Chomp_Chomp_logos_5ty_DOfKY.jpeg?updatedAt=1766925051206"
				alt="Library Logo"
				class="main-logo"
			/>
			<p class="tagline">Search our collection</p>

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

			<section class="catalog-info">
				<h2>What's in this catalog?</h2>
				<p>
					This catalog contains bibliographic records for books, serials, audiovisual materials, and electronic resources.
					Use the search box above to find items by title, author, subject headings, or ISBN.
					Advanced search options allow for more precise queries using multiple criteria.
				</p>
			</section>
		</div>
	</header>
</div>

<style>
	.catalog-home {
		min-height: 100vh;
		background: linear-gradient(135deg, #3a3a3a 0%, #4d4d4d 100%);
		padding: 0;
	}

	.header-top {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 2rem;
		text-align: right;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid rgba(231, 59, 66, 0.2);
	}

	.admin-link {
		color: #e73b42;
		font-size: 0.875rem;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border: 1px solid #e73b42;
		border-radius: var(--radius-sm);
		transition: all 0.2s;
	}

	.admin-link:hover {
		background: #e73b42;
		color: white;
	}

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
		color: #b0b0b0;
		font-weight: 300;
	}

	.search-box {
		display: flex;
		max-width: 600px;
		width: 100%;
		margin: 0 auto 1.5rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		border: 2px solid rgba(255, 255, 255, 0.1);
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
		color: white;
		background: transparent;
	}

	.search-box input::placeholder {
		color: rgba(255, 255, 255, 0.4);
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
		background: rgba(255, 255, 255, 0.05);
		border-radius: var(--radius-md);
		max-width: 600px;
		width: 100%;
		margin: 0 auto;
		border: 1px solid rgba(255, 255, 255, 0.1);
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
		background: rgba(255, 255, 255, 0.03);
		border-radius: var(--radius-md);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.catalog-info h2 {
		font-size: 1.125rem;
		color: rgba(255, 255, 255, 0.6);
		margin: 0 0 1rem 0;
		font-weight: 500;
		text-transform: none;
	}

	.catalog-info p {
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.95rem;
		line-height: 1.6;
		margin: 0;
	}

	@media (max-width: 768px) {
		.main-logo {
			max-width: 250px;
		}

		.tagline {
			font-size: 1.25rem;
		}

		.hero-content {
			padding: 2rem 1rem;
		}
	}
</style>
