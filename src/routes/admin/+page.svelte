<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let totalRecords = $state(0);
	let activeSerials = $state(0);
	let totalHoldings = $state(0);
	let loading = $state(true);

	onMount(async () => {
		await loadStats();
	});

	async function loadStats() {
		loading = true;

		const [recordsResult, serialsResult, holdingsResult] = await Promise.all([
			data.supabase.from('marc_records').select('id', { count: 'exact', head: true }),
			data.supabase.from('serials').select('id', { count: 'exact', head: true }).eq('status', 'active'),
			data.supabase.from('holdings').select('id', { count: 'exact', head: true })
		]);

		totalRecords = recordsResult.count || 0;
		activeSerials = serialsResult.count || 0;
		totalHoldings = holdingsResult.count || 0;

		loading = false;
	}
</script>

<div class="dashboard">
	<h1>Admin Dashboard</h1>

	<div class="stats">
		<div class="stat-card">
			<h3>Total Records</h3>
			<p class="stat-number">{loading ? '...' : totalRecords.toLocaleString()}</p>
			<p class="stat-label">Bibliographic records</p>
		</div>

		<div class="stat-card">
			<h3>Active Serials</h3>
			<p class="stat-number">{loading ? '...' : activeSerials.toLocaleString()}</p>
			<p class="stat-label">Current subscriptions</p>
		</div>

		<div class="stat-card">
			<h3>Total Holdings</h3>
			<p class="stat-number">{loading ? '...' : totalHoldings.toLocaleString()}</p>
			<p class="stat-label">Physical/digital items</p>
		</div>
	</div>

	<div class="quick-actions">
		<h2>Quick Actions</h2>
		<div class="actions-grid">
			<a href="/admin/cataloging/new" class="action-card">
				<span class="icon">➕</span>
				<h3>Create MARC Record</h3>
				<p>Manually create a new bibliographic record</p>
			</a>

			<a href="/admin/cataloging/isbn-lookup" class="action-card">
				<span class="icon">🔍</span>
				<h3>ISBN Lookup</h3>
				<p>Import records from OpenLibrary or LoC</p>
			</a>

			<a href="/admin/serials/new" class="action-card">
				<span class="icon">📰</span>
				<h3>Add Serial</h3>
				<p>Register a new serial publication</p>
			</a>

			<a href="/admin/cataloging" class="action-card">
				<span class="icon">📚</span>
				<h3>Browse Catalog</h3>
				<p>View and edit existing records</p>
			</a>
		</div>
	</div>
</div>

<style>
	.dashboard {
		max-width: 1400px;
	}

	h1 {
		margin: 0 0 2rem 0;
		font-size: 2.5rem;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;
	}

	.stat-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.stat-card h3 {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		text-transform: uppercase;
		color: #666;
		font-weight: 500;
	}

	.stat-number {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 700;
		color: #2c3e50;
	}

	.stat-label {
		margin: 0.5rem 0 0 0;
		font-size: 0.875rem;
		color: #999;
	}

	.quick-actions h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.action-card {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
		border: 2px solid transparent;
	}

	.action-card:hover {
		border-color: #667eea;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}

	.icon {
		font-size: 2.5rem;
		display: block;
		margin-bottom: 1rem;
	}

	.action-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.action-card p {
		margin: 0;
		color: #666;
		font-size: 0.875rem;
	}
</style>
