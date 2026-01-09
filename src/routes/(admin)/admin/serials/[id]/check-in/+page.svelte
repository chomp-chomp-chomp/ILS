<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let serialId = $derived($page.params.id);
	let serial = $state<any>(null);
	let expectedIssues = $state<any[]>([]);
	let lateIssues = $state<any[]>([]);
	let loading = $state(true);
	let currentUser = $state(''); // Would come from auth in real app

	// Quick check-in
	let quickCheckInIssue = $state<any>(null);
	let checkInDate = $state(new Date().toISOString().split('T')[0]);
	let condition = $state('good');
	let conditionNotes = $state('');
	let receivedNotes = $state('');
	let isSupplement = $state(false);
	let isSpecialIssue = $state(false);
	let supplementDescription = $state('');
	let saving = $state(false);
	let error = $state('');

	onMount(async () => {
		await loadData();
		currentUser = 'Current User'; // Would get from auth
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

		// Load expected issues (not received yet)
		const { data: expectedData } = await data.supabase
			.from('serial_issues')
			.select('*')
			.eq('serial_id', serialId)
			.eq('status', 'expected')
			.order('expected_date');

		expectedIssues = expectedData || [];

		// Load late issues
		const { data: lateData } = await data.supabase
			.from('serial_issues')
			.select('*')
			.eq('serial_id', serialId)
			.eq('status', 'late')
			.order('expected_date');

		lateIssues = lateData || [];

		loading = false;
	}

	async function checkIn(issue: any) {
		saving = true;
		error = '';

		try {
			const updates = {
				status: 'received',
				received_date: checkInDate,
				received_by: currentUser,
				condition,
				condition_notes: conditionNotes || null,
				notes: receivedNotes || null,
				is_supplement: isSupplement,
				is_special_issue: isSpecialIssue,
				supplement_description: supplementDescription || null
			};

			const { error: updateError } = await data.supabase
				.from('serial_issues')
				.update(updates)
				.eq('id', issue.id);

			if (updateError) throw updateError;

			// Reset form
			resetCheckInForm();
			quickCheckInIssue = null;

			await loadData();
		} catch (err: any) {
			error = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	function resetCheckInForm() {
		checkInDate = new Date().toISOString().split('T')[0];
		condition = 'good';
		conditionNotes = '';
		receivedNotes = '';
		isSupplement = false;
		isSpecialIssue = false;
		supplementDescription = '';
		error = '';
	}

	function selectIssueForCheckIn(issue: any) {
		quickCheckInIssue = issue;
		resetCheckInForm();
	}

	function isLate(issue: any): boolean {
		if (!issue.expected_date) return false;
		const expected = new Date(issue.expected_date);
		const today = new Date();
		const daysDiff = Math.floor((today.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
		return daysDiff > 7; // 7 day grace period
	}

	function getDaysLate(issue: any): number {
		if (!issue.expected_date) return 0;
		const expected = new Date(issue.expected_date);
		const today = new Date();
		return Math.floor((today.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
	}
</script>

<div class="checkin-page">
	<header class="page-header">
		<div>
			<a href="/admin/serials" class="back-link">← Back to Serials</a>
			<h1>{serial?.title || 'Serial'} - Check In</h1>
		</div>
	</header>

	{#if quickCheckInIssue}
		<div class="checkin-form">
			<h2>Check In: {quickCheckInIssue.display_text}</h2>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					checkIn(quickCheckInIssue);
				}}
			>
				<div class="form-row">
					<div class="form-group">
						<label for="checkInDate">Received Date *</label>
						<input id="checkInDate" type="date" bind:value={checkInDate} required />
					</div>

					<div class="form-group">
						<label for="condition">Condition *</label>
						<select id="condition" bind:value={condition}>
							<option value="excellent">Excellent</option>
							<option value="good">Good</option>
							<option value="damaged">Damaged</option>
							<option value="incomplete">Incomplete</option>
						</select>
					</div>
				</div>

				{#if condition === 'damaged' || condition === 'incomplete'}
					<div class="form-group">
						<label for="conditionNotes">Condition Notes *</label>
						<textarea
							id="conditionNotes"
							bind:value={conditionNotes}
							rows="2"
							placeholder="Describe the condition issues..."
							required
						></textarea>
					</div>
				{/if}

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={isSupplement} />
						<span>This is a supplement</span>
					</label>
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={isSpecialIssue} />
						<span>This is a special issue</span>
					</label>
				</div>

				{#if isSupplement || isSpecialIssue}
					<div class="form-group">
						<label for="supplementDescription">Description</label>
						<input
							id="supplementDescription"
							type="text"
							bind:value={supplementDescription}
							placeholder="e.g., Annual Index, Special Issue on Climate Change"
						/>
					</div>
				{/if}

				<div class="form-group">
					<label for="receivedNotes">Notes</label>
					<textarea
						id="receivedNotes"
						bind:value={receivedNotes}
						rows="3"
						placeholder="Any additional notes..."
					></textarea>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={saving}>
						{saving ? 'Checking In...' : 'Check In Issue'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (quickCheckInIssue = null)}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if loading}
		<p>Loading expected issues...</p>
	{:else}
		{#if lateIssues.length > 0}
			<section class="issues-section late-section">
				<h2>Late Issues ({lateIssues.length})</h2>
				<div class="issues-list">
					{#each lateIssues as issue}
						<div class="issue-card late">
							<div class="issue-header">
								<div>
									<h3>{issue.display_text}</h3>
									<span class="late-badge">{getDaysLate(issue)} days late</span>
								</div>
								<button class="btn-primary" onclick={() => selectIssueForCheckIn(issue)}>
									Check In
								</button>
							</div>
							<div class="issue-details">
								<span
									><strong>Expected:</strong>
									{new Date(issue.expected_date).toLocaleDateString()}</span
								>
								{#if issue.claim_count > 0}
									<span class="claimed">Claimed {issue.claim_count} time(s)</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if expectedIssues.length === 0 && lateIssues.length === 0}
			<div class="empty-state">
				<p>No issues awaiting check-in</p>
				<p class="help-text">
					Create a prediction pattern to generate expected issues, or they may all be checked in
					already.
				</p>
			</div>
		{:else if expectedIssues.length > 0}
			<section class="issues-section">
				<h2>Expected Issues ({expectedIssues.length})</h2>
				<div class="issues-list">
					{#each expectedIssues as issue}
						<div class="issue-card" class:warning={isLate(issue)}>
							<div class="issue-header">
								<div>
									<h3>{issue.display_text}</h3>
									{#if isLate(issue)}
										<span class="warning-badge">Approaching late</span>
									{/if}
								</div>
								<button class="btn-primary" onclick={() => selectIssueForCheckIn(issue)}>
									Check In
								</button>
							</div>
							<div class="issue-details">
								<span
									><strong>Expected:</strong>
									{new Date(issue.expected_date).toLocaleDateString()}</span
								>
								{#if issue.is_combined}
									<span class="badge-info">Combined Issue</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.checkin-page {
		max-width: 1200px;
	}

	.page-header {
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

	.checkin-form {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-lg);
		border: 2px solid var(--accent);
	}

	.checkin-form h2 {
		margin: 0 0 var(--space-md) 0;
		color: var(--accent);
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

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		cursor: pointer;
		font-weight: normal;
		margin-bottom: var(--space-xs);
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		margin: 0;
	}

	.error {
		background: var(--danger);
		color: white;
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
	}

	.btn-primary,
	.btn-secondary {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		border: none;
		font-size: 1rem;
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

	.issues-section {
		margin-bottom: var(--space-xl);
	}

	.issues-section h2 {
		margin: 0 0 var(--space-md) 0;
	}

	.late-section h2 {
		color: var(--danger);
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

	.issue-card.late {
		border-color: var(--danger);
		background: rgba(244, 67, 54, 0.05);
	}

	.issue-card.warning {
		border-color: var(--warning);
	}

	.issue-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-sm);
	}

	.issue-header h3 {
		margin: 0 0 var(--space-xs) 0;
		color: var(--text-primary);
	}

	.issue-details {
		display: flex;
		gap: var(--space-md);
		font-size: 0.875rem;
		color: var(--text-muted);
		flex-wrap: wrap;
		align-items: center;
	}

	.late-badge,
	.warning-badge,
	.badge-info {
		display: inline-block;
		padding: 2px var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.late-badge {
		background: var(--danger);
		color: white;
	}

	.warning-badge {
		background: var(--warning);
		color: white;
	}

	.badge-info {
		background: var(--info);
		color: white;
	}

	.claimed {
		color: var(--warning);
		font-weight: 600;
	}
</style>
