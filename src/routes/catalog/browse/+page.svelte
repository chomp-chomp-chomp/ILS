<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let records = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const { data: recordsData } = await data.supabase
			.from('marc_records')
			.select('*')
			.order('title_statement->a');

		records = recordsData || [];
		loading = false;
	});
</script>

<div class="browse-page">
	<header class="page-header">
		<h1>Browse Collection</h1>
		<a href="/" class="back-link">← Back to Search</a>
	</header>

	{#if loading}
		<p class="loading">Loading...</p>
	{:else if records.length === 0}
		<div class="empty">
			<p>No records in the catalog yet.</p>
		</div>
	{:else}
		<div class="records-list">
			{#each records as record}
				<article class="record-card">
					<div class="record-content">
						<h3>
							<a href="/catalog/record/{record.id}">{record.title_statement?.a || 'Untitled'}</a>
						</h3>
						{#if record.title_statement?.b}
							<p class="subtitle">{record.title_statement.b}</p>
						{/if}
						{#if record.main_entry_personal_name?.a}
							<p class="author">
								by <a
									href="/catalog/search/results?author={encodeURIComponent(
										record.main_entry_personal_name.a
									)}"
									class="author-link">{record.main_entry_personal_name.a}</a
								>
							</p>
						{/if}
						{#if record.publication_info?.b || record.publication_info?.c}
							<p class="publication">
								{#if record.publication_info.b}{record.publication_info.b}{/if}
								{#if record.publication_info.c}
									{#if record.publication_info.b}, {/if}{record.publication_info.c}
								{/if}
							</p>
						{/if}
						{#if record.series_statement?.a}
							<p class="series">
								Series: <a
									href="/catalog/search/results?q={encodeURIComponent(record.series_statement.a)}"
									class="series-link">{record.series_statement.a}</a
								>
								{#if record.series_statement?.v}; {record.series_statement.v}{/if}
							</p>
						{/if}
						<div class="badges">
							{#if record.material_type}
								<span class="badge type">{record.material_type}</span>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<style>
	.browse-page {
		min-height: 100vh;
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.back-link {
		color: var(--accent);
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.loading,
	.empty {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	.records-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.record-card {
		background: white;
		padding: 1.5rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.record-card:hover {
		border-color: #667eea;
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
	}

	.record-content {
		min-width: 0;
	}

	.record-content h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.record-content h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.record-content h3 a:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.subtitle {
		margin: 0 0 0.5rem 0;
		color: #666;
		font-style: italic;
		font-size: 1rem;
	}

	.author {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 0.875rem;
	}

	.author-link {
		color: #667eea;
		text-decoration: none;
		transition: color 0.2s;
	}

	.author-link:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.publication {
		margin: 0 0 0.5rem 0;
		color: #666;
		font-size: 0.875rem;
	}

	.series {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 0.875rem;
	}

	.series-link {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.series-link:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge.type {
		background: #e3f2fd;
		color: #1976d2;
	}
</style>
