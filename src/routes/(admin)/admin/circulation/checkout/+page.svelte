<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let patronBarcode = $state('');
	let itemBarcode = $state('');
	let patron = $state<any>(null);
	let patronType = $state<any>(null);
	let item = $state<any>(null);
	let marcRecord = $state<any>(null);
	let currentCheckouts = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let success = $state('');

	let patronBarcodeInput: HTMLInputElement;
	let itemBarcodeInput: HTMLInputElement;

	onMount(() => {
		// Focus patron barcode input on mount
		patronBarcodeInput?.focus();
	});

	async function lookupPatron() {
		if (!patronBarcode.trim()) return;

		loading = true;
		error = '';
		patron = null;

		try {
			// Look up patron
			const { data: patronData, error: patronError } = await supabase
				.from('patrons')
				.select('*, patron_type:patron_types(*)')
				.eq('barcode', patronBarcode.trim())
				.single();

			if (patronError) throw new Error('Patron not found');

			patron = patronData;
			patronType = patronData.patron_type;

			// Check patron status
			if (patron.status !== 'active') {
				error = `Patron account is ${patron.status}. Cannot checkout items.`;
				patron = null;
				return;
			}

			// Load current checkouts
			const { data: checkoutsData, error: checkoutsError } = await supabase
				.from('current_checkouts')
				.select('*')
				.eq('patron_id', patron.id);

			if (checkoutsError) throw checkoutsError;

			currentCheckouts = checkoutsData || [];

			// Check if at checkout limit
			if (currentCheckouts.length >= patronType.max_checkouts) {
				error = `Patron has reached maximum checkout limit (${patronType.max_checkouts} items).`;
			}

			// Focus item barcode input
			setTimeout(() => itemBarcodeInput?.focus(), 100);

		} catch (err: any) {
			error = err.message || 'Error looking up patron';
		} finally {
			loading = false;
		}
	}

	async function lookupItem() {
		if (!itemBarcode.trim()) return;
		if (!patron) {
			error = 'Please scan patron barcode first.';
			return;
		}

		loading = true;
		error = '';
		item = null;

		try {
			// Look up item
			const { data: itemData, error: itemError } = await supabase
				.from('items')
				.select('*, marc_record:marc_records(*)')
				.eq('barcode', itemBarcode.trim())
				.single();

			if (itemError) throw new Error('Item not found');

			item = itemData;
			marcRecord = itemData.marc_record;

			// Check item status
			if (item.status !== 'available') {
				error = `Item is ${item.status}. Cannot checkout.`;
				item = null;
				itemBarcode = '';
				itemBarcodeInput?.focus();
				return;
			}

			// Check circulation status
			if (item.circulation_status !== 'circulating') {
				error = `Item is ${item.circulation_status.replace('_', ' ')}. Cannot checkout.`;
				item = null;
				itemBarcode = '';
				itemBarcodeInput?.focus();
				return;
			}

			// Auto-checkout
			await processCheckout();

		} catch (err: any) {
			error = err.message || 'Error looking up item';
			itemBarcode = '';
			itemBarcodeInput?.focus();
		} finally {
			loading = false;
		}
	}

	async function processCheckout() {
		if (!patron || !item) return;

		loading = true;
		error = '';
		success = '';

		try {
			// Calculate due date
			const loanPeriodDays = item.loan_period_days || patronType.default_loan_period_days;
			const dueDate = new Date();
			dueDate.setDate(dueDate.getDate() + loanPeriodDays);

			// Get current user (staff member)
			const { data: { user } } = await supabase.auth.getUser();

			// Create checkout record
			const { data: checkoutData, error: checkoutError } = await supabase
				.from('checkouts')
				.insert({
					item_id: item.id,
					patron_id: patron.id,
					due_date: dueDate.toISOString(),
					checkout_staff_id: user?.id,
					status: 'checked_out'
				})
				.select()
				.single();

			if (checkoutError) throw checkoutError;

			// Success message
			const title = marcRecord.title_statement?.a || 'Untitled';
			success = `Checked out: ${title} - Due: ${dueDate.toLocaleDateString()}`;

			// Reload patron checkouts
			const { data: updatedCheckouts, error: checkoutsError } = await supabase
				.from('current_checkouts')
				.select('*')
				.eq('patron_id', patron.id);

			if (!checkoutsError) {
				currentCheckouts = updatedCheckouts || [];
			}

			// Clear item for next scan
			item = null;
			marcRecord = null;
			itemBarcode = '';
			itemBarcodeInput?.focus();

			// Clear success message after 3 seconds
			setTimeout(() => {
				success = '';
			}, 3000);

		} catch (err: any) {
			error = `Error processing checkout: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function clearPatron() {
		patron = null;
		patronType = null;
		currentCheckouts = [];
		item = null;
		marcRecord = null;
		patronBarcode = '';
		itemBarcode = '';
		error = '';
		success = '';
		patronBarcodeInput?.focus();
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function getUrgencyClass(urgency: string): string {
		switch (urgency) {
			case 'overdue': return 'urgency-overdue';
			case 'due_soon': return 'urgency-due-soon';
			default: return '';
		}
	}
</script>

<div class="checkout-page">
	<header class="page-header">
		<h1>Checkout Items</h1>
	</header>

	<div class="checkout-container">
		<!-- Patron Section -->
		<div class="section patron-section">
			<h2>1. Scan Patron Card</h2>
			<form onsubmit={(e) => { e.preventDefault(); lookupPatron(); }}>
				<div class="barcode-input-group">
					<input
						bind:this={patronBarcodeInput}
						type="text"
						bind:value={patronBarcode}
						placeholder="Scan or enter patron barcode..."
						class="barcode-input"
						disabled={loading || !!patron}
					/>
					{#if !patron}
						<button type="submit" class="btn-primary" disabled={loading || !patronBarcode.trim()}>
							Lookup
						</button>
					{:else}
						<button type="button" onclick={clearPatron} class="btn-secondary">
							Clear Patron
						</button>
					{/if}
				</div>
			</form>

			{#if patron}
				<div class="patron-info">
					<div class="patron-header">
						<h3>{patron.first_name} {patron.last_name}</h3>
						<span class="patron-type">{patronType.name}</span>
					</div>
					<div class="patron-details">
						<p><strong>Card:</strong> {patron.barcode}</p>
						<p><strong>Email:</strong> {patron.email || '—'}</p>
						<p>
							<strong>Checkouts:</strong>
							{currentCheckouts.length} / {patronType.max_checkouts}
						</p>
						{#if patron.balance > 0}
							<p class="balance-warning">
								<strong>Balance Owed:</strong> ${patron.balance.toFixed(2)}
							</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Item Section -->
		<div class="section item-section">
			<h2>2. Scan Item Barcode</h2>
			<form onsubmit={(e) => { e.preventDefault(); lookupItem(); }}>
				<div class="barcode-input-group">
					<input
						bind:this={itemBarcodeInput}
						type="text"
						bind:value={itemBarcode}
						placeholder="Scan or enter item barcode..."
						class="barcode-input"
						disabled={loading || !patron}
					/>
					<button type="submit" class="btn-primary" disabled={loading || !patron || !itemBarcode.trim()}>
						Checkout
					</button>
				</div>
			</form>

			{#if !patron}
				<p class="help-text">Scan patron barcode first</p>
			{/if}
		</div>

		<!-- Messages -->
		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		{#if success}
			<div class="success-message">{success}</div>
		{/if}

		<!-- Current Checkouts -->
		{#if patron && currentCheckouts.length > 0}
			<div class="section">
				<h2>Current Checkouts ({currentCheckouts.length})</h2>
				<div class="table-responsive">
					<table>
						<thead>
							<tr>
								<th>Item Barcode</th>
								<th>Title</th>
								<th>Due Date</th>
								<th>Renewals</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each currentCheckouts as checkout}
								<tr class={getUrgencyClass(checkout.urgency)}>
									<td class="barcode">{checkout.item_barcode}</td>
									<td>{checkout.title_statement?.a || 'Untitled'}</td>
									<td>{formatDateTime(checkout.due_date)}</td>
									<td class="center">{checkout.renewal_count}</td>
									<td>
										{#if checkout.urgency === 'overdue'}
											<span class="urgency-badge overdue">OVERDUE</span>
										{:else if checkout.urgency === 'due_soon'}
											<span class="urgency-badge due-soon">Due Soon</span>
										{:else}
											OK
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.checkout-page {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.checkout-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		color: #333;
	}

	.barcode-input-group {
		display: flex;
		gap: 1rem;
	}

	.barcode-input {
		flex: 1;
		padding: 1rem;
		border: 2px solid #d0d0d0;
		border-radius: 4px;
		font-size: 1.125rem;
		font-family: monospace;
		font-weight: 500;
		transition: all 0.2s;
	}

	.barcode-input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.barcode-input:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.help-text {
		margin: 0.5rem 0 0 0;
		color: #666;
		font-size: 0.875rem;
		font-style: italic;
	}

	.patron-info {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: #f8f9fa;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.patron-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.patron-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	.patron-type {
		display: inline-block;
		padding: 0.375rem 1rem;
		background: #e0e0e0;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.patron-details p {
		margin: 0.5rem 0;
		font-size: 0.875rem;
	}

	.balance-warning {
		color: #f44336;
		font-weight: 600;
	}

	.error-message,
	.success-message {
		padding: 1rem 1.5rem;
		border-radius: 8px;
		font-weight: 500;
	}

	.error-message {
		background: #fee;
		color: #c33;
		border: 1px solid #fcc;
	}

	.success-message {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.table-responsive {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f8f9fa;
		border-bottom: 2px solid #e0e0e0;
	}

	th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
	}

	td {
		padding: 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.875rem;
	}

	tbody tr:hover {
		background: #f8f9fa;
	}

	.barcode {
		font-family: monospace;
		font-weight: 500;
		color: #666;
	}

	.center {
		text-align: center;
	}

	.urgency-overdue {
		background: #ffebee !important;
	}

	.urgency-due-soon {
		background: #fff3e0 !important;
	}

	.urgency-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.urgency-badge.overdue {
		background: #f44336;
		color: white;
	}

	.urgency-badge.due-soon {
		background: #ff9800;
		color: white;
	}

	.btn-primary,
	.btn-secondary {
		padding: 1rem 1.5rem;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background: #5a6268;
	}

	@media (max-width: 768px) {
		.barcode-input-group {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
