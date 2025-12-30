<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(dateString: string | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}

	function getStatusBadgeClass(status: string): string {
		const statusMap: Record<string, string> = {
			pending: 'badge-warning',
			approved: 'badge-info',
			requested: 'badge-info',
			shipped: 'badge-primary',
			received: 'badge-success',
			available: 'badge-success',
			checked_out: 'badge-primary',
			returned: 'badge-info',
			completed: 'badge-success',
			cancelled: 'badge-secondary',
			denied: 'badge-error'
		};
		return statusMap[status] || 'badge-secondary';
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>Interlibrary Loan (ILL) Dashboard</h1>
		<div class="header-actions">
			<a href="/admin/ill/borrowing" class="btn btn-primary">Borrowing Requests</a>
			<a href="/admin/ill/lending" class="btn btn-primary">Lending Requests</a>
			<a href="/admin/ill/partners" class="btn btn-secondary">Partner Libraries</a>
		</div>
	</div>

	<!-- Statistics Overview -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-label">Total Borrowing Requests</div>
			<div class="stat-value">{data.stats.totalBorrowing}</div>
			<a href="/admin/ill/borrowing" class="stat-link">View all →</a>
		</div>

		<div class="stat-card">
			<div class="stat-label">Total Lending Requests</div>
			<div class="stat-value">{data.stats.totalLending}</div>
			<a href="/admin/ill/lending" class="stat-link">View all →</a>
		</div>

		<div class="stat-card">
			<div class="stat-label">Active Partner Libraries</div>
			<div class="stat-value">{data.stats.activePartners}</div>
			<a href="/admin/ill/partners" class="stat-link">Manage →</a>
		</div>

		<div class="stat-card highlight">
			<div class="stat-label">Pending Borrowing</div>
			<div class="stat-value">{data.stats.pendingBorrowing}</div>
			<a href="/admin/ill/borrowing?status=pending" class="stat-link">Review →</a>
		</div>

		<div class="stat-card highlight">
			<div class="stat-label">Pending Lending</div>
			<div class="stat-value">{data.stats.pendingLending}</div>
			<a href="/admin/ill/lending?status=pending" class="stat-link">Review →</a>
		</div>
	</div>

	<!-- Status Breakdown -->
	<div class="two-column-grid">
		<div class="card">
			<h2>Borrowing Status Breakdown</h2>
			<div class="status-list">
				{#each Object.entries(data.stats.borrowingByStatus) as [status, count]}
					<div class="status-item">
						<span class="badge {getStatusBadgeClass(status)}">{status}</span>
						<span class="count">{count}</span>
					</div>
				{/each}
				{#if Object.keys(data.stats.borrowingByStatus).length === 0}
					<p class="empty-state">No borrowing requests yet</p>
				{/if}
			</div>
		</div>

		<div class="card">
			<h2>Lending Status Breakdown</h2>
			<div class="status-list">
				{#each Object.entries(data.stats.lendingByStatus) as [status, count]}
					<div class="status-item">
						<span class="badge {getStatusBadgeClass(status)}">{status}</span>
						<span class="count">{count}</span>
					</div>
				{/each}
				{#if Object.keys(data.stats.lendingByStatus).length === 0}
					<p class="empty-state">No lending requests yet</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Recent Requests -->
	<div class="card">
		<div class="card-header">
			<h2>Recent Requests</h2>
			<a href="/admin/ill/statistics" class="btn btn-secondary">View Statistics</a>
		</div>

		{#if data.recentRequests.length > 0}
			<div class="table-responsive">
				<table>
					<thead>
						<tr>
							<th>Type</th>
							<th>Title</th>
							<th>Patron/Library</th>
							<th>Partner</th>
							<th>Status</th>
							<th>Created</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentRequests as request}
							<tr>
								<td>
									<span class="badge {request.request_type === 'borrowing' ? 'badge-info' : 'badge-primary'}">
										{request.request_type}
									</span>
								</td>
								<td>
									<strong>{request.title}</strong>
									{#if request.author}
										<br />
										<small>{request.author}</small>
									{/if}
								</td>
								<td>
									{#if request.patron}
										{request.patron.name}
									{:else if request.patron_name}
										{request.patron_name}
									{:else}
										N/A
									{/if}
								</td>
								<td>{request.partner?.library_name || request.partner_library_name || 'N/A'}</td>
								<td>
									<span class="badge {getStatusBadgeClass(request.status)}">
										{request.status}
									</span>
								</td>
								<td>{formatDate(request.created_at)}</td>
								<td>
									<a
										href="/admin/ill/{request.request_type}/request/{request.id}"
										class="btn btn-sm btn-secondary"
									>
										View
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="empty-state">No ILL requests yet</p>
		{/if}
	</div>

	<!-- Quick Links -->
	<div class="quick-links">
		<h2>Quick Links</h2>
		<div class="link-grid">
			<a href="/admin/ill/borrowing?status=pending" class="link-card">
				<h3>Review Pending Borrowing</h3>
				<p>Review and approve patron borrowing requests</p>
			</a>
			<a href="/admin/ill/lending?status=pending" class="link-card">
				<h3>Review Pending Lending</h3>
				<p>Approve or deny requests from other libraries</p>
			</a>
			<a href="/admin/ill/partners/new" class="link-card">
				<h3>Add Partner Library</h3>
				<p>Add a new library to your ILL network</p>
			</a>
			<a href="/admin/ill/statistics" class="link-card">
				<h3>View Statistics</h3>
				<p>Detailed reports and analytics</p>
			</a>
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
		color: #333;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

	.stat-card.highlight {
		border-left-color: #f59e0b;
		background: #fffbeb;
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
		margin-bottom: 8px;
	}

	.stat-link {
		font-size: 14px;
		color: #e73b42;
		text-decoration: none;
	}

	.stat-link:hover {
		text-decoration: underline;
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
		font-size: 20px;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.card-header h2 {
		margin: 0;
	}

	.status-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: #f9fafb;
		border-radius: 4px;
	}

	.count {
		font-weight: bold;
		color: #333;
	}

	.badge {
		display: inline-block;
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		text-transform: capitalize;
	}

	.badge-primary {
		background: #e73b42;
		color: white;
	}
	.badge-secondary {
		background: #6b7280;
		color: white;
	}
	.badge-success {
		background: #10b981;
		color: white;
	}
	.badge-warning {
		background: #f59e0b;
		color: white;
	}
	.badge-info {
		background: #3b82f6;
		color: white;
	}
	.badge-error {
		background: #ef4444;
		color: white;
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
		color: #374151;
	}

	tbody tr:hover {
		background: #f9fafb;
	}

	.empty-state {
		text-align: center;
		color: #6b7280;
		padding: 40px;
	}

	.quick-links {
		margin-top: 30px;
	}

	.quick-links h2 {
		margin-bottom: 20px;
		color: #333;
	}

	.link-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 20px;
	}

	.link-card {
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		text-decoration: none;
		color: inherit;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.link-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.link-card h3 {
		margin: 0 0 8px 0;
		color: #e73b42;
		font-size: 18px;
	}

	.link-card p {
		margin: 0;
		color: #6b7280;
		font-size: 14px;
	}

	.btn {
		display: inline-block;
		padding: 8px 20px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		transition: background 0.2s;
		border: none;
		cursor: pointer;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d32f36;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f9fafb;
	}

	.btn-sm {
		padding: 4px 12px;
		font-size: 14px;
	}
</style>
