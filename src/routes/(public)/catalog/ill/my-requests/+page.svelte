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

	function getStatusMessage(status: string): string {
		const messages: Record<string, string> = {
			pending: 'Your request is being reviewed by library staff',
			approved: 'Your request has been approved and is being processed',
			requested: 'We have requested this item from a partner library',
			shipped: 'The item is on its way to our library',
			received: 'The item has arrived at our library',
			available: 'The item is ready for pickup!',
			checked_out: 'You have checked out this item',
			returned: 'You have returned this item',
			completed: 'This request is completed',
			cancelled: 'This request was cancelled',
			denied: 'This request could not be fulfilled'
		};
		return messages[status] || 'Status unknown';
	}

	let activeRequests = $derived(
		data.requests.filter((r) => !['completed', 'cancelled', 'denied'].includes(r.status))
	);
	let pastRequests = $derived(
		data.requests.filter((r) => ['completed', 'cancelled', 'denied'].includes(r.status))
	);
</script>

<div class="container">
	<div class="page-header">
		<h1>My ILL Requests</h1>
		<div class="header-actions">
			<a href="/catalog" class="btn btn-secondary">← Back to Catalog</a>
			<a href="/catalog/ill/request" class="btn btn-primary">New Request</a>
		</div>
	</div>

	{#if !data.patron}
		<div class="message error">
			<p>No patron account found. Please contact the library to set up your account.</p>
		</div>
	{:else if data.requests.length === 0}
		<div class="empty-state">
			<h2>No ILL Requests Yet</h2>
			<p>You haven't submitted any interlibrary loan requests yet.</p>
			<a href="/catalog/ill/request" class="btn btn-primary">Submit Your First Request</a>
		</div>
	{:else}
		<!-- Active Requests -->
		{#if activeRequests.length > 0}
			<div class="card">
				<h2>Active Requests ({activeRequests.length})</h2>

				<div class="requests-list">
					{#each activeRequests as request}
						<div class="request-item">
							<div class="request-header">
								<div class="request-title">
									<h3>{request.title}</h3>
									{#if request.author}
										<p class="author">by {request.author}</p>
									{/if}
								</div>
								<span class="badge {getStatusBadgeClass(request.status)}">
									{request.status}
								</span>
							</div>

							<div class="request-details">
								<div class="detail-item">
									<strong>Requested:</strong>
									{formatDate(request.created_at)}
								</div>
								{#if request.needed_by_date}
									<div class="detail-item">
										<strong>Needed By:</strong>
										{formatDate(request.needed_by_date)}
									</div>
								{/if}
								{#if request.due_date}
									<div class="detail-item">
										<strong>Due Date:</strong>
										{formatDate(request.due_date)}
									</div>
								{/if}
								{#if request.pickup_location}
									<div class="detail-item">
										<strong>Pickup Location:</strong>
										{request.pickup_location}
									</div>
								{/if}
							</div>

							<div class="status-message">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="10"></circle>
									<line x1="12" y1="16" x2="12" y2="12"></line>
									<line x1="12" y1="8" x2="12.01" y2="8"></line>
								</svg>
								{getStatusMessage(request.status)}
							</div>

							{#if request.isbn}
								<div class="metadata">
									<small>ISBN: {request.isbn}</small>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Past Requests -->
		{#if pastRequests.length > 0}
			<div class="card">
				<h2>Past Requests ({pastRequests.length})</h2>

				<div class="table-responsive">
					<table>
						<thead>
							<tr>
								<th>Title</th>
								<th>Author</th>
								<th>Requested</th>
								<th>Status</th>
								<th>Completed</th>
							</tr>
						</thead>
						<tbody>
							{#each pastRequests as request}
								<tr>
									<td><strong>{request.title}</strong></td>
									<td>{request.author || 'N/A'}</td>
									<td>{formatDate(request.created_at)}</td>
									<td>
										<span class="badge {getStatusBadgeClass(request.status)}">
											{request.status}
										</span>
									</td>
									<td>{formatDate(request.completed_date || request.updated_at)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Help Section -->
	<div class="help-section">
		<h3>Questions About Your Requests?</h3>
		<p>
			If you have questions about the status of your interlibrary loan request or need assistance,
			please contact the library.
		</p>
		<div class="help-links">
			<a href="/catalog/ill/request" class="btn btn-secondary">Submit New Request</a>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
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

	.message {
		padding: 20px;
		border-radius: 4px;
		margin-bottom: 20px;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.empty-state h2 {
		margin: 0 0 12px 0;
		color: #374151;
	}

	.empty-state p {
		margin: 0 0 24px 0;
		color: #6b7280;
	}

	.card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 30px;
		margin-bottom: 30px;
	}

	.card h2 {
		margin: 0 0 24px 0;
		color: #333;
		border-bottom: 2px solid #e73b42;
		padding-bottom: 12px;
	}

	.requests-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.request-item {
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 20px;
		background: #f9fafb;
	}

	.request-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 15px;
	}

	.request-title h3 {
		margin: 0 0 4px 0;
		color: #111827;
		font-size: 18px;
	}

	.request-title .author {
		margin: 0;
		color: #6b7280;
		font-size: 14px;
	}

	.request-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-bottom: 15px;
		padding: 12px;
		background: white;
		border-radius: 4px;
	}

	.detail-item {
		font-size: 14px;
		color: #374151;
	}

	.detail-item strong {
		color: #111827;
	}

	.status-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: #eff6ff;
		border-left: 3px solid #3b82f6;
		border-radius: 4px;
		color: #1e40af;
		font-size: 14px;
	}

	.metadata {
		margin-top: 12px;
		color: #6b7280;
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

	.help-section {
		background: #fffbeb;
		border-left: 4px solid #f59e0b;
		padding: 24px;
		border-radius: 4px;
	}

	.help-section h3 {
		margin: 0 0 12px 0;
		color: #92400e;
	}

	.help-section p {
		margin: 0 0 20px 0;
		color: #78350f;
	}

	.help-links {
		display: flex;
		gap: 12px;
	}

	.btn {
		display: inline-block;
		padding: 10px 24px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
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

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 15px;
		}

		.request-header {
			flex-direction: column;
			gap: 12px;
		}

		.request-details {
			grid-template-columns: 1fr;
		}
	}
</style>
