<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let serialId = $derived($page.params.id);
	let serial = $state<any>(null);
	let unboundIssues = $state<any[]>([]);
	let bindingBatches = $state<any[]>([]);
	let vendors = $state<any[]>([]);
	let budgets = $state<any[]>([]);
	let loading = $state(true);
	let showNewBatch = $state(false);

	// Form state
	let selectedIssues = $state<Set<string>>(new Set());
	let batchName = $state('');
	let binderyVendorId = $state('');
	let budgetId = $state('');
	let sentDate = $state('');
	let expectedReturnDate = $state('');
	let estimatedCost = $state('');
	let batchNotes = $state('');
	let volumeNumber = $state('');
	let volumeYear = $state(new Date().getFullYear());
	let spineLabel = $state('');
	let saving = $state(false);
	let error = $state('');

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;

		// Load serial
		const { data: serialData } = await data.supabase
			.from('serials')
			.select('*')
			.eq('id', serialId)
			.single();

		serial = serialData;

		// Load unbound received issues
		const { data: unboundData } = await data.supabase
			.from('serial_issues')
			.select('*')
			.eq('serial_id', serialId)
			.eq('status', 'received')
			.eq('binding_status', 'unbound')
			.order('year', { ascending: false })
			.order('volume', { ascending: false })
			.order('issue', { ascending: false });

		unboundIssues = unboundData || [];

		// Load binding batches
		const { data: batchesData } = await data.supabase
			.from('serial_binding_batches')
			.select('*, vendors(name)')
			.order('created_at', { ascending: false });

		bindingBatches = batchesData || [];

		// Load vendors
		const { data: vendorsData } = await data.supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');

		vendors = vendorsData || [];

		// Load budgets
		const { data: budgetsData } = await data.supabase
			.from('budgets')
			.select('id, name, code')
			.eq('status', 'active')
			.order('name');

		budgets = budgetsData || [];

		loading = false;
	}

	async function createBindingBatch() {
		saving = true;
		error = '';

		try {
			if (selectedIssues.size === 0) {
				throw new Error('Please select at least one issue');
			}

			// Generate batch number
			const batchNumber = `BIND-${Date.now()}`;

			// Create batch
			const batchData = {
				batch_number: batchNumber,
				batch_name: batchName || `${serial.title} - ${volumeNumber || volumeYear}`,
				bindery_vendor_id: binderyVendorId || null,
				budget_id: budgetId || null,
				sent_date: sentDate || null,
				expected_return_date: expectedReturnDate || null,
				estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
				status: sentDate ? 'sent' : 'preparing',
				notes: batchNotes || null
			};

			const { data: insertedBatch, error: batchError } = await data.supabase
				.from('serial_binding_batches')
				.insert([batchData])
				.select()
				.single();

			if (batchError) throw batchError;

			// Add issues to batch
			const bindingItems = Array.from(selectedIssues).map((issueId) => ({
				binding_batch_id: insertedBatch.id,
				serial_id: serialId,
				serial_issue_id: issueId,
				volume_number: volumeNumber || null,
				volume_year: volumeYear,
				spine_label: spineLabel || null
			}));

			const { error: itemsError } = await data.supabase
				.from('serial_binding_items')
				.insert(bindingItems);

			if (itemsError) throw itemsError;

			// Update issue statuses
			const { error: updateError } = await data.supabase
				.from('serial_issues')
				.update({
					binding_status: 'marked_for_binding',
					binding_batch_id: insertedBatch.id
				})
				.in('id', Array.from(selectedIssues));

			if (updateError) throw updateError;

			// Reset form
			resetForm();
			showNewBatch = false;
			await loadData();
		} catch (err: any) {
			error = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	async function updateBatchStatus(batchId: string, status: string, updates: any = {}) {
		await data.supabase
			.from('serial_binding_batches')
			.update({ status, ...updates })
			.eq('id', batchId);

		// Update issue statuses
		if (status === 'in_binding') {
			await data.supabase
				.from('serial_issues')
				.update({ binding_status: 'in_binding' })
				.eq('binding_batch_id', batchId);
		} else if (status === 'returned' || status === 'complete') {
			await data.supabase
				.from('serial_issues')
				.update({ binding_status: 'bound' })
				.eq('binding_batch_id', batchId);
		}

		await loadData();
	}

	function toggleIssueSelection(issueId: string) {
		if (selectedIssues.has(issueId)) {
			selectedIssues.delete(issueId);
		} else {
			selectedIssues.add(issueId);
		}
		selectedIssues = new Set(selectedIssues);
	}

	function resetForm() {
		selectedIssues = new Set();
		batchName = '';
		binderyVendorId = '';
		budgetId = '';
		sentDate = '';
		expectedReturnDate = '';
		estimatedCost = '';
		batchNotes = '';
		volumeNumber = '';
		volumeYear = new Date().getFullYear();
		spineLabel = '';
		error = '';
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'preparing':
				return 'badge-info';
			case 'sent':
				return 'badge-warning';
			case 'in_binding':
				return 'badge-warning';
			case 'returned':
				return 'badge-success';
			case 'complete':
				return 'badge-success';
			default:
				return '';
		}
	}
</script>

<div class="binding-page">
	<header class="page-header">
		<div>
			<a href="/admin/serials" class="back-link">← Back to Serials</a>
			<h1>{serial?.title || 'Serial'} - Binding</h1>
		</div>
		<button
			class="btn-primary"
			onclick={() => (showNewBatch = !showNewBatch)}
			disabled={unboundIssues.length === 0}
		>
			{showNewBatch ? 'Cancel' : 'New Binding Batch'}
		</button>
	</header>

	{#if showNewBatch}
		<div class="binding-form">
			<h2>Create Binding Batch</h2>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					createBindingBatch();
				}}
			>
				<section class="form-section">
					<h3>Select Issues ({selectedIssues.size} selected)</h3>

					<div class="issues-selection">
						{#each unboundIssues as issue}
							<label class="issue-checkbox">
								<input
									type="checkbox"
									checked={selectedIssues.has(issue.id)}
									onchange={() => toggleIssueSelection(issue.id)}
								/>
								<span class="issue-label">
									{issue.display_text}
									{#if issue.received_date}
										<span class="issue-date"
											>({new Date(issue.received_date).toLocaleDateString()})</span
										>
									{/if}
								</span>
							</label>
						{/each}
					</div>
				</section>

				<section class="form-section">
					<h3>Batch Details</h3>

					<div class="form-group">
						<label for="batchName">Batch Name</label>
						<input
							id="batchName"
							type="text"
							bind:value={batchName}
							placeholder="e.g., Nature 2024 Volume 45"
						/>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="volumeNumber">Volume Number</label>
							<input id="volumeNumber" type="text" bind:value={volumeNumber} />
						</div>

						<div class="form-group">
							<label for="volumeYear">Volume Year</label>
							<input id="volumeYear" type="number" bind:value={volumeYear} min="1900" />
						</div>
					</div>

					<div class="form-group">
						<label for="spineLabel">Spine Label</label>
						<input
							id="spineLabel"
							type="text"
							bind:value={spineLabel}
							placeholder="Text for spine"
						/>
					</div>
				</section>

				<section class="form-section">
					<h3>Bindery Information</h3>

					<div class="form-group">
						<label for="binderyVendor">Bindery Vendor</label>
						<select id="binderyVendor" bind:value={binderyVendorId}>
							<option value="">Select vendor...</option>
							{#each vendors as vendor}
								<option value={vendor.id}>{vendor.name}</option>
							{/each}
						</select>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="sentDate">Sent Date</label>
							<input id="sentDate" type="date" bind:value={sentDate} />
						</div>

						<div class="form-group">
							<label for="expectedReturnDate">Expected Return Date</label>
							<input id="expectedReturnDate" type="date" bind:value={expectedReturnDate} />
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="estimatedCost">Estimated Cost</label>
							<input
								id="estimatedCost"
								type="number"
								step="0.01"
								bind:value={estimatedCost}
								placeholder="0.00"
							/>
						</div>

						<div class="form-group">
							<label for="budget">Budget</label>
							<select id="budget" bind:value={budgetId}>
								<option value="">Select budget...</option>
								{#each budgets as budget}
									<option value={budget.id}>{budget.name} ({budget.code})</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="form-group">
						<label for="batchNotes">Notes</label>
						<textarea id="batchNotes" bind:value={batchNotes} rows="3"></textarea>
					</div>
				</section>

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={saving || selectedIssues.size === 0}>
						{saving ? 'Creating Batch...' : 'Create Binding Batch'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (showNewBatch = false)}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if loading}
		<p>Loading...</p>
	{:else}
		{#if unboundIssues.length > 0 && !showNewBatch}
			<section class="unbound-section">
				<h2>Unbound Issues ({unboundIssues.length})</h2>
				<p class="help-text">These issues are available for binding</p>
			</section>
		{/if}

		{#if bindingBatches.length === 0}
			<div class="empty-state">
				<p>No binding batches yet</p>
				<p class="help-text">Create a batch to send issues for binding</p>
			</div>
		{:else}
			<section class="batches-section">
				<h2>Binding Batches</h2>

				<div class="batches-list">
					{#each bindingBatches as batch}
						<div class="batch-card">
							<div class="batch-header">
								<div>
									<h3>{batch.batch_name || batch.batch_number}</h3>
									<span class="badge {getStatusBadgeClass(batch.status)}">
										{batch.status}
									</span>
								</div>
							</div>

							<div class="batch-details">
								<div class="detail-grid">
									<div class="detail-item">
										<span class="detail-label">Batch Number</span>
										<span class="detail-value">{batch.batch_number}</span>
									</div>
									{#if batch.vendors?.name}
										<div class="detail-item">
											<span class="detail-label">Bindery</span>
											<span class="detail-value">{batch.vendors.name}</span>
										</div>
									{/if}
									{#if batch.sent_date}
										<div class="detail-item">
											<span class="detail-label">Sent Date</span>
											<span class="detail-value"
												>{new Date(batch.sent_date).toLocaleDateString()}</span
											>
										</div>
									{/if}
									{#if batch.expected_return_date}
										<div class="detail-item">
											<span class="detail-label">Expected Return</span>
											<span class="detail-value"
												>{new Date(batch.expected_return_date).toLocaleDateString()}</span
											>
										</div>
									{/if}
									{#if batch.returned_date}
										<div class="detail-item">
											<span class="detail-label">Returned Date</span>
											<span class="detail-value"
												>{new Date(batch.returned_date).toLocaleDateString()}</span
											>
										</div>
									{/if}
									{#if batch.estimated_cost}
										<div class="detail-item">
											<span class="detail-label">Estimated Cost</span>
											<span class="detail-value">${batch.estimated_cost.toFixed(2)}</span>
										</div>
									{/if}
									{#if batch.actual_cost}
										<div class="detail-item">
											<span class="detail-label">Actual Cost</span>
											<span class="detail-value">${batch.actual_cost.toFixed(2)}</span>
										</div>
									{/if}
								</div>

								{#if batch.notes}
									<p class="batch-notes"><strong>Notes:</strong> {batch.notes}</p>
								{/if}
							</div>

							{#if batch.status === 'preparing'}
								<div class="batch-actions">
									<button
										class="btn-sm btn-primary"
										onclick={() =>
											updateBatchStatus(batch.id, 'sent', {
												sent_date: new Date().toISOString().split('T')[0]
											})}
									>
										Mark as Sent
									</button>
								</div>
							{:else if batch.status === 'sent'}
								<div class="batch-actions">
									<button
										class="btn-sm btn-info"
										onclick={() => updateBatchStatus(batch.id, 'in_binding')}
									>
										Mark In Binding
									</button>
								</div>
							{:else if batch.status === 'in_binding'}
								<div class="batch-actions">
									<button
										class="btn-sm btn-success"
										onclick={() =>
											updateBatchStatus(batch.id, 'returned', {
												returned_date: new Date().toISOString().split('T')[0]
											})}
									>
										Mark as Returned
									</button>
								</div>
							{:else if batch.status === 'returned'}
								<div class="batch-actions">
									<button
										class="btn-sm btn-success"
										onclick={() => updateBatchStatus(batch.id, 'complete')}
									>
										Mark Complete
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.binding-page {
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

	.binding-form {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-lg);
		border: 1px solid var(--border);
	}

	.binding-form h2 {
		margin: 0 0 var(--space-lg) 0;
	}

	.form-section {
		margin-bottom: var(--space-lg);
		padding-bottom: var(--space-lg);
		border-bottom: 1px solid var(--border);
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h3 {
		margin: 0 0 var(--space-md) 0;
		font-size: 1.1rem;
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

	.issues-selection {
		display: grid;
		gap: var(--space-xs);
		max-height: 300px;
		overflow-y: auto;
		padding: var(--space-sm);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
	}

	.issue-checkbox {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: var(--transition-smooth);
	}

	.issue-checkbox:hover {
		background: var(--bg-secondary);
	}

	.issue-checkbox input[type='checkbox'] {
		width: auto;
		margin: 0;
	}

	.issue-label {
		flex: 1;
		font-size: 0.875rem;
	}

	.issue-date {
		color: var(--text-muted);
		font-size: 0.75rem;
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

	.form-actions {
		display: flex;
		gap: var(--space-md);
		margin-top: var(--space-lg);
	}

	.unbound-section {
		margin-bottom: var(--space-lg);
	}

	.unbound-section h2 {
		margin: 0 0 var(--space-xs) 0;
	}

	.help-text {
		font-size: 0.875rem;
		color: var(--text-muted);
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

	.batches-section h2 {
		margin: 0 0 var(--space-md) 0;
	}

	.batches-list {
		display: grid;
		gap: var(--space-md);
	}

	.batch-card {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.batch-header {
		margin-bottom: var(--space-md);
	}

	.batch-header h3 {
		margin: 0 0 var(--space-xs) 0;
		display: inline-block;
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

	.batch-details {
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

	.batch-notes {
		margin-top: var(--space-sm);
		padding: var(--space-sm);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.batch-actions {
		display: flex;
		gap: var(--space-sm);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border);
	}
</style>
