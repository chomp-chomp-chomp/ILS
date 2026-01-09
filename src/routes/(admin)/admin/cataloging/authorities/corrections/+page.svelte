<script lang="ts">
	import { onMount } from 'svelte';

	let loading = $state(false);
	let unauthorized = $state<any[]>([]);
	let selectedField = $state('');
	let corrections = $state<Map<string, any>>(new Map());
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');

	const fields = [
		{ value: '', label: 'All Fields' },
		{ value: '100', label: '100 - Personal Names' },
		{ value: '650', label: '650 - Subject Headings' }
	];

	async function findUnauthorized() {
		loading = true;
		message = '';

		try {
			const params = new URLSearchParams();
			if (selectedField) params.set('field', selectedField);
			params.set('limit', '100');

			const response = await fetch(`/api/authorities/unauthorized?${params.toString()}`);

			if (!response.ok) {
				throw new Error('Failed to fetch unauthorized headings');
			}

			const data = await response.json();
			unauthorized = data.unauthorized || [];

			if (unauthorized.length === 0) {
				message = 'No unauthorized headings found! All headings are linked to authorities.';
				messageType = 'success';
			} else {
				message = `Found ${unauthorized.length} unauthorized headings with suggested corrections.`;
				messageType = 'info';
			}
		} catch (error: any) {
			message = error.message || 'Failed to find unauthorized headings';
			messageType = 'error';
		} finally {
			loading = false;
		}
	}

	function toggleCorrection(item: any, apply: boolean) {
		const key = item.marc_record_id + item.field + (item.field_index ?? 0);
		if (apply) {
			corrections.set(key, {
				marc_record_id: item.marc_record_id,
				field: item.field,
				field_index: item.field_index ?? 0,
				authority_id: item.suggested_authority_id,
				old_heading: item.heading,
				new_heading: item.suggested_heading
			});
		} else {
			corrections.delete(key);
		}
		corrections = corrections; // Trigger reactivity
	}

	function selectAll() {
		unauthorized.forEach((item) => {
			if (item.suggested_authority_id && item.confidence > 0.8) {
				toggleCorrection(item, true);
			}
		});
	}

	function deselectAll() {
		corrections.clear();
		corrections = corrections;
	}

	async function applyCorrections() {
		if (corrections.size === 0) {
			message = 'No corrections selected';
			messageType = 'error';
			return;
		}

		const confirmMsg = `Apply ${corrections.size} correction(s)?\n\nThis will:\n1. Link headings to authorities\n2. Update MARC record headings to match authorized forms\n\nThis action cannot be undone.`;

		if (!confirm(confirmMsg)) {
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/authorities/unauthorized', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					corrections: Array.from(corrections.values())
				})
			});

			if (!response.ok) {
				throw new Error('Failed to apply corrections');
			}

			const result = await response.json();

			message = `Applied ${result.success} correction(s) successfully. ${result.failed} failed.`;
			messageType = result.failed > 0 ? 'info' : 'success';

			if (result.errors && result.errors.length > 0) {
				console.error('Correction errors:', result.errors);
			}

			// Refresh the list
			corrections.clear();
			corrections = corrections;
			await findUnauthorized();
		} catch (error: any) {
			message = error.message || 'Failed to apply corrections';
			messageType = 'error';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		findUnauthorized();
	});
</script>

