<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let serialId = $derived($page.params.id);
	let serial = $state<any>(null);
	let patterns = $state<any[]>([]);
	let loading = $state(true);
	let showNewPattern = $state(false);

	// Form state
	let patternName = $state('');
	let frequency = $state('monthly');
	let issuesPerYear = $state(12);
	let enumType = $state('sequential');
	let volumeStart = $state(1);
	let volumeIncrement = $state(1);
	let issueStart = $state(1);
	let issueIncrement = $state(1);
	let resetIssueOnVolumeChange = $state(true);
	let chronType = $state('year_month');
	let seasonPattern = $state('');
	let allowCombinedIssues = $state(false);
	let startDate = $state('');
	let endDate = $state('');
	let generateAheadMonths = $state(12);
	let displayTemplate = $state('Vol. {volume} No. {issue} ({month} {year})');
	let patternNotes = $state('');
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

		// Load patterns
		const { data: patternsData } = await data.supabase
			.from('serial_prediction_patterns')
			.select('*')
			.eq('serial_id', serialId)
			.order('created_at', { ascending: false });

		patterns = patternsData || [];

		loading = false;
	}

	async function savePattern() {
		saving = true;
		error = '';

		try {
			const patternData = {
				serial_id: serialId,
				name: patternName,
				is_active: true,
				frequency,
				issues_per_year: issuesPerYear,
				enum_type: enumType,
				volume_start: volumeStart,
				volume_increment: volumeIncrement,
				issue_start: issueStart,
				issue_increment: issueIncrement,
				reset_issue_on_volume_change: resetIssueOnVolumeChange,
				chron_type: chronType,
				season_pattern: seasonPattern || null,
				allow_combined_issues: allowCombinedIssues,
				start_date: startDate,
				end_date: endDate || null,
				generate_ahead_months: generateAheadMonths,
				display_template: displayTemplate,
				notes: patternNotes || null
			};

			const { data: insertedPattern, error: insertError } = await data.supabase
				.from('serial_prediction_patterns')
				.insert([patternData])
				.select()
				.single();

			if (insertError) throw insertError;

			// Generate predicted issues
			if (insertedPattern) {
				const { error: rpcError } = await data.supabase.rpc('generate_predicted_issues', {
					p_pattern_id: insertedPattern.id,
					p_months_ahead: generateAheadMonths
				});

				if (rpcError) {
					console.error('Error generating issues:', rpcError);
				}
			}

			// Reset form
			resetForm();
			showNewPattern = false;
			await loadData();
		} catch (err: any) {
			error = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	function resetForm() {
		patternName = '';
		frequency = 'monthly';
		issuesPerYear = 12;
		enumType = 'sequential';
		volumeStart = 1;
		volumeIncrement = 1;
		issueStart = 1;
		issueIncrement = 1;
		resetIssueOnVolumeChange = true;
		chronType = 'year_month';
		seasonPattern = '';
		allowCombinedIssues = false;
		startDate = '';
		endDate = '';
		generateAheadMonths = 12;
		displayTemplate = 'Vol. {volume} No. {issue} ({month} {year})';
		patternNotes = '';
		error = '';
	}

	async function togglePatternActive(pattern: any) {
		await data.supabase
			.from('serial_prediction_patterns')
			.update({ is_active: !pattern.is_active })
			.eq('id', pattern.id);

		await loadData();
	}

	async function deletePattern(patternId: string) {
		if (!confirm('Are you sure you want to delete this pattern? This will not delete already generated issues.')) {
			return;
		}

		await data.supabase.from('serial_prediction_patterns').delete().eq('id', patternId);

		await loadData();
	}

	async function generateIssues(patternId: string) {
		try {
			const { error: rpcError } = await data.supabase.rpc('generate_predicted_issues', {
				p_pattern_id: patternId,
				p_months_ahead: 12
			});

			if (rpcError) throw rpcError;

			alert('Issues generated successfully!');
		} catch (err: any) {
			alert(`Error: ${err.message}`);
		}
	}

	function updateFrequencyDefaults() {
		switch (frequency) {
			case 'daily':
				issuesPerYear = 365;
				break;
			case 'weekly':
				issuesPerYear = 52;
				break;
			case 'monthly':
				issuesPerYear = 12;
				break;
			case 'quarterly':
				issuesPerYear = 4;
				seasonPattern = 'quarterly';
				break;
			case 'annual':
				issuesPerYear = 1;
				break;
			default:
				issuesPerYear = 12;
		}
	}
</script>

<div class="patterns-page">
	<header class="page-header">
		<div>
			<a href="/admin/serials" class="back-link">← Back to Serials</a>
			<h1>{serial?.title || 'Serial'} - Prediction Patterns</h1>
		</div>
		<button class="btn-primary" onclick={() => (showNewPattern = !showNewPattern)}>
			{showNewPattern ? 'Cancel' : 'New Pattern'}
		</button>
	</header>

	{#if showNewPattern}
		<div class="pattern-form">
			<h2>Create Prediction Pattern</h2>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					savePattern();
				}}
			>
				<section class="form-section">
					<h3>Basic Information</h3>

					<div class="form-group">
						<label for="patternName">Pattern Name *</label>
						<input
							id="patternName"
							type="text"
							bind:value={patternName}
							required
							placeholder="e.g., Current Volume Pattern"
						/>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="frequency">Frequency *</label>
							<select
								id="frequency"
								bind:value={frequency}
								onchange={updateFrequencyDefaults}
							>
								<option value="daily">Daily</option>
								<option value="weekly">Weekly</option>
								<option value="monthly">Monthly</option>
								<option value="quarterly">Quarterly</option>
								<option value="annual">Annual</option>
								<option value="irregular">Irregular</option>
							</select>
						</div>

						<div class="form-group">
							<label for="issuesPerYear">Issues Per Year</label>
							<input id="issuesPerYear" type="number" bind:value={issuesPerYear} min="1" />
						</div>
					</div>
				</section>

				<section class="form-section">
					<h3>Enumeration (Volume/Issue Numbering)</h3>

					<div class="form-group">
						<label for="enumType">Enumeration Type</label>
						<select id="enumType" bind:value={enumType}>
							<option value="sequential">Sequential (Vol. 1, 2, 3...)</option>
							<option value="calendar">Calendar Year Based</option>
							<option value="seasonal">Seasonal</option>
							<option value="custom">Custom</option>
						</select>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="volumeStart">Volume Start</label>
							<input id="volumeStart" type="number" bind:value={volumeStart} min="1" />
						</div>

						<div class="form-group">
							<label for="volumeIncrement">Volume Increment</label>
							<input
								id="volumeIncrement"
								type="number"
								bind:value={volumeIncrement}
								min="1"
							/>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="issueStart">Issue Start</label>
							<input id="issueStart" type="number" bind:value={issueStart} min="1" />
						</div>

						<div class="form-group">
							<label for="issueIncrement">Issue Increment</label>
							<input
								id="issueIncrement"
								type="number"
								bind:value={issueIncrement}
								min="1"
							/>
						</div>
					</div>

					<div class="form-group">
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={resetIssueOnVolumeChange} />
							<span>Reset issue number when volume changes</span>
						</label>
					</div>
				</section>

				<section class="form-section">
					<h3>Chronology & Display</h3>

					<div class="form-group">
						<label for="chronType">Chronology Type</label>
						<select id="chronType" bind:value={chronType}>
							<option value="year">Year Only</option>
							<option value="year_month">Year & Month</option>
							<option value="year_season">Year & Season</option>
							<option value="custom">Custom</option>
						</select>
					</div>

					{#if frequency === 'quarterly' || chronType === 'year_season'}
						<div class="form-group">
							<label for="seasonPattern">Season Pattern</label>
							<select id="seasonPattern" bind:value={seasonPattern}>
								<option value="">None</option>
								<option value="quarterly">Quarterly (Q1, Q2, Q3, Q4)</option>
								<option value="spring_summer_fall_winter"
									>Spring/Summer/Fall/Winter</option
								>
							</select>
						</div>
					{/if}

					<div class="form-group">
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={allowCombinedIssues} />
							<span>Allow combined issues (e.g., July/August)</span>
						</label>
					</div>

					<div class="form-group">
						<label for="displayTemplate">Display Template</label>
						<input
							id="displayTemplate"
							type="text"
							bind:value={displayTemplate}
							placeholder="Vol. {volume} No. {issue} ({month} {year})"
						/>
						<small
							>Use placeholders: {'{'}volume{'}'}, {'{'}issue{'}'}, {'{'}year{'}'}, {'{'}month{'}'}</small
						>
					</div>
				</section>

				<section class="form-section">
					<h3>Schedule</h3>

					<div class="form-row">
						<div class="form-group">
							<label for="startDate">Start Date *</label>
							<input id="startDate" type="date" bind:value={startDate} required />
						</div>

						<div class="form-group">
							<label for="endDate">End Date (optional)</label>
							<input id="endDate" type="date" bind:value={endDate} />
						</div>
					</div>

					<div class="form-group">
						<label for="generateAheadMonths">Generate Issues Ahead (months)</label>
						<input
							id="generateAheadMonths"
							type="number"
							bind:value={generateAheadMonths}
							min="1"
							max="60"
						/>
						<small>How many months in advance to generate expected issues</small>
					</div>

					<div class="form-group">
						<label for="patternNotes">Notes</label>
						<textarea id="patternNotes" bind:value={patternNotes} rows="3"></textarea>
					</div>
				</section>

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={saving || !patternName || !startDate}>
						{saving ? 'Creating...' : 'Create Pattern & Generate Issues'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (showNewPattern = false)}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if loading}
		<p>Loading patterns...</p>
	{:else if patterns.length === 0}
		<div class="empty-state">
			<p>No prediction patterns created yet</p>
			<p class="help-text">
				Create a prediction pattern to automatically generate expected issues for this serial.
			</p>
		</div>
	{:else}
		<div class="patterns-list">
			{#each patterns as pattern}
				<div class="pattern-card">
					<div class="pattern-header">
						<div>
							<h3>{pattern.name}</h3>
							<span class="badge {pattern.is_active ? 'badge-active' : 'badge-inactive'}">
								{pattern.is_active ? 'Active' : 'Inactive'}
							</span>
						</div>
						<div class="pattern-actions">
							<button
								class="btn-icon"
								onclick={() => togglePatternActive(pattern)}
								title={pattern.is_active ? 'Deactivate' : 'Activate'}
							>
								{pattern.is_active ? '⏸' : '▶'}
							</button>
							<button
								class="btn-icon"
								onclick={() => generateIssues(pattern.id)}
								title="Generate more issues"
							>
								🔄
							</button>
							<button
								class="btn-icon btn-danger"
								onclick={() => deletePattern(pattern.id)}
								title="Delete pattern"
							>
								🗑
							</button>
						</div>
					</div>

					<div class="pattern-details">
						<div class="detail-grid">
							<div class="detail-item">
								<span class="detail-label">Frequency</span>
								<span class="detail-value">{pattern.frequency}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Issues/Year</span>
								<span class="detail-value">{pattern.issues_per_year}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Start Date</span>
								<span class="detail-value"
									>{new Date(pattern.start_date).toLocaleDateString()}</span
								>
							</div>
							{#if pattern.end_date}
								<div class="detail-item">
									<span class="detail-label">End Date</span>
									<span class="detail-value"
										>{new Date(pattern.end_date).toLocaleDateString()}</span
									>
								</div>
							{/if}
						</div>

						<div class="template-preview">
							<span class="detail-label">Display Template:</span>
							<code>{pattern.display_template}</code>
						</div>

						{#if pattern.notes}
							<p class="pattern-notes">{pattern.notes}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.patterns-page {
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

	.pattern-form {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-lg);
		border: 1px solid var(--border);
	}

	.pattern-form h2 {
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
		color: var(--text-primary);
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

	small {
		display: block;
		margin-top: var(--space-xs);
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		cursor: pointer;
		font-weight: normal;
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
	.btn-secondary,
	.btn-icon {
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

	.btn-icon {
		padding: var(--space-xs) var(--space-sm);
		background: var(--bg-primary);
		border: 1px solid var(--border);
		font-size: 1.2rem;
	}

	.btn-icon:hover {
		background: var(--bg-secondary);
	}

	.btn-danger:hover {
		background: var(--danger);
		color: white;
		border-color: var(--danger);
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

	.patterns-list {
		display: grid;
		gap: var(--space-md);
	}

	.pattern-card {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.pattern-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-md);
	}

	.pattern-header h3 {
		margin: 0 0 var(--space-xs) 0;
		display: inline-block;
		margin-right: var(--space-sm);
	}

	.badge {
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-lg);
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 600;
	}

	.badge-active {
		background: var(--success);
		color: white;
	}

	.badge-inactive {
		background: var(--text-muted);
		color: white;
	}

	.pattern-actions {
		display: flex;
		gap: var(--space-xs);
	}

	.pattern-details {
		margin-top: var(--space-md);
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
		margin-bottom: var(--space-xs);
	}

	.detail-value {
		font-weight: 500;
		color: var(--text-primary);
	}

	.template-preview {
		margin-top: var(--space-md);
		padding: var(--space-md);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
	}

	.template-preview code {
		color: var(--accent);
		font-family: 'Courier New', monospace;
	}

	.pattern-notes {
		margin-top: var(--space-md);
		font-size: 0.875rem;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
