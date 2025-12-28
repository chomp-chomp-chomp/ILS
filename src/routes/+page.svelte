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
		background: var(--bg-primary);
		padding: 0;
	}

	.header-top {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 2rem;
		text-align: right;
		background: white;
		border-bottom: 1px solid var(--border);
	}

	.admin-link {
		color: var(--accent);
		font-size: 0.875rem;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		transition: all 0.2s;
	}

	.admin-link:hover {
		background: var(--accent);
		color: white;
	}

	.hero {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
		padding: 6rem 2rem 4rem;
		background: white;
		border-left: 1px solid var(--border);
		border-right: 1px solid var(--border);
		min-height: calc(100vh - 60px);
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	h1 {
		font-size: 3.5rem;
		margin: 0 0 1rem 0;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hero > p {
		font-size: 1.5rem;
		margin-bottom: 3rem;
		color: var(--text-muted);
	}

	.search-box {
		display: flex;
		max-width: 600px;
		margin: 0 auto 1.5rem;
		background: white;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		border: 2px solid var(--border);
	}

	.search-box:focus-within {
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(231, 59, 66, 0.15);
	}

	.search-box input {
		flex: 1;
		padding: 1rem 1.5rem;
		border: none;
		font-size: 1.125rem;
		color: var(--text-primary);
		background: transparent;
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
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		max-width: 600px;
		margin: 0 auto;
	}

	.search-links a {
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
	}

	.search-links a:hover {
		text-decoration: underline;
	}

	.search-links span {
		opacity: 0.3;
		color: var(--text-muted);
	}

	@media (max-width: 768px) {
		h1 {
			font-size: 2.5rem;
		}

		.hero > p {
			font-size: 1.25rem;
		}

		.hero {
			border-left: none;
			border-right: none;
			padding: 4rem 1rem 2rem;
		}
	}
</style>
