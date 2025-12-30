<script lang="ts">
	import { goto } from '$app/navigation';

	let {
		requests = [],
		requestType,
		onStatusChange
	}: {
		requests: any[];
		requestType: 'borrowing' | 'lending';
		onStatusChange: (id: string, status: string) => Promise<void>;
	} = $props();

	let selectedStatus = $state('all');
	let showShipmentModal = $state(false);
	let selectedRequest: any = $state(null);

	let filteredRequests = $derived(
		selectedStatus === 'all'
			? requests
			: requests.filter((r) => r.status === selectedStatus)
	);

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

	function openShipmentModal(request: any) {
		selectedRequest = request;
		showShipmentModal = true;
	}

	async function quickStatusChange(id: string, newStatus: string) {
		if (confirm(`Change status to ${newStatus}?`)) {
			await onStatusChange(id, newStatus);
		}
	}
</script>

<div class="queue-container">
	<!-- Status Filter -->
	<div class="filter-bar">
		<label for="status-filter">Filter by status:</label>
		<select id="status-filter" bind:value={selectedStatus}>
			<option value="all">All Requests</option>
			<option value="pending">Pending</option>
			<option value="approved">Approved</option>
			<option value="requested">Requested</option>
			<option value="shipped">Shipped</option>
			<option value="received">Received</option>
			<option value="available">Available</option>
			<option value="checked_out">Checked Out</option>
			<option value="returned">Returned</option>
			<option value="completed">Completed</option>
			<option value="cancelled">Cancelled</option>
			<option value="denied">Denied</option>
		</select>
		<span class="result-count">{filteredRequests.length} requests</span>
	</div>

	<!-- Requests Table -->
	{#if filteredRequests.length > 0}
		<div class="table-responsive">
			<table>
				<thead>
					<tr>
						<th>Title</th>
						<th>{requestType === 'borrowing' ? 'Patron' : 'Requesting Library'}</th>
						<th>{requestType === 'borrowing' ? 'Partner Library' : 'Our Copy'}</th>
						<th>Status</th>
						<th>Created</th>
						<th>Due Date</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredRequests as request}
						<tr>
							<td>
								<strong>{request.title}</strong>
								{#if request.author}
									<br />
									<small>{request.author}</small>
								{/if}
							</td>
							<td>
								{#if requestType === 'borrowing'}
									{request.patron?.name || 'N/A'}
								{:else}
									{request.partner?.library_name || request.partner_library_name || 'N/A'}
								{/if}
							</td>
							<td>
								{#if requestType === 'borrowing'}
									{request.partner?.library_name || request.partner_library_name || 'Not assigned'}
								{:else}
									{request.marc_record ? 'In catalog' : 'Not in catalog'}
								{/if}
							</td>
							<td>
								<span class="badge {getStatusBadgeClass(request.status)}">
									{request.status}
								</span>
							</td>
							<td>{formatDate(request.created_at)}</td>
							<td>{formatDate(request.due_date)}</td>
							<td>
								<div class="action-buttons">
									{#if request.status === 'pending'}
										<button
											onclick={() => quickStatusChange(request.id, 'approved')}
											class="btn btn-sm btn-success"
										>
											Approve
										</button>
										<button
											onclick={() => quickStatusChange(request.id, 'denied')}
											class="btn btn-sm btn-error"
										>
											Deny
										</button>
									{:else if request.status === 'approved'}
										<button
											onclick={() => quickStatusChange(request.id, 'requested')}
											class="btn btn-sm btn-primary"
										>
											Mark Requested
										</button>
									{:else if request.status === 'requested' || request.status === 'shipped'}
										<button onclick={() => openShipmentModal(request)} class="btn btn-sm btn-info">
											Track Shipment
										</button>
									{:else if request.status === 'received'}
										<button
											onclick={() => quickStatusChange(request.id, 'available')}
											class="btn btn-sm btn-success"
										>
											Mark Available
										</button>
									{/if}
									<a href="/admin/ill/{requestType}/request/{request.id}" class="btn btn-sm btn-secondary">
										Details
									</a>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="empty-state">No {selectedStatus === 'all' ? '' : selectedStatus} requests found.</p>
	{/if}
</div>

<style>
	.queue-container {
		width: 100%;
	}

	.filter-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
		padding: 15px;
		background: #f9fafb;
		border-radius: 4px;
	}

	.filter-bar label {
		font-weight: 500;
	}

	.filter-bar select {
		padding: 6px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
	}

	.result-count {
		color: #6b7280;
		font-size: 14px;
		margin-left: auto;
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

	.action-buttons {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
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

	.btn {
		display: inline-block;
		padding: 6px 12px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}
	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}
	.btn-success {
		background: #10b981;
		color: white;
	}
	.btn-error {
		background: #ef4444;
		color: white;
	}
	.btn-info {
		background: #3b82f6;
		color: white;
	}
	.btn-sm {
		padding: 4px 10px;
		font-size: 12px;
	}

	.empty-state {
		text-align: center;
		color: #6b7280;
		padding: 40px;
	}
</style>
