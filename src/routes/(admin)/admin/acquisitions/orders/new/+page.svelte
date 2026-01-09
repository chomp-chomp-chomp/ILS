<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let vendors = $state<any[]>([]);
	let budgets = $state<any[]>([]);
	let marcRecords = $state<any[]>([]);
	let message = $state('');
	let saving = $state(false);

	// Order fields
	let orderNumber = $state('');
	let vendorId = $state('');
	let budgetId = $state('');
	let orderDate = $state(new Date().toISOString().split('T')[0]);
	let expectedDeliveryDate = $state('');
	let shippingAddress = $state('');
	let shippingMethod = $state('');
	let vendorOrderNumber = $state('');
	let orderNotes = $state('');

	// Order items
	let items = $state<any[]>([]);

	onMount(async () => {
		await Promise.all([loadVendors(), loadBudgets(), loadMarcRecords()]);
		generateOrderNumber();
	});

	async function loadVendors() {
		const { data: vendorsData } = await data.supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');

		vendors = vendorsData || [];
	}

	async function loadBudgets() {
		const { data: budgetsData } = await data.supabase
			.from('budgets')
			.select('id, name, code')
			.eq('status', 'active')
			.order('name');

		budgets = budgetsData || [];
	}

	async function loadMarcRecords() {
		const { data: recordsData } = await data.supabase
			.from('marc_records')
			.select('id, title_statement, main_entry_personal_name, isbn')
			.order('title_statement->a');

		marcRecords = recordsData || [];
	}

	function generateOrderNumber() {
		const year = new Date().getFullYear();
		const random = Math.floor(1000 + Math.random() * 9000);
		orderNumber = `PO-${year}-${random}`;
	}

	function addItem() {
		items = [
			...items,
			{
				id: Date.now().toString(),
				marc_record_id: null,
				title: '',
				author: '',
				isbn: '',
				publisher: '',
				publication_year: '',
				quantity: 1,
				unit_price: 0,
				discount_percent: 0,
				line_total: 0,
				budget_id: budgetId || null,
				notes: ''
			}
		];
	}

	function removeItem(itemId: string) {
		items = items.filter((item) => item.id !== itemId);
	}

	function updateItemTotal(item: any) {
		const subtotal = item.quantity * item.unit_price;
		const discount = subtotal * (item.discount_percent / 100);
		item.line_total = subtotal - discount;
		items = [...items];
	}

	function linkToRecord(item: any, recordId: string) {
		const record = marcRecords.find((r) => r.id === recordId);
		if (record) {
			item.marc_record_id = recordId;
			item.title = record.title_statement?.a || '';
			item.author = record.main_entry_personal_name?.a || '';
			item.isbn = record.isbn || '';
			items = [...items];
		}
	}

	const subtotal = $derived(items.reduce((sum, item) => sum + Number(item.line_total || 0), 0));
	const taxAmount = $derived(0); // Can be calculated based on tax rate
	const shippingAmount = $derived(0);
	const discountAmount = $derived(0);
	const totalAmount = $derived(subtotal + taxAmount + shippingAmount - discountAmount);

	async function saveOrder() {
		if (!vendorId) {
			message = 'Please select a vendor';
			return;
		}

		if (items.length === 0) {
			message = 'Please add at least one item to the order';
			return;
		}

		saving = true;
		message = '';

		try {
			// Create order
			const orderData = {
				order_number: orderNumber,
				vendor_id: vendorId,
				budget_id: budgetId || null,
				order_date: orderDate,
				expected_delivery_date: expectedDeliveryDate || null,
				status: 'pending',
				currency: 'USD',
				subtotal,
				tax_amount: taxAmount,
				shipping_amount: shippingAmount,
				discount_amount: discountAmount,
				total_amount: totalAmount,
				shipping_address: shippingAddress || null,
				shipping_method: shippingMethod || null,
				vendor_order_number: vendorOrderNumber || null,
				notes: orderNotes || null,
				ordered_by: data.session?.user?.email || null
			};

			const { data: insertedOrder, error: orderError } = await data.supabase
				.from('acquisition_orders')
				.insert([orderData])
				.select()
				.single();

			if (orderError) throw orderError;

			// Create order items
			const itemsData = items.map((item) => ({
				acquisition_order_id: insertedOrder.id,
				marc_record_id: item.marc_record_id || null,
				title: item.title,
				author: item.author || null,
				isbn: item.isbn || null,
				publisher: item.publisher || null,
				publication_year: item.publication_year || null,
				quantity: item.quantity,
				unit_price: item.unit_price,
				discount_percent: item.discount_percent,
				line_total: item.line_total,
				status: 'ordered',
				budget_id: item.budget_id || budgetId || null,
				encumbered_amount: item.line_total,
				notes: item.notes || null
			}));

			const { error: itemsError } = await data.supabase.from('order_items').insert(itemsData);

			if (itemsError) throw itemsError;

			// Navigate to order detail
			goto(`/admin/acquisitions/orders/${insertedOrder.id}`);
		} catch (err: any) {
			message = `Error: ${err.message}`;
			saving = false;
		}
	}
