<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let order = $state<any>(null);
	let items = $state<any[]>([]);
	let loading = $state(true);
	let message = $state('');

	const orderId = $derived($page.params.id);

	onMount(async () => {
		await loadOrder();
	});

	async function loadOrder() {
		loading = true;

		const [orderResult, itemsResult] = await Promise.all([
			data.supabase
				.from('acquisition_orders')
				.select(
					`
					*,
					vendor:vendors(name, email, phone),
					budget:budgets(name, code)
				`
				)
				.eq('id', orderId)
				.single(),

			data.supabase
				.from('order_items')
				.select(
					`
					*,
					marc_record:marc_records(id, title_statement, main_entry_personal_name),
					budget:budgets(name, code)
				`
				)
				.eq('acquisition_order_id', orderId)
		]);

		if (orderResult.data) {
			order = orderResult.data;
		}

		if (itemsResult.data) {
			items = itemsResult.data;
		}

		loading = false;
	}

	async function updateOrderStatus(newStatus: string) {
		try {
			const { error } = await data.supabase
				.from('acquisition_orders')
				.update({ status: newStatus })
				.eq('id', orderId);

			if (error) throw error;

			order.status = newStatus;
			message = 'Order status updated!';
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function receiveItem(item: any, quantityReceived: number) {
		if (quantityReceived <= 0) return;

		try {
			const newTotalReceived = (item.quantity_received || 0) + quantityReceived;
			const newStatus = newTotalReceived >= item.quantity ? 'received' : 'ordered';

			const { error } = await data.supabase
				.from('order_items')
				.update({
					quantity_received: newTotalReceived,
					status: newStatus,
					received_date: new Date().toISOString().split('T')[0]
				})
				.eq('id', item.id);

			if (error) throw error;

			await loadOrder();
			message = `Received ${quantityReceived} item(s)`;
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}
</script>

{#if loading}
	<div class="loading">Loading order...</div>
{:else if !order}
	<div class="error">Order not found</div>
{:else}
	<div class="order-detail-page">
		<header class="page-header">
			<div>
				<h1>Purchase Order {order.order_number}</h1>
				<div class="order-meta">
					<span>Created {new Date(order.created_at).toLocaleDateString()}</span>
					<span class="status-badge {order.status}">{order.status}</span>
				</div>
			</div>
			<div class="header-actions">
				<select
					value={order.status}
					onchange={(e) => updateOrderStatus(e.currentTarget.value)}
					class="status-select"
				>
					<option value="pending">Pending</option>
					<option value="ordered">Ordered</option>
					<option value="partial">Partial</option>
					<option value="received">Received</option>
					<option value="cancelled">Cancelled</option>
					<option value="closed">Closed</option>
				</select>
				<a href="/admin/acquisitions/orders" class="btn-back">← Back to Orders</a>
			</div>
		</header>

		{#if message}
			<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
				{message}
			</div>
		{/if}

		<div class="order-details">
			<div class="detail-section">
				<h3>Order Information</h3>
				<div class="detail-grid">
					<div class="detail-item">
						<strong>Vendor:</strong>
						{order.vendor?.name || 'N/A'}
					</div>
					<div class="detail-item">
						<strong>Order Date:</strong>
						{new Date(order.order_date).toLocaleDateString()}
					</div>
					<div class="detail-item">
						<strong>Budget:</strong>
						{order.budget?.name || 'N/A'}
					</div>
					{#if order.expected_delivery_date}
						<div class="detail-item">
							<strong>Expected Delivery:</strong>
							{new Date(order.expected_delivery_date).toLocaleDateString()}
						</div>
					{/if}
					{#if order.vendor_order_number}
						<div class="detail-item">
							<strong>Vendor Order #:</strong>
							{order.vendor_order_number}
						</div>
					{/if}
					{#if order.shipping_method}
						<div class="detail-item">
							<strong>Shipping Method:</strong>
							{order.shipping_method}
						</div>
					{/if}
				</div>

				{#if order.notes}
					<div class="notes">
						<strong>Notes:</strong>
						<p>{order.notes}</p>
					</div>
				{/if}
			</div>

			<div class="vendor-info">
				<h3>Vendor Contact</h3>
				{#if order.vendor?.email}
					<p><strong>Email:</strong> <a href="mailto:{order.vendor.email}">{order.vendor.email}</a></p>
				{/if}
				{#if order.vendor?.phone}
					<p><strong>Phone:</strong> {order.vendor.phone}</p>
				{/if}
			</div>
		</div>

		<div class="items-section">
			<h3>Order Items ({items.length})</h3>

			{#if items.length === 0}
				<div class="empty-items">No items in this order</div>
			{:else}
				<div class="items-table-container">
					<table class="items-table">
						<thead>
							<tr>
								<th>Item</th>
								<th>Qty</th>
								<th>Unit Price</th>
								<th>Discount</th>
								<th>Total</th>
								<th>Received</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each items as item}
								<tr>
									<td>
										<div class="item-title">
											{#if item.marc_record}
												<a
													href="/admin/cataloging/edit/{item.marc_record.id}"
													class="catalog-link"
												>
													{item.title}
												</a>
											{:else}
												{item.title}
											{/if}
										</div>
										{#if item.author}
											<div class="item-author">{item.author}</div>
										{/if}
										{#if item.isbn}
											<div class="item-isbn">ISBN: {item.isbn}</div>
										{/if}
									</td>
									<td>{item.quantity}</td>
									<td class="amount">${Number(item.unit_price || 0).toFixed(2)}</td>
									<td>{item.discount_percent || 0}%</td>
									<td class="amount">${Number(item.line_total || 0).toFixed(2)}</td>
									<td>
										{item.quantity_received || 0}/{item.quantity}
									</td>
									<td>
										<span class="item-status {item.status}">{item.status}</span>
									</td>
									<td>
										{#if item.quantity_received < item.quantity}
											<button
												class="btn-receive"
												onclick={() => receiveItem(item, 1)}
											>
												Receive 1
											</button>
											{#if item.quantity - item.quantity_received > 1}
												<button
													class="btn-receive"
													onclick={() => receiveItem(item, item.quantity - item.quantity_received)}
												>
													Receive All
												</button>
											{/if}
										{:else}
											<span class="received-mark">✓ Complete</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="order-summary">
			<h3>Order Summary</h3>
			<div class="summary-row">
				<span>Subtotal:</span>
				<span class="amount">${Number(order.subtotal || 0).toFixed(2)}</span>
			</div>
			<div class="summary-row">
				<span>Tax:</span>
				<span class="amount">${Number(order.tax_amount || 0).toFixed(2)}</span>
			</div>
			<div class="summary-row">
				<span>Shipping:</span>
				<span class="amount">${Number(order.shipping_amount || 0).toFixed(2)}</span>
			</div>
			<div class="summary-row">
				<span>Discount:</span>
				<span class="amount">-${Number(order.discount_amount || 0).toFixed(2)}</span>
			</div>
			<div class="summary-row total">
				<span>Total:</span>
				<span class="amount">${Number(order.total_amount || 0).toFixed(2)}</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	.order-detail-page {
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

	.order-meta {
		display: flex;
		gap: 1rem;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.pending {
		background: #fff3cd;
		color: #856404;
	}

	.status-badge.ordered {
		background: #cce5ff;
		color: #004085;
	}

	.status-badge.partial {
		background: #fff7ed;
		color: #c2410c;
	}

	.status-badge.received {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.cancelled,
	.status-badge.closed {
		background: #e2e3e5;
		color: #6c757d;
	}

	.header-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.status-select {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
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

	.order-details {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.detail-section,
	.vendor-info,
	.items-section,
	.order-summary {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	h3 {
		margin: 0 0 1.5rem 0;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.detail-item {
		font-size: 0.875rem;
	}

	.detail-item strong {
		color: var(--text-muted);
		display: block;
		margin-bottom: 0.25rem;
	}

	.notes {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.vendor-info p {
		margin: 0.5rem 0;
		font-size: 0.875rem;
	}

	.items-section {
		margin-bottom: 1.5rem;
	}

	.empty-items {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
	}

	.items-table-container {
		overflow-x: auto;
	}

	.items-table {
		width: 100%;
		border-collapse: collapse;
	}

	.items-table thead {
		background: var(--bg-secondary);
	}

	.items-table th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.items-table td {
		padding: 1rem 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.item-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.catalog-link {
		color: var(--accent);
		text-decoration: none;
	}

	.catalog-link:hover {
		text-decoration: underline;
	}

	.item-author,
	.item-isbn {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.amount {
		font-variant-numeric: tabular-nums;
	}

	.item-status {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.item-status.ordered {
		background: #cce5ff;
		color: #004085;
	}

	.item-status.received {
		background: #d4edda;
		color: #155724;
	}

	.btn-receive {
		padding: 0.5rem 0.75rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
		margin-right: 0.5rem;
	}

	.received-mark {
		color: #10b981;
		font-weight: 600;
	}

	.order-summary {
		max-width: 400px;
		margin-left: auto;
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.summary-row.total {
		font-size: 1.25rem;
		font-weight: 700;
		padding-top: 1rem;
		border-top: 2px solid var(--text-primary);
		border-bottom: none;
	}

	@media (max-width: 768px) {
		.order-details {
			grid-template-columns: 1fr;
		}

		.items-table {
			font-size: 0.75rem;
		}

		.items-table th,
		.items-table td {
			padding: 0.5rem;
		}
	}
</style>
