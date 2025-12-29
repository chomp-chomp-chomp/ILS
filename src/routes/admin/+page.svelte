<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import 'chartjs-adapter-date-fns';

	Chart.register(...registerables);

	let { data }: { data: PageData } = $props();

	let circulationChart: Chart | null = null;
	let collectionChart: Chart | null = null;
	let patronChart: Chart | null = null;
	let budgetChart: Chart | null = null;

	onMount(() => {
		// Render all charts
		renderCirculationChart();
		renderCollectionChart();
		renderPatronChart();
		renderBudgetChart();

		// Cleanup on destroy
		return () => {
			circulationChart?.destroy();
			collectionChart?.destroy();
			patronChart?.destroy();
			budgetChart?.destroy();
		};
	});

	function renderCirculationChart() {
		const canvas = document.getElementById('circulationChart') as HTMLCanvasElement;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		circulationChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: data.circulationTrends.map((t) => t.date),
				datasets: [
					{
						label: 'Checkouts',
						data: data.circulationTrends.map((t) => t.checkouts),
						borderColor: '#e73b42',
						backgroundColor: 'rgba(231, 59, 66, 0.1)',
						tension: 0.4,
						fill: true
					},
					{
						label: 'Check-ins',
						data: data.circulationTrends.map((t) => t.checkins),
						borderColor: '#667eea',
						backgroundColor: 'rgba(102, 126, 234, 0.1)',
						tension: 0.4,
						fill: true
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top'
					},
					title: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							precision: 0
						}
					}
				}
			}
		});
	}

	function renderCollectionChart() {
		const canvas = document.getElementById('collectionChart') as HTMLCanvasElement;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		collectionChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.collectionGrowth.map((g) => g.month),
				datasets: [
					{
						label: 'New Records',
						data: data.collectionGrowth.map((g) => g.records),
						backgroundColor: 'rgba(231, 59, 66, 0.8)',
						borderColor: '#e73b42',
						borderWidth: 1,
						yAxisID: 'y'
					},
					{
						label: 'Total Collection',
						data: data.collectionGrowth.map((g) => g.cumulative),
						type: 'line',
						borderColor: '#667eea',
						backgroundColor: 'rgba(102, 126, 234, 0.1)',
						tension: 0.4,
						fill: true,
						yAxisID: 'y1'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'top'
					}
				},
				scales: {
					y: {
						type: 'linear',
						display: true,
						position: 'left',
						beginAtZero: true,
						ticks: {
							precision: 0
						}
					},
					y1: {
						type: 'linear',
						display: true,
						position: 'right',
						beginAtZero: true,
						grid: {
							drawOnChartArea: false
						},
						ticks: {
							precision: 0
						}
					}
				}
			}
		});
	}

	function renderPatronChart() {
		const canvas = document.getElementById('patronChart') as HTMLCanvasElement;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		patronChart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: data.patronActivity.map((p) => p.patron_type),
				datasets: [
					{
						label: 'Total Patrons',
						data: data.patronActivity.map((p) => p.count),
						backgroundColor: [
							'rgba(231, 59, 66, 0.8)',
							'rgba(102, 126, 234, 0.8)',
							'rgba(52, 168, 83, 0.8)',
							'rgba(251, 188, 5, 0.8)',
							'rgba(156, 39, 176, 0.8)'
						],
						borderWidth: 2,
						borderColor: '#fff'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'bottom'
					}
				}
			}
		});
	}

	function renderBudgetChart() {
		const canvas = document.getElementById('budgetChart') as HTMLCanvasElement;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		budgetChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.budgetData.map((b) => b.budget_name),
				datasets: [
					{
						label: 'Spent',
						data: data.budgetData.map((b) => b.spent),
						backgroundColor: 'rgba(231, 59, 66, 0.8)',
						borderColor: '#e73b42',
						borderWidth: 1
					},
					{
						label: 'Remaining',
						data: data.budgetData.map((b) => b.remaining),
						backgroundColor: 'rgba(52, 168, 83, 0.8)',
						borderColor: '#34a853',
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top'
					}
				},
				scales: {
					x: {
						stacked: true
					},
					y: {
						stacked: true,
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return '$' + value.toLocaleString();
							}
						}
					}
				}
			}
		});
	}
</script>

