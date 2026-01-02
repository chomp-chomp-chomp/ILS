<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let holdings = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let bulkCreating = $state(false);
	let bulkMessage = $state('');

	onMount(async () => {
		await loadHoldings();
	});

	async function loadHoldings() {
		try {
			const { data: holdingsData, error: fetchError } = await data.supabase
				.from('holdings')
				.select(`
					*,
					marc_records (
						id,
						title_statement,
						main_entry_personal_name
					)
				`)
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;

			holdings = holdingsData || [];
		} catch (err) {
			error = `Error loading holdings: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	async function bulkCreateHoldings() {
		if (!confirm('This will create holdings for all records that don\'t have them. Continue?')) {
			return;
		}

		bulkCreating = true;
		bulkMessage = '';

		try {
			const response = await fetch('/api/holdings/bulk-create', {
				method: 'POST'
			});

			if (!response.ok) throw new Error('Failed to bulk create holdings');

			const result = await response.json();
			bulkMessage = result.message;

			// Reload holdings
			await loadHoldings();
		} catch (err) {
			bulkMessage = `Error: ${err.message}`;
		} finally {
			bulkCreating = false;
		}
	}
</script>

<div class="holdings-page">
	<header class="page-header">
		<div class="header-content">
			<div>
				<h1>Holdings</h1>
				<p class="subtitle">Manage physical and electronic copies</p>
			</div>
			<button class="btn-primary" onclick={bulkCreateHoldings} disabled={bulkCreating}>
				{bulkCreating ? 'Creating...' : 'Bulk Create Holdings'}
			</button>
		</div>
	</header>

	{#if bulkMessage}
		<div class="message {bulkMessage.includes('Error') ? 'error' : 'success'}">
			{bulkMessage}
		</div>
	{/if}

	{#if loading}
		<div class="loading">Loading holdings...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if holdings.length === 0}
		<div class="empty-state">
			<h2>No Holdings Yet</h2>
			<p>Holdings are automatically created when you add records.</p>
			<p>You can also manually add holdings to existing records.</p>
			<a href="/admin/cataloging" class="btn-primary">Go to Cataloging</a>
		</div>
	{:else}
		<div class="holdings-list">
			<p class="count">Showing {holdings.length} holding{holdings.length === 1 ? '' : 's'}</p>

			<div class="holdings-table">
				<table>
					<thead>
						<tr>
							<th>Title</th>
							<th>Call Number</th>
							<th>Location</th>
							<th>Barcode</th>
							<th>Status</th>
							<th>Copy #</th>
						</tr>
					</thead>
					<tbody>
						{#each holdings as holding}
							<tr>
								<td class="title-cell">
									{#if holding.marc_records}
										<a href="/catalog/record/{holding.marc_records.id}">
											{holding.marc_records.title_statement?.a || 'Untitled'}
										</a>
									{:else}
										Record not found
									{/if}
								</td>
								<td>{holding.call_number || '—'}</td>
								<td>{holding.location || '—'}</td>
								<td>{holding.barcode || '—'}</td>
								<td>
									<span class="status" class:available={holding.status === 'available'}>
										{holding.status || 'available'}
									</span>
								</td>
								<td>{holding.copy_number || 1}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.holdings-page {
		max-width: 1400px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.message {
		padding: 1rem;
		margin-bottom: 1rem;
		border-radius: 4px;
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border-color: #f5c6cb;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		margin: 0;
		color: #666;
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
	}

	.empty-state p {
		color: #666;
		margin-bottom: 1rem;
	}

	.btn-primary {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		background: #667eea;
		color: white;
		text-decoration: none;
		border-radius: 4px;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.count {
		color: #666;
		margin-bottom: 1rem;
	}

	.holdings-table {
		background: white;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid #e0e0e0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 1rem;
		text-align: left;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #f8f9fa;
		font-weight: 600;
		font-size: 0.875rem;
		text-transform: uppercase;
		color: #666;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tbody tr:hover {
		background: #f8f9fa;
	}

	.title-cell a {
		color: #2c3e50;
		text-decoration: none;
	}

	.title-cell a:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.status {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: #ffc107;
		color: white;
		border-radius: 12px;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.status.available {
		background: #4caf50;
	}

	@media (max-width: 768px) {
		.holdings-table {
			overflow-x: auto;
		}

		table {
			min-width: 800px;
		}
	}
</style>
