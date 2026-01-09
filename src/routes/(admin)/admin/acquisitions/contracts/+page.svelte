<script lang="ts">
	import type { PageData} from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let contracts = $state<any[]>([]);
	let vendors = $state<any[]>([]);
	let budgets = $state<any[]>([]);
	let loading = $state(true);
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let message = $state('');

	// Form fields
	let contractNumber = $state('');
	let name = $state('');
	let vendorId = $state('');
	let budgetId = $state('');
	let contractType = $state('');
	let resourceType = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let renewalDate = $state('');
	let noticePeriodDays = $state(90);
	let contractValue = $state(0);
	let currency = $state('USD');
	let paymentFrequency = $state('Annual');
	let autoRenew = $state(false);
	let contractStatus = $state('active');
	let terms = $state('');
	let contractNotes = $state('');
	let alertBeforeRenewalDays = $state(90);

	onMount(async () => {
		await Promise.all([loadContracts(), loadVendors(), loadBudgets()]);
	});

	async function loadContracts() {
		loading = true;
		const { data: contractsData } = await data.supabase
			.from('contracts')
			.select(
				`
				*,
				vendor:vendors(name),
				budget:budgets(name, code)
			`
			)
			.order('created_at', { ascending: false });

		contracts = contractsData || [];
		loading = false;
	}

	async function loadVendors() {
		const { data: vendorsData } = await data.supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');

		vendors = vendorsData || [];
	}

	async function loadBudgets() {
		const { data: budgetsData } = await data.supabase
			.from('budgets')
			.select('id, name, code')
			.eq('status', 'active')
			.order('name');

		budgets = budgetsData || [];
	}

	function resetForm() {
		contractNumber = '';
		name = '';
		vendorId = '';
		budgetId = '';
		contractType = '';
		resourceType = '';
		startDate = '';
		endDate = '';
		renewalDate = '';
		noticePeriodDays = 90;
		contractValue = 0;
		currency = 'USD';
		paymentFrequency = 'Annual';
		autoRenew = false;
		contractStatus = 'active';
		terms = '';
		contractNotes = '';
		alertBeforeRenewalDays = 90;
	}

	function editContract(contract: any) {
		editingId = contract.id;
		showForm = true;
		contractNumber = contract.contract_number || '';
		name = contract.name || '';
		vendorId = contract.vendor_id || '';
		budgetId = contract.budget_id || '';
		contractType = contract.contract_type || '';
		resourceType = contract.resource_type || '';
		startDate = contract.start_date || '';
		endDate = contract.end_date || '';
		renewalDate = contract.renewal_date || '';
		noticePeriodDays = contract.notice_period_days || 90;
		contractValue = Number(contract.contract_value) || 0;
		currency = contract.currency || 'USD';
		paymentFrequency = contract.payment_frequency || 'Annual';
		autoRenew = contract.auto_renew || false;
		contractStatus = contract.status || 'active';
		terms = contract.terms || '';
		contractNotes = contract.notes || '';
		alertBeforeRenewalDays = contract.alert_before_renewal_days || 90;
	}

	async function saveContract() {
		if (!name.trim() || !vendorId || !startDate) {
			message = 'Name, vendor, and start date are required';
			return;
		}

		const contractData = {
			contract_number: contractNumber.trim() || null,
			name: name.trim(),
			vendor_id: vendorId,
			budget_id: budgetId || null,
			contract_type: contractType || null,
			resource_type: resourceType || null,
			start_date: startDate,
			end_date: endDate || null,
			renewal_date: renewalDate || null,
			notice_period_days: noticePeriodDays,
			contract_value: contractValue || null,
			currency,
			payment_frequency: paymentFrequency,
			auto_renew: autoRenew,
			status: contractStatus,
			terms: terms || null,
			notes: contractNotes || null,
			alert_before_renewal_days: alertBeforeRenewalDays
		};

		try {
			if (editingId) {
				const { error } = await data.supabase
					.from('contracts')
					.update(contractData)
					.eq('id', editingId);

				if (error) throw error;
				message = 'Contract updated successfully!';
			} else {
				const { error } = await data.supabase.from('contracts').insert([contractData]);

				if (error) throw error;
				message = 'Contract created successfully!';
			}

			showForm = false;
			editingId = null;
			resetForm();
			await loadContracts();

			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function deleteContract(contractId: string) {
		if (!confirm('Are you sure you want to delete this contract?')) return;

		try {
			const { error } = await data.supabase.from('contracts').delete().eq('id', contractId);

			if (error) throw error;

			message = 'Contract deleted successfully!';
			await loadContracts();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function getDaysUntilRenewal(renewalDate: string) {
		if (!renewalDate) return null;
		const renewal = new Date(renewalDate);
		const today = new Date();
		const diff = renewal.getTime() - today.getTime();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}
</script>

<div class="contracts-page">
	<header class="page-header">
		<div>
			<h1>Contract Management</h1>
			<p class="subtitle">Manage vendor contracts, licenses, and renewals</p>
		</div>
		<div class="header-actions">
			<button
				class="btn-primary"
				onclick={() => {
					if (!showForm) {
						resetForm();
						editingId = null;
					}
					showForm = !showForm;
				}}
			>
				{showForm ? 'Cancel' : '+ Add Contract'}
			</button>
			<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
		</div>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	{#if showForm}
		<div class="contract-form">
			<h3>{editingId ? 'Edit Contract' : 'Add New Contract'}</h3>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveContract();
				}}
			>
				<div class="form-section">
					<h4>Basic Information</h4>
					<div class="form-row">
						<div class="form-group">
							<label for="name">Contract Name *</label>
							<input id="name" type="text" bind:value={name} required />
						</div>

						<div class="form-group">
							<label for="contractNumber">Contract Number</label>
							<input id="contractNumber" type="text" bind:value={contractNumber} />
						</div>

						<div class="form-group">
							<label for="vendorId">Vendor *</label>
							<select id="vendorId" bind:value={vendorId} required>
								<option value="">Select vendor...</option>
								{#each vendors as vendor}
									<option value={vendor.id}>{vendor.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="contractType">Contract Type</label>
							<select id="contractType" bind:value={contractType}>
								<option value="">Select type...</option>
								<option value="Purchase">Purchase</option>
								<option value="License">License</option>
								<option value="Subscription">Subscription</option>
								<option value="Service">Service</option>
							</select>
						</div>

						<div class="form-group">
							<label for="resourceType">Resource Type</label>
							<select id="resourceType" bind:value={resourceType}>
								<option value="">Select resource...</option>
								<option value="Database">Database</option>
								<option value="Ebook Package">Ebook Package</option>
								<option value="Journals">Journals</option>
								<option value="Software">Software</option>
								<option value="Equipment">Equipment</option>
								<option value="Other">Other</option>
							</select>
						</div>

						<div class="form-group">
							<label for="contractStatus">Status</label>
							<select id="contractStatus" bind:value={contractStatus}>
								<option value="draft">Draft</option>
								<option value="active">Active</option>
								<option value="expiring">Expiring</option>
								<option value="expired">Expired</option>
								<option value="cancelled">Cancelled</option>
							</select>
						</div>
					</div>
				</div>

				<div class="form-section">
					<h4>Dates & Renewal</h4>
					<div class="form-row">
						<div class="form-group">
							<label for="startDate">Start Date *</label>
							<input id="startDate" type="date" bind:value={startDate} required />
						</div>

						<div class="form-group">
							<label for="endDate">End Date</label>
							<input id="endDate" type="date" bind:value={endDate} />
						</div>

						<div class="form-group">
							<label for="renewalDate">Renewal Date</label>
							<input id="renewalDate" type="date" bind:value={renewalDate} />
						</div>

						<div class="form-group">
							<label for="noticePeriodDays">Notice Period (Days)</label>
							<input
								id="noticePeriodDays"
								type="number"
								bind:value={noticePeriodDays}
								min="0"
							/>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="alertBeforeRenewalDays">Alert Before Renewal (Days)</label>
							<input
								id="alertBeforeRenewalDays"
								type="number"
								bind:value={alertBeforeRenewalDays}
								min="0"
							/>
						</div>

						<div class="form-group">
							<label class="checkbox-label">
								<input type="checkbox" bind:checked={autoRenew} />
								<span>Auto-renew Contract</span>
							</label>
						</div>
					</div>
				</div>

				<div class="form-section">
					<h4>Financial Details</h4>
					<div class="form-row">
						<div class="form-group">
							<label for="contractValue">Contract Value</label>
							<input
								id="contractValue"
								type="number"
								bind:value={contractValue}
								min="0"
								step="0.01"
							/>
						</div>

						<div class="form-group">
							<label for="currency">Currency</label>
							<select id="currency" bind:value={currency}>
								<option value="USD">USD</option>
								<option value="EUR">EUR</option>
								<option value="GBP">GBP</option>
								<option value="CAD">CAD</option>
							</select>
						</div>

						<div class="form-group">
							<label for="paymentFrequency">Payment Frequency</label>
							<select id="paymentFrequency" bind:value={paymentFrequency}>
								<option value="One-time">One-time</option>
								<option value="Monthly">Monthly</option>
								<option value="Quarterly">Quarterly</option>
								<option value="Annual">Annual</option>
							</select>
						</div>

						<div class="form-group">
							<label for="budgetId">Budget</label>
							<select id="budgetId" bind:value={budgetId}>
								<option value="">Select budget...</option>
								{#each budgets as budget}
									<option value={budget.id}>
										{budget.name} {budget.code ? `(${budget.code})` : ''}
									</option>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div class="form-section">
					<h4>Terms & Notes</h4>
					<div class="form-row">
						<div class="form-group full-width">
							<label for="terms">Contract Terms</label>
							<textarea id="terms" bind:value={terms} rows="4"></textarea>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group full-width">
							<label for="contractNotes">Notes</label>
							<textarea id="contractNotes" bind:value={contractNotes} rows="3"></textarea>
						</div>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary">
						{editingId ? 'Update Contract' : 'Create Contract'}
					</button>
					<button
						type="button"
						class="btn-secondary"
						onclick={() => {
							showForm = false;
							editingId = null;
							resetForm();
						}}
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	<div class="contracts-list">
		{#if loading}
			<p class="loading">Loading contracts...</p>
		{:else if contracts.length === 0}
			<div class="empty-state">
				<p>No contracts yet. Create your first contract to start tracking vendor agreements.</p>
			</div>
		{:else}
			<h3>Contracts ({contracts.length})</h3>
			{#each contracts as contract}
				{@const daysUntilRenewal = getDaysUntilRenewal(contract.renewal_date)}
				<div class="contract-card">
					<div class="contract-header">
						<div>
							<h4>{contract.name}</h4>
							<div class="contract-meta">
								{#if contract.contract_number}
									<span class="contract-number">{contract.contract_number}</span>
									<span class="separator">•</span>
								{/if}
								<span>{contract.vendor?.name || 'N/A'}</span>
								{#if contract.contract_type}
									<span class="separator">•</span>
									<span>{contract.contract_type}</span>
								{/if}
								{#if contract.resource_type}
									<span class="separator">•</span>
									<span>{contract.resource_type}</span>
								{/if}
							</div>
						</div>
						<span class="status-badge {contract.status}">{contract.status}</span>
					</div>

					<div class="contract-details">
						<div class="detail-grid">
							<div class="detail-item">
								<strong>Start Date:</strong>
								{new Date(contract.start_date).toLocaleDateString()}
							</div>
							{#if contract.end_date}
								<div class="detail-item">
									<strong>End Date:</strong>
									{new Date(contract.end_date).toLocaleDateString()}
								</div>
							{/if}
							{#if contract.contract_value}
								<div class="detail-item">
									<strong>Value:</strong>
									${Number(contract.contract_value).toFixed(2)} {contract.currency}
								</div>
							{/if}
							<div class="detail-item">
								<strong>Payment:</strong>
								{contract.payment_frequency}
							</div>
							{#if contract.auto_renew}
								<div class="detail-item">
									<strong>Auto-renew:</strong>
									Yes
								</div>
							{/if}
						</div>

						{#if contract.renewal_date}
							<div class="renewal-info">
								<strong>Renewal Date:</strong>
								{new Date(contract.renewal_date).toLocaleDateString()}
								{#if daysUntilRenewal !== null}
									{#if daysUntilRenewal < 0}
										<span class="renewal-alert overdue">
											Overdue by {Math.abs(daysUntilRenewal)} days
										</span>
									{:else if daysUntilRenewal <= contract.alert_before_renewal_days}
										<span class="renewal-alert soon">In {daysUntilRenewal} days</span>
									{/if}
								{/if}
							</div>
						{/if}

						{#if contract.terms || contract.notes}
							<div class="contract-text">
								{#if contract.terms}
									<div>
										<strong>Terms:</strong>
										<p>{contract.terms}</p>
									</div>
								{/if}
								{#if contract.notes}
									<div>
										<strong>Notes:</strong>
										<p>{contract.notes}</p>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="contract-actions">
						<button class="btn-edit" onclick={() => editContract(contract)}>Edit</button>
						<button class="btn-delete" onclick={() => deleteContract(contract.id)}>Delete</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.contracts-page {
		max-width: 1200px;
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

	.header-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
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

	.contract-form {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
		border: 2px solid var(--accent);
	}

	h3 {
		margin: 0 0 1.5rem 0;
	}

	.form-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h4 {
		margin: 0 0 1rem 0;
		color: var(--text-muted);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-row:last-child {
		margin-bottom: 0;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	input,
	select,
	textarea {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
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

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding-top: 0.5rem;
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		margin: 0;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.contracts-list h3 {
		margin-bottom: 1.5rem;
	}

	.contract-card {
		background: white;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: 1.5rem;
	}

	.contract-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.contract-card h4 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.contract-meta {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.contract-number {
		font-weight: 600;
		color: var(--text-primary);
	}

	.separator {
		margin: 0 0.5rem;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.draft {
		background: #e2e3e5;
		color: #6c757d;
	}

	.status-badge.active {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.expiring {
		background: #fff3cd;
		color: #856404;
	}

	.status-badge.expired {
		background: #f8d7da;
		color: #721c24;
	}

	.status-badge.cancelled {
		background: #e2e3e5;
		color: #6c757d;
	}

	.contract-details {
		margin-bottom: 1rem;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.detail-item {
		font-size: 0.875rem;
	}

	.detail-item strong {
		color: var(--text-muted);
		display: block;
		margin-bottom: 0.25rem;
	}

	.renewal-info {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.renewal-alert {
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		margin-left: 0.5rem;
	}

	.renewal-alert.soon {
		background: #fff3cd;
		color: #856404;
	}

	.renewal-alert.overdue {
		background: #f8d7da;
		color: #721c24;
	}

	.contract-text {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
		margin-top: 1rem;
	}

	.contract-text div {
		margin-bottom: 1rem;
	}

	.contract-text div:last-child {
		margin-bottom: 0;
	}

	.contract-text p {
		margin: 0.5rem 0 0 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.contract-actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.btn-edit,
	.btn-delete {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.btn-edit {
		background: var(--info);
		color: white;
	}

	.btn-delete {
		background: var(--danger);
		color: white;
	}
</style>
