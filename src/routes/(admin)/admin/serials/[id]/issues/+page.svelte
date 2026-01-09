<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let serialId = $derived($page.params.id);
	let serial = $state<any>(null);
	let issues = $state<any[]>([]);
	let loading = $state(true);
	let filterStatus = $state('all'); // all, received, expected, late, claimed
	let searchQuery = $state('');

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;

		// Load serial
		const { data: serialData } = await supabase
			.from('serials')
			.select('*')
			.eq('id', serialId)
			.single();

		serial = serialData;

		// Load all issues
		const { data: issuesData } = await supabase
			.from('serial_issues')
			.select('*')
			.eq('serial_id', serialId)
			.order('year', { ascending: false })
			.order('volume', { ascending: false })
			.order('issue', { ascending: false });

		issues = issuesData || [];

		loading = false;
	}

	let filteredIssues = $derived(
		issues.filter((issue) => {
			// Status filter
			if (filterStatus !== 'all' && issue.status !== filterStatus) {
				return false;
			}

			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					issue.display_text?.toLowerCase().includes(query) ||
					issue.notes?.toLowerCase().includes(query) ||
					String(issue.volume).includes(query) ||
					String(issue.issue).includes(query) ||
					String(issue.year).includes(query)
				);
			}

			return true;
		})
	);

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'received':
				return 'badge-success';
			case 'expected':
				return 'badge-info';
			case 'late':
				return 'badge-warning';
			case 'claimed':
				return 'badge-danger';
			case 'missing':
				return 'badge-danger';
			case 'cancelled':
				return 'badge-muted';
			default:
				return '';
		}
	}

	function getConditionBadgeClass(condition: string): string {
		switch (condition) {
			case 'excellent':
			case 'good':
				return 'condition-good';
			case 'damaged':
				return 'condition-damaged';
			case 'incomplete':
				return 'condition-incomplete';
			default:
				return '';
		}
	}

	let stats = $derived({
		total: issues.length,
		received: issues.filter((i) => i.status === 'received').length,
		expected: issues.filter((i) => i.status === 'expected').length,
		late: issues.filter((i) => i.status === 'late').length,
		claimed: issues.filter((i) => i.status === 'claimed').length
	});
</script>

