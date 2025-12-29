<script context="module" lang="ts">
	export const prerender = false;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let query = $state('');

	function handleSearch() {
		if (query.trim()) {
			goto(`/catalog/search/results?q=${encodeURIComponent(query)}`);
		}
	}
</script>

<div class="opac-home">
	<header class="hero">
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
			<a href="/catalog/browse">Browse All</a>
		</div>
	</header>

	<div class="info-cards">
		<div class="card">
			<h3>📚 Books & E-books</h3>
			<p>Search our print and electronic book collection</p>
		</div>

		<div class="card">
			<h3>📰 Serials</h3>
			<p>Browse journals, magazines, and newsletters</p>
		</div>

		<div class="card">
			<h3>🎬 Media</h3>
			<p>Find DVDs, audiobooks, and digital media</p>
		</div>
	</div>

	<footer class="home-footer">
		<a href="/">← Back to Home</a>
		{#if data && data.session}
			<span>|</span>
			<a href="/admin">Admin Panel</a>
		{/if}
	</footer>
</div>

<style>
	.opac-home {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 2rem;
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
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}

	.search-box input {
		flex: 1;
		padding: 1rem 1.5rem;
		border: none;
		font-size: 1.125rem;
		color: #333;
	}

	.search-box input:focus {
		outline: none;
	}

	.search-box button {
		padding: 1rem 2rem;
		background: #667eea;
		color: white;
		border: none;
		font-size: 1.125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.search-box button:hover {
		background: #5568d3;
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

	.info-cards {
		max-width: 1200px;
		margin: 4rem auto;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 2rem;
	}

	.card {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		padding: 2rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.card h3 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.card p {
		margin: 0;
		opacity: 0.9;
	}

	.home-footer {
		text-align: center;
		margin-top: 4rem;
		opacity: 0.8;
	}

	.home-footer a {
		color: white;
		text-decoration: none;
	}

	.home-footer a:hover {
		text-decoration: underline;
	}

	.home-footer span {
		margin: 0 0.5rem;
	}
</style>

