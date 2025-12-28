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
		<div class="records-grid">
			{#each records as record}
				<a href="/catalog/record/{record.id}" class="record-card">
					<h3>{record.title_statement?.a || 'Untitled'}</h3>
					{#if record.main_entry_personal_name?.a}
						<p class="author">{record.main_entry_personal_name.a}</p>
					{/if}
					{#if record.publication_info?.c}
						<p class="year">{record.publication_info.c}</p>
					{/if}
					{#if record.material_type}
						<span class="type-badge">{record.material_type}</span>
					{/if}
				</a>
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

	.records-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.record-card {
		background: white;
		padding: 1.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: var(--transition-smooth);
		display: flex;
		flex-direction: column;
	}

	.record-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
		border-color: var(--accent);
	}

	.record-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		color: var(--text-primary);
	}

	.author {
		font-style: italic;
		color: var(--text-muted);
		margin: 0.25rem 0;
		font-size: 0.875rem;
	}

	.year {
		color: var(--text-light);
		margin: 0.25rem 0;
		font-size: 0.875rem;
	}

	.type-badge {
		display: inline-block;
		margin-top: auto;
		padding-top: 0.75rem;
		font-size: 0.75rem;
		color: var(--accent);
		text-transform: uppercase;
		font-weight: 500;
	}
</style>
