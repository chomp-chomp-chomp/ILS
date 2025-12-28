<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let budgets = $state<any[]>([]);
	let loading = $state(true);
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let message = $state('');

	// Form fields
	let name = $state('');
	let code = $state('');
	let fiscalYear = $state(new Date().getFullYear());
	let allocatedAmount = $state(0);
	let category = $state('');
	let department = $state('');
	let budgetStatus = $state('active');
	let notes = $state('');

	onMount(async () => {
		await loadBudgets();
	});

	async function loadBudgets() {
		loading = true;
		const { data: budgetsData } = await data.supabase
			.from('budgets')
			.select('*')
			.order('fiscal_year', { ascending: false })
			.order('name');

		budgets = budgetsData || [];
		loading = false;
	}

	function resetForm() {
		name = '';
		code = '';
		fiscalYear = new Date().getFullYear();
		allocatedAmount = 0;
		category = '';
		department = '';
		budgetStatus = 'active';
		notes = '';
	}

	function editBudget(budget: any) {
		editingId = budget.id;
		showForm = true;
		name = budget.name || '';
		code = budget.code || '';
		fiscalYear = budget.fiscal_year || new Date().getFullYear();
		allocatedAmount = Number(budget.allocated_amount) || 0;
		category = budget.category || '';
		department = budget.department || '';
		budgetStatus = budget.status || 'active';
		notes = budget.notes || '';
	}

	async function saveBudget() {
		if (!name.trim()) {
			message = 'Budget name is required';
			return;
		}

		if (allocatedAmount <= 0) {
			message = 'Allocated amount must be greater than zero';
			return;
		}

		const budgetData = {
			name: name.trim(),
			code: code.trim() || null,
			fiscal_year: fiscalYear,
			allocated_amount: allocatedAmount,
			category: category.trim() || null,
			department: department.trim() || null,
			status: budgetStatus,
			notes: notes.trim() || null
		};

		try {
			if (editingId) {
				const { error } = await data.supabase
					.from('budgets')
					.update(budgetData)
					.eq('id', editingId);

				if (error) throw error;
				message = 'Budget updated successfully!';
			} else {
				const { error } = await data.supabase.from('budgets').insert([budgetData]);

				if (error) throw error;
				message = 'Budget created successfully!';
			}

			showForm = false;
			editingId = null;
			resetForm();
			await loadBudgets();

			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function deleteBudget(budgetId: string) {
		if (!confirm('Are you sure you want to delete this budget?')) return;

		try {
			const { error } = await data.supabase.from('budgets').delete().eq('id', budgetId);

			if (error) throw error;

			message = 'Budget deleted successfully!';
			await loadBudgets();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	function calculateAvailable(budget: any) {
		const allocated = Number(budget.allocated_amount) || 0;
		const spent = Number(budget.spent_amount) || 0;
		const encumbered = Number(budget.encumbered_amount) || 0;
		return allocated - spent - encumbered;
	}

	function calculatePercentage(amount: number, total: number) {
		return total > 0 ? (amount / total) * 100 : 0;
	}
</script>

<div class="budgets-page">
	<header class="page-header">
		<div>
			<h1>Budget Management</h1>
			<p class="subtitle">Track budget allocations, spending, and encumbrances</p>
		</div>
		<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<div class="actions-bar">
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
			{showForm ? 'Cancel' : '+ Add Budget'}
		</button>
	</div>

	{#if showForm}
		<div class="budget-form">
			<h3>{editingId ? 'Edit Budget' : 'Add New Budget'}</h3>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveBudget();
				}}
			>
				<div class="form-row">
					<div class="form-group">
						<label for="name">Budget Name *</label>
						<input id="name" type="text" bind:value={name} required />
					</div>

					<div class="form-group">
						<label for="code">Budget Code</label>
						<input id="code" type="text" bind:value={code} placeholder="Optional code" />
					</div>

					<div class="form-group">
						<label for="fiscalYear">Fiscal Year *</label>
						<input id="fiscalYear" type="number" bind:value={fiscalYear} min="2000" max="2100" />
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="allocatedAmount">Allocated Amount *</label>
						<input
							id="allocatedAmount"
							type="number"
							bind:value={allocatedAmount}
							min="0"
							step="0.01"
							required
						/>
					</div>

					<div class="form-group">
						<label for="category">Category</label>
						<select id="category" bind:value={category}>
							<option value="">Select category...</option>
							<option value="Books">Books</option>
							<option value="Serials">Serials</option>
							<option value="Digital Resources">Digital Resources</option>
							<option value="Media">Media</option>
							<option value="Equipment">Equipment</option>
							<option value="Other">Other</option>
						</select>
					</div>

					<div class="form-group">
						<label for="department">Department</label>
						<input id="department" type="text" bind:value={department} />
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="budgetStatus">Status</label>
						<select id="budgetStatus" bind:value={budgetStatus}>
							<option value="active">Active</option>
							<option value="closed">Closed</option>
							<option value="frozen">Frozen</option>
						</select>
					</div>
				</div>

				<div class="form-row">
					<div class="form-group full-width">
						<label for="notes">Notes</label>
						<textarea id="notes" bind:value={notes} rows="3"></textarea>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary">
						{editingId ? 'Update Budget' : 'Create Budget'}
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

	<div class="budgets-list">
		{#if loading}
			<p class="loading">Loading budgets...</p>
		{:else if budgets.length === 0}
			<div class="empty-state">
				<p>No budgets yet. Create your first budget to start tracking spending.</p>
			</div>
		{:else}
			<h3>Budgets ({budgets.length})</h3>
			{#each budgets as budget}
				{@const allocated = Number(budget.allocated_amount) || 0}
				{@const spent = Number(budget.spent_amount) || 0}
				{@const encumbered = Number(budget.encumbered_amount) || 0}
				{@const available = calculateAvailable(budget)}
				{@const spentPct = calculatePercentage(spent, allocated)}
				{@const encumberedPct = calculatePercentage(encumbered, allocated)}
				{@const availablePct = calculatePercentage(available, allocated)}

				<div class="budget-card">
					<div class="budget-header">
						<div>
							<h4>{budget.name}</h4>
							<div class="budget-meta">
								<span>FY {budget.fiscal_year}</span>
								{#if budget.code}
									<span class="separator">•</span>
									<span class="budget-code">{budget.code}</span>
								{/if}
								{#if budget.category}
									<span class="separator">•</span>
									<span>{budget.category}</span>
								{/if}
								{#if budget.department}
									<span class="separator">•</span>
									<span>{budget.department}</span>
								{/if}
							</div>
						</div>
						<span class="status-badge {budget.status}">{budget.status}</span>
					</div>

					<div class="budget-amounts">
						<div class="amount-item">
							<div class="amount-label">Allocated</div>
							<div class="amount-value">${allocated.toFixed(2)}</div>
						</div>
						<div class="amount-item spent">
							<div class="amount-label">Spent</div>
							<div class="amount-value">${spent.toFixed(2)}</div>
							<div class="amount-percentage">{spentPct.toFixed(1)}%</div>
						</div>
						<div class="amount-item encumbered">
							<div class="amount-label">Encumbered</div>
							<div class="amount-value">${encumbered.toFixed(2)}</div>
							<div class="amount-percentage">{encumberedPct.toFixed(1)}%</div>
						</div>
						<div class="amount-item available">
							<div class="amount-label">Available</div>
							<div class="amount-value">${available.toFixed(2)}</div>
							<div class="amount-percentage">{availablePct.toFixed(1)}%</div>
						</div>
					</div>

					<div class="budget-progress">
						<div class="progress-bar">
							<div class="progress-segment spent" style="width: {spentPct}%"></div>
							<div class="progress-segment encumbered" style="width: {encumberedPct}%"></div>
							<div class="progress-segment available" style="width: {availablePct}%"></div>
						</div>
						<div class="progress-legend">
							<span class="legend-item spent">Spent</span>
							<span class="legend-item encumbered">Encumbered</span>
							<span class="legend-item available">Available</span>
						</div>
					</div>

					{#if budget.notes}
						<div class="budget-notes">
							<strong>Notes:</strong>
							{budget.notes}
						</div>
					{/if}

					<div class="budget-actions">
						<button class="btn-edit" onclick={() => editBudget(budget)}>Edit</button>
						<button class="btn-delete" onclick={() => deleteBudget(budget.id)}>Delete</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.budgets-page {
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

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: var(--transition-smooth);
	}

	.btn-back:hover {
		background: var(--border);
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

	.actions-bar {
		margin-bottom: 2rem;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
		transition: var(--transition-smooth);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
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

	.budget-form {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
		border: 2px solid var(--accent);
	}

	.budget-form h3 {
		margin: 0 0 1.5rem 0;
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

	.budgets-list h3 {
		margin: 0 0 1.5rem 0;
	}

	.budget-card {
		background: white;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: 1.5rem;
	}

	.budget-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.budget-card h4 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	.budget-meta {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.budget-code {
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

	.status-badge.active {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.closed {
		background: #e2e3e5;
		color: #6c757d;
	}

	.status-badge.frozen {
		background: #cce5ff;
		color: #004085;
	}

	.budget-amounts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.amount-item {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
	}

	.amount-item.spent {
		background: #fee;
	}

	.amount-item.encumbered {
		background: #fff7ed;
	}

	.amount-item.available {
		background: #d4edda;
	}

	.amount-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		margin-bottom: 0.25rem;
	}

	.amount-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.amount-percentage {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.budget-progress {
		margin-bottom: 1rem;
	}

	.progress-bar {
		height: 32px;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		overflow: hidden;
		display: flex;
	}

	.progress-segment {
		height: 100%;
		transition: width 0.3s ease;
	}

	.progress-segment.spent {
		background: var(--accent);
	}

	.progress-segment.encumbered {
		background: #f59e0b;
	}

	.progress-segment.available {
		background: #10b981;
	}

	.progress-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 0.75rem;
		font-size: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-item::before {
		content: '';
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-item.spent::before {
		background: var(--accent);
	}

	.legend-item.encumbered::before {
		background: #f59e0b;
	}

	.legend-item.available::before {
		background: #10b981;
	}

	.budget-notes {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.budget-actions {
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
		transition: var(--transition-smooth);
	}

	.btn-edit {
		background: var(--info);
		color: white;
	}

	.btn-edit:hover {
		background: var(--info-hover);
	}

	.btn-delete {
		background: var(--danger);
		color: white;
	}

	.btn-delete:hover {
		background: var(--danger-hover);
	}
</style>
