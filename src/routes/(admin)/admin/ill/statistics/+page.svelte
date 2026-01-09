<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			pending: '#f59e0b',
			approved: '#3b82f6',
			requested: '#3b82f6',
			shipped: '#e73b42',
			received: '#10b981',
			available: '#10b981',
			checked_out: '#e73b42',
			returned: '#3b82f6',
			completed: '#10b981',
			cancelled: '#6b7280',
			denied: '#ef4444'
		};
		return colors[status] || '#6b7280';
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>ILL Statistics & Reports</h1>
		<div class="header-actions">
			<a href="/admin/ill" class="btn btn-secondary">← Back to ILL Dashboard</a>
		</div>
	</div>

	<!-- Overview Stats -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-label">Total Borrowing Requests</div>
			<div class="stat-value">{data.stats.totalBorrowing}</div>
			<div class="stat-detail">
				{data.stats.completedBorrowing} completed
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-label">Total Lending Requests</div>
			<div class="stat-value">{data.stats.totalLending}</div>
			<div class="stat-detail">
				{data.stats.completedLending} completed
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-label">Avg. Borrowing Turnaround</div>
			<div class="stat-value">{data.stats.avgBorrowingTime}</div>
			<div class="stat-detail">days</div>
		</div>

		<div class="stat-card">
			<div class="stat-label">Avg. Lending Turnaround</div>
			<div class="stat-value">{data.stats.avgLendingTime}</div>
			<div class="stat-detail">days</div>
		</div>
	</div>

	<!-- Monthly Trends -->
	<div class="card">
		<h2>Monthly Activity (Last 12 Months)</h2>
		<div class="chart-container">
			<div class="bar-chart">
				{#each data.monthlyStats as stat}
					<div class="bar-group">
						<div class="bars">
							<div class="bar bar-borrowed" style="height: {(stat.borrowed / 20) * 100}px">
								{#if stat.borrowed > 0}
									<span class="bar-label">{stat.borrowed}</span>
								{/if}
							</div>
							<div class="bar bar-lent" style="height: {(stat.lent / 20) * 100}px">
								{#if stat.lent > 0}
									<span class="bar-label">{stat.lent}</span>
								{/if}
							</div>
						</div>
						<div class="bar-month">{stat.month}</div>
					</div>
				{/each}
			</div>
			<div class="chart-legend">
				<div class="legend-item">
					<div class="legend-color" style="background: #e73b42"></div>
					<span>Borrowed</span>
				</div>
				<div class="legend-item">
					<div class="legend-color" style="background: #3b82f6"></div>
					<span>Lent</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Status Breakdown -->
	<div class="two-column-grid">
		<div class="card">
			<h2>Borrowing by Status</h2>
			<div class="status-chart">
				{#each Object.entries(data.stats.borrowingByStatus) as [status, count]}
					<div class="status-bar">
						<div class="status-name">{status}</div>
						<div class="status-bar-container">
							<div
								class="status-bar-fill"
								style="width: {(count / data.stats.totalBorrowing) * 100}%; background: {getStatusColor(
									status
								)}"
							></div>
							<span class="status-count">{count}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="card">
			<h2>Lending by Status</h2>
			<div class="status-chart">
				{#each Object.entries(data.stats.lendingByStatus) as [status, count]}
					<div class="status-bar">
						<div class="status-name">{status}</div>
						<div class="status-bar-container">
							<div
								class="status-bar-fill"
								style="width: {(count / data.stats.totalLending) * 100}%; background: {getStatusColor(
									status
								)}"
							></div>
							<span class="status-count">{count}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Top Partners -->
	<div class="card">
		<h2>Top Partner Libraries</h2>
		<div class="table-responsive">
			<table>
				<thead>
					<tr>
						<th>Library Name</th>
						<th>Total Borrowed</th>
						<th>Total Lent</th>
						<th>Total Activity</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.topPartners as partner}
						<tr>
							<td><strong>{partner.library_name}</strong></td>
							<td>{partner.total_borrowed}</td>
							<td>{partner.total_lent}</td>
							<td><strong>{partner.total_borrowed + partner.total_lent}</strong></td>
							<td>
								{#if partner.is_active}
									<span class="badge badge-success">Active</span>
								{:else}
									<span class="badge badge-secondary">Inactive</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Summary -->
	<div class="card summary-card">
		<h2>Summary</h2>
		<div class="summary-grid">
			<div class="summary-item">
				<div class="summary-label">Success Rate (Borrowing)</div>
				<div class="summary-value">
					{data.stats.totalBorrowing > 0
						? Math.round((data.stats.completedBorrowing / data.stats.totalBorrowing) * 100)
						: 0}%
				</div>
			</div>
			<div class="summary-item">
				<div class="summary-label">Success Rate (Lending)</div>
				<div class="summary-value">
					{data.stats.totalLending > 0
						? Math.round((data.stats.completedLending / data.stats.totalLending) * 100)
						: 0}%
				</div>
			</div>
			<div class="summary-item">
				<div class="summary-label">Total Transactions</div>
				<div class="summary-value">
					{data.stats.totalBorrowing + data.stats.totalLending}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 30px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 30px;
	}

	.page-header h1 {
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 20px;
		margin-bottom: 30px;
	}

	.stat-card {
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		border-left: 4px solid #e73b42;
	}

	.stat-label {
		font-size: 14px;
		color: #666;
		margin-bottom: 8px;
	}

	.stat-value {
		font-size: 36px;
		font-weight: bold;
		color: #333;
	}

	.stat-detail {
		font-size: 14px;
		color: #888;
		margin-top: 4px;
	}

	.two-column-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 20px;
		margin-bottom: 30px;
	}

	.card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 20px;
		margin-bottom: 20px;
	}

	.card h2 {
		margin: 0 0 20px 0;
		color: #333;
	}

	.chart-container {
		padding: 20px 0;
	}

	.bar-chart {
		display: flex;
		gap: 12px;
		align-items: flex-end;
		justify-content: space-between;
		height: 200px;
		padding: 0 10px 30px 10px;
		border-bottom: 2px solid #e5e7eb;
	}

	.bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.bars {
		display: flex;
		gap: 4px;
		align-items: flex-end;
		min-height: 150px;
	}

	.bar {
		width: 20px;
		min-height: 2px;
		border-radius: 4px 4px 0 0;
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.bar-borrowed {
		background: #e73b42;
	}

	.bar-lent {
		background: #3b82f6;
	}

	.bar-label {
		font-size: 10px;
		color: white;
		font-weight: bold;
		padding: 2px;
	}

	.bar-month {
		font-size: 11px;
		color: #666;
		margin-top: 8px;
		transform: rotate(-45deg);
		white-space: nowrap;
	}

	.chart-legend {
		display: flex;
		gap: 20px;
		justify-content: center;
		margin-top: 20px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.legend-color {
		width: 16px;
		height: 16px;
		border-radius: 2px;
	}

	.status-chart {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.status-name {
		width: 100px;
		font-size: 14px;
		color: #666;
		text-transform: capitalize;
	}

	.status-bar-container {
		flex: 1;
		height: 30px;
		background: #f3f4f6;
		border-radius: 4px;
		position: relative;
		display: flex;
		align-items: center;
	}

	.status-bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s;
	}

	.status-count {
		position: absolute;
		right: 8px;
		font-weight: bold;
		font-size: 14px;
		color: #333;
	}

	.table-responsive {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #e5e7eb;
	}

	th {
		background: #f9fafb;
		font-weight: 600;
	}

	tbody tr:hover {
		background: #f9fafb;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.badge-success {
		background: #10b981;
		color: white;
	}
	.badge-secondary {
		background: #6b7280;
		color: white;
	}

	.summary-card {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.summary-card h2 {
		color: white;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
	}

	.summary-item {
		text-align: center;
	}

	.summary-label {
		font-size: 14px;
		opacity: 0.9;
		margin-bottom: 8px;
	}

	.summary-value {
		font-size: 32px;
		font-weight: bold;
	}

	.btn {
		display: inline-block;
		padding: 8px 20px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}
</style>
