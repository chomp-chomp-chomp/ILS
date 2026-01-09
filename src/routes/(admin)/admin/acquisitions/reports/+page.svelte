<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let receivingHistory = $state<any[]>([]);
	let vendors = $state<any[]>([]);
	let loading = $state(true);

	// Filters
	let startDate = $state('');
	let endDate = $state('');
	let selectedVendor = $state('all');

	onMount(async () => {
		// Set default date range (last 30 days)
		const end = new Date();
		const start = new Date();
		start.setDate(start.getDate() - 30);

		endDate = end.toISOString().split('T')[0];
		startDate = start.toISOString().split('T')[0];

		await Promise.all([loadReceivingHistory(), loadVendors()]);
	});

	async function loadReceivingHistory() {
		loading = true;

		let query = supabase
			.from('receiving_history')
			.select(
				`
				*,
				order:acquisition_orders!receiving_history_acquisition_order_id_fkey(
					order_number,
					vendor:vendors(id, name)
				),
				order_item:order_items(
					title,
					author,
					isbn,
					unit_price
				)
			`
			)
			.order('received_date', { ascending: false });

		if (startDate) {
			query = query.gte('received_date', startDate);
		}
		if (endDate) {
			query = query.lte('received_date', endDate);
		}

		const { data: historyData } = await query;

		receivingHistory = historyData || [];
		loading = false;
	}

	async function loadVendors() {
		const { data: vendorsData } = await supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');

		vendors = vendorsData || [];
	}

	async function applyFilters() {
		await loadReceivingHistory();
	}

	const filteredHistory = $derived(() => {
		let filtered = receivingHistory;

		if (selectedVendor !== 'all') {
			filtered = filtered.filter(
				(h) => h.order?.vendor?.id === selectedVendor
			);
		}

		return filtered;
	});

	const stats = $derived(() => {
		const filtered = filteredHistory;
		return {
			totalReceived: filtered.reduce((sum, h) => sum + (h.quantity_received || 0), 0),
			totalValue: filtered.reduce(
				(sum, h) => sum + (h.quantity_received || 0) * Number(h.order_item?.unit_price || 0),
				0
			),
			itemsCreated: filtered.reduce((sum, h) => sum + (h.items_created || 0), 0),
			uniqueOrders: new Set(filtered.map((h) => h.acquisition_order_id)).size
		};
	});

	// Vendor performance metrics
	const vendorPerformance = $derived(() => {
		const vendorMap = new Map();

		receivingHistory.forEach((h) => {
			const vendorId = h.order?.vendor?.id;
			const vendorName = h.order?.vendor?.name;

			if (!vendorId || !vendorName) return;

			if (!vendorMap.has(vendorId)) {
				vendorMap.set(vendorId, {
					id: vendorId,
					name: vendorName,
					totalItems: 0,
					totalOrders: new Set(),
					totalValue: 0,
					onTimeDeliveries: 0,
					lateDeliveries: 0
				});
			}

			const vendor = vendorMap.get(vendorId);
			vendor.totalItems += h.quantity_received || 0;
			vendor.totalOrders.add(h.acquisition_order_id);
			vendor.totalValue += (h.quantity_received || 0) * Number(h.order_item?.unit_price || 0);
		});

		return Array.from(vendorMap.values())
			.map((v) => ({
				...v,
				totalOrders: v.totalOrders.size
			}))
			.sort((a, b) => b.totalValue - a.totalValue);
	});

	function exportToCSV() {
		const headers = [
			'Date',
			'Order',
			'Vendor',
			'Item',
			'ISBN',
			'Quantity',
			'Unit Price',
			'Total Value',
			'Items Created',
			'Received By',
			'Status'
		];

		const rows = filteredHistory.map((h) => [
			h.received_date,
			h.order?.order_number || '',
			h.order?.vendor?.name || '',
			h.order_item?.title || '',
			h.order_item?.isbn || '',
			h.quantity_received || 0,
			Number(h.order_item?.unit_price || 0).toFixed(2),
			((h.quantity_received || 0) * Number(h.order_item?.unit_price || 0)).toFixed(2),
			h.items_created || 0,
			h.received_by || '',
			h.status || ''
		]);

		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `receiving-history-${startDate}-to-${endDate}.csv`;
		a.click();
		window.URL.revokeObjectURL(url);
	}
</script>