<svelte:head>
	<title>Batch Authority Corrections - Admin</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>Batch Authority Corrections</h1>
		<p>Find and correct unauthorized headings in MARC records</p>
	</header>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<div class="controls">
		<div class="filter-group">
			<label for="field-filter">Field:</label>
			<select id="field-filter" bind:value={selectedField}>
				{#each fields as field}
					<option value={field.value}>{field.label}</option>
				{/each}
			</select>
		</div>

		<button class="btn-primary" onclick={findUnauthorized} disabled={loading}>
			{loading ? 'Searching...' : 'Find Unauthorized Headings'}
		</button>

		{#if unauthorized.length > 0}
			<div class="selection-controls">
				<button class="btn-secondary" onclick={selectAll}>
					Select All (>80% confidence)
				</button>
				<button class="btn-secondary" onclick={deselectAll}>Deselect All</button>
				<button
					class="btn-primary"
					onclick={applyCorrections}
					disabled={loading || corrections.size === 0}
				>
					Apply {corrections.size} Correction(s)
				</button>
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="loading">
			<p>Loading...</p>
		</div>
	{:else if unauthorized.length === 0}
		<div class="no-results">
			<p>No unauthorized headings found.</p>
			<p>This means all headings in your catalog are linked to authority records.</p>
		</div>
	{:else}
		<div class="corrections-table">
			<p class="table-info">
				Review the suggestions below. High confidence matches (>80%) are safe to auto-apply.
			</p>

			<table>
				<thead>
					<tr>
						<th>Apply</th>
						<th>Current Heading</th>
						<th>Suggested Authorized Form</th>
						<th>Confidence</th>
						<th>Field</th>
					</tr>
				</thead>
				<tbody>
					{#each unauthorized as item}
						{@const key = item.marc_record_id + item.field + (item.field_index ?? 0)}
						{@const isSelected = corrections.has(key)}
						{@const confidence = Math.round(item.confidence * 100)}
						<tr class:selected={isSelected} class:high-confidence={confidence >= 80}>
							<td>
								<input
									type="checkbox"
									checked={isSelected}
									onchange={(e) => toggleCorrection(item, e.currentTarget.checked)}
									disabled={!item.suggested_authority_id}
								/>
							</td>
							<td>
								<div class="heading-info">
									<strong>{item.heading}</strong>
									<a
										href="/admin/cataloging/edit/{item.marc_record_id}"
										class="record-link"
										target="_blank"
									>
										View Record
									</a>
								</div>
							</td>
							<td>
								{#if item.suggested_heading}
									<div class="suggested-heading">
										<strong>{item.suggested_heading}</strong>
										{#if item.heading !== item.suggested_heading}
											<span class="change-indicator">Will be updated</span>
										{/if}
									</div>
								{:else}
									<span class="no-suggestion">No suggestion available</span>
								{/if}
							</td>
							<td>
								<div class="confidence-badge confidence-{Math.floor(confidence / 20) * 20}">
									{confidence}%
								</div>
							</td>
							<td>
								<span class="field-badge">{item.field}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 20px;
	}

	.page-header {
		margin-bottom: 30px;
	}

	.page-header h1 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.page-header p {
		margin: 0;
		color: #666;
	}

	.message {
		padding: 12px 20px;
		margin-bottom: 20px;
		border-radius: 4px;
		border-left: 4px solid;
	}

	.message.success {
		background: #d4edda;
		border-color: #28a745;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border-color: #dc3545;
		color: #721c24;
	}

	.message.info {
		background: #d1ecf1;
		border-color: #17a2b8;
		color: #0c5460;
	}

	.controls {
		background: white;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 30px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.filter-group label {
		font-weight: 500;
		font-size: 14px;
	}

	.filter-group select {
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.selection-controls {
		display: flex;
		gap: 12px;
		margin-left: auto;
	}

	.loading,
	.no-results {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.corrections-table {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.table-info {
		margin: 0 0 20px 0;
		padding: 12px;
		background: #f8f9fa;
		border-radius: 4px;
		font-size: 14px;
		color: #666;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	th {
		background: #f8f9fa;
		font-weight: 600;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #666;
	}

	tr:hover {
		background: #f8f9fa;
	}

	tr.selected {
		background: #e3f2fd;
	}

	tr.high-confidence {
		border-left: 3px solid #28a745;
	}

	.heading-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.record-link {
		font-size: 12px;
		color: #667eea;
	}

	.suggested-heading {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.change-indicator {
		font-size: 11px;
		padding: 2px 6px;
		background: #fff3cd;
		color: #856404;
		border-radius: 3px;
	}

	.no-suggestion {
		color: #999;
		font-style: italic;
		font-size: 13px;
	}

	.confidence-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
	}

	.confidence-100,
	.confidence-80 {
		background: #d4edda;
		color: #155724;
	}

	.confidence-60 {
		background: #fff3cd;
		color: #856404;
	}

	.confidence-40,
	.confidence-20,
	.confidence-0 {
		background: #f8d7da;
		color: #721c24;
	}

	.field-badge {
		display: inline-block;
		padding: 4px 8px;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.btn-primary,
	.btn-secondary {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d32f2f;
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f8f9fa;
	}
</style>
