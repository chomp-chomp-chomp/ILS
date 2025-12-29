<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let stats = $state({
		vendors: 0,
		activeOrders: 0,
		pendingInvoices: 0,
		activeContracts: 0,
		totalBudget: 0,
		spentAmount: 0,
		encumberedAmount: 0
	});

	onMount(async () => {
		// Load statistics
		const [vendorsData, ordersData, invoicesData, contractsData, budgetsData] = await Promise.all([
			data.supabase.from('vendors').select('id', { count: 'exact', head: true }),
			data.supabase
				.from('acquisition_orders')
				.select('id', { count: 'exact', head: true })
				.in('status', ['pending', 'ordered', 'partial']),
			data.supabase
				.from('invoices')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'pending'),
			data.supabase
				.from('contracts')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'active'),
			data.supabase.from('budgets').select('allocated_amount, spent_amount, encumbered_amount')
		]);

		stats.vendors = vendorsData.count || 0;
		stats.activeOrders = ordersData.count || 0;
		stats.pendingInvoices = invoicesData.count || 0;
		stats.activeContracts = contractsData.count || 0;

		if (budgetsData.data) {
			stats.totalBudget = budgetsData.data.reduce(
				(sum, b) => sum + Number(b.allocated_amount || 0),
				0
			);
			stats.spentAmount = budgetsData.data.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0);
			stats.encumberedAmount = budgetsData.data.reduce(
				(sum, b) => sum + Number(b.encumbered_amount || 0),
				0
			);
		}
	});

	const availableAmount = $derived(
		stats.totalBudget - stats.spentAmount - stats.encumberedAmount
	);
</script>

<div class="acquisitions-dashboard">
	<header class="page-header">
		<h1>Acquisitions Module</h1>
		<p class="subtitle">Manage vendors, orders, budgets, and contracts</p>
	</header>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{stats.vendors}</div>
			<div class="stat-label">Active Vendors</div>
		</div>

		<div class="stat-card">
			<div class="stat-value">{stats.activeOrders}</div>
			<div class="stat-label">Active Orders</div>
		</div>

		<div class="stat-card">
			<div class="stat-value">{stats.pendingInvoices}</div>
			<div class="stat-label">Pending Invoices</div>
		</div>

		<div class="stat-card">
			<div class="stat-value">{stats.activeContracts}</div>
			<div class="stat-label">Active Contracts</div>
		</div>
	</div>

	<div class="budget-overview">
		<h2>Budget Overview</h2>
		<div class="budget-bars">
			<div class="budget-item">
				<div class="budget-label">
					<span>Allocated</span>
					<span class="amount">${stats.totalBudget.toFixed(2)}</span>
				</div>
				<div class="progress-bar">
					<div class="progress-fill allocated" style="width: 100%"></div>
				</div>
			</div>

			<div class="budget-item">
				<div class="budget-label">
					<span>Spent</span>
					<span class="amount">${stats.spentAmount.toFixed(2)}</span>
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill spent"
						style="width: {stats.totalBudget > 0
							? (stats.spentAmount / stats.totalBudget) * 100
							: 0}%"
					></div>
				</div>
			</div>

			<div class="budget-item">
				<div class="budget-label">
					<span>Encumbered</span>
					<span class="amount">${stats.encumberedAmount.toFixed(2)}</span>
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill encumbered"
						style="width: {stats.totalBudget > 0
							? (stats.encumberedAmount / stats.totalBudget) * 100
							: 0}%"
					></div>
				</div>
			</div>

			<div class="budget-item">
				<div class="budget-label">
					<span>Available</span>
					<span class="amount available-amt">${availableAmount.toFixed(2)}</span>
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill available"
						style="width: {stats.totalBudget > 0 ? (availableAmount / stats.totalBudget) * 100 : 0}%"
					></div>
				</div>
			</div>
		</div>
	</div>

	<div class="modules-grid">
		<a href="/admin/acquisitions/vendors" class="module-card">
			<h3>Vendors</h3>
			<p>Manage vendor information, contacts, and payment terms</p>
		</a>

		<a href="/admin/acquisitions/budgets" class="module-card">
			<h3>Budgets</h3>
			<p>Track budget allocations, spending, and encumbrances</p>
		</a>

		<a href="/admin/acquisitions/orders" class="module-card">
			<h3>Purchase Orders</h3>
			<p>Create and manage orders, track receiving and payments</p>
		</a>

		<a href="/admin/acquisitions/receiving" class="module-card highlight">
			<h3>Receiving</h3>
			<p>Process incoming shipments, create item records, and track deliveries</p>
		</a>

		<a href="/admin/acquisitions/invoices" class="module-card">
			<h3>Invoices & Payments</h3>
			<p>Process invoices and record payments to vendors</p>
		</a>

		<a href="/admin/acquisitions/contracts" class="module-card">
			<h3>Contracts</h3>
			<p>Manage vendor contracts, licenses, and renewals</p>
		</a>
	</div>
</div>

<style>
	.acquisitions-dashboard {
		max-width: 1400px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 1rem;
	}

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

	.stat-value {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}

	.stat-label {
		color: var(--text-muted);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.budget-overview {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: 2rem;
	}

	.budget-overview h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
	}

	.budget-bars {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.budget-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.budget-label {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.amount {
		font-weight: 600;
		color: var(--text-primary);
	}

	.available-amt {
		color: #10b981;
	}

	.progress-bar {
		height: 24px;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		transition: width 0.3s ease;
	}

	.progress-fill.allocated {
		background: #e5e7eb;
	}

	.progress-fill.spent {
		background: var(--accent);
	}

	.progress-fill.encumbered {
		background: #f59e0b;
	}

	.progress-fill.available {
		background: #10b981;
	}

	.modules-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.module-card {
		background: white;
		padding: 2rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: var(--transition-smooth);
	}

	.module-card:hover {
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.module-card.highlight {
		border-color: var(--accent);
		background: linear-gradient(135deg, #ffffff 0%, #fef3f2 100%);
	}

	.module-card.highlight h3 {
		font-weight: 700;
	}

	.module-card h3 {
		margin: 0 0 0.75rem 0;
		color: var(--accent);
		font-size: 1.25rem;
	}

	.module-card p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
		line-height: 1.5;
	}
</style>
