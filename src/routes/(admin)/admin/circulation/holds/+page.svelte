<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let holds = $state<any[]>([]);
	let filteredHolds = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Filter state
	let statusFilter = $state<string>('all');

	onMount(async () => {
		await loadHolds();
	});

	async function loadHolds() {
		try {
			const { data: holdsData, error: fetchError } = await supabase
				.from('active_holds')
				.select('*')
				.order('hold_date', { ascending: true });

			if (fetchError) throw fetchError;

			holds = holdsData || [];
			applyFilters();
		} catch (err: any) {
			error = `Error loading holds: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		let filtered = [...holds];

		if (statusFilter !== 'all') {
			filtered = filtered.filter(hold => hold.status === statusFilter);
		}

		filteredHolds = filtered;
	}

	// Reactive: reapply filters when filter changes
	$effect(() => {
		statusFilter;
		if (holds.length > 0) {
			applyFilters();
		}
	});

	async function cancelHold(holdId: string) {
		if (!confirm('Cancel this hold?')) return;

		try {
			const { error: updateError } = await supabase
				.from('holds')
				.update({
					status: 'cancelled',
					cancellation_date: new Date().toISOString()
				})
				.eq('id', holdId);

			if (updateError) throw updateError;

			await loadHolds();
		} catch (err: any) {
			alert(`Error cancelling hold: ${err.message}`);
		}
	}

	async function markPickedUp(holdId: string) {
		if (!confirm('Mark this hold as picked up?')) return;

		try {
			const { error: updateError } = await supabase
				.from('holds')
				.update({
					status: 'picked_up',
					pickup_date: new Date().toISOString()
				})
				.eq('id', holdId);

			if (updateError) throw updateError;

			await loadHolds();
		} catch (err: any) {
			alert(`Error marking hold as picked up: ${err.message}`);
		}
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString();
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'placed': return 'status-placed';
			case 'in_transit': return 'status-in-transit';
			case 'available': return 'status-available';
			case 'picked_up': return 'status-picked-up';
			default: return '';
		}
	}
</script>

<div class="holds-page">
	<header class="page-header">
		<h1>Holds Management</h1>
	</header>

	{#if loading}
		<div class="loading">Loading holds...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else}
		<div class="controls">
			<div class="filter-controls">
				<select bind:value={statusFilter} class="filter-select">
					<option value="all">All Statuses</option>
					<option value="placed">Placed</option>
					<option value="in_transit">In Transit</option>
					<option value="available">Available for Pickup</option>
				</select>
			</div>
			<p class="count">
				Showing {filteredHolds.length} of {holds.length} hold{holds.length === 1 ? '' : 's'}
			</p>
		</div>

		{#if filteredHolds.length === 0}
			<div class="empty-state">
				<p>No holds found.</p>
			</div>
		{:else}
			<div class="holds-list">
				{#each filteredHolds as hold}
					<div class="hold-card">
						<div class="hold-main">
							<div class="hold-header">
								<h3>
									<a href="/catalog/record/{hold.marc_record_id}">
										{hold.title_statement?.a || 'Untitled'}
									</a>
								</h3>
								<span class="status-badge {getStatusBadgeClass(hold.status)}">
									{hold.status.replace('_', ' ')}
								</span>
							</div>

							<div class="hold-details">
								<div class="detail-row">
									<span class="label">Patron:</span>
									<span>
										<a href="/admin/circulation/patrons/{hold.patron_id}">
											{hold.first_name} {hold.last_name}
										</a>
										<span class="barcode-small">({hold.patron_barcode})</span>
									</span>
								</div>
								{#if hold.email}
									<div class="detail-row">
										<span class="label">Email:</span>
										<span>{hold.email}</span>
									</div>
								{/if}
								<div class="detail-row">
									<span class="label">Hold Date:</span>
									<span>{formatDate(hold.hold_date)}</span>
								</div>
								{#if hold.queue_position}
									<div class="detail-row">
										<span class="label">Queue Position:</span>
										<span>#{hold.queue_position}</span>
									</div>
								{/if}
								{#if hold.item_barcode}
									<div class="detail-row">
										<span class="label">Item Barcode:</span>
										<span class="barcode-small">{hold.item_barcode}</span>
									</div>
								{/if}
								{#if hold.pickup_location}
									<div class="detail-row">
										<span class="label">Pickup Location:</span>
										<span>{hold.pickup_location}</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="hold-actions">
							{#if hold.status === 'available'}
								<button onclick={() => markPickedUp(hold.id)} class="btn-small btn-pickup">
									Mark Picked Up
								</button>
							{/if}
							{#if hold.status === 'placed' || hold.status === 'available'}
								<button onclick={() => cancelHold(hold.id)} class="btn-small btn-cancel">
									Cancel Hold
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.holds-page {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.controls {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
	}

	.filter-controls {
		margin-bottom: 1rem;
	}

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-select:focus {
		outline: none;
		border-color: #e73b42;
	}

	.count {
		color: #666;
		margin: 0;
		font-size: 0.875rem;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
	}

	.error {
		color: #c33;
		background: #fee;
		border: 1px solid #fcc;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
		color: #666;
	}

	.holds-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hold-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1.5rem;
		transition: all 0.2s;
	}

	.hold-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.hold-main {
		flex: 1;
	}

	.hold-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e0e0e0;
		gap: 1rem;
	}

	.hold-header h3 {
		margin: 0;
		font-size: 1.125rem;
		flex: 1;
	}

	.hold-header h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.hold-header h3 a:hover {
		color: #e73b42;
		text-decoration: underline;
	}

	.status-badge {
		display: inline-block;
		padding: 0.375rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.status-placed {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-in-transit {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-available {
		background: #d4edda;
		color: #155724;
	}

	.status-picked-up {
		background: #e0e0e0;
		color: #666;
	}

	.hold-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-row {
		display: flex;
		gap: 0.75rem;
		font-size: 0.875rem;
	}

	.label {
		font-weight: 600;
		color: #666;
		min-width: 120px;
	}

	.barcode-small {
		font-family: monospace;
		font-size: 0.875rem;
		color: #666;
		background: #f5f5f5;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.hold-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.btn-small {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
		font-weight: 500;
		white-space: nowrap;
	}

	.btn-pickup {
		background: #28a745;
		color: white;
	}

	.btn-pickup:hover {
		background: #218838;
	}

	.btn-cancel {
		background: #6c757d;
		color: white;
	}

	.btn-cancel:hover {
		background: #5a6268;
	}

	@media (max-width: 768px) {
		.hold-card {
			flex-direction: column;
		}

		.hold-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.hold-actions {
			width: 100%;
		}

		.btn-small {
			width: 100%;
		}
	}
</style>
