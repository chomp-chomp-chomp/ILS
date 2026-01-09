<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let orders = $state<any[]>([]);
	let vendors = $state<any[]>([]);
	let budgets = $state<any[]>([]);
	let loading = $state(true);
	let message = $state('');

	onMount(async () => {
		await Promise.all([loadOrders(), loadVendors(), loadBudgets()]);
	});

	async function loadOrders() {
		loading = true;
		const { data: ordersData } = await supabase
			.from('acquisition_orders')
			.select(
				`
				*,
				vendor:vendors(name),
				budget:budgets(name)
			`
			)
			.order('created_at', { ascending: false });

		orders = ordersData || [];
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

	async function loadBudgets() {
		const { data: budgetsData } = await supabase
			.from('budgets')
			.select('id, name, code')
			.eq('status', 'active')
			.order('name');

		budgets = budgetsData || [];
	}

	async function deleteOrder(orderId: string) {
		if (!confirm('Are you sure you want to delete this order?')) return;

		try {
			const { error } = await supabase.from('acquisition_orders').delete().eq('id', orderId);

			if (error) throw error;

			message = 'Order deleted successfully!';
			await loadOrders();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function updateOrderStatus(orderId: string, newStatus: string) {
		try {
			const { error } = await supabase
				.from('acquisition_orders')
				.update({ status: newStatus })
				.eq('id', orderId);

			if (error) throw error;

			await loadOrders();
			message = 'Status updated!';
			setTimeout(() => (message = ''), 2000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}
</script>

<div class="orders-page">
	<header class="page-header">
		<div>
			<h1>Purchase Orders</h1>
			<p class="subtitle">Create and manage acquisition orders</p>
		</div>
		<div class="header-actions">
			<a href="/admin/acquisitions/orders/new" class="btn-primary">+ Create Order</a>
			<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
		</div>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<div class="orders-list">
		{#if loading}
			<p class="loading">Loading orders...</p>
		{:else if orders.length === 0}
			<div class="empty-state">
				<p>No purchase orders yet. Create your first order to start acquiring materials.</p>
			</div>
		{:else}
			<div class="orders-table-container">
				<table class="orders-table">
					<thead>
						<tr>
							<th>Order #</th>
							<th>Vendor</th>
							<th>Order Date</th>
							<th>Budget</th>
							<th>Total</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each orders as order}
							<tr>
								<td>
									<a href="/admin/acquisitions/orders/{order.id}" class="order-number">
										{order.order_number}
									</a>
								</td>
								<td>{order.vendor?.name || 'N/A'}</td>
								<td>{new Date(order.order_date).toLocaleDateString()}</td>
								<td>{order.budget?.name || 'N/A'}</td>
								<td class="amount">${Number(order.total_amount || 0).toFixed(2)}</td>
								<td>
									<select
										value={order.status}
										onchange={(e) => updateOrderStatus(order.id, e.currentTarget.value)}
										class="status-select {order.status}"
									>
										<option value="pending">Pending</option>
										<option value="ordered">Ordered</option>
										<option value="partial">Partial</option>
										<option value="received">Received</option>
										<option value="cancelled">Cancelled</option>
										<option value="closed">Closed</option>
									</select>
								</td>
								<td>
									<div class="action-buttons">
										<a href="/admin/acquisitions/orders/{order.id}" class="btn-view">View</a>
										<button class="btn-delete-sm" onclick={() => deleteOrder(order.id)}>
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	.orders-page {
		max-width: 1400px;
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

	.header-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: white;
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: var(--transition-smooth);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: var(--transition-smooth);
	}

	.btn-back:hover {
		background: var(--border);
	}

	.message {
		padding: 1rem;
		border-radius: var(--radius-sm);
		margin-bottom: 1.5rem;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.orders-table-container {
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		overflow: hidden;
	}

	.orders-table {
		width: 100%;
		border-collapse: collapse;
	}

	.orders-table thead {
		background: var(--bg-secondary);
	}

	.orders-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.orders-table td {
		padding: 1rem;
		border-top: 1px solid var(--border);
	}

	.order-number {
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}

	.order-number:hover {
		text-decoration: underline;
	}

	.amount {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.status-select {
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		cursor: pointer;
	}

	.status-select.pending {
		background: #fff3cd;
	}

	.status-select.ordered {
		background: #cce5ff;
	}

	.status-select.partial {
		background: #fff7ed;
	}

	.status-select.received {
		background: #d4edda;
	}

	.status-select.cancelled,
	.status-select.closed {
		background: #e2e3e5;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.btn-view {
		padding: 0.5rem 1rem;
		background: var(--info);
		color: white;
		text-decoration: none;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		transition: var(--transition-smooth);
	}

	.btn-view:hover {
		background: var(--info-hover);
	}

	.btn-delete-sm {
		padding: 0.5rem 1rem;
		background: var(--danger);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
		transition: var(--transition-smooth);
	}

	.btn-delete-sm:hover {
		background: var(--danger-hover);
	}
</style>
