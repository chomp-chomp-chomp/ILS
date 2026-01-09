<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let invoice = $state<any>(null);
	let lineItems = $state<any[]>([]);
	let orderItems = $state<any[]>([]);
	let loading = $state(true);
	let message = $state('');

	// Line item form state
	let showLineItemForm = $state(false);
	let editingLineItemId = $state<string | null>(null);
	let lineItemDescription = $state('');
	let lineItemIsbn = $state('');
	let lineItemQuantity = $state(1);
	let lineItemUnitPrice = $state(0);
	let lineItemDiscountPercent = $state(0);
	let selectedOrderItemId = $state<string | null>(null);

	const invoiceId = $derived($page.params.id);

	onMount(async () => {
		await loadInvoice();
	});

	async function loadInvoice() {
		loading = true;

		const [invoiceResult, lineItemsResult] = await Promise.all([
			supabase
				.from('invoices')
				.select(
					`
					*,
					vendor:vendors(name, email),
					order:acquisition_orders(
						id,
						order_number,
						items:order_items(
							id,
							title,
							author,
							isbn,
							quantity,
							unit_price,
							discount_percent,
							line_total,
							status
						)
					)
				`
				)
				.eq('id', invoiceId)
				.single(),

			supabase
				.from('invoice_line_items')
				.select(
					`
					*,
					order_item:order_items(
						id,
						title,
						author,
						isbn,
						quantity,
						unit_price,
						acquisition_order_id
					)
				`
				)
				.eq('invoice_id', invoiceId)
		]);

		if (invoiceResult.data) {
			invoice = invoiceResult.data;
			orderItems = invoice.order?.items || [];
		}

		if (lineItemsResult.data) {
			lineItems = lineItemsResult.data;
		}

		loading = false;
	}

	function openLineItemForm(lineItem?: any) {
		if (lineItem) {
			editingLineItemId = lineItem.id;
			lineItemDescription = lineItem.description;
			lineItemIsbn = lineItem.isbn || '';
			lineItemQuantity = lineItem.quantity;
			lineItemUnitPrice = lineItem.unit_price;
			lineItemDiscountPercent = lineItem.discount_percent || 0;
			selectedOrderItemId = lineItem.order_item_id;
		} else {
			resetLineItemForm();
		}
		showLineItemForm = true;
	}

	function resetLineItemForm() {
		editingLineItemId = null;
		lineItemDescription = '';
		lineItemIsbn = '';
		lineItemQuantity = 1;
		lineItemUnitPrice = 0;
		lineItemDiscountPercent = 0;
		selectedOrderItemId = null;
	}

	function closeLineItemForm() {
		showLineItemForm = false;
		resetLineItemForm();
	}

	async function saveLineItem() {
		if (!lineItemDescription.trim() || lineItemQuantity <= 0 || lineItemUnitPrice < 0) {
			message = 'Error: Description, quantity, and price are required';
			return;
		}

		try {
			const lineTotal = lineItemQuantity * lineItemUnitPrice * (1 - lineItemDiscountPercent / 100);

			const lineItemData = {
				invoice_id: invoiceId,
				order_item_id: selectedOrderItemId || null,
				description: lineItemDescription.trim(),
				isbn: lineItemIsbn.trim() || null,
				quantity: lineItemQuantity,
				unit_price: lineItemUnitPrice,
				discount_percent: lineItemDiscountPercent,
				line_total: lineTotal,
				matched: !!selectedOrderItemId
			};

			if (editingLineItemId) {
				const { error } = await supabase
					.from('invoice_line_items')
					.update(lineItemData)
					.eq('id', editingLineItemId);

				if (error) throw error;
				message = 'Line item updated successfully!';
			} else {
				const { error } = await supabase.from('invoice_line_items').insert([lineItemData]);

				if (error) throw error;
				message = 'Line item added successfully!';
			}

			await loadInvoice();
			closeLineItemForm();
			await detectDiscrepancies();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function deleteLineItem(lineItemId: string) {
		if (!confirm('Are you sure you want to delete this line item?')) return;

		try {
			const { error } = await supabase.from('invoice_line_items').delete().eq('id', lineItemId);

			if (error) throw error;

			message = 'Line item deleted successfully!';
			await loadInvoice();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function autoMatchLineItems() {
		if (!invoice.acquisition_order_id) {
			message = 'Error: This invoice is not linked to an order';
			return;
		}

		try {
			let matchedCount = 0;

			for (const lineItem of lineItems) {
				if (lineItem.matched) continue;

				// Try to match by ISBN first
				let matchedOrderItem = null;
				if (lineItem.isbn) {
					matchedOrderItem = orderItems.find(
						(oi) => oi.isbn && oi.isbn.toLowerCase() === lineItem.isbn.toLowerCase()
					);
				}

				// If no ISBN match, try fuzzy title match
				if (!matchedOrderItem && lineItem.description) {
					const descLower = lineItem.description.toLowerCase();
					matchedOrderItem = orderItems.find(
						(oi) =>
							oi.title &&
							(oi.title.toLowerCase().includes(descLower) ||
								descLower.includes(oi.title.toLowerCase()))
					);
				}

				if (matchedOrderItem) {
					const { error } = await supabase
						.from('invoice_line_items')
						.update({
							order_item_id: matchedOrderItem.id,
							matched: true
						})
						.eq('id', lineItem.id);

					if (!error) matchedCount++;
				}
			}

			await loadInvoice();
			await detectDiscrepancies();
			message = `Matched ${matchedCount} line item(s) to order items`;
			setTimeout(() => (message = ''), 5000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function detectDiscrepancies() {
		try {
			for (const lineItem of lineItems) {
				if (!lineItem.order_item) continue;

				let discrepancyType = null;
				let discrepancyNotes = [];

				// Check price difference (tolerance: ±5%)
				const expectedPrice = Number(lineItem.order_item.unit_price);
				const actualPrice = Number(lineItem.unit_price);
				const priceDiff = Math.abs(expectedPrice - actualPrice);
				const priceDiffPercent = (priceDiff / expectedPrice) * 100;

				if (priceDiffPercent > 5) {
					discrepancyType = 'price_difference';
					discrepancyNotes.push(
						`Price difference: Expected $${expectedPrice.toFixed(2)}, got $${actualPrice.toFixed(2)} (${priceDiffPercent.toFixed(1)}%)`
					);
				}

				// Check quantity difference
				const expectedQty = Number(lineItem.order_item.quantity);
				const actualQty = Number(lineItem.quantity);

				if (actualQty !== expectedQty) {
					discrepancyType = discrepancyType || 'quantity_difference';
					discrepancyNotes.push(
						`Quantity difference: Expected ${expectedQty}, got ${actualQty}`
					);
				}

				// Update discrepancy info
				if (discrepancyType || discrepancyNotes.length > 0) {
					await supabase
						.from('invoice_line_items')
						.update({
							discrepancy_type: discrepancyType,
							discrepancy_notes: discrepancyNotes.join('; ')
						})
						.eq('id', lineItem.id);
				}
			}

			// Check for items not ordered
			for (const lineItem of lineItems) {
				if (!lineItem.matched && !lineItem.order_item_id) {
					await supabase
						.from('invoice_line_items')
						.update({
							discrepancy_type: 'not_ordered',
							discrepancy_notes: 'This item was not found in the purchase order'
						})
						.eq('id', lineItem.id);
				}
			}

			await loadInvoice();
		} catch (err: any) {
			console.error('Error detecting discrepancies:', err);
		}
	}

	async function approveInvoice() {
		if (!confirm('Approve this invoice for payment?')) return;

		try {
			const { error } = await supabase
				.from('invoices')
				.update({
					approved_for_payment: true,
					approved_by: data.session?.user?.email || 'Unknown',
					approved_at: new Date().toISOString(),
					payment_status: 'approved'
				})
				.eq('id', invoiceId);

			if (error) throw error;

			await loadInvoice();
			message = 'Invoice approved for payment!';
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function disputeInvoice() {
		const reason = prompt('Enter reason for disputing this invoice:');
		if (!reason) return;

		try {
			const { error } = await supabase
				.from('invoices')
				.update({
					payment_status: 'disputed',
					notes: invoice.notes ? `${invoice.notes}\n\nDisputed: ${reason}` : `Disputed: ${reason}`
				})
				.eq('id', invoiceId);

			if (error) throw error;

			await loadInvoice();
			message = 'Invoice marked as disputed';
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function exportToCSV() {
		const headers = ['Description', 'ISBN', 'Quantity', 'Unit Price', 'Discount %', 'Total', 'Matched', 'Discrepancy'];
		const rows = lineItems.map((item) => [
			item.description,
			item.isbn || '',
			item.quantity,
			item.unit_price,
			item.discount_percent || 0,
			item.line_total,
			item.matched ? 'Yes' : 'No',
			item.discrepancy_type || ''
		]);

		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `invoice-${invoice.invoice_number}-line-items.csv`;
		a.click();
		window.URL.revokeObjectURL(url);
	}

	const invoiceTotal = $derived(lineItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0));
	const matchedCount = $derived(lineItems.filter((item) => item.matched).length);
	const discrepancyCount = $derived(lineItems.filter((item) => item.discrepancy_type).length);
</script>

{#if loading}
	<div class="loading">Loading invoice...</div>
{:else if !invoice}
	<div class="error">Invoice not found</div>
{:else}
	<div class="invoice-detail-page">
		<header class="page-header">
			<div>
				<h1>Invoice {invoice.invoice_number}</h1>
				<div class="invoice-meta">
					<span>Vendor: {invoice.vendor?.name || 'N/A'}</span>
					{#if invoice.order}
						<span>
							Order:
							<a href="/admin/acquisitions/orders/{invoice.order.id}">{invoice.order.order_number}</a>
						</span>
					{/if}
					<span class="status-badge {invoice.payment_status || invoice.status}">
						{invoice.payment_status || invoice.status}
					</span>
				</div>
			</div>
			<div class="header-actions">
				<a href="/admin/acquisitions/invoices" class="btn-back">← Back to Invoices</a>
			</div>
		</header>

		{#if message}
			<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
				{message}
			</div>
		{/if}

		<!-- Invoice Info -->
		<div class="invoice-info">
			<div class="info-section">
				<h3>Invoice Details</h3>
				<div class="info-grid">
					<div class="info-item">
						<strong>Invoice Date:</strong>
						{new Date(invoice.invoice_date).toLocaleDateString()}
					</div>
					{#if invoice.due_date}
						<div class="info-item">
							<strong>Due Date:</strong>
							{new Date(invoice.due_date).toLocaleDateString()}
						</div>
					{/if}
					<div class="info-item">
						<strong>Vendor Total:</strong>
						${Number(invoice.total_amount || 0).toFixed(2)}
					</div>
					<div class="info-item">
						<strong>Line Items Total:</strong>
						${invoiceTotal.toFixed(2)}
					</div>
				</div>
				{#if invoice.approved_for_payment}
					<div class="approval-info">
						✓ Approved by {invoice.approved_by} on {new Date(invoice.approved_at).toLocaleDateString()}
					</div>
				{/if}
			</div>

			<div class="matching-stats">
				<h3>Matching Status</h3>
				<div class="stat-row">
					<span>Line Items:</span>
					<span class="stat-value">{lineItems.length}</span>
				</div>
				<div class="stat-row">
					<span>Matched:</span>
					<span class="stat-value matched">{matchedCount}/{lineItems.length}</span>
				</div>
				<div class="stat-row">
					<span>Discrepancies:</span>
					<span class="stat-value {discrepancyCount > 0 ? 'alert' : ''}">
						{discrepancyCount}
					</span>
				</div>
			</div>
		</div>

		<!-- Actions Bar -->
		<div class="actions-bar">
			<button class="btn-primary" onclick={() => openLineItemForm()}>+ Add Line Item</button>
			{#if invoice.acquisition_order_id && lineItems.length > 0}
				<button class="btn-secondary" onclick={autoMatchLineItems}>🔗 Auto-Match to Order</button>
			{/if}
			{#if lineItems.length > 0}
				<button class="btn-secondary" onclick={exportToCSV}>📥 Export CSV</button>
			{/if}
			{#if !invoice.approved_for_payment && lineItems.length > 0}
				<button class="btn-approve" onclick={approveInvoice}>✓ Approve for Payment</button>
				<button class="btn-dispute" onclick={disputeInvoice}>⚠ Dispute</button>
			{/if}
		</div>

		<!-- Line Items Table -->
		<div class="line-items-section">
			<h3>Line Items ({lineItems.length})</h3>

			{#if lineItems.length === 0}
				<div class="empty-state">
					<p>No line items yet. Add invoice line items to begin matching.</p>
				</div>
			{:else}
				<div class="line-items-table-container">
					<table class="line-items-table">
						<thead>
							<tr>
								<th>Description</th>
								<th>ISBN</th>
								<th>Qty</th>
								<th>Unit Price</th>
								<th>Discount</th>
								<th>Total</th>
								<th>Matched</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each lineItems as item}
								<tr class:has-discrepancy={item.discrepancy_type}>
									<td>
										<div class="item-description">{item.description}</div>
										{#if item.order_item}
											<div class="matched-to">
												→ Matched to: {item.order_item.title}
											</div>
										{/if}
									</td>
									<td class="isbn">{item.isbn || '-'}</td>
									<td>{item.quantity}</td>
									<td class="amount">${Number(item.unit_price).toFixed(2)}</td>
									<td>{item.discount_percent || 0}%</td>
									<td class="amount">${Number(item.line_total).toFixed(2)}</td>
									<td>
										{#if item.matched}
											<span class="match-badge matched">✓ Matched</span>
										{:else}
											<span class="match-badge unmatched">Unmatched</span>
										{/if}
									</td>
									<td>
										{#if item.discrepancy_type}
											<div class="discrepancy-badge" title={item.discrepancy_notes}>
												{item.discrepancy_type.replace('_', ' ')}
											</div>
											<div class="discrepancy-notes">{item.discrepancy_notes}</div>
										{:else}
											<span class="ok-badge">✓ OK</span>
										{/if}
									</td>
									<td>
										<div class="action-buttons">
											<button class="btn-edit-sm" onclick={() => openLineItemForm(item)}>
												Edit
											</button>
											<button class="btn-delete-sm" onclick={() => deleteLineItem(item.id)}>
												Delete
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="5" class="total-label">Total:</td>
								<td class="amount total-amount">${invoiceTotal.toFixed(2)}</td>
								<td colspan="3"></td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>

		<!-- Line Item Form Modal -->
		{#if showLineItemForm}
			<div class="modal-overlay" onclick={closeLineItemForm}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h2>{editingLineItemId ? 'Edit Line Item' : 'Add Line Item'}</h2>
						<button class="modal-close" onclick={closeLineItemForm}>×</button>
					</div>

					<div class="modal-body">
						<form
							onsubmit={(e) => {
								e.preventDefault();
								saveLineItem();
							}}
						>
							<div class="form-group">
								<label for="lineItemDescription">Description *</label>
								<input
									id="lineItemDescription"
									type="text"
									bind:value={lineItemDescription}
									required
									placeholder="Item description from invoice"
								/>
							</div>

							<div class="form-group">
								<label for="lineItemIsbn">ISBN (Optional)</label>
								<input
									id="lineItemIsbn"
									type="text"
									bind:value={lineItemIsbn}
									placeholder="For auto-matching"
								/>
							</div>

							<div class="form-row">
								<div class="form-group">
									<label for="lineItemQuantity">Quantity *</label>
									<input
										id="lineItemQuantity"
										type="number"
										bind:value={lineItemQuantity}
										min="1"
										required
									/>
								</div>

								<div class="form-group">
									<label for="lineItemUnitPrice">Unit Price *</label>
									<input
										id="lineItemUnitPrice"
										type="number"
										bind:value={lineItemUnitPrice}
										min="0"
										step="0.01"
										required
									/>
								</div>

								<div class="form-group">
									<label for="lineItemDiscountPercent">Discount %</label>
									<input
										id="lineItemDiscountPercent"
										type="number"
										bind:value={lineItemDiscountPercent}
										min="0"
										max="100"
										step="0.01"
									/>
								</div>
							</div>

							{#if invoice.acquisition_order_id && orderItems.length > 0}
								<div class="form-group">
									<label for="selectedOrderItemId">Match to Order Item (Optional)</label>
									<select id="selectedOrderItemId" bind:value={selectedOrderItemId}>
										<option value={null}>-- No match --</option>
										{#each orderItems as orderItem}
											<option value={orderItem.id}>
												{orderItem.title} ({orderItem.quantity} @ ${Number(orderItem.unit_price).toFixed(2)})
											</option>
										{/each}
									</select>
								</div>
							{/if}

							<div class="calculated-total">
								<strong>Line Total:</strong>
								${(lineItemQuantity * lineItemUnitPrice * (1 - lineItemDiscountPercent / 100)).toFixed(2)}
							</div>

							<div class="modal-actions">
								<button type="submit" class="btn-primary">
									{editingLineItemId ? 'Update' : 'Add'} Line Item
								</button>
								<button type="button" class="btn-secondary" onclick={closeLineItemForm}>
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

	.invoice-detail-page {
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

	.invoice-meta {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-muted);
		flex-wrap: wrap;
	}

	.invoice-meta a {
		color: var(--accent);
		text-decoration: none;
	}

	.invoice-meta a:hover {
		text-decoration: underline;
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

	.status-badge.approved {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.disputed {
		background: #f8d7da;
		color: #721c24;
	}

	.status-badge.paid {
		background: #d4edda;
		color: #155724;
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

	/* Invoice Info */
	.invoice-info {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.info-section,
	.matching-stats {
		background: white;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	h3 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.info-item {
		font-size: 0.875rem;
	}

	.info-item strong {
		color: var(--text-muted);
		display: block;
		margin-bottom: 0.25rem;
	}

	.approval-info {
		margin-top: 1rem;
		padding: 0.75rem;
		background: #d4edda;
		color: #155724;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.stat-value {
		font-weight: 700;
		font-size: 1.125rem;
	}

	.stat-value.matched {
		color: #10b981;
	}

	.stat-value.alert {
		color: #ef4444;
	}

	/* Actions Bar */
	.actions-bar {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary,
	.btn-approve,
	.btn-dispute {
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

	.btn-approve {
		background: #10b981;
		color: white;
	}

	.btn-dispute {
		background: #ef4444;
		color: white;
	}

	/* Line Items Table */
	.line-items-section {
		background: white;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	.line-items-table-container {
		overflow-x: auto;
	}

	.line-items-table {
		width: 100%;
		border-collapse: collapse;
	}

	.line-items-table thead {
		background: var(--bg-secondary);
	}

	.line-items-table th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.line-items-table td {
		padding: 1rem 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.line-items-table tr.has-discrepancy {
		background: #fef2f2;
	}

	.item-description {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.matched-to {
		font-size: 0.75rem;
		color: #10b981;
	}

	.isbn {
		font-family: monospace;
		color: var(--text-muted);
	}

	.amount {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.match-badge {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.match-badge.matched {
		background: #d4edda;
		color: #155724;
	}

	.match-badge.unmatched {
		background: #fff3cd;
		color: #856404;
	}

	.discrepancy-badge {
		padding: 0.25rem 0.5rem;
		background: #fee2e2;
		color: #991b1b;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		margin-bottom: 0.25rem;
		display: inline-block;
	}

	.discrepancy-notes {
		font-size: 0.75rem;
		color: #991b1b;
		margin-top: 0.25rem;
	}

	.ok-badge {
		color: #10b981;
		font-weight: 600;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.btn-edit-sm,
	.btn-delete-sm {
		padding: 0.375rem 0.75rem;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
	}

	.btn-edit-sm {
		background: var(--accent);
		color: white;
	}

	.btn-delete-sm {
		background: var(--danger);
		color: white;
	}

	.line-items-table tfoot td {
		font-weight: 700;
		border-top: 2px solid var(--text-primary);
	}

	.total-label {
		text-align: right;
	}

	.total-amount {
		font-size: 1.125rem;
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
		max-width: 700px;
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

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--accent);
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.calculated-total {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		text-align: right;
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	@media (max-width: 768px) {
		.invoice-info {
			grid-template-columns: 1fr;
		}

		.info-grid {
			grid-template-columns: 1fr;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.line-items-table {
			font-size: 0.75rem;
		}
	}
</style>
