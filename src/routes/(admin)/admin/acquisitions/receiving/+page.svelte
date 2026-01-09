<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let orders = $state<any[]>([]);
	let items = $state<any[]>([]);
	let loading = $state(true);
	let message = $state('');
	let filterStatus = $state('all');
	let filterVendor = $state('all');
	let showOverdueOnly = $state(false);
	let vendors = $state<any[]>([]);

	// Receiving modal state
	let showReceivingModal = $state(false);
	let receivingItem = $state<any>(null);
	let receiveQuantity = $state(0);
	let receiveStatus = $state<'received' | 'backordered' | 'cancelled'>('received');
	let receiveNotes = $state('');
	let createItems = $state(true);

	const today = new Date().toISOString().split('T')[0];

	onMount(async () => {
		await Promise.all([loadOrders(), loadVendors()]);
	});

	async function loadOrders() {
		loading = true;

		const { data: ordersData } = await data.supabase
			.from('acquisition_orders')
			.select(
				`
				*,
				vendor:vendors(id, name),
				items:order_items(
					*,
					marc_record:marc_records(id, title_statement),
					budget:budgets(name, code)
				)
			`
			)
			.in('status', ['ordered', 'partial'])
			.order('expected_delivery_date', { ascending: true, nullsFirst: false });

		if (ordersData) {
			orders = ordersData;
			// Flatten items for easier display
			items = ordersData.flatMap((order) =>
				(order.items || []).map((item: any) => ({
					...item,
					order_number: order.order_number,
					order_id: order.id,
					vendor_name: order.vendor?.name,
					expected_delivery_date: order.expected_delivery_date
				}))
			);
		}

		loading = false;
	}

	async function loadVendors() {
		const { data: vendorsData } = await data.supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');

		vendors = vendorsData || [];
	}

	const filteredItems = $derived(() => {
		let filtered = items;

		// Filter by status
		if (filterStatus !== 'all') {
			filtered = filtered.filter((item) => item.status === filterStatus);
		}

		// Filter by vendor
		if (filterVendor !== 'all') {
			filtered = filtered.filter((item) => {
				const order = orders.find((o) => o.id === item.order_id);
				return order?.vendor_id === filterVendor;
			});
		}

		// Filter overdue
		if (showOverdueOnly) {
			filtered = filtered.filter((item) => {
				if (!item.expected_delivery_date) return false;
				return item.expected_delivery_date < today && item.status === 'ordered';
			});
		}

		return filtered;
	});

	const stats = $derived({
		total: items.length,
		ordered: items.filter((i) => i.status === 'ordered').length,
		backordered: items.filter((i) => i.status === 'backordered').length,
		overdue: items.filter(
			(i) =>
				i.expected_delivery_date &&
				i.expected_delivery_date < today &&
				i.status === 'ordered'
		).length
	});

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
			const newTotalReceived =
				(receivingItem.quantity_received || 0) +
				(receiveStatus === 'received' ? receiveQuantity : 0);
			const finalStatus =
				receiveStatus === 'received'
					? newTotalReceived >= receivingItem.quantity
						? 'received'
						: 'ordered'
					: receiveStatus;

			// Update order item
			const { error: updateError } = await data.supabase
				.from('order_items')
				.update({
					quantity_received: newTotalReceived,
					status: finalStatus,
					received_date:
						receiveStatus === 'received'
							? new Date().toISOString().split('T')[0]
							: receivingItem.received_date,
					receiving_notes: receiveNotes || null,
					received_by: data.session?.user?.email || 'Unknown',
					last_received_at: new Date().toISOString()
				})
				.eq('id', receivingItem.id);

			if (updateError) throw updateError;

			// Create receiving history record
			const { error: historyError } = await data.supabase.from('receiving_history').insert([
				{
					order_item_id: receivingItem.id,
					acquisition_order_id: receivingItem.order_id,
					quantity_received: receiveQuantity,
					received_date: new Date().toISOString().split('T')[0],
					received_by: data.session?.user?.email || 'Unknown',
					status: receiveStatus,
					notes: receiveNotes || null,
					items_created: createItems && receiveStatus === 'received' ? receiveQuantity : 0
				}
			]);

			if (historyError) throw historyError;

			// Create physical item records if requested and status is 'received'
			if (createItems && receiveStatus === 'received' && receiveQuantity > 0) {
				const order = orders.find((o) => o.id === receivingItem.order_id);
				const itemsToCreate = [];

				for (let i = 0; i < receiveQuantity; i++) {
					const { data: barcodeData, error: barcodeError } =
						await data.supabase.rpc('generate_barcode');

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
						vendor_id: order?.vendor_id,
						price: receivingItem.unit_price,
						currency: 'USD'
					});
				}

				if (itemsToCreate.length > 0) {
					const { error: itemsError } = await data.supabase.from('items').insert(itemsToCreate);

					if (itemsError) {
						console.error('Error creating items:', itemsError);
						message = `Warning: Items received but ${itemsToCreate.length} physical item records failed to create`;
					}
				}
			}

			await loadOrders();
			closeReceivingModal();

			const statusText =
				receiveStatus === 'received'
					? `Received ${receiveQuantity} item(s)`
					: `Marked ${receiveQuantity} item(s) as ${receiveStatus}`;
			const itemsText =
				createItems && receiveStatus === 'received'
					? ` and created ${receiveQuantity} item record(s)`
					: '';
			message = statusText + itemsText;

			setTimeout(() => (message = ''), 5000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function isOverdue(item: any): boolean {
		return (
			!!item.expected_delivery_date &&
			item.expected_delivery_date < today &&
			item.status === 'ordered'
		);
	}
</script>

<div class="receiving-page">
	<header class="page-header">
		<div>
			<h1>Receiving</h1>
			<p class="subtitle">Process incoming orders and shipments</p>
		</div>
		<div class="header-actions">
			<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
		</div>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<!-- Stats Cards -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{stats.total}</div>
			<div class="stat-label">Total Items Awaiting</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.ordered}</div>
			<div class="stat-label">On Order</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.backordered}</div>
			<div class="stat-label">Backordered</div>
		</div>
		<div class="stat-card alert">
			<div class="stat-value">{stats.overdue}</div>
			<div class="stat-label">Overdue</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="filters">
		<div class="filter-group">
			<label for="filterStatus">Status:</label>
			<select id="filterStatus" bind:value={filterStatus}>
				<option value="all">All</option>
				<option value="ordered">Ordered</option>
				<option value="backordered">Backordered</option>
			</select>
		</div>

		<div class="filter-group">
			<label for="filterVendor">Vendor:</label>
			<select id="filterVendor" bind:value={filterVendor}>
				<option value="all">All Vendors</option>
				{#each vendors as vendor}
					<option value={vendor.id}>{vendor.name}</option>
				{/each}
			</select>
		</div>

		<div class="filter-group">
			<label class="checkbox-filter">
				<input type="checkbox" bind:checked={showOverdueOnly} />
				<span>Show Overdue Only</span>
			</label>
		</div>
	</div>

	<!-- Items List -->
	<div class="items-section">
		{#if loading}
			<p class="loading">Loading items...</p>
		{:else if filteredItems.length === 0}
			<div class="empty-state">
				<p>No items to receive.</p>
			</div>
		{:else}
			<div class="items-table-container">
				<table class="items-table">
					<thead>
						<tr>
							<th>Order #</th>
							<th>Item</th>
							<th>Vendor</th>
							<th>Expected Date</th>
							<th>Qty</th>
							<th>Received</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredItems as item}
							<tr class:overdue={isOverdue(item)}>
								<td>
									<a href="/admin/acquisitions/orders/{item.order_id}" class="order-link">
										{item.order_number}
									</a>
								</td>
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
								<td>{item.vendor_name || 'N/A'}</td>
								<td>
									{#if item.expected_delivery_date}
										<span class:overdue-date={isOverdue(item)}>
											{new Date(item.expected_delivery_date).toLocaleDateString()}
										</span>
										{#if isOverdue(item)}
											<div class="overdue-badge">OVERDUE</div>
										{/if}
									{:else}
										<span class="text-muted">Not set</span>
									{/if}
								</td>
								<td>{item.quantity}</td>
								<td>{item.quantity_received || 0}</td>
								<td>
									<span class="item-status {item.status}">{item.status}</span>
								</td>
								<td>
									{#if item.status !== 'received' && item.status !== 'cancelled'}
										<button class="btn-receive" onclick={() => openReceivingModal(item)}>
											Receive
										</button>
									{:else if item.status === 'received'}
										<span class="received-mark">✓</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
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
						<p class="order-info">
							Order: <a href="/admin/acquisitions/orders/{receivingItem.order_id}"
								>{receivingItem.order_number}</a
							>
						</p>
						<div class="quantity-info">
							<span><strong>Ordered:</strong> {receivingItem.quantity}</span>
							<span><strong>Already Received:</strong> {receivingItem.quantity_received || 0}</span>
							<span
								><strong>Remaining:</strong>
								{receivingItem.quantity - (receivingItem.quantity_received || 0)}</span
							>
						</div>
					</div>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							processReceiving();
						}}
					>
						<div class="form-group">
							<label for="receiveQuantity">Quantity to Process *</label>
							<input
								id="receiveQuantity"
								type="number"
								bind:value={receiveQuantity}
								min="1"
								max={receiveStatus === 'received'
									? receivingItem.quantity - (receivingItem.quantity_received || 0)
									: receivingItem.quantity}
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
								<small class="help-text"
									>Items will be created with status "in-processing" and ready for cataloging</small
								>
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

<style>
	.receiving-page {
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

	.header-actions {
		display: flex;
		gap: 1rem;
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

	.stat-card.alert {
		border-color: #ef4444;
		background: #fef2f2;
	}

	.stat-value {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--accent);
		line-height: 1;
		margin-bottom: 0.5rem;
	}

	.stat-card.alert .stat-value {
		color: #ef4444;
	}

	.stat-label {
		color: var(--text-muted);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Filters */
	.filters {
		display: flex;
		gap: 1.5rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
		padding: 1.5rem;
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.filter-group select {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		min-width: 200px;
	}

	.checkbox-filter {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding-top: 0.5rem;
	}

	.checkbox-filter input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	/* Items Section */
	.items-section {
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
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
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.items-table td {
		padding: 1rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.items-table tr.overdue {
		background: #fef2f2;
	}

	.order-link,
	.catalog-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}

	.order-link:hover,
	.catalog-link:hover {
		text-decoration: underline;
	}

	.item-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.item-author,
	.item-isbn {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.text-muted {
		color: var(--text-muted);
	}

	.overdue-date {
		color: #dc2626;
		font-weight: 600;
	}

	.overdue-badge {
		display: inline-block;
		margin-top: 0.25rem;
		padding: 0.125rem 0.5rem;
		background: #dc2626;
		color: white;
		font-size: 0.625rem;
		font-weight: 700;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
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

	.item-status.backordered {
		background: #fff7ed;
		color: #c2410c;
	}

	.item-status.received {
		background: #d4edda;
		color: #155724;
	}

	.btn-receive {
		padding: 0.5rem 1rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.btn-receive:hover {
		opacity: 0.9;
	}

	.received-mark {
		color: #10b981;
		font-size: 1.25rem;
		font-weight: 600;
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

	.order-info a {
		color: var(--accent);
		text-decoration: none;
	}

	.order-info a:hover {
		text-decoration: underline;
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

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.filters {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-group select {
			min-width: unset;
		}

		.items-table {
			font-size: 0.75rem;
		}

		.items-table th,
		.items-table td {
			padding: 0.5rem;
		}

		.quantity-info {
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
