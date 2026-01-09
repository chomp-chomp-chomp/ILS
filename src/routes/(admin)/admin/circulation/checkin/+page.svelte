<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let itemBarcode = $state('');
	let checkedInItems = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let success = $state('');

	let itemBarcodeInput: HTMLInputElement;

	onMount(() => {
		// Focus item barcode input on mount
		itemBarcodeInput?.focus();
	});

	async function processCheckin() {
		if (!itemBarcode.trim()) return;

		loading = true;
		error = '';
		success = '';

		try {
			// Look up item
			const { data: itemData, error: itemError } = await supabase
				.from('items')
				.select('*, marc_record:marc_records(*)')
				.eq('barcode', itemBarcode.trim())
				.single();

			if (itemError) throw new Error('Item not found');

			// Find active checkout for this item
			const { data: checkoutData, error: checkoutError } = await supabase
				.from('checkouts')
				.select('*, patron:patrons(*)')
				.eq('item_id', itemData.id)
				.in('status', ['checked_out', 'overdue'])
				.order('checkout_date', { ascending: false })
				.limit(1)
				.single();

			if (checkoutError) {
				// Item might not be checked out
				if (itemData.status === 'available') {
					error = 'This item is already available (not checked out).';
				} else {
					error = `Item status is ${itemData.status}. No active checkout found.`;
				}
				itemBarcode = '';
				itemBarcodeInput?.focus();
				return;
			}

			// Get current user (staff member)
			const { data: { user } } = await supabase.auth.getUser();

			// Update checkout record to mark as returned
			const { error: updateError } = await supabase
				.from('checkouts')
				.update({
					return_date: new Date().toISOString(),
					status: 'returned',
					checkin_staff_id: user?.id
				})
				.eq('id', checkoutData.id);

			if (updateError) throw updateError;

			// Calculate if item was overdue
			const dueDate = new Date(checkoutData.due_date);
			const now = new Date();
			const isOverdue = now > dueDate;

			// Add to checked-in items list
			const title = itemData.marc_record.title_statement?.a || 'Untitled';
			checkedInItems = [
				{
					barcode: itemData.barcode,
					title,
					patron: checkoutData.patron,
					dueDate: checkoutData.due_date,
					isOverdue,
					holdStatus: null // Will be updated if there's a hold
				},
				...checkedInItems
			];

			// Check if there's a hold and update the status message
			setTimeout(async () => {
				// Refresh item to see if it went to on_hold status
				const { data: refreshedItem } = await supabase
					.from('items')
					.select('status')
					.eq('id', itemData.id)
					.single();

				if (refreshedItem?.status === 'on_hold') {
					// Find the hold that was trapped
					const { data: trapResult } = await supabase
						.from('holds')
						.select('*, patron:patrons(*)')
						.eq('item_id', itemData.id)
						.eq('status', 'available')
						.single();

					if (trapResult) {
						checkedInItems[0].holdStatus = `Hold trapped for ${trapResult.patron.first_name} ${trapResult.patron.last_name}`;
					}
				}
			}, 500);

			success = `Checked in: ${title}`;

			// Clear input for next scan
			itemBarcode = '';
			itemBarcodeInput?.focus();

			// Clear success message after 2 seconds
			setTimeout(() => {
				success = '';
			}, 2000);

		} catch (err: any) {
			error = err.message || 'Error processing checkin';
			itemBarcode = '';
			itemBarcodeInput?.focus();
		} finally {
			loading = false;
		}
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function clearHistory() {
		checkedInItems = [];
	}
</script>

<div class="checkin-page">
	<header class="page-header">
		<h1>Checkin Items</h1>
	</header>

	<div class="checkin-container">
		<!-- Checkin Section -->
		<div class="section checkin-section">
			<h2>Scan Item Barcode</h2>
			<form onsubmit={(e) => { e.preventDefault(); processCheckin(); }}>
				<div class="barcode-input-group">
					<input
						bind:this={itemBarcodeInput}
						type="text"
						bind:value={itemBarcode}
						placeholder="Scan or enter item barcode..."
						class="barcode-input"
						disabled={loading}
						autofocus
					/>
					<button type="submit" class="btn-primary" disabled={loading || !itemBarcode.trim()}>
						{loading ? 'Processing...' : 'Checkin'}
					</button>
				</div>
			</form>
		</div>

		<!-- Messages -->
		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		{#if success}
			<div class="success-message">{success}</div>
		{/if}

		<!-- Checked-in Items -->
		{#if checkedInItems.length > 0}
			<div class="section">
				<div class="section-header">
					<h2>Checked-in Items ({checkedInItems.length})</h2>
					<button onclick={clearHistory} class="btn-clear">Clear History</button>
				</div>

				<div class="checkin-list">
					{#each checkedInItems as item}
						<div class="checkin-card" class:overdue={item.isOverdue}>
							<div class="checkin-main">
								<div class="checkin-title">
									<strong>{item.title}</strong>
									<span class="barcode-small">{item.barcode}</span>
								</div>
								<div class="checkin-details">
									<p>
										<strong>Patron:</strong>
										{item.patron.first_name} {item.patron.last_name}
										({item.patron.barcode})
									</p>
									<p>
										<strong>Due:</strong>
										{formatDateTime(item.dueDate)}
										{#if item.isOverdue}
											<span class="overdue-badge">OVERDUE</span>
										{/if}
									</p>
									{#if item.holdStatus}
										<p class="hold-alert">
											<strong>⚠️ {item.holdStatus}</strong>
										</p>
									{/if}
								</div>
							</div>
							<div class="checkin-status">
								{#if item.holdStatus}
									<span class="status-badge on-hold">On Hold</span>
								{:else}
									<span class="status-badge available">Available</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.checkin-page {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.checkin-container {
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

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.section-header h2 {
		margin: 0;
	}

	.btn-clear {
		padding: 0.5rem 1rem;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-clear:hover {
		background: #5a6268;
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

	.checkin-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.checkin-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem;
		background: #f8f9fa;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		transition: all 0.2s;
	}

	.checkin-card.overdue {
		background: #ffebee;
		border-color: #f44336;
	}

	.checkin-main {
		flex: 1;
	}

	.checkin-title {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.checkin-title strong {
		font-size: 1rem;
	}

	.barcode-small {
		font-family: monospace;
		font-size: 0.875rem;
		color: #666;
		background: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.checkin-details p {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		color: #666;
	}

	.overdue-badge {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: #f44336;
		color: white;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.hold-alert {
		color: #ff9800;
		font-weight: 600;
		margin-top: 0.5rem !important;
		padding: 0.5rem;
		background: #fff3e0;
		border-radius: 4px;
	}

	.checkin-status {
		display: flex;
		align-items: center;
	}

	.status-badge {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.available {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.on-hold {
		background: #fff3cd;
		color: #856404;
	}

	.btn-primary {
		padding: 1rem 1.5rem;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		background: #e73b42;
		color: white;
		white-space: nowrap;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.barcode-input-group {
			flex-direction: column;
		}

		.btn-primary {
			width: 100%;
		}

		.checkin-card {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.btn-clear {
			width: 100%;
		}
	}
</style>
