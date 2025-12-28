<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let records = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			const { data: recordsData, error: fetchError } = await data.supabase
				.from('marc_records')
				.select('*')
				.order('created_at', { ascending: false })
				.limit(50);

			if (fetchError) throw fetchError;

			records = recordsData || [];
		} catch (err) {
			error = `Error loading records: ${err.message}`;
		} finally {
			loading = false;
		}
	});

	async function deleteRecord(id: string) {
		if (!confirm('Are you sure you want to delete this record?')) return;

		try {
			const { error: deleteError } = await data.supabase
				.from('marc_records')
				.delete()
				.eq('id', id);

			if (deleteError) throw deleteError;

			records = records.filter((r) => r.id !== id);
		} catch (err) {
			alert(`Error deleting record: ${err.message}`);
		}
	}
</script>

<div class="cataloging-page">
	<header class="page-header">
		<h1>Catalog Records</h1>
		<div class="actions">
			<a href="/admin/cataloging/new" class="btn-primary">Create New Record</a>
			<a href="/admin/cataloging/isbn-lookup" class="btn-secondary">ISBN Lookup</a>
		</div>
	</header>

	{#if loading}
		<div class="loading">Loading records...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if records.length === 0}
		<div class="empty-state">
			<h2>No Records Yet</h2>
			<p>Start building your catalog by adding your first record!</p>
			<div class="empty-actions">
				<a href="/admin/cataloging/isbn-lookup" class="btn-primary">
					Try ISBN Lookup
				</a>
				<a href="/admin/cataloging/new" class="btn-secondary">
					Create Manually
				</a>
			</div>
		</div>
	{:else}
		<div class="records-list">
			<p class="count">Showing {records.length} record{records.length === 1 ? '' : 's'}</p>

			{#each records as record}
				<div class="record-card">
					<div class="record-main">
						<h3>
							<a href="/catalog/record/{record.id}">
								{record.title_statement?.a || 'Untitled'}
							</a>
						</h3>
						{#if record.main_entry_personal_name?.a}
							<p class="author">{record.main_entry_personal_name.a}</p>
						{/if}
						{#if record.isbn}
							<p class="isbn">ISBN: {record.isbn}</p>
						{/if}
						{#if record.publication_info?.c}
							<p class="year">Published: {record.publication_info.c}</p>
						{/if}
					</div>
					<div class="record-actions">
						<a href="/admin/cataloging/edit/{record.id}" class="btn-edit">Edit</a>
						<button onclick={() => deleteRecord(record.id)} class="btn-delete">
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.cataloging-page {
		max-width: 1200px;
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

	.actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
	}

	.error {
		color: #c33;
		background: #fee;
		border: 1px solid #fcc;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
	}

	.empty-state h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.empty-state p {
		color: #666;
		margin-bottom: 2rem;
	}

	.empty-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.count {
		color: #666;
		margin-bottom: 1rem;
	}

	.records-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.record-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.record-main {
		flex: 1;
	}

	.record-main h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.record-main h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.record-main h3 a:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.record-main p {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		color: #666;
	}

	.author {
		font-style: italic;
	}

	.record-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-edit,
	.btn-delete {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
	}

	.btn-edit {
		background: #2196f3;
		color: white;
	}

	.btn-edit:hover {
		background: #1976d2;
	}

	.btn-delete {
		background: #f44336;
		color: white;
	}

	.btn-delete:hover {
		background: #d32f2f;
	}
</style>
