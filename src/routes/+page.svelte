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

		<h1>Library Catalog</h1>
		<p>Search our collection</p>

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
	</header>
</div>

<style>
	.catalog-home {
		min-height: 100vh;
		background: linear-gradient(135deg, var(--accent) 0%, #c62d34 100%);
		color: white;
		padding: 2rem;
	}

	.header-top {
		max-width: 800px;
		margin: 0 auto 2rem;
		text-align: right;
	}

	.admin-link {
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.875rem;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: var(--radius-sm);
		transition: all 0.2s;
	}

	.admin-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.hero {
		max-width: 800px;
		margin: 0 auto;
		text-align: center;
		padding: 4rem 0;
	}

	h1 {
		font-size: 3.5rem;
		margin: 0 0 1rem 0;
		font-weight: 700;
	}

	.hero > p {
		font-size: 1.5rem;
		margin-bottom: 3rem;
		opacity: 0.9;
	}

	.search-box {
		display: flex;
		max-width: 600px;
		margin: 0 auto 1rem;
		background: white;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}

	.search-box input {
		flex: 1;
		padding: 1rem 1.5rem;
		border: none;
		font-size: 1.125rem;
		color: var(--text-primary);
	}

	.search-box input:focus {
		outline: none;
	}

	.search-box button {
		padding: 1rem 2rem;
		background: var(--accent);
		color: white;
		border: none;
		font-size: 1.125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.search-box button:hover {
		background: var(--accent-hover);
	}

	.search-links {
		display: flex;
		gap: 1rem;
		justify-content: center;
		font-size: 1rem;
	}

	.search-links a {
		color: white;
		text-decoration: none;
		opacity: 0.9;
	}

	.search-links a:hover {
		opacity: 1;
		text-decoration: underline;
	}

	.search-links span {
		opacity: 0.5;
	}

	@media (max-width: 768px) {
		h1 {
			font-size: 2.5rem;
		}

		.hero > p {
			font-size: 1.25rem;
		}
	}
</style>