<div class="dashboard">
	<div class="dashboard-header">
		<h1>Admin Dashboard</h1>
		<p class="dashboard-subtitle">Real-time library analytics and insights</p>
	</div>

	<!-- Key Stats Overview -->
	<div class="stats-overview">
		<div class="stat-card primary">
			<div class="stat-icon">📚</div>
			<div class="stat-content">
				<h3>Total Records</h3>
				<p class="stat-number">{data.stats.totalRecords.toLocaleString()}</p>
				<p class="stat-label">Bibliographic records</p>
			</div>
		</div>

		<div class="stat-card secondary">
			<div class="stat-icon">📰</div>
			<div class="stat-content">
				<h3>Active Serials</h3>
				<p class="stat-number">{data.stats.activeSerials.toLocaleString()}</p>
				<p class="stat-label">Current subscriptions</p>
			</div>
		</div>

		<div class="stat-card success">
			<div class="stat-icon">📦</div>
			<div class="stat-content">
				<h3>Total Holdings</h3>
				<p class="stat-number">{data.stats.totalHoldings.toLocaleString()}</p>
				<p class="stat-label">Physical/digital items</p>
			</div>
		</div>

		<div class="stat-card info">
			<div class="stat-icon">👥</div>
			<div class="stat-content">
				<h3>Total Patrons</h3>
				<p class="stat-number">{data.stats.totalPatrons.toLocaleString()}</p>
				<p class="stat-label">Registered users</p>
			</div>
		</div>

		<div class="stat-card warning">
			<div class="stat-icon">🔄</div>
			<div class="stat-content">
				<h3>Active Checkouts</h3>
				<p class="stat-number">{data.stats.activeCheckouts.toLocaleString()}</p>
				<p class="stat-label">Currently borrowed</p>
			</div>
		</div>

		<div class="stat-card danger">
			<div class="stat-icon">⚠️</div>
			<div class="stat-content">
				<h3>Overdue Items</h3>
				<p class="stat-number">{data.stats.overdueItems.toLocaleString()}</p>
				<p class="stat-label">Need attention</p>
			</div>
		</div>
	</div>

	<!-- Charts Section -->
	<div class="charts-grid">
		<!-- Circulation Trends -->
		<div class="chart-card large">
			<div class="chart-header">
				<h2>Circulation Trends (Last 30 Days)</h2>
				<p>Daily checkout and check-in activity</p>
			</div>
			<div class="chart-container">
				<canvas id="circulationChart"></canvas>
			</div>
		</div>

		<!-- Collection Growth -->
		<div class="chart-card large">
			<div class="chart-header">
				<h2>Collection Growth</h2>
				<p>Monthly additions and total collection size</p>
			</div>
			<div class="chart-container">
				<canvas id="collectionChart"></canvas>
			</div>
		</div>

		<!-- Patron Distribution -->
		<div class="chart-card">
			<div class="chart-header">
				<h2>Patron Distribution</h2>
				<p>Breakdown by patron type</p>
			</div>
			<div class="chart-container">
				<canvas id="patronChart"></canvas>
			</div>
		</div>

		<!-- Budget Allocation -->
		<div class="chart-card">
			<div class="chart-header">
				<h2>Budget Allocation</h2>
				<p>Spending vs. remaining funds</p>
			</div>
			<div class="chart-container">
				<canvas id="budgetChart"></canvas>
			</div>
		</div>
	</div>

	<!-- Top Circulating Items -->
	{#if data.topItems && data.topItems.length > 0}
		<div class="top-items-section">
			<div class="section-header">
				<h2>Top Circulating Items</h2>
				<p>Most popular items in your collection</p>
			</div>
			<div class="top-items-list">
				{#each data.topItems as item, index}
					<a href="/catalog/record/{item.id}" class="top-item">
						<div class="item-rank">#{index + 1}</div>
						<div class="item-info">
							<h3>{item.title}</h3>
							<p class="item-author">{item.author}</p>
						</div>
						<div class="item-count">
							<span class="count-number">{item.checkoutCount}</span>
							<span class="count-label">checkouts</span>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Quick Actions -->
	<div class="quick-actions-section">
		<div class="section-header">
			<h2>Quick Actions</h2>
			<p>Common administrative tasks</p>
		</div>
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

			<a href="/admin/circulation/checkout" class="action-card">
				<span class="icon">🔄</span>
				<h3>Check Out Item</h3>
				<p>Process patron checkouts</p>
			</a>

			<a href="/admin/acquisitions" class="action-card">
				<span class="icon">💰</span>
				<h3>Acquisitions</h3>
				<p>Manage orders and budgets</p>
			</a>
		</div>
	</div>
</div>

<style>
	.dashboard {
		max-width: 1600px;
		padding: 2rem;
	}

	.dashboard-header {
		margin-bottom: 2rem;
	}

	.dashboard-header h1 {
		margin: 0;
		font-size: 2.5rem;
		color: #1a1a1a;
	}

	.dashboard-subtitle {
		margin: 0.5rem 0 0 0;
		color: #666;
		font-size: 1.125rem;
	}

	/* Stats Overview */
	.stats-overview {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;
	}

	.stat-card {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		gap: 1.5rem;
		transition: all 0.3s ease;
		border-left: 4px solid;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.stat-card.primary {
		border-left-color: #e73b42;
	}

	.stat-card.secondary {
		border-left-color: #667eea;
	}

	.stat-card.success {
		border-left-color: #34a853;
	}

	.stat-card.info {
		border-left-color: #4285f4;
	}

	.stat-card.warning {
		border-left-color: #fbbc05;
	}

	.stat-card.danger {
		border-left-color: #ea4335;
	}

	.stat-icon {
		font-size: 3rem;
		line-height: 1;
		opacity: 0.8;
	}

	.stat-content h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		text-transform: uppercase;
		color: #888;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.stat-number {
		margin: 0 0 0.25rem 0;
		font-size: 2rem;
		font-weight: 700;
		color: #1a1a1a;
	}

	.stat-label {
		margin: 0;
		font-size: 0.8125rem;
		color: #999;
	}

	/* Charts Grid */
	.charts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2rem;
		margin-bottom: 3rem;
	}

	.chart-card {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.chart-card.large {
		grid-column: span 2;
	}

	.chart-header {
		margin-bottom: 1.5rem;
	}

	.chart-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: #1a1a1a;
	}

	.chart-header p {
		margin: 0;
		font-size: 0.875rem;
		color: #666;
	}

	.chart-container {
		position: relative;
		height: 300px;
	}

	/* Top Items Section */
	.top-items-section {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		margin-bottom: 3rem;
	}

	.section-header {
		margin-bottom: 1.5rem;
	}

	.section-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #1a1a1a;
	}

	.section-header p {
		margin: 0;
		font-size: 0.875rem;
		color: #666;
	}

	.top-items-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.top-item {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1.25rem;
		background: #f8f9fa;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
		border: 2px solid transparent;
	}

	.top-item:hover {
		background: white;
		border-color: #e73b42;
		box-shadow: 0 2px 8px rgba(231, 59, 66, 0.15);
		transform: translateX(4px);
	}

	.item-rank {
		font-size: 1.5rem;
		font-weight: 700;
		color: #e73b42;
		min-width: 50px;
		text-align: center;
	}

	.item-info {
		flex: 1;
		min-width: 0;
	}

	.item-info h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1.125rem;
		color: #1a1a1a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-author {
		margin: 0;
		font-size: 0.875rem;
		color: #666;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-count {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 80px;
	}

	.count-number {
		font-size: 1.5rem;
		font-weight: 700;
		color: #667eea;
	}

	.count-label {
		font-size: 0.75rem;
		color: #999;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Quick Actions */
	.quick-actions-section {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.action-card {
		background: #f8f9fa;
		padding: 2rem;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: all 0.3s ease;
		border: 2px solid transparent;
	}

	.action-card:hover {
		border-color: #e73b42;
		background: white;
		box-shadow: 0 4px 12px rgba(231, 59, 66, 0.15);
		transform: translateY(-2px);
	}

	.icon {
		font-size: 2.5rem;
		display: block;
		margin-bottom: 1rem;
	}

	.action-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		color: #1a1a1a;
	}

	.action-card p {
		margin: 0;
		color: #666;
		font-size: 0.875rem;
	}

	/* Mobile Responsive */
	@media (max-width: 1024px) {
		.charts-grid {
			grid-template-columns: 1fr;
		}

		.chart-card.large {
			grid-column: span 1;
		}
	}

	@media (max-width: 768px) {
		.dashboard {
			padding: 1rem;
		}

		.dashboard-header h1 {
			font-size: 2rem;
		}

		.stats-overview {
			grid-template-columns: 1fr;
		}

		.stat-card {
			padding: 1.25rem;
		}

		.stat-icon {
			font-size: 2.5rem;
		}

		.stat-number {
			font-size: 1.75rem;
		}

		.chart-card {
			padding: 1.5rem;
		}

		.top-item {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.item-rank {
			min-width: auto;
		}

		.item-count {
			align-items: flex-start;
		}

		.actions-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
