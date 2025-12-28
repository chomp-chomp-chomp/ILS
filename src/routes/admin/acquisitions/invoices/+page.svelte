<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let invoices = $state<any[]>([]);
	let vendors = $state<any[]>([]);
	let orders = $state<any[]>([]);
	let budgets = $state<any[]>([]);
	let loading = $state(true);
	let showForm = $state(false);
	let showPaymentForm = $state(false);
	let editingId = $state<string | null>(null);
	let payingInvoiceId = $state<string | null>(null);
	let message = $state('');

	// Invoice form fields
	let invoiceNumber = $state('');
	let vendorId = $state('');
	let orderId = $state('');
	let invoiceDate = $state(new Date().toISOString().split('T')[0]);
	let dueDate = $state('');
	let subtotal = $state(0);
	let taxAmount = $state(0);
	let shippingAmount = $state(0);
	let discountAmount = $state(0);
	let invoiceNotes = $state('');

	// Payment form fields
	let paymentDate = $state(new Date().toISOString().split('T')[0]);
	let paymentAmount = $state(0);
	let paymentBudgetId = $state('');
	let paymentMethod = $state('Check');
	let referenceNumber = $state('');
	let paymentNotes = $state('');

	onMount(async () => {
		await Promise.all([loadInvoices(), loadVendors(), loadOrders(), loadBudgets()]);
	});

	async function loadInvoices() {
		loading = true;
		const { data: invoicesData } = await data.supabase
			.from('invoices')
			.select(
				`
				*,
				vendor:vendors(name),
				order:acquisition_orders(order_number)
			`
			)
			.order('created_at', { ascending: false });

		invoices = invoicesData || [];
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

	async function loadOrders() {
		const { data: ordersData } = await data.supabase
			.from('acquisition_orders')
			.select('id, order_number')
			.order('created_at', { ascending: false });

		orders = ordersData || [];
	}

	async function loadBudgets() {
		const { data: budgetsData } = await data.supabase
			.from('budgets')
			.select('id, name, code')
			.eq('status', 'active')
			.order('name');

		budgets = budgetsData || [];
	}

	function resetInvoiceForm() {
		invoiceNumber = '';
		vendorId = '';
		orderId = '';
		invoiceDate = new Date().toISOString().split('T')[0];
		dueDate = '';
		subtotal = 0;
		taxAmount = 0;
		shippingAmount = 0;
		discountAmount = 0;
		invoiceNotes = '';
	}

	function resetPaymentForm() {
		paymentDate = new Date().toISOString().split('T')[0];
		paymentAmount = 0;
		paymentBudgetId = '';
		paymentMethod = 'Check';
		referenceNumber = '';
		paymentNotes = '';
	}

	const totalAmount = $derived(subtotal + taxAmount + shippingAmount - discountAmount);

	async function saveInvoice() {
		if (!invoiceNumber.trim() || !vendorId) {
			message = 'Invoice number and vendor are required';
			return;
		}

		const invoiceData = {
			invoice_number: invoiceNumber.trim(),
			vendor_id: vendorId,
			acquisition_order_id: orderId || null,
			invoice_date: invoiceDate,
			due_date: dueDate || null,
			currency: 'USD',
			subtotal,
			tax_amount: taxAmount,
			shipping_amount: shippingAmount,
			discount_amount: discountAmount,
			total_amount: totalAmount,
			paid_amount: 0,
			status: 'pending',
			notes: invoiceNotes || null
		};

		try {
			if (editingId) {
				const { error } = await data.supabase
					.from('invoices')
					.update(invoiceData)
					.eq('id', editingId);

				if (error) throw error;
				message = 'Invoice updated successfully!';
			} else {
				const { error } = await data.supabase.from('invoices').insert([invoiceData]);

				if (error) throw error;
				message = 'Invoice created successfully!';
			}

			showForm = false;
			editingId = null;
			resetInvoiceForm();
			await loadInvoices();

			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function recordPayment() {
		if (!paymentBudgetId || paymentAmount <= 0) {
			message = 'Budget and payment amount are required';
			return;
		}

		try {
			const paymentData = {
				invoice_id: payingInvoiceId,
				budget_id: paymentBudgetId,
				payment_date: paymentDate,
				amount: paymentAmount,
				currency: 'USD',
				payment_method: paymentMethod,
				reference_number: referenceNumber || null,
				notes: paymentNotes || null
			};

			const { error: paymentError } = await data.supabase.from('payments').insert([paymentData]);

			if (paymentError) throw paymentError;

			// Update invoice paid amount
			const invoice = invoices.find((inv) => inv.id === payingInvoiceId);
			if (invoice) {
				const newPaidAmount = Number(invoice.paid_amount || 0) + paymentAmount;
				const newStatus =
					newPaidAmount >= Number(invoice.total_amount) ? 'paid' : 'partial';

				const { error: updateError } = await data.supabase
					.from('invoices')
					.update({ paid_amount: newPaidAmount, status: newStatus })
					.eq('id', payingInvoiceId);

				if (updateError) throw updateError;
			}

			showPaymentForm = false;
			payingInvoiceId = null;
			resetPaymentForm();
			await loadInvoices();

			message = 'Payment recorded successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function deleteInvoice(invoiceId: string) {
		if (!confirm('Are you sure you want to delete this invoice?')) return;

		try {
			const { error } = await data.supabase.from('invoices').delete().eq('id', invoiceId);

			if (error) throw error;

			message = 'Invoice deleted successfully!';
			await loadInvoices();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function openPaymentForm(invoiceId: string) {
		payingInvoiceId = invoiceId;
		const invoice = invoices.find((inv) => inv.id === invoiceId);
		if (invoice) {
			const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);
			paymentAmount = remaining;
		}
		showPaymentForm = true;
	}
</script>

<div class="invoices-page">
	<header class="page-header">
		<div>
			<h1>Invoices & Payments</h1>
			<p class="subtitle">Process vendor invoices and record payments</p>
		</div>
		<div class="header-actions">
			<button class="btn-primary" onclick={() => { if (!showForm) { resetInvoiceForm(); editingId = null; } showForm = !showForm; }}>
				{showForm ? 'Cancel' : '+ Add Invoice'}
			</button>
			<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
		</div>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	{#if showForm}
		<div class="invoice-form">
			<h3>{editingId ? 'Edit Invoice' : 'Add New Invoice'}</h3>

			<form onsubmit={(e) => { e.preventDefault(); saveInvoice(); }}>
				<div class="form-row">
					<div class="form-group">
						<label for="invoiceNumber">Invoice Number *</label>
						<input id="invoiceNumber" type="text" bind:value={invoiceNumber} required />
					</div>

					<div class="form-group">
						<label for="vendorId">Vendor *</label>
						<select id="vendorId" bind:value={vendorId} required>
							<option value="">Select vendor...</option>
							{#each vendors as vendor}
								<option value={vendor.id}>{vendor.name}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="orderId">Related Order (Optional)</label>
						<select id="orderId" bind:value={orderId}>
							<option value="">No order link</option>
							{#each orders as order}
								<option value={order.id}>{order.order_number}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="invoiceDate">Invoice Date</label>
						<input id="invoiceDate" type="date" bind:value={invoiceDate} />
					</div>

					<div class="form-group">
						<label for="dueDate">Due Date</label>
						<input id="dueDate" type="date" bind:value={dueDate} />
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="subtotal">Subtotal</label>
						<input id="subtotal" type="number" bind:value={subtotal} min="0" step="0.01" />
					</div>

					<div class="form-group">
						<label for="taxAmount">Tax</label>
						<input id="taxAmount" type="number" bind:value={taxAmount} min="0" step="0.01" />
					</div>

					<div class="form-group">
						<label for="shippingAmount">Shipping</label>
						<input id="shippingAmount" type="number" bind:value={shippingAmount} min="0" step="0.01" />
					</div>

					<div class="form-group">
						<label for="discountAmount">Discount</label>
						<input id="discountAmount" type="number" bind:value={discountAmount} min="0" step="0.01" />
					</div>
				</div>

				<div class="total-display">
					<strong>Total Amount:</strong> ${totalAmount.toFixed(2)}
				</div>

				<div class="form-row">
					<div class="form-group full-width">
						<label for="invoiceNotes">Notes</label>
						<textarea id="invoiceNotes" bind:value={invoiceNotes} rows="3"></textarea>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary">
						{editingId ? 'Update Invoice' : 'Create Invoice'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => { showForm = false; editingId = null; resetInvoiceForm(); }}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if showPaymentForm}
		<div class="payment-form">
			<h3>Record Payment</h3>

			<form onsubmit={(e) => { e.preventDefault(); recordPayment(); }}>
				<div class="form-row">
					<div class="form-group">
						<label for="paymentDate">Payment Date</label>
						<input id="paymentDate" type="date" bind:value={paymentDate} />
					</div>

					<div class="form-group">
						<label for="paymentAmount">Amount</label>
						<input id="paymentAmount" type="number" bind:value={paymentAmount} min="0" step="0.01" required />
					</div>

					<div class="form-group">
						<label for="paymentBudgetId">Budget *</label>
						<select id="paymentBudgetId" bind:value={paymentBudgetId} required>
							<option value="">Select budget...</option>
							{#each budgets as budget}
								<option value={budget.id}>{budget.name} {budget.code ? `(${budget.code})` : ''}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="paymentMethod">Payment Method</label>
						<select id="paymentMethod" bind:value={paymentMethod}>
							<option value="Check">Check</option>
							<option value="Wire Transfer">Wire Transfer</option>
							<option value="Credit Card">Credit Card</option>
							<option value="ACH">ACH</option>
							<option value="Cash">Cash</option>
						</select>
					</div>

					<div class="form-group">
						<label for="referenceNumber">Reference Number</label>
						<input id="referenceNumber" type="text" bind:value={referenceNumber} placeholder="Check #, Transaction ID, etc." />
					</div>
				</div>

				<div class="form-row">
					<div class="form-group full-width">
						<label for="paymentNotes">Notes</label>
						<textarea id="paymentNotes" bind:value={paymentNotes} rows="2"></textarea>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary">Record Payment</button>
					<button type="button" class="btn-secondary" onclick={() => { showPaymentForm = false; payingInvoiceId = null; resetPaymentForm(); }}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	<div class="invoices-list">
		{#if loading}
			<p class="loading">Loading invoices...</p>
		{:else if invoices.length === 0}
			<div class="empty-state">
				<p>No invoices yet. Create your first invoice to start tracking payments.</p>
			</div>
		{:else}
			<div class="invoices-table-container">
				<table class="invoices-table">
					<thead>
						<tr>
							<th>Invoice #</th>
							<th>Vendor</th>
							<th>Date</th>
							<th>Due Date</th>
							<th>Total</th>
							<th>Paid</th>
							<th>Balance</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each invoices as invoice}
							{@const balance = Number(invoice.total_amount) - Number(invoice.paid_amount || 0)}
							<tr>
								<td class="invoice-number">{invoice.invoice_number}</td>
								<td>{invoice.vendor?.name || 'N/A'}</td>
								<td>{new Date(invoice.invoice_date).toLocaleDateString()}</td>
								<td>
									{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
								</td>
								<td class="amount">${Number(invoice.total_amount).toFixed(2)}</td>
								<td class="amount">${Number(invoice.paid_amount || 0).toFixed(2)}</td>
								<td class="amount {balance > 0 ? 'unpaid' : 'paid'}">${balance.toFixed(2)}</td>
								<td>
									<span class="status-badge {invoice.status}">{invoice.status}</span>
								</td>
								<td>
									<div class="action-buttons">
										{#if invoice.status !== 'paid'}
											<button class="btn-pay" onclick={() => openPaymentForm(invoice.id)}>
												Pay
											</button>
										{/if}
										<button class="btn-delete-sm" onclick={() => deleteInvoice(invoice.id)}>
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
	.invoices-page {
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
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
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

	.invoice-form,
	.payment-form {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
		border: 2px solid var(--accent);
	}

	h3 {
		margin: 0 0 1.5rem 0;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	input,
	select,
	textarea {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	textarea {
		resize: vertical;
	}

	.total-display {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		margin-bottom: 1rem;
		font-size: 1.125rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
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

	.invoices-table-container {
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		overflow-x: auto;
	}

	.invoices-table {
		width: 100%;
		border-collapse: collapse;
	}

	.invoices-table thead {
		background: var(--bg-secondary);
	}

	.invoices-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.invoices-table td {
		padding: 1rem;
		border-top: 1px solid var(--border);
	}

	.invoice-number {
		font-weight: 600;
	}

	.amount {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.amount.unpaid {
		color: var(--accent);
	}

	.amount.paid {
		color: #10b981;
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

	.status-badge.partial {
		background: #cce5ff;
		color: #004085;
	}

	.status-badge.paid {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.overdue {
		background: #f8d7da;
		color: #721c24;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.btn-pay {
		padding: 0.5rem 1rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.btn-delete-sm {
		padding: 0.5rem 1rem;
		background: var(--danger);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}
</style>
