<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let serialId = $derived($page.params.id);
	let serial = $state<any>(null);
	let claims = $state<any[]>([]);
	let lateIssues = $state<any[]>([]);
	let vendors = $state<any[]>([]);
	let loading = $state(true);
	let showNewClaim = $state(false);

	// Form state
	let selectedIssueId = $state('');
	let claimType = $state('missing');
	let claimMethod = $state('email');
	let vendorId = $state('');
	let claimedBy = $state('Current User');
	let claimNotes = $state('');
	let saving = $state(false);
	let error = $state('');

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;

		// Load serial with vendor info
		const { data: serialData } = await supabase
			.from('serials')
			.select('*, vendors(*)')
			.eq('id', serialId)
			.single();

		serial = serialData;
		vendorId = serial?.vendor_id || '';

		// Load claims
		const { data: claimsData } = await supabase
			.from('serial_claims')
			.select('*, serial_issues(display_text, volume, issue), vendors(name)')
			.eq('serial_id', serialId)
			.order('created_at', { ascending: false });

		claims = claimsData || [];

		// Load late/claimable issues
		const { data: lateData } = await supabase
			.from('serial_issues')
			.select('*')
			.eq('serial_id', serialId)
			.in('status', ['late', 'claimed'])
			.order('expected_date');

		lateIssues = lateData || [];

		// Load all vendors
		const { data: vendorsData } = await supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');

		vendors = vendorsData || [];

		loading = false;
	}

	async function createClaim() {
		saving = true;
		error = '';

		try {
			const issue = lateIssues.find((i) => i.id === selectedIssueId);
			if (!issue) throw new Error('Issue not found');

			const claimData = {
				serial_id: serialId,
				serial_issue_id: selectedIssueId,
				claim_number: issue.claim_count + 1,
				claim_type: claimType,
				claim_method: claimMethod,
				claimed_by: claimedBy,
				vendor_id: vendorId || null,
				notes: claimNotes || null,
				status: 'pending',
				escalation_level: issue.claim_count + 1
			};

			const { error: insertError } = await supabase
				.from('serial_claims')
				.insert([claimData]);

			if (insertError) throw insertError;

			// Update issue status and claim count
			await supabase
				.from('serial_issues')
				.update({
					status: 'claimed',
					claim_count: issue.claim_count + 1,
					last_claim_date: new Date().toISOString().split('T')[0]
				})
				.eq('id', selectedIssueId);

			// Reset form
			resetForm();
			showNewClaim = false;
			await loadData();
		} catch (err: any) {
			error = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	async function updateClaim(claimId: string, updates: any) {
		await supabase.from('serial_claims').update(updates).eq('id', claimId);
		await loadData();
	}

	function resetForm() {
		selectedIssueId = '';
		claimType = 'missing';
		claimMethod = 'email';
		claimNotes = '';
		error = '';
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'pending':
				return 'badge-warning';
			case 'acknowledged':
				return 'badge-info';
			case 'resolved':
				return 'badge-success';
			case 'escalated':
				return 'badge-danger';
			case 'cancelled':
				return 'badge-muted';
			default:
				return '';
		}
	}

	let stats = $derived({
		total: claims.length,
		pending: claims.filter((c) => c.status === 'pending').length,
		acknowledged: claims.filter((c) => c.status === 'acknowledged').length,
		resolved: claims.filter((c) => c.status === 'resolved').length,
		escalated: claims.filter((c) => c.status === 'escalated').length
	});
</script>

<div class="claims-page">
	<header class="page-header">
		<div>
			<a href="/admin/serials" class="back-link">← Back to Serials</a>
			<h1>{serial?.title || 'Serial'} - Claims</h1>
		</div>
		<button class="btn-primary" onclick={() => (showNewClaim = !showNewClaim)}>
			{showNewClaim ? 'Cancel' : 'New Claim'}
		</button>
	</header>

	<div class="stats-bar">
		<div class="stat">
			<span class="stat-value">{stats.total}</span>
			<span class="stat-label">Total Claims</span>
		</div>
		<div class="stat stat-warning">
			<span class="stat-value">{stats.pending}</span>
			<span class="stat-label">Pending</span>
		</div>
		<div class="stat stat-info">
			<span class="stat-value">{stats.acknowledged}</span>
			<span class="stat-label">Acknowledged</span>
		</div>
		<div class="stat stat-success">
			<span class="stat-value">{stats.resolved}</span>
			<span class="stat-label">Resolved</span>
		</div>
		{#if stats.escalated > 0}
			<div class="stat stat-danger">
				<span class="stat-value">{stats.escalated}</span>
				<span class="stat-label">Escalated</span>
			</div>
		{/if}
	</div>

	{#if showNewClaim}
		<div class="claim-form">
			<h2>Create New Claim</h2>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					createClaim();
				}}
			>
				<div class="form-group">
					<label for="selectedIssue">Issue to Claim *</label>
					<select id="selectedIssue" bind:value={selectedIssueId} required>
						<option value="">Select an issue...</option>
						{#each lateIssues as issue}
							<option value={issue.id}>
								{issue.display_text} (Expected: {new Date(
									issue.expected_date
								).toLocaleDateString()})
								{#if issue.claim_count > 0}
									- {issue.claim_count} previous claim(s)
								{/if}
							</option>
						{/each}
					</select>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="claimType">Claim Type</label>
						<select id="claimType" bind:value={claimType}>
							<option value="missing">Missing</option>
							<option value="late">Late</option>
							<option value="damaged">Damaged</option>
						</select>
					</div>

					<div class="form-group">
						<label for="claimMethod">Claim Method</label>
						<select id="claimMethod" bind:value={claimMethod}>
							<option value="email">Email</option>
							<option value="phone">Phone</option>
							<option value="form">Online Form</option>
							<option value="letter">Letter</option>
						</select>
					</div>
				</div>

				<div class="form-group">
					<label for="vendor">Vendor</label>
					<select id="vendor" bind:value={vendorId}>
						<option value="">Select vendor...</option>
						{#each vendors as vendor}
							<option value={vendor.id}>{vendor.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="claimNotes">Notes</label>
					<textarea
						id="claimNotes"
						bind:value={claimNotes}
						rows="4"
						placeholder="Additional notes about this claim..."
					></textarea>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={saving || !selectedIssueId}>
						{saving ? 'Creating Claim...' : 'Create Claim'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (showNewClaim = false)}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if loading}
		<p>Loading claims...</p>
	{:else if claims.length === 0}
		<div class="empty-state">
			<p>No claims filed yet</p>
			<p class="help-text">File a claim when an expected issue doesn't arrive</p>
		</div>
	{:else}
		<div class="claims-list">
			{#each claims as claim}
				<div class="claim-card">
					<div class="claim-header">
						<div>
							<h3>{claim.serial_issues?.display_text || 'Unknown Issue'}</h3>
							<span class="claim-number">Claim #{claim.claim_number}</span>
							<span class="badge {getStatusBadgeClass(claim.status)}">
								{claim.status}
							</span>
							{#if claim.escalation_level > 1}
								<span class="badge badge-escalated">
									Escalation Level {claim.escalation_level}
								</span>
							{/if}
						</div>
					</div>

					<div class="claim-details">
						<div class="detail-grid">
							<div class="detail-item">
								<span class="detail-label">Claim Type</span>
								<span class="detail-value">{claim.claim_type}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Claim Date</span>
								<span class="detail-value"
									>{new Date(claim.claim_date).toLocaleDateString()}</span
								>
							</div>
							<div class="detail-item">
								<span class="detail-label">Method</span>
								<span class="detail-value">{claim.claim_method}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Claimed By</span>
								<span class="detail-value">{claim.claimed_by}</span>
							</div>
							{#if claim.vendors?.name}
								<div class="detail-item">
									<span class="detail-label">Vendor</span>
									<span class="detail-value">{claim.vendors.name}</span>
								</div>
							{/if}
							{#if claim.response_date}
								<div class="detail-item">
									<span class="detail-label">Response Date</span>
									<span class="detail-value"
										>{new Date(claim.response_date).toLocaleDateString()}</span
									>
								</div>
							{/if}
							{#if claim.resolution}
								<div class="detail-item">
									<span class="detail-label">Resolution</span>
									<span class="detail-value">{claim.resolution}</span>
								</div>
							{/if}
						</div>

						{#if claim.notes}
							<p class="claim-notes"><strong>Notes:</strong> {claim.notes}</p>
						{/if}

						{#if claim.vendor_response}
							<p class="vendor-response">
								<strong>Vendor Response:</strong>
								{claim.vendor_response}
							</p>
						{/if}
					</div>

					{#if claim.status === 'pending' || claim.status === 'acknowledged'}
						<div class="claim-actions">
							<button
								class="btn-sm btn-info"
								onclick={() =>
									updateClaim(claim.id, {
										status: 'acknowledged',
										response_date: new Date().toISOString().split('T')[0]
									})}
							>
								Mark Acknowledged
							</button>
							<button
								class="btn-sm btn-success"
								onclick={() =>
									updateClaim(claim.id, {
										status: 'resolved',
										resolution: 'received'
									})}
							>
								Mark Resolved
							</button>
							<button
								class="btn-sm btn-danger"
								onclick={() =>
									updateClaim(claim.id, {
										status: 'escalated',
										escalation_level: claim.escalation_level + 1
									})}
							>
								Escalate
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.claims-page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-lg);
	}

	.page-header > div h1 {
		margin: 0;
	}

	.back-link {
		display: inline-block;
		margin-bottom: var(--space-sm);
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.875rem;
	}

	.back-link:hover {
		color: var(--accent);
	}

	.stats-bar {
		display: flex;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-lg);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-sm);
		min-width: 80px;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-success .stat-value {
		color: var(--success);
	}

	.stat-info .stat-value {
		color: var(--info);
	}

	.stat-warning .stat-value {
		color: var(--warning);
	}

	.stat-danger .stat-value {
		color: var(--danger);
	}

	.claim-form {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-lg);
		border: 1px solid var(--border);
	}

	.claim-form h2 {
		margin: 0 0 var(--space-lg) 0;
	}

	.form-group {
		margin-bottom: var(--space-md);
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-md);
	}

	label {
		display: block;
		margin-bottom: var(--space-xs);
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: var(--space-sm);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		box-sizing: border-box;
		font-family: inherit;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	textarea {
		resize: vertical;
	}

	.error {
		background: var(--danger);
		color: white;
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
	}

	.btn-primary,
	.btn-secondary,
	.btn-sm {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		border: none;
		font-size: 0.875rem;
		cursor: pointer;
		transition: var(--transition-smooth);
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--bg-secondary);
	}

	.btn-sm {
		padding: var(--space-xs) var(--space-sm);
		font-size: 0.75rem;
	}

	.btn-info {
		background: var(--info);
		color: white;
	}

	.btn-info:hover {
		background: var(--info-hover);
	}

	.btn-success {
		background: var(--success);
		color: white;
	}

	.btn-success:hover {
		background: var(--success-hover);
	}

	.btn-danger {
		background: var(--danger);
		color: white;
	}

	.btn-danger:hover {
		background: var(--danger-hover);
	}

	.form-actions {
		display: flex;
		gap: var(--space-md);
		margin-top: var(--space-lg);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-xl);
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
	}

	.empty-state p {
		margin-bottom: var(--space-sm);
		color: var(--text-muted);
	}

	.help-text {
		font-size: 0.875rem;
	}

	.claims-list {
		display: grid;
		gap: var(--space-md);
	}

	.claim-card {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.claim-header {
		margin-bottom: var(--space-md);
	}

	.claim-header h3 {
		margin: 0 0 var(--space-xs) 0;
		display: inline-block;
		margin-right: var(--space-sm);
	}

	.claim-number {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-right: var(--space-sm);
	}

	.badge {
		display: inline-block;
		padding: 2px var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-right: var(--space-xs);
	}

	.badge-success {
		background: var(--success);
		color: white;
	}

	.badge-info {
		background: var(--info);
		color: white;
	}

	.badge-warning {
		background: var(--warning);
		color: white;
	}

	.badge-danger {
		background: var(--danger);
		color: white;
	}

	.badge-muted {
		background: var(--text-muted);
		color: white;
	}

	.badge-escalated {
		background: var(--danger);
		color: white;
	}

	.claim-details {
		margin-bottom: var(--space-md);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.detail-item {
		display: flex;
		flex-direction: column;
	}

	.detail-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 2px;
	}

	.detail-value {
		font-weight: 500;
		color: var(--text-primary);
	}

	.claim-notes,
	.vendor-response {
		margin-top: var(--space-sm);
		padding: var(--space-sm);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.vendor-response {
		border-left: 3px solid var(--info);
	}

	.claim-actions {
		display: flex;
		gap: var(--space-sm);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border);
	}
</style>
