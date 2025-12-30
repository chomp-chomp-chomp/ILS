<script lang="ts">
	let searchPattern = $state('');
	let replaceWith = $state('');
	let fieldFilter = $state('');
	let subfieldFilter = $state('');
	let caseSensitive = $state(true);
	let useRegex = $state(false);
	let previewResults = $state<any[]>([]);
	let loading = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');

	async function runPreview() {
		if (!searchPattern) {
			message = 'Please enter a search pattern';
			messageType = 'error';
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/find-replace', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					searchPattern,
					replaceWith,
					fieldFilter: fieldFilter || null,
					subfieldFilter: subfieldFilter || null,
					caseSensitive,
					useRegex,
					previewOnly: true
				})
			});

			const data = await response.json();

			if (data.success) {
				previewResults = data.changes || [];
				message = `Found ${data.summary.totalChanges} changes in ${data.summary.recordsAffected} records`;
				messageType = 'info';
			} else {
				message = 'Preview failed';
				messageType = 'error';
			}
		} catch (error) {
			message = 'Error running preview';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function applyChanges() {
		if (!confirm(`Are you sure you want to apply ${previewResults.length} changes? This cannot be undone automatically.`)) {
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/find-replace', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					searchPattern,
					replaceWith,
					fieldFilter: fieldFilter || null,
					subfieldFilter: subfieldFilter || null,
					caseSensitive,
					useRegex,
					previewOnly: false
				})
			});

			const data = await response.json();

			if (data.success) {
				message = `Successfully applied ${data.summary.totalChanges} changes to ${data.summary.recordsAffected} records`;
				messageType = 'success';
				previewResults = [];
				searchPattern = '';
				replaceWith = '';
			} else {
				message = 'Failed to apply changes';
				messageType = 'error';
			}
		} catch (error) {
			message = 'Error applying changes';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="find-replace">
	<h2>Global Find & Replace</h2>
	<p class="description">Search and replace text across all MARC fields with advanced filtering options.</p>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<div class="form-section">
		<div class="form-row">
			<div class="form-group">
				<label for="searchPattern">
					Search Pattern
					<span class="required">*</span>
				</label>
				<input
					id="searchPattern"
					type="text"
					bind:value={searchPattern}
					placeholder="Enter text or regex to find"
					required
				/>
			</div>

			<div class="form-group">
				<label for="replaceWith">Replace With</label>
				<input
					id="replaceWith"
					type="text"
					bind:value={replaceWith}
					placeholder="Replacement text (leave empty to delete)"
				/>
			</div>
		</div>

		<div class="form-row">
			<div class="form-group">
				<label for="fieldFilter">Field Filter (Optional)</label>
				<input
					id="fieldFilter"
					type="text"
					bind:value={fieldFilter}
					placeholder="e.g., 'subject' or '650'"
				/>
				<small>Only search in fields matching this name</small>
			</div>

			<div class="form-group">
				<label for="subfieldFilter">Subfield Filter (Optional)</label>
				<input
					id="subfieldFilter"
					type="text"
					bind:value={subfieldFilter}
					placeholder="e.g., 'a'"
					maxlength="1"
				/>
				<small>Only search in this MARC subfield</small>
			</div>
		</div>

		<div class="checkbox-group">
			<label>
				<input type="checkbox" bind:checked={caseSensitive} />
				Case sensitive
			</label>

			<label>
				<input type="checkbox" bind:checked={useRegex} />
				Use regular expressions
			</label>
		</div>

		<div class="button-group">
			<button class="btn btn-secondary" onclick={runPreview} disabled={loading || !searchPattern}>
				{loading ? 'Processing...' : 'Preview Changes'}
			</button>

			{#if previewResults.length > 0}
				<button class="btn btn-primary" onclick={applyChanges} disabled={loading}>
					Apply {previewResults.length} Changes
				</button>
			{/if}
		</div>
	</div>

	{#if previewResults.length > 0}
		<div class="preview-section">
			<h3>Preview ({previewResults.length} changes)</h3>
			<p class="hint">Showing first 100 changes. All changes will be applied.</p>

			<div class="preview-table">
				<table>
					<thead>
						<tr>
							<th>Record</th>
							<th>Field</th>
							<th>Old Value</th>
							<th>New Value</th>
						</tr>
					</thead>
					<tbody>
						{#each previewResults.slice(0, 100) as change}
							<tr>
								<td>
									<strong>{change.recordTitle}</strong>
									<br />
									<small class="record-id">{change.recordId}</small>
								</td>
								<td><code>{change.fieldName}</code></td>
								<td class="old-value">{change.oldValue}</td>
								<td class="new-value">{change.newValue}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.find-replace {
		max-width: 1200px;
	}

	h2 {
		font-size: 24px;
		color: #333;
		margin-bottom: 8px;
	}

	.description {
		color: #666;
		margin-bottom: 20px;
	}

	.message {
		padding: 12px 16px;
		border-radius: 4px;
		margin-bottom: 20px;
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

	.message.info {
		background: #d1ecf1;
		color: #0c5460;
		border: 1px solid #bee5eb;
	}

	.form-section {
		background: #f9f9f9;
		padding: 20px;
		border-radius: 8px;
		margin-bottom: 30px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-bottom: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group label {
		font-weight: 600;
		margin-bottom: 8px;
		color: #333;
	}

	.required {
		color: #e73b42;
	}

	.form-group input {
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.form-group small {
		margin-top: 4px;
		color: #666;
		font-size: 13px;
	}

	.checkbox-group {
		display: flex;
		gap: 20px;
		margin-bottom: 20px;
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.button-group {
		display: flex;
		gap: 12px;
	}

	.btn {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12a31;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f5f5f5;
	}

	.preview-section {
		margin-top: 30px;
	}

	.preview-section h3 {
		font-size: 20px;
		margin-bottom: 8px;
	}

	.hint {
		color: #666;
		font-size: 14px;
		margin-bottom: 16px;
	}

	.preview-table {
		overflow-x: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f5f5f5;
	}

	th {
		text-align: left;
		padding: 12px;
		font-weight: 600;
		border-bottom: 2px solid #ddd;
	}

	td {
		padding: 12px;
		border-bottom: 1px solid #eee;
		vertical-align: top;
	}

	tbody tr:hover {
		background: #f9f9f9;
	}

	.record-id {
		color: #999;
		font-size: 12px;
	}

	code {
		background: #f0f0f0;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 13px;
	}

	.old-value {
		color: #721c24;
		background: #f8d7da;
		text-decoration: line-through;
	}

	.new-value {
		color: #155724;
		background: #d4edda;
		font-weight: 600;
	}

	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.button-group {
			flex-direction: column;
		}

		.preview-table {
			font-size: 13px;
		}

		th, td {
			padding: 8px;
		}
	}
</style>
