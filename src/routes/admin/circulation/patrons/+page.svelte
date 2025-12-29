<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let patrons = $state<any[]>([]);
	let filteredPatrons = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Search and filter state
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	onMount(async () => {
		await loadPatrons();
	});

	async function loadPatrons() {
		try {
			const { data: patronsData, error: fetchError } = await data.supabase
				.from('patron_account_summary')
				.select('*')
				.order('last_name', { ascending: true });

			if (fetchError) throw fetchError;

			patrons = patronsData || [];
			applyFilters();
		} catch (err: any) {
			error = `Error loading patrons: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		let filtered = [...patrons];

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(patron => {
				const name = `${patron.first_name} ${patron.last_name}`.toLowerCase();
				const email = patron.email?.toLowerCase() || '';
				const barcode = patron.barcode?.toLowerCase() || '';
				return name.includes(query) || email.includes(query) || barcode.includes(query);
			});
		}

		// Apply status filter
		if (statusFilter !== 'all') {
			filtered = filtered.filter(patron => patron.status === statusFilter);
		}

		filteredPatrons = filtered;
	}

	// Reactive: reapply filters when search/filter changes
	$effect(() => {
		searchQuery;
		statusFilter;
		if (patrons.length > 0) {
			applyFilters();
		}
	});

	async function deletePatron(id: string) {
		if (!confirm('Are you sure you want to delete this patron? This will also delete their checkout history.')) return;

		try {
			const { error: deleteError } = await data.supabase
				.from('patrons')
				.delete()
				.eq('id', id);

			if (deleteError) throw deleteError;

			await loadPatrons();
		} catch (err: any) {
			alert(`Error deleting patron: ${err.message}`);
		}
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'active': return 'status-active';
			case 'expired': return 'status-expired';
			case 'blocked': return 'status-blocked';
			case 'suspended': return 'status-suspended';
			default: return '';
		}
	}

	let selectedPatrons = $state<Set<string>>(new Set());

	function togglePatron(id: string) {
		if (selectedPatrons.has(id)) {
			selectedPatrons.delete(id);
		} else {
			selectedPatrons.add(id);
		}
		selectedPatrons = new Set(selectedPatrons); // Trigger reactivity
	}

	function toggleAll() {
		if (selectedPatrons.size === filteredPatrons.length) {
			selectedPatrons.clear();
		} else {
			selectedPatrons = new Set(filteredPatrons.map(p => p.id));
		}
	}

	async function bulkDelete() {
		if (selectedPatrons.size === 0) {
			alert('No patrons selected');
			return;
		}

		if (!confirm(`Delete ${selectedPatrons.size} selected patron(s)? This will also delete their checkout history.`)) {
			return;
		}

		try {
			const ids = Array.from(selectedPatrons);
			const { error: deleteError } = await data.supabase
				.from('patrons')
				.delete()
				.in('id', ids);

			if (deleteError) throw deleteError;

			selectedPatrons.clear();
			await loadPatrons();
		} catch (err: any) {
			alert(`Error deleting patrons: ${err.message}`);
		}
	}
</script>

<div class="patrons-page">
	<header class="page-header">
		<h1>Patron Management</h1>
		<div class="actions">
			<a href="/admin/circulation/patrons/bulk-upload" class="btn-upload">Bulk Upload</a>
			<a href="/admin/circulation/patrons/new" class="btn-primary">Add New Patron</a>
		</div>
	</header>

	{#if loading}
		<div class="loading">Loading patrons...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else}
		<div class="controls">
			<div class="search-group">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by name, email, or barcode..."
					class="search-input"
				/>
			</div>
			<div class="filter-controls">
				<select bind:value={statusFilter} class="filter-select">
					<option value="all">All Statuses</option>
					<option value="active">Active</option>
					<option value="expired">Expired</option>
					<option value="blocked">Blocked</option>
					<option value="suspended">Suspended</option>
				</select>
				{#if selectedPatrons.size > 0}
					<button onclick={bulkDelete} class="btn-bulk-delete">
						Delete Selected ({selectedPatrons.size})
					</button>
				{/if}
			</div>
		</div>

		<div class="patrons-list">
			<p class="count">
				Showing {filteredPatrons.length} of {patrons.length} patron{patrons.length === 1 ? '' : 's'}
			</p>

			{#if filteredPatrons.length === 0}
				<div class="empty-state">
					<p>No patrons found matching your search.</p>
				</div>
			{:else}
				<div class="table-responsive">
					<table class="patrons-table">
						<thead>
							<tr>
								<th class="checkbox-col">
									<input
										type="checkbox"
										checked={selectedPatrons.size === filteredPatrons.length && filteredPatrons.length > 0}
										onchange={toggleAll}
									/>
								</th>
								<th>Barcode</th>
								<th>Name</th>
								<th>Email</th>
								<th>Type</th>
								<th>Status</th>
								<th>Checkouts</th>
								<th>Holds</th>
								<th>Balance</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredPatrons as patron}
								<tr>
									<td class="checkbox-col">
										<input
											type="checkbox"
											checked={selectedPatrons.has(patron.id)}
											onchange={() => togglePatron(patron.id)}
										/>
									</td>
									<td class="barcode">{patron.barcode}</td>
									<td class="name">
										<a href="/admin/circulation/patrons/{patron.id}">
											{patron.last_name}, {patron.first_name}
										</a>
									</td>
									<td>{patron.email || '—'}</td>
									<td><span class="patron-type">{patron.patron_type}</span></td>
									<td>
										<span class="status-badge {getStatusBadgeClass(patron.status)}">
											{patron.status}
										</span>
									</td>
									<td class="center">
										{patron.current_checkouts || 0}
										{#if patron.overdue_count > 0}
											<span class="overdue-badge">{patron.overdue_count} overdue</span>
										{/if}
									</td>
									<td class="center">{patron.active_holds || 0}</td>
									<td class="center">
										{#if patron.balance > 0}
											<span class="balance-owed">${patron.balance.toFixed(2)}</span>
										{:else}
											$0.00
										{/if}
									</td>
									<td class="actions">
										<a href="/admin/circulation/patrons/{patron.id}" class="btn-small btn-edit">
											View
										</a>
										<button onclick={() => deletePatron(patron.id)} class="btn-small btn-delete">
											Delete
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.patrons-page {
		max-width: 1400px;
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

	.btn-primary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s;
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d12d34;
	}

	.btn-upload {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s;
		background: #f59e0b;
		color: white;
	}

	.btn-upload:hover {
		background: #d97706;
	}

	.btn-bulk-delete {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		background: #f44336;
		color: white;
		font-weight: 500;
	}

	.btn-bulk-delete:hover {
		background: #d32f2f;
	}

	.controls {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
	}

	.search-group {
		margin-bottom: 1rem;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.filter-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-select:focus {
		outline: none;
		border-color: #e73b42;
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

	.count {
		color: #666;
		margin-bottom: 1rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
		color: #666;
	}

	.table-responsive {
		overflow-x: auto;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.patrons-table {
		width: 100%;
		border-collapse: collapse;
	}

	.patrons-table thead {
		background: #f8f9fa;
		border-bottom: 2px solid #e0e0e0;
	}

	.patrons-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: #333;
	}

	.patrons-table td {
		padding: 1rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.875rem;
	}

	.patrons-table tbody tr:hover {
		background: #f8f9fa;
	}

	.checkbox-col {
		width: 40px;
		text-align: center;
	}

	.checkbox-col input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.barcode {
		font-family: monospace;
		font-weight: 500;
		color: #666;
	}

	.name a {
		color: #2c3e50;
		text-decoration: none;
		font-weight: 500;
	}

	.name a:hover {
		color: #e73b42;
		text-decoration: underline;
	}

	.patron-type {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: #e0e0e0;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-active {
		background: #d4edda;
		color: #155724;
	}

	.status-expired {
		background: #fff3cd;
		color: #856404;
	}

	.status-blocked,
	.status-suspended {
		background: #f8d7da;
		color: #721c24;
	}

	.center {
		text-align: center;
	}

	.overdue-badge {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.125rem 0.5rem;
		background: #f44336;
		color: white;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.balance-owed {
		color: #f44336;
		font-weight: 600;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.btn-small {
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
		font-weight: 500;
	}

	.btn-edit {
		background: #e73b42;
		color: white;
	}

	.btn-edit:hover {
		background: #d12d34;
	}

	.btn-delete {
		background: #f44336;
		color: white;
	}

	.btn-delete:hover {
		background: #d32f2f;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.actions {
			width: 100%;
		}

		.actions a {
			width: 100%;
			text-align: center;
			display: block;
		}
	}
</style>