<div class="reports-page">
	<header class="page-header">
		<div>
			<h1>Acquisitions Reports</h1>
			<p class="subtitle">Receiving history and vendor performance analytics</p>
		</div>
		<div class="header-actions">
			<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
		</div>
	</header>

	<!-- Stats Overview -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{stats.totalReceived}</div>
			<div class="stat-label">Items Received</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${stats.totalValue.toFixed(2)}</div>
			<div class="stat-label">Total Value</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.itemsCreated}</div>
			<div class="stat-label">Item Records Created</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.uniqueOrders}</div>
			<div class="stat-label">Orders Processed</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="filters-section">
		<h2>Receiving History</h2>
		<div class="filters">
			<div class="filter-group">
				<label for="startDate">Start Date:</label>
				<input id="startDate" type="date" bind:value={startDate} />
			</div>

			<div class="filter-group">
				<label for="endDate">End Date:</label>
				<input id="endDate" type="date" bind:value={endDate} />
			</div>

			<div class="filter-group">
				<label for="selectedVendor">Vendor:</label>
				<select id="selectedVendor" bind:value={selectedVendor}>
					<option value="all">All Vendors</option>
					{#each vendors as vendor}
						<option value={vendor.id}>{vendor.name}</option>
					{/each}
				</select>
			</div>

			<div class="filter-actions">
				<button class="btn-primary" onclick={applyFilters}>Apply Filters</button>
				{#if filteredHistory.length > 0}
					<button class="btn-secondary" onclick={exportToCSV}>📥 Export CSV</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Receiving History Table -->
	<div class="history-section">
		{#if loading}
			<p class="loading">Loading receiving history...</p>
		{:else if filteredHistory.length === 0}
			<div class="empty-state">
				<p>No receiving history found for the selected period.</p>
			</div>
		{:else}
			<div class="history-table-container">
				<table class="history-table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Order</th>
							<th>Vendor</th>
							<th>Item</th>
							<th>Qty Received</th>
							<th>Unit Price</th>
							<th>Total Value</th>
							<th>Items Created</th>
							<th>Received By</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredHistory as history}
							{@const totalValue = (history.quantity_received || 0) * Number(history.order_item?.unit_price || 0)}
							<tr>
								<td>{new Date(history.received_date).toLocaleDateString()}</td>
								<td>
									<a
										href="/admin/acquisitions/orders/{history.acquisition_order_id}"
										class="order-link"
									>
										{history.order?.order_number}
									</a>
								</td>
								<td>{history.order?.vendor?.name || 'N/A'}</td>
								<td>
									<div class="item-title">{history.order_item?.title || 'N/A'}</div>
									{#if history.order_item?.author}
										<div class="item-author">{history.order_item.author}</div>
									{/if}
									{#if history.order_item?.isbn}
										<div class="item-isbn">ISBN: {history.order_item.isbn}</div>
									{/if}
								</td>
								<td>{history.quantity_received || 0}</td>
								<td class="amount">${Number(history.order_item?.unit_price || 0).toFixed(2)}</td>
								<td class="amount">${totalValue.toFixed(2)}</td>
								<td>{history.items_created || 0}</td>
								<td class="small-text">{history.received_by || 'N/A'}</td>
								<td>
									<span class="status-badge {history.status}">{history.status}</span>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="4" class="total-label">Totals:</td>
							<td class="total-value">{stats.totalReceived}</td>
							<td></td>
							<td class="amount total-value">${stats.totalValue.toFixed(2)}</td>
							<td class="total-value">{stats.itemsCreated}</td>
							<td colspan="2"></td>
						</tr>
					</tfoot>
				</table>
			</div>
		{/if}
	</div>

	<!-- Vendor Performance -->
	<div class="vendor-performance-section">
		<h2>Vendor Performance</h2>

		{#if vendorPerformance.length === 0}
			<div class="empty-state">
				<p>No vendor data available for the selected period.</p>
			</div>
		{:else}
			<div class="vendor-table-container">
				<table class="vendor-table">
					<thead>
						<tr>
							<th>Vendor</th>
							<th>Orders</th>
							<th>Items Received</th>
							<th>Total Value</th>
							<th>Avg per Order</th>
						</tr>
					</thead>
					<tbody>
						{#each vendorPerformance as vendor}
							{@const avgPerOrder = vendor.totalOrders > 0 ? vendor.totalValue / vendor.totalOrders : 0}
							<tr>
								<td class="vendor-name">{vendor.name}</td>
								<td>{vendor.totalOrders}</td>
								<td>{vendor.totalItems}</td>
								<td class="amount">${vendor.totalValue.toFixed(2)}</td>
								<td class="amount">${avgPerOrder.toFixed(2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	.reports-page {
		max-width: 1600px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: white;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.stat-value {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--accent);
		line-height: 1;
		margin-bottom: 0.5rem;
	}

	.stat-label {
		color: var(--text-muted);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Filters Section */
	.filters-section,
	.history-section,
	.vendor-performance-section {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: 2rem;
	}

	h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		align-items: end;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.filter-group input,
	.filter-group select {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
	}

	.filter-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-secondary {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	/* Tables */
	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	.history-table-container,
	.vendor-table-container {
		overflow-x: auto;
	}

	.history-table,
	.vendor-table {
		width: 100%;
		border-collapse: collapse;
	}

	.history-table thead,
	.vendor-table thead {
		background: var(--bg-secondary);
	}

	.history-table th,
	.vendor-table th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.history-table td,
	.vendor-table td {
		padding: 1rem 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.order-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}

	.order-link:hover {
		text-decoration: underline;
	}

	.item-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.item-author,
	.item-isbn {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.amount {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.small-text {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.status-badge {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.received {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.backordered {
		background: #fff7ed;
		color: #c2410c;
	}

	.status-badge.cancelled {
		background: #fee2e2;
		color: #991b1b;
	}

	.history-table tfoot td {
		font-weight: 700;
		border-top: 2px solid var(--text-primary);
		background: var(--bg-secondary);
	}

	.total-label {
		text-align: right;
	}

	.total-value {
		font-weight: 700;
	}

	.vendor-name {
		font-weight: 600;
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.filters {
			grid-template-columns: 1fr;
		}

		.history-table,
		.vendor-table {
			font-size: 0.75rem;
		}
	}
</style>
