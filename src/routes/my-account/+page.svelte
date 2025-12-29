<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let patron = $state<any>(null);
	let patronType = $state<any>(null);
	let checkouts = $state<any[]>([]);
	let holds = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		await loadPatronAccount();
	});

	async function loadPatronAccount() {
		try {
			// Check if user is authenticated
			const { data: { user } } = await data.supabase.auth.getUser();

			if (!user) {
				goto('/my-account/login');
				return;
			}

			// Load patron record
			const { data: patronData, error: patronError } = await data.supabase
				.from('patrons')
				.select('*, patron_type:patron_types(*)')
				.eq('user_id', user.id)
				.single();

			if (patronError) {
				error = 'Patron record not found. Please contact library staff.';
				loading = false;
				return;
			}

			patron = patronData;
			patronType = patronData.patron_type;

			// Load checkouts
			const { data: checkoutsData, error: checkoutsError } = await data.supabase
				.from('current_checkouts')
				.select('*')
				.eq('patron_id', patron.id);

			if (checkoutsError) throw checkoutsError;
			checkouts = checkoutsData || [];

			// Load holds
			const { data: holdsData, error: holdsError } = await data.supabase
				.from('active_holds')
				.select('*')
				.eq('patron_id', patron.id);

			if (holdsError) throw holdsError;
			holds = holdsData || [];

		} catch (err: any) {
			error = `Error loading account: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	async function renewItem(checkoutId: string, currentRenewals: number) {
		if (!confirm('Renew this item?')) return;

		try {
			// Check renewal limit
			if (currentRenewals >= patronType.max_renewals) {
				alert(`Cannot renew: maximum renewals (${patronType.max_renewals}) reached.`);
				return;
			}

			// Check for holds
			const checkout = checkouts.find(c => c.id === checkoutId);
			const { data: holdsData } = await data.supabase
				.from('holds')
				.select('id')
				.eq('marc_record_id', checkout.marc_record_id)
				.in('status', ['placed', 'in_transit'])
				.limit(1);

			if (holdsData && holdsData.length > 0) {
				alert('Cannot renew: there are holds on this item.');
				return;
			}

			// Calculate new due date
			const loanPeriodDays = patronType.default_loan_period_days;
			const newDueDate = new Date();
			newDueDate.setDate(newDueDate.getDate() + loanPeriodDays);

			// Update checkout
			const { error: updateError } = await data.supabase
				.from('checkouts')
				.update({
					due_date: newDueDate.toISOString(),
					renewal_count: currentRenewals + 1,
					last_renewal_date: new Date().toISOString()
				})
				.eq('id', checkoutId);

			if (updateError) throw updateError;

			await loadPatronAccount();
			alert(`Item renewed successfully. New due date: ${newDueDate.toLocaleDateString()}`);
		} catch (err: any) {
			alert(`Error renewing item: ${err.message}`);
		}
	}

	async function cancelHold(holdId: string) {
		if (!confirm('Cancel this hold?')) return;

		try {
			const { error: updateError } = await data.supabase
				.from('holds')
				.update({
					status: 'cancelled',
					cancellation_date: new Date().toISOString()
				})
				.eq('id', holdId);

			if (updateError) throw updateError;

			await loadPatronAccount();
		} catch (err: any) {
			alert(`Error cancelling hold: ${err.message}`);
		}
	}

	async function handleLogout() {
		await data.supabase.auth.signOut();
		goto('/my-account/login');
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString();
	}

	function formatDateTime(dateString: string | null): string {
		if (!dateString) return '—';
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

<div class="account-page">
	{#if loading}
		<div class="loading">Loading your account...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if patron}
		<header class="page-header">
			<div>
				<h1>My Library Account</h1>
				<p class="patron-name">{patron.first_name} {patron.last_name}</p>
			</div>
			<div class="header-actions">
				<a href="/catalog" class="btn-secondary">Browse Catalog</a>
				<button onclick={handleLogout} class="btn-logout">Logout</button>
			</div>
		</header>

		<!-- Account Summary -->
		<div class="summary-cards">
			<div class="summary-card">
				<div class="summary-number">{checkouts.length}</div>
				<div class="summary-label">Items Checked Out</div>
			</div>
			<div class="summary-card">
				<div class="summary-number">{checkouts.filter(c => c.urgency === 'overdue').length}</div>
				<div class="summary-label">Overdue Items</div>
			</div>
			<div class="summary-card">
				<div class="summary-number">{holds.length}</div>
				<div class="summary-label">Active Holds</div>
			</div>
			<div class="summary-card">
				<div class="summary-number">${patron.balance?.toFixed(2) || '0.00'}</div>
				<div class="summary-label">Balance</div>
			</div>
		</div>

		<!-- Current Checkouts -->
		<div class="section">
			<h2>Current Checkouts</h2>
			{#if checkouts.length === 0}
				<p class="empty">You don't have any items checked out.</p>
				<a href="/catalog" class="btn-primary">Browse Catalog</a>
			{:else}
				<div class="items-list">
					{#each checkouts as checkout}
						<div class="item-card" class:overdue={checkout.urgency === 'overdue'}>
							<div class="item-main">
								<h3>
									<a href="/catalog/record/{checkout.marc_record_id}">
										{checkout.title_statement?.a || 'Untitled'}
									</a>
								</h3>
								{#if checkout.title_statement?.b}
									<p class="subtitle">{checkout.title_statement.b}</p>
								{/if}
								<div class="item-details">
									<p><strong>Due:</strong> {formatDateTime(checkout.due_date)}</p>
									<p><strong>Renewals:</strong> {checkout.renewal_count} / {patronType.max_renewals}</p>
									{#if checkout.urgency === 'overdue'}
										<p class="overdue-text"><strong>⚠️ This item is overdue</strong></p>
									{:else if checkout.urgency === 'due_soon'}
										<p class="due-soon-text"><strong>Due soon!</strong></p>
									{/if}
								</div>
							</div>
							<div class="item-actions">
								<button
									onclick={() => renewItem(checkout.id, checkout.renewal_count)}
									class="btn-renew"
									disabled={checkout.renewal_count >= patronType.max_renewals}
								>
									{checkout.renewal_count >= patronType.max_renewals ? 'Max Renewals' : 'Renew'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Active Holds -->
		<div class="section">
			<h2>Active Holds</h2>
			{#if holds.length === 0}
				<p class="empty">You don't have any active holds.</p>
			{:else}
				<div class="items-list">
					{#each holds as hold}
						<div class="item-card">
							<div class="item-main">
								<h3>
									<a href="/catalog/record/{hold.marc_record_id}">
										{hold.title_statement?.a || 'Untitled'}
									</a>
								</h3>
								<div class="item-details">
									<p><strong>Hold Placed:</strong> {formatDate(hold.hold_date)}</p>
									<p><strong>Status:</strong> <span class="hold-status {hold.status}">{hold.status.replace('_', ' ')}</span></p>
									{#if hold.queue_position}
										<p><strong>Queue Position:</strong> #{hold.queue_position}</p>
									{/if}
									{#if hold.status === 'available'}
										<p class="available-text"><strong>✓ Ready for pickup!</strong></p>
									{/if}
								</div>
							</div>
							<div class="item-actions">
								{#if hold.status !== 'picked_up'}
									<button onclick={() => cancelHold(hold.id)} class="btn-cancel">
										Cancel Hold
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.account-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
		background: #f5f5f5;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
		margin-top: 2rem;
	}

	.error {
		color: #c33;
		background: #fee;
		border: 1px solid #fcc;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		padding: 2rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	h1 {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
	}

	.patron-name {
		margin: 0;
		color: #666;
		font-size: 1.125rem;
	}

	.header-actions {
		display: flex;
		gap: 1rem;
	}

	.summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.summary-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.summary-number {
		font-size: 2.5rem;
		font-weight: 700;
		color: #e73b42;
		margin-bottom: 0.5rem;
	}

	.summary-label {
		color: #666;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.section h2 {
		margin: 0 0 1.5rem 0;
		color: #2c3e50;
	}

	.empty {
		color: #666;
		font-style: italic;
		margin-bottom: 1rem;
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.item-card {
		padding: 1.5rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1.5rem;
		transition: all 0.2s;
	}

	.item-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.item-card.overdue {
		border-left: 4px solid #f44336;
		background: #ffebee;
	}

	.item-main {
		flex: 1;
	}

	.item-main h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.item-main h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.item-main h3 a:hover {
		color: #e73b42;
		text-decoration: underline;
	}

	.subtitle {
		margin: 0 0 1rem 0;
		color: #666;
		font-style: italic;
	}

	.item-details p {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		color: #666;
	}

	.overdue-text {
		color: #f44336 !important;
		font-weight: 600 !important;
	}

	.due-soon-text {
		color: #ff9800 !important;
		font-weight: 600 !important;
	}

	.available-text {
		color: #28a745 !important;
		font-weight: 600 !important;
	}

	.hold-status {
		text-transform: capitalize;
		font-weight: 500;
	}

	.hold-status.available {
		color: #28a745;
	}

	.hold-status.placed {
		color: #1976d2;
	}

	.hold-status.in_transit {
		color: #f57c00;
	}

	.item-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.btn-primary,
	.btn-secondary,
	.btn-renew,
	.btn-cancel,
	.btn-logout {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
		display: inline-block;
		text-align: center;
		white-space: nowrap;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d12d34;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background: #5a6268;
	}

	.btn-renew {
		background: #28a745;
		color: white;
	}

	.btn-renew:hover:not(:disabled) {
		background: #218838;
	}

	.btn-renew:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: #6c757d;
		color: white;
	}

	.btn-cancel:hover {
		background: #5a6268;
	}

	.btn-logout {
		background: #f44336;
		color: white;
	}

	.btn-logout:hover {
		background: #d32f2f;
	}

	@media (max-width: 768px) {
		.account-page {
			padding: 1rem;
		}

		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
			flex-direction: column;
		}

		.header-actions button,
		.header-actions a {
			width: 100%;
		}

		.summary-cards {
			grid-template-columns: repeat(2, 1fr);
		}

		.item-card {
			flex-direction: column;
		}

		.item-actions {
			width: 100%;
		}

		.item-actions button {
			width: 100%;
		}
	}
</style>
