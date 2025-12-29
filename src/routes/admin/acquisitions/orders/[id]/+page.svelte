<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let order = $state<any>(null);
	let items = $state<any[]>([]);
	let loading = $state(true);
	let message = $state('');

	// Receiving modal state
	let showReceivingModal = $state(false);
	let receivingItem = $state<any>(null);
	let receiveQuantity = $state(0);
	let receiveStatus = $state<'received' | 'backordered' | 'cancelled'>('received');
	let receiveNotes = $state('');
	let createItems = $state(true);

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

	function openReceivingModal(item: any) {
		receivingItem = item;
		const remaining = item.quantity - (item.quantity_received || 0);
		receiveQuantity = remaining;
		receiveStatus = 'received';
		receiveNotes = '';
		createItems = true;
		showReceivingModal = true;
	}

	function closeReceivingModal() {
		showReceivingModal = false;
		receivingItem = null;
		receiveQuantity = 0;
		receiveNotes = '';
	}

	async function processReceiving() {
		if (!receivingItem || receiveQuantity <= 0) {
			message = 'Error: Invalid quantity';
			return;
		}

		const remaining = receivingItem.quantity - (receivingItem.quantity_received || 0);
		if (receiveQuantity > remaining && receiveStatus === 'received') {
			message = `Error: Cannot receive more than ${remaining} items`;
			return;
		}

		try {
			const newTotalReceived = (receivingItem.quantity_received || 0) + (receiveStatus === 'received' ? receiveQuantity : 0);
			const finalStatus = receiveStatus === 'received'
				? (newTotalReceived >= receivingItem.quantity ? 'received' : 'ordered')
				: receiveStatus;

			// Update order item
			const { error: updateError } = await data.supabase
				.from('order_items')
				.update({
					quantity_received: newTotalReceived,
					status: finalStatus,
					received_date: receiveStatus === 'received' ? new Date().toISOString().split('T')[0] : receivingItem.received_date,
					receiving_notes: receiveNotes || null,
					received_by: data.session?.user?.email || 'Unknown',
					last_received_at: new Date().toISOString()
				})
				.eq('id', receivingItem.id);

			if (updateError) throw updateError;

			// Create receiving history record
			const { error: historyError } = await data.supabase
				.from('receiving_history')
				.insert([{
					order_item_id: receivingItem.id,
					acquisition_order_id: order.id,
					quantity_received: receiveQuantity,
					received_date: new Date().toISOString().split('T')[0],
					received_by: data.session?.user?.email || 'Unknown',
					status: receiveStatus,
					notes: receiveNotes || null,
					items_created: createItems && receiveStatus === 'received' ? receiveQuantity : 0
				}]);

			if (historyError) throw historyError;

			// Create physical item records if requested and status is 'received'
			if (createItems && receiveStatus === 'received' && receiveQuantity > 0) {
				const itemsToCreate = [];
				for (let i = 0; i < receiveQuantity; i++) {
					// Call the generate_barcode function
					const { data: barcodeData, error: barcodeError } = await data.supabase
						.rpc('generate_barcode');

					if (barcodeError) {
						console.error('Error generating barcode:', barcodeError);
						continue;
					}

					itemsToCreate.push({
						marc_record_id: receivingItem.marc_record_id || null,
						barcode: barcodeData,
						copy_number: (receivingItem.quantity_received || 0) + i + 1,
						status: 'in_processing',
						acquisition_date: new Date().toISOString().split('T')[0],
						acquisition_source: 'purchase',
						vendor_id: order.vendor_id,
						price: receivingItem.unit_price,
						currency: 'USD'
					});
				}

				if (itemsToCreate.length > 0) {
					const { error: itemsError } = await data.supabase
						.from('items')
						.insert(itemsToCreate);

					if (itemsError) {
						console.error('Error creating items:', itemsError);
						message = `Warning: Items received but ${itemsToCreate.length} physical item records failed to create`;
					}
				}
			}

			await loadOrder();
			closeReceivingModal();

			const statusText = receiveStatus === 'received'
				? `Received ${receiveQuantity} item(s)`
				: `Marked ${receiveQuantity} item(s) as ${receiveStatus}`;
			const itemsText = createItems && receiveStatus === 'received'
				? ` and created ${receiveQuantity} item record(s)`
				: '';
			message = statusText + itemsText;

			setTimeout(() => (message = ''), 5000);
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
										{#if item.status !== 'received' && item.status !== 'cancelled'}
											<button
												class="btn-receive"
												onclick={() => openReceivingModal(item)}
											>
												Receive
											</button>
										{:else if item.status === 'received'}
											<span class="received-mark">✓ Received</span>
										{:else if item.status === 'cancelled'}
											<span class="cancelled-mark">✗ Cancelled</span>
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

		<!-- Receiving Modal -->
		{#if showReceivingModal && receivingItem}
			<div class="modal-overlay" onclick={closeReceivingModal}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h2>Receive Item</h2>
						<button class="modal-close" onclick={closeReceivingModal}>×</button>
					</div>

					<div class="modal-body">
						<div class="receiving-item-info">
							<h3>{receivingItem.title}</h3>
							{#if receivingItem.author}
								<p class="item-author">{receivingItem.author}</p>
							{/if}
							{#if receivingItem.isbn}
								<p class="item-isbn">ISBN: {receivingItem.isbn}</p>
							{/if}
							<div class="quantity-info">
								<span><strong>Ordered:</strong> {receivingItem.quantity}</span>
								<span><strong>Already Received:</strong> {receivingItem.quantity_received || 0}</span>
								<span><strong>Remaining:</strong> {receivingItem.quantity - (receivingItem.quantity_received || 0)}</span>
							</div>
						</div>

						<form onsubmit={(e) => { e.preventDefault(); processReceiving(); }}>
							<div class="form-group">
								<label for="receiveQuantity">Quantity to Process *</label>
								<input
									id="receiveQuantity"
									type="number"
									bind:value={receiveQuantity}
									min="1"
									max={receiveStatus === 'received' ? receivingItem.quantity - (receivingItem.quantity_received || 0) : receivingItem.quantity}
									required
								/>
								<small class="help-text">
									{#if receiveStatus === 'received'}
										Maximum: {receivingItem.quantity - (receivingItem.quantity_received || 0)} remaining
									{:else}
										Enter quantity to mark as {receiveStatus}
									{/if}
								</small>
							</div>

							<div class="form-group">
								<label for="receiveStatus">Status *</label>
								<select id="receiveStatus" bind:value={receiveStatus} required>
									<option value="received">Received</option>
									<option value="backordered">Backordered</option>
									<option value="cancelled">Cancelled</option>
								</select>
							</div>

							{#if receiveStatus === 'received'}
								<div class="form-group">
									<label class="checkbox-label">
										<input type="checkbox" bind:checked={createItems} />
										<span>Create {receiveQuantity} physical item record(s) with barcodes</span>
									</label>
									<small class="help-text">Items will be created with status "in-processing" and ready for cataloging</small>
								</div>
							{/if}

							<div class="form-group">
								<label for="receiveNotes">Notes</label>
								<textarea
									id="receiveNotes"
									bind:value={receiveNotes}
									rows="3"
									placeholder="Any issues, damages, or special notes..."
								></textarea>
							</div>

							<div class="modal-actions">
								<button type="submit" class="btn-primary">
									{receiveStatus === 'received' ? 'Receive Items' : `Mark as ${receiveStatus}`}
								</button>
								<button type="button" class="btn-secondary" onclick={closeReceivingModal}>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}
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

	.cancelled-mark {
		color: #ef4444;
		font-weight: 600;
	}

	.item-status.backordered {
		background: #fff7ed;
		color: #c2410c;
	}

	.item-status.cancelled {
		background: #fee2e2;
		color: #991b1b;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: var(--radius-md);
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: var(--text-muted);
		line-height: 1;
		padding: 0;
		width: 2rem;
		height: 2rem;
	}

	.modal-close:hover {
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.receiving-item-info {
		background: var(--bg-secondary);
		padding: 1rem;
		border-radius: var(--radius-sm);
		margin-bottom: 1.5rem;
	}

	.receiving-item-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.receiving-item-info p {
		margin: 0.25rem 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.quantity-info {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.form-group input[type='number'],
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	.form-group textarea {
		resize: vertical;
	}

	.help-text {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		font-weight: normal;
	}

	.checkbox-label input[type='checkbox'] {
		margin-top: 0.25rem;
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.btn-secondary:hover {
		background: var(--border);
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