</script>

<div class="new-order-page">
	<header class="page-header">
		<div>
			<h1>Create Purchase Order</h1>
			<p class="subtitle">Add a new acquisition order</p>
		</div>
		<a href="/admin/acquisitions/orders" class="btn-back">← Back to Orders</a>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<form
		onsubmit={(e) => {
			e.preventDefault();
			saveOrder();
		}}
	>
		<div class="order-form">
			<h3>Order Information</h3>

			<div class="form-row">
				<div class="form-group">
					<label for="orderNumber">Order Number *</label>
					<input id="orderNumber" type="text" bind:value={orderNumber} required />
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
					<label for="budgetId">Default Budget</label>
					<select id="budgetId" bind:value={budgetId}>
						<option value="">Select budget...</option>
						{#each budgets as budget}
							<option value={budget.id}>{budget.name} {budget.code ? `(${budget.code})` : ''}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="orderDate">Order Date</label>
					<input id="orderDate" type="date" bind:value={orderDate} />
				</div>

				<div class="form-group">
					<label for="expectedDeliveryDate">Expected Delivery</label>
					<input id="expectedDeliveryDate" type="date" bind:value={expectedDeliveryDate} />
				</div>

				<div class="form-group">
					<label for="vendorOrderNumber">Vendor Order #</label>
					<input id="vendorOrderNumber" type="text" bind:value={vendorOrderNumber} />
				</div>
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="shippingMethod">Shipping Method</label>
					<input id="shippingMethod" type="text" bind:value={shippingMethod} />
				</div>

				<div class="form-group full-width">
					<label for="shippingAddress">Shipping Address</label>
					<textarea id="shippingAddress" bind:value={shippingAddress} rows="2"></textarea>
				</div>
			</div>

			<div class="form-row">
				<div class="form-group full-width">
					<label for="orderNotes">Notes</label>
					<textarea id="orderNotes" bind:value={orderNotes} rows="3"></textarea>
				</div>
			</div>
		</div>

		<div class="items-section">
			<div class="items-header">
				<h3>Order Items</h3>
				<button type="button" class="btn-secondary" onclick={addItem}>+ Add Item</button>
			</div>

			{#if items.length === 0}
				<div class="empty-items">
					<p>No items added yet. Click "Add Item" to start adding items to this order.</p>
				</div>
			{:else}
				{#each items as item, index}
					<div class="item-card">
						<div class="item-header">
							<span>Item #{index + 1}</span>
							<button type="button" class="btn-remove" onclick={() => removeItem(item.id)}>
								Remove
							</button>
						</div>

						<div class="form-row">
							<div class="form-group full-width">
								<label for="catalog-{item.id}">Link to Catalog Record (Optional)</label>
								<select
									id="catalog-{item.id}"
									value={item.marc_record_id || ''}
									onchange={(e) => linkToRecord(item, e.currentTarget.value)}
								>
									<option value="">No catalog link</option>
									{#each marcRecords as record}
										<option value={record.id}>
											{record.title_statement?.a || 'Untitled'}
											{record.main_entry_personal_name?.a ? ` - ${record.main_entry_personal_name.a}` : ''}
										</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="form-row">
							<div class="form-group full-width">
								<label for="title-{item.id}">Title *</label>
								<input id="title-{item.id}" type="text" bind:value={item.title} required />
							</div>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label for="author-{item.id}">Author</label>
								<input id="author-{item.id}" type="text" bind:value={item.author} />
							</div>

							<div class="form-group">
								<label for="isbn-{item.id}">ISBN</label>
								<input id="isbn-{item.id}" type="text" bind:value={item.isbn} />
							</div>

							<div class="form-group">
								<label for="publisher-{item.id}">Publisher</label>
								<input id="publisher-{item.id}" type="text" bind:value={item.publisher} />
							</div>

							<div class="form-group">
								<label for="year-{item.id}">Year</label>
								<input id="year-{item.id}" type="text" bind:value={item.publication_year} />
							</div>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label for="quantity-{item.id}">Quantity</label>
								<input
									id="quantity-{item.id}"
									type="number"
									bind:value={item.quantity}
									min="1"
									oninput={() => updateItemTotal(item)}
								/>
							</div>

							<div class="form-group">
								<label for="price-{item.id}">Unit Price</label>
								<input
									id="price-{item.id}"
									type="number"
									bind:value={item.unit_price}
									min="0"
									step="0.01"
									oninput={() => updateItemTotal(item)}
								/>
							</div>

							<div class="form-group">
								<label for="discount-{item.id}">Discount %</label>
								<input
									id="discount-{item.id}"
									type="number"
									bind:value={item.discount_percent}
									min="0"
									max="100"
									step="0.01"
									oninput={() => updateItemTotal(item)}
								/>
							</div>

							<div class="form-group">
								<label>Line Total</label>
								<div class="line-total">${item.line_total.toFixed(2)}</div>
							</div>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label for="item-budget-{item.id}">Item Budget</label>
								<select id="item-budget-{item.id}" bind:value={item.budget_id}>
									<option value={null}>Use order default</option>
									{#each budgets as budget}
										<option value={budget.id}>
											{budget.name} {budget.code ? `(${budget.code})` : ''}
										</option>
									{/each}
								</select>
							</div>

							<div class="form-group full-width">
								<label for="item-notes-{item.id}">Item Notes</label>
								<input id="item-notes-{item.id}" type="text" bind:value={item.notes} />
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<div class="order-summary">
			<h3>Order Summary</h3>
			<div class="summary-row">
				<span>Subtotal:</span>
				<span class="amount">${subtotal.toFixed(2)}</span>
			</div>
			<div class="summary-row">
				<span>Tax:</span>
				<span class="amount">${taxAmount.toFixed(2)}</span>
			</div>
			<div class="summary-row">
				<span>Shipping:</span>
				<span class="amount">${shippingAmount.toFixed(2)}</span>
			</div>
			<div class="summary-row">
				<span>Discount:</span>
				<span class="amount">-${discountAmount.toFixed(2)}</span>
			</div>
			<div class="summary-row total">
				<span>Total:</span>
				<span class="amount">${totalAmount.toFixed(2)}</span>
			</div>
		</div>

		<div class="form-actions">
			<button type="submit" class="btn-primary" disabled={saving}>
				{saving ? 'Creating Order...' : 'Create Order'}
			</button>
			<a href="/admin/acquisitions/orders" class="btn-cancel">Cancel</a>
		</div>
	</form>
</div>

<style>
	.new-order-page {
		max-width: 1200px;
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

	.order-form,
	.items-section,
	.order-summary {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: 1.5rem;
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

	.form-row:last-child {
		margin-bottom: 0;
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

	.items-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.items-header h3 {
		margin: 0;
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

	.empty-items {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
	}

	.item-card {
		background: var(--bg-secondary);
		padding: 1.5rem;
		border-radius: var(--radius-md);
		margin-bottom: 1rem;
	}

	.item-card:last-child {
		margin-bottom: 0;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
		font-weight: 600;
	}

	.btn-remove {
		padding: 0.5rem 1rem;
		background: var(--danger);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.line-total {
		padding: 0.75rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
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

	.amount {
		font-variant-numeric: tabular-nums;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary {
		padding: 0.75rem 2rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
		transition: var(--transition-smooth);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel {
		padding: 0.75rem 2rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
		display: inline-flex;
		align-items: center;
	}
</style>