<div class="issues-page">
	<header class="page-header">
		<div>
			<a href="/admin/serials" class="back-link">← Back to Serials</a>
			<h1>{serial?.title || 'Serial'} - Issues</h1>
		</div>
		<div class="header-actions">
			<a href="/admin/serials/{serialId}/check-in" class="btn-primary">Check In Issue</a>
			<a href="/admin/serials/{serialId}/patterns" class="btn-secondary">Manage Patterns</a>
		</div>
	</header>

	<div class="stats-bar">
		<div class="stat">
			<span class="stat-value">{stats.total}</span>
			<span class="stat-label">Total Issues</span>
		</div>
		<div class="stat stat-success">
			<span class="stat-value">{stats.received}</span>
			<span class="stat-label">Received</span>
		</div>
		<div class="stat stat-info">
			<span class="stat-value">{stats.expected}</span>
			<span class="stat-label">Expected</span>
		</div>
		{#if stats.late > 0}
			<div class="stat stat-warning">
				<span class="stat-value">{stats.late}</span>
				<span class="stat-label">Late</span>
			</div>
		{/if}
		{#if stats.claimed > 0}
			<div class="stat stat-danger">
				<span class="stat-value">{stats.claimed}</span>
				<span class="stat-label">Claimed</span>
			</div>
		{/if}
	</div>

	<div class="filters-bar">
		<div class="filter-group">
			<label for="filterStatus">Status:</label>
			<select id="filterStatus" bind:value={filterStatus}>
				<option value="all">All ({issues.length})</option>
				<option value="received">Received ({stats.received})</option>
				<option value="expected">Expected ({stats.expected})</option>
				<option value="late">Late ({stats.late})</option>
				<option value="claimed">Claimed ({stats.claimed})</option>
			</select>
		</div>

		<div class="search-group">
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Search issues..."
				class="search-input"
			/>
		</div>
	</div>

	{#if loading}
		<p>Loading issues...</p>
	{:else if filteredIssues.length === 0}
		<div class="empty-state">
			<p>No issues found</p>
			{#if searchQuery || filterStatus !== 'all'}
				<p class="help-text">Try adjusting your filters</p>
			{:else}
				<p class="help-text">Create a prediction pattern to generate expected issues</p>
			{/if}
		</div>
	{:else}
		<div class="issues-list">
			{#each filteredIssues as issue}
				<div class="issue-card">
					<div class="issue-header">
						<div class="issue-title">
							<h3>{issue.display_text}</h3>
							<div class="issue-badges">
								<span class="badge {getStatusBadgeClass(issue.status)}">
									{issue.status}
								</span>
								{#if issue.is_supplement}
									<span class="badge badge-supplement">Supplement</span>
								{/if}
								{#if issue.is_special_issue}
									<span class="badge badge-special">Special Issue</span>
								{/if}
								{#if issue.is_combined}
									<span class="badge badge-combined">Combined</span>
								{/if}
							</div>
						</div>
						{#if issue.status === 'received' && issue.condition}
							<span class="condition-badge {getConditionBadgeClass(issue.condition)}">
								{issue.condition}
							</span>
						{/if}
					</div>

					<div class="issue-details">
						<div class="detail-grid">
							<div class="detail-item">
								<span class="detail-label">Volume/Issue</span>
								<span class="detail-value">Vol. {issue.volume} No. {issue.issue}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Date</span>
								<span class="detail-value"
									>{issue.year}{issue.month ? `/${issue.month}` : ''}</span
								>
							</div>
							{#if issue.expected_date}
								<div class="detail-item">
									<span class="detail-label">Expected</span>
									<span class="detail-value"
										>{new Date(issue.expected_date).toLocaleDateString()}</span
									>
								</div>
							{/if}
							{#if issue.received_date}
								<div class="detail-item">
									<span class="detail-label">Received</span>
									<span class="detail-value"
										>{new Date(issue.received_date).toLocaleDateString()}</span
									>
								</div>
							{/if}
							{#if issue.received_by}
								<div class="detail-item">
									<span class="detail-label">Received By</span>
									<span class="detail-value">{issue.received_by}</span>
								</div>
							{/if}
							{#if issue.binding_status && issue.binding_status !== 'unbound'}
								<div class="detail-item">
									<span class="detail-label">Binding Status</span>
									<span class="detail-value">{issue.binding_status}</span>
								</div>
							{/if}
							{#if issue.claim_count > 0}
								<div class="detail-item">
									<span class="detail-label">Claims</span>
									<span class="detail-value claim-count">{issue.claim_count}</span>
								</div>
							{/if}
						</div>

						{#if issue.supplement_description}
							<p class="supplement-desc"><strong>Description:</strong> {issue.supplement_description}</p>
						{/if}

						{#if issue.condition_notes}
							<p class="condition-notes"><strong>Condition Notes:</strong> {issue.condition_notes}</p>
						{/if}

						{#if issue.notes}
							<p class="issue-notes"><strong>Notes:</strong> {issue.notes}</p>
						{/if}
					</div>

					<div class="issue-actions">
						{#if issue.status === 'expected' || issue.status === 'late'}
							<a href="/admin/serials/{serialId}/check-in">Check In</a>
						{/if}
						{#if issue.status === 'late' || issue.status === 'claimed'}
							<a href="/admin/serials/{serialId}/claims?issue={issue.id}">View Claims</a>
						{/if}
						{#if issue.status === 'received' && issue.binding_status === 'unbound'}
							<a href="/admin/serials/{serialId}/binding">Add to Binding</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.issues-page {
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

	.header-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.btn-primary,
	.btn-secondary {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		border: none;
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
		transition: var(--transition-smooth);
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-primary:hover {
		background: var(--accent-hover);
	}

	.btn-secondary {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--bg-primary);
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

	.filters-bar {
		display: flex;
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
		align-items: center;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.filter-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.filter-group select {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.search-group {
		flex: 1;
		max-width: 400px;
	}

	.search-input {
		width: 100%;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
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

	.issues-list {
		display: grid;
		gap: var(--space-md);
	}

	.issue-card {
		background: var(--bg-secondary);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.issue-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-md);
	}

	.issue-title h3 {
		margin: 0 0 var(--space-xs) 0;
		color: var(--text-primary);
	}

	.issue-badges {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.badge {
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

	.badge-danger {
		background: var(--danger);
		color: white;
	}

	.badge-muted {
		background: var(--text-muted);
		color: white;
	}

	.badge-supplement,
	.badge-special,
	.badge-combined {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	.condition-badge {
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.condition-good {
		background: var(--success);
		color: white;
	}

	.condition-damaged {
		background: var(--warning);
		color: white;
	}

	.condition-incomplete {
		background: var(--danger);
		color: white;
	}

	.issue-details {
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

	.claim-count {
		color: var(--warning);
		font-weight: 600;
	}

	.supplement-desc,
	.condition-notes,
	.issue-notes {
		margin-top: var(--space-sm);
		padding: var(--space-sm);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.issue-actions {
		display: flex;
		gap: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border);
	}

	.issue-actions a {
		color: var(--accent);
		text-decoration: none;
		font-size: 0.875rem;
		transition: var(--transition-smooth);
	}

	.issue-actions a:hover {
		text-decoration: underline;
	}
</style>
