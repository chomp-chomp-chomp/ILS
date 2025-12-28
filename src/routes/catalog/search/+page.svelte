<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let query = $derived($page.url.searchParams.get('q') || '');
	let results = $state<any[]>([]);
	let searching = $state(false);
	let error = $state('');

	onMount(() => {
		if (query) {
			performSearch();
		}
	});

	async function performSearch() {
		searching = true;
		error = '';
		results = [];

		try {
			// Use PostgreSQL full-text search
			const { data: searchResults, error: searchError } = await data.supabase
				.from('marc_records')
				.select('*')
				.or(
					`title_statement->>a.ilike.%${query}%,` +
						`main_entry_personal_name->>a.ilike.%${query}%,` +
						`isbn.ilike.%${query}%`
				)
				.limit(50);

			if (searchError) throw searchError;

			results = searchResults || [];
		} catch (err) {
			error = `Search error: ${err.message}`;
		} finally {
			searching = false;
		}
	}

	// Re-run search when query changes
	$effect(() => {
		if (query) {
			performSearch();
		}
	});
</script>

<div class="search-page">
	<header class="search-header">
		<h1>Search Results</h1>
		<div class="search-box">
			<input
				type="search"
				value={query}
				readonly
				placeholder="Search query"
			/>
			<a href="/catalog" class="btn-new-search">New Search</a>
		</div>
	</header>

	<div class="content">
		{#if searching}
			<p class="status">Searching...</p>
		{:else if error}
			<p class="error">{error}</p>
		{:else if results.length === 0}
			<div class="no-results">
				<p>No results found for "{query}"</p>
				<p>Try:</p>
				<ul>
					<li>Using different keywords</li>
					<li>Checking your spelling</li>
					<li>Using more general terms</li>
					<li>Trying <a href="/catalog/search/advanced">Advanced Search</a></li>
				</ul>
			</div>
		{:else}
			<div class="results-info">
				<p>Found {results.length} result{results.length === 1 ? '' : 's'}</p>
			</div>

			<div class="results-list">
				{#each results as record}
					<a href="/catalog/record/{record.id}" class="result-card">
						<div class="result-main">
							<h3>{record.title_statement?.a || 'Untitled'}</h3>
							{#if record.title_statement?.b}
								<p class="subtitle">{record.title_statement.b}</p>
							{/if}
							{#if record.main_entry_personal_name?.a}
								<p class="author">by {record.main_entry_personal_name.a}</p>
							{/if}
							{#if record.publication_info}
								<p class="publication">
									{#if record.publication_info.b}{record.publication_info.b}{/if}
									{#if record.publication_info.c}, {record.publication_info.c}{/if}
								</p>
							{/if}
							{#if record.summary}
								<p class="summary">{record.summary.substring(0, 200)}{record.summary.length > 200 ? '...' : ''}</p>
							{/if}
						</div>
						<div class="result-meta">
							{#if record.isbn}
								<span class="badge">ISBN: {record.isbn}</span>
							{/if}
							{#if record.material_type}
								<span class="badge type">{record.material_type}</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<footer class="search-footer">
		<a href="/catalog">← Back to Catalog Home</a>
	</footer>
</div>

<style>
	.search-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
	}

	.search-header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 1rem 0;
	}

	.search-box {
		display: flex;
		gap: 1rem;
		max-width: 600px;
	}

	.search-box input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		background: #f8f9fa;
	}

	.btn-new-search {
		padding: 0.75rem 1.5rem;
		background: #667eea;
		color: white;
		text-decoration: none;
		border-radius: 4px;
		white-space: nowrap;
	}

	.btn-new-search:hover {
		background: #5568d3;
	}

	.status,
	.error {
		padding: 1rem;
		border-radius: 4px;
		text-align: center;
	}

	.error {
		background: #fee;
		color: #c33;
		border: 1px solid #fcc;
	}

	.no-results {
		text-align: center;
		padding: 3rem;
	}

	.no-results p:first-child {
		font-size: 1.25rem;
		margin-bottom: 2rem;
	}

	.no-results ul {
		text-align: left;
		display: inline-block;
		margin-top: 1rem;
	}

	.results-info {
		margin-bottom: 1rem;
		color: #666;
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.result-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		border: 1px solid #e0e0e0;
		transition: all 0.2s;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.result-card:hover {
		border-color: #667eea;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.result-main {
		flex: 1;
	}

	.result-main h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.subtitle {
		margin: 0 0 0.5rem 0;
		color: #666;
		font-style: italic;
	}

	.author {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.publication {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #666;
	}

	.summary {
		margin: 1rem 0 0 0;
		color: #666;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.result-meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: #e0e0e0;
		border-radius: 12px;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.badge.type {
		background: #d4edda;
		color: #155724;
	}

	.search-footer {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid #e0e0e0;
		text-align: center;
	}

	.search-footer a {
		color: #667eea;
		text-decoration: none;
	}

	.search-footer a:hover {
		text-decoration: underline;
	}
</style>
