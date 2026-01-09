<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let claims = $state<any[]>([]);
	let overdueOrders = $state<any[]>([]);
	let loading = $state(true);
	let message = $state('');

	// Claim form state
	let showClaimForm = $state(false);
	let selectedOrderId = $state<string | null>(null);
	let selectedOrderItemId = $state<string | null>(null);
	let claimType = $state<'overdue' | 'missing' | 'damaged'>('overdue');
	let claimMethod = $state<'email' | 'phone' | 'letter'>('email');
	let claimNotes = $state('');

	// Response form state
	let showResponseForm = $state(false);
	let respondingClaimId = $state<string | null>(null);
	let vendorResponse = $state('');
	let resolution = $state<'received' | 'refunded' | 'cancelled' | 'pending'>('pending');

	const today = new Date().toISOString().split('T')[0];

	onMount(async () => {
		await Promise.all([loadClaims(), loadOverdueOrders()]);
	});

	async function loadClaims() {
		loading = true;

		const { data: claimsData } = await data.supabase
			.from('claims')
			.select(
				`
				*,
				order:acquisition_orders(
					id,
					order_number,
					vendor:vendors(name, email)
				),
				order_item:order_items(
					id,
					title,
					author,
					isbn,
					quantity
				)
			`
			)
			.order('created_at', { ascending: false });

		claims = claimsData || [];
		loading = false;
	}

	async function loadOverdueOrders() {
		const { data: ordersData } = await data.supabase
			.from('acquisition_orders')
			.select(
				`
				*,
				vendor:vendors(id, name, email),
				items:order_items(
					id,
					title,
					author,
					isbn,
					quantity,
					quantity_received,
					status
				)
			`
			)
			.in('status', ['ordered', 'partial'])
			.not('expected_delivery_date', 'is', null)
			.lt('expected_delivery_date', today);

		overdueOrders = ordersData || [];
	}

	function openClaimForm(orderId: string, orderItemId?: string) {
		selectedOrderId = orderId;
		selectedOrderItemId = orderItemId || null;
		claimType = 'overdue';
		claimMethod = 'email';
		claimNotes = '';
		showClaimForm = true;
	}

	function closeClaimForm() {
		showClaimForm = false;
		selectedOrderId = null;
		selectedOrderItemId = null;
		claimNotes = '';
	}

	async function submitClaim() {
		if (!selectedOrderId) {
			message = 'Error: No order selected';
			return;
		}

		try {
			const order = overdueOrders.find((o) => o.id === selectedOrderId);
			if (!order) {
				message = 'Error: Order not found';
				return;
			}

			const daysOverdue = order.expected_delivery_date
				? Math.floor(
						(new Date(today).getTime() - new Date(order.expected_delivery_date).getTime()) /
							(1000 * 60 * 60 * 24)
					)
				: 0;

			const claimData = {
				acquisition_order_id: selectedOrderId,
				order_item_id: selectedOrderItemId,
				claim_type: claimType,
				claim_date: today,
				expected_delivery_date: order.expected_delivery_date,
				days_overdue: daysOverdue,
				claim_method: claimMethod,
				claimed_by: data.session?.user?.email || 'Unknown',
				resolution: 'pending',
				notes: claimNotes || null
			};

			const { error } = await data.supabase.from('claims').insert([claimData]);

			if (error) throw error;

			await loadClaims();
			closeClaimForm();
			message = 'Claim submitted successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function openResponseForm(claimId: string) {
		respondingClaimId = claimId;
		const claim = claims.find((c) => c.id === claimId);
		if (claim) {
			vendorResponse = claim.vendor_response || '';
			resolution = claim.resolution || 'pending';
		}
		showResponseForm = true;
	}

	function closeResponseForm() {
		showResponseForm = false;
		respondingClaimId = null;
		vendorResponse = '';
		resolution = 'pending';
	}

	async function submitResponse() {
		if (!respondingClaimId) return;

		try {
			const { error } = await data.supabase
				.from('claims')
				.update({
					vendor_response: vendorResponse || null,
					response_date: today,
					resolution: resolution
				})
				.eq('id', respondingClaimId);

			if (error) throw error;

			await loadClaims();
			closeResponseForm();
			message = 'Response recorded successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function generateClaimLetter(claim: any) {
		const order = claim.order;
		const vendor = order?.vendor;
		const item = claim.order_item;

		let letterContent = `Date: ${new Date().toLocaleDateString()}\n\n`;
		letterContent += `To: ${vendor?.name || 'Vendor'}\n`;
		if (vendor?.email) letterContent += `Email: ${vendor.email}\n`;
		letterContent += `\nRe: Claim for Purchase Order ${order?.order_number}\n\n`;
		letterContent += `Dear ${vendor?.name || 'Vendor'},\n\n`;

		if (claim.claim_type === 'overdue') {
			letterContent += `We are writing to follow up on Purchase Order ${order?.order_number}, `;
			letterContent += `which was expected to be delivered by ${new Date(claim.expected_delivery_date).toLocaleDateString()}. `;
			letterContent += `As of today, this order is ${claim.days_overdue} day(s) overdue.\n\n`;
		}

		if (item) {
			letterContent += `Item in question:\n`;
			letterContent += `  Title: ${item.title}\n`;
			if (item.author) letterContent += `  Author: ${item.author}\n`;
			if (item.isbn) letterContent += `  ISBN: ${item.isbn}\n`;
			letterContent += `  Quantity: ${item.quantity}\n\n`;
		}

		letterContent += `Please provide an update on the status of this order at your earliest convenience. `;
		letterContent += `If the item(s) are no longer available, please notify us so we can make alternative arrangements.\n\n`;

		if (claim.notes) {
			letterContent += `Additional notes:\n${claim.notes}\n\n`;
		}

		letterContent += `Thank you for your prompt attention to this matter.\n\n`;
		letterContent += `Sincerely,\n`;
		letterContent += `${claim.claimed_by}\n`;

		// Download as text file
		const blob = new Blob([letterContent], { type: 'text/plain' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `claim-${order?.order_number}-${new Date().toISOString().split('T')[0]}.txt`;
		a.click();
		window.URL.revokeObjectURL(url);

		message = 'Claim letter downloaded!';
		setTimeout(() => (message = ''), 3000);
	}

	function copyClaimEmail(claim: any) {
		const order = claim.order;
		const vendor = order?.vendor;
		const item = claim.order_item;

		let emailContent = `Subject: Claim for Purchase Order ${order?.order_number}\n\n`;
		emailContent += `Dear ${vendor?.name || 'Vendor'},\n\n`;

		if (claim.claim_type === 'overdue') {
			emailContent += `We are writing to follow up on Purchase Order ${order?.order_number}, `;
			emailContent += `which was expected to be delivered by ${new Date(claim.expected_delivery_date).toLocaleDateString()}. `;
			emailContent += `As of today, this order is ${claim.days_overdue} day(s) overdue.\n\n`;
		}

		if (item) {
			emailContent += `Item in question:\n`;
			emailContent += `• Title: ${item.title}\n`;
			if (item.author) emailContent += `• Author: ${item.author}\n`;
			if (item.isbn) emailContent += `• ISBN: ${item.isbn}\n`;
			emailContent += `• Quantity: ${item.quantity}\n\n`;
		}

		emailContent += `Please provide an update on the status of this order.\n\n`;

		if (claim.notes) {
			emailContent += `Additional notes:\n${claim.notes}\n\n`;
		}

		emailContent += `Thank you,\n${claim.claimed_by}`;

		navigator.clipboard.writeText(emailContent);
		message = 'Email text copied to clipboard!';
		setTimeout(() => (message = ''), 3000);
	}

	const stats = $derived({
		total: claims.length,
		pending: claims.filter((c) => c.resolution === 'pending').length,
		resolved: claims.filter((c) => c.resolution !== 'pending').length,
		overdueOrders: overdueOrders.length
	});

	const filteredClaims = $derived(claims);
</script>

<div class="claims-page">
	<header class="page-header">
		<div>
			<h1>Claims Management</h1>
			<p class="subtitle">Track and manage claims for overdue, missing, or damaged orders</p>
		</div>
		<div class="header-actions">
			<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
		</div>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<!-- Stats -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{stats.total}</div>
			<div class="stat-label">Total Claims</div>
		</div>
		<div class="stat-card alert">
			<div class="stat-value">{stats.pending}</div>
			<div class="stat-label">Pending Resolution</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.resolved}</div>
			<div class="stat-label">Resolved</div>
		</div>
		<div class="stat-card alert">
			<div class="stat-value">{stats.overdueOrders}</div>
			<div class="stat-label">Overdue Orders</div>
		</div>
	</div>

	<!-- Overdue Orders Section -->
	{#if overdueOrders.length > 0}
		<div class="overdue-section">
			<h2>Overdue Orders Requiring Attention</h2>
			<div class="overdue-list">
				{#each overdueOrders as order}
					{@const daysOverdue = Math.floor(
						(new Date(today).getTime() - new Date(order.expected_delivery_date).getTime()) /
							(1000 * 60 * 60 * 24)
					)}
					{@const hasClaim = claims.some((c) => c.acquisition_order_id === order.id)}
					<div class="overdue-card">
						<div class="overdue-header">
							<h3>
								<a href="/admin/acquisitions/orders/{order.id}">{order.order_number}</a>
							</h3>
							<span class="overdue-badge">{daysOverdue} days overdue</span>
						</div>
						<div class="overdue-info">
							<p><strong>Vendor:</strong> {order.vendor?.name}</p>
							<p>
								<strong>Expected:</strong>
								{new Date(order.expected_delivery_date).toLocaleDateString()}
							</p>
							<p><strong>Items:</strong> {order.items?.length || 0}</p>
						</div>
						<div class="overdue-actions">
							{#if hasClaim}
								<span class="claimed-mark">✓ Claim Filed</span>
							{:else}
								<button class="btn-claim" onclick={() => openClaimForm(order.id)}>
									File Claim
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Claims List -->
	<div class="claims-section">
		<h2>Claims History</h2>

		{#if loading}
			<p class="loading">Loading claims...</p>
		{:else if filteredClaims.length === 0}
			<div class="empty-state">
				<p>No claims filed yet.</p>
			</div>
		{:else}
			<div class="claims-table-container">
				<table class="claims-table">
					<thead>
						<tr>
							<th>Claim Date</th>
							<th>Order</th>
							<th>Vendor</th>
							<th>Type</th>
							<th>Days Overdue</th>
							<th>Method</th>
							<th>Resolution</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredClaims as claim}
							<tr>
								<td>{new Date(claim.claim_date).toLocaleDateString()}</td>
								<td>
									<a href="/admin/acquisitions/orders/{claim.order?.id}" class="order-link">
										{claim.order?.order_number}
									</a>
									{#if claim.order_item}
										<div class="item-title">{claim.order_item.title}</div>
									{/if}
								</td>
								<td>{claim.order?.vendor?.name || 'N/A'}</td>
								<td>
									<span class="type-badge {claim.claim_type}">{claim.claim_type}</span>
								</td>
								<td>{claim.days_overdue || 0}</td>
								<td>{claim.claim_method}</td>
								<td>
									<span class="resolution-badge {claim.resolution}">{claim.resolution}</span>
									{#if claim.response_date}
										<div class="response-date">
											{new Date(claim.response_date).toLocaleDateString()}
										</div>
									{/if}
								</td>
								<td>
									<div class="action-buttons">
										<button class="btn-sm" onclick={() => generateClaimLetter(claim)}>
											📄 Letter
										</button>
										<button class="btn-sm" onclick={() => copyClaimEmail(claim)}>
											📧 Copy Email
										</button>
										<button class="btn-sm" onclick={() => openResponseForm(claim.id)}>
											Record Response
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Claim Form Modal -->
	{#if showClaimForm}
		<div class="modal-overlay" onclick={closeClaimForm}>
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h2>File Claim</h2>
					<button class="modal-close" onclick={closeClaimForm}>×</button>
				</div>

				<div class="modal-body">
					<form
						onsubmit={(e) => {
							e.preventDefault();
							submitClaim();
						}}
					>
						<div class="form-group">
							<label for="claimType">Claim Type *</label>
							<select id="claimType" bind:value={claimType} required>
								<option value="overdue">Overdue</option>
								<option value="missing">Missing</option>
								<option value="damaged">Damaged</option>
							</select>
						</div>

						<div class="form-group">
							<label for="claimMethod">Claim Method *</label>
							<select id="claimMethod" bind:value={claimMethod} required>
								<option value="email">Email</option>
								<option value="phone">Phone</option>
								<option value="letter">Letter</option>
							</select>
						</div>

						<div class="form-group">
							<label for="claimNotes">Notes</label>
							<textarea
								id="claimNotes"
								bind:value={claimNotes}
								rows="4"
								placeholder="Additional details about the claim..."
							></textarea>
						</div>

						<div class="modal-actions">
							<button type="submit" class="btn-primary">Submit Claim</button>
							<button type="button" class="btn-secondary" onclick={closeClaimForm}>
								Cancel
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Response Form Modal -->
	{#if showResponseForm}
		<div class="modal-overlay" onclick={closeResponseForm}>
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h2>Record Vendor Response</h2>
					<button class="modal-close" onclick={closeResponseForm}>×</button>
				</div>

				<div class="modal-body">
					<form
						onsubmit={(e) => {
							e.preventDefault();
							submitResponse();
						}}
					>
						<div class="form-group">
							<label for="vendorResponse">Vendor Response</label>
							<textarea
								id="vendorResponse"
								bind:value={vendorResponse}
								rows="4"
								placeholder="What did the vendor say?"
							></textarea>
						</div>

						<div class="form-group">
							<label for="resolution">Resolution *</label>
							<select id="resolution" bind:value={resolution} required>
								<option value="pending">Pending</option>
								<option value="received">Received</option>
								<option value="refunded">Refunded</option>
								<option value="cancelled">Cancelled</option>
							</select>
						</div>

						<div class="modal-actions">
							<button type="submit" class="btn-primary">Save Response</button>
							<button type="button" class="btn-secondary" onclick={closeResponseForm}>
								Cancel
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.claims-page {
		max-width: 1600px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
	}

	.message {
		padding: 1rem;
		border-radius: var(--radius-sm);
		margin-bottom: 1.5rem;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	/* Stats Grid */
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

	.stat-card.alert {
		border-color: #ef4444;
		background: #fef2f2;
	}

	.stat-value {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--accent);
		line-height: 1;
		margin-bottom: 0.5rem;
	}

	.stat-card.alert .stat-value {
		color: #ef4444;
	}

	.stat-label {
		color: var(--text-muted);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Overdue Section */
	.overdue-section {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 2px solid #ef4444;
		margin-bottom: 2rem;
	}

	.overdue-section h2 {
		margin: 0 0 1.5rem 0;
		color: #ef4444;
	}

	.overdue-list {
		display: grid;
		gap: 1rem;
	}

	.overdue-card {
		padding: 1.5rem;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		border-radius: var(--radius-sm);
	}

	.overdue-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.overdue-header h3 {
		margin: 0;
		font-size: 1.125rem;
	}

	.overdue-header a {
		color: var(--accent);
		text-decoration: none;
	}

	.overdue-header a:hover {
		text-decoration: underline;
	}

	.overdue-badge {
		padding: 0.375rem 0.75rem;
		background: #dc2626;
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.overdue-info {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.overdue-info p {
		margin: 0;
		font-size: 0.875rem;
	}

	.overdue-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-claim {
		padding: 0.5rem 1rem;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-weight: 600;
	}

	.claimed-mark {
		color: #10b981;
		font-weight: 600;
	}

	/* Claims Section */
	.claims-section {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	h2 {
		margin: 0 0 1.5rem 0;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	.claims-table-container {
		overflow-x: auto;
	}

	.claims-table {
		width: 100%;
		border-collapse: collapse;
	}

	.claims-table thead {
		background: var(--bg-secondary);
	}

	.claims-table th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.claims-table td {
		padding: 1rem 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.order-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}

	.order-link:hover {
		text-decoration: underline;
	}

	.item-title {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.type-badge,
	.resolution-badge {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.type-badge.overdue {
		background: #fee2e2;
		color: #991b1b;
	}

	.type-badge.missing {
		background: #fef3c7;
		color: #92400e;
	}

	.type-badge.damaged {
		background: #fed7aa;
		color: #9a3412;
	}

	.resolution-badge.pending {
		background: #fff3cd;
		color: #856404;
	}

	.resolution-badge.received {
		background: #d4edda;
		color: #155724;
	}

	.resolution-badge.refunded {
		background: #cce5ff;
		color: #004085;
	}

	.resolution-badge.cancelled {
		background: #e2e3e5;
		color: #6c757d;
	}

	.response-date {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn-sm {
		padding: 0.375rem 0.75rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: var(--radius-md);
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: var(--text-muted);
		line-height: 1;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
	}

	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group textarea {
		resize: vertical;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-secondary {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.overdue-info {
			grid-template-columns: 1fr;
		}
	}
</style>
