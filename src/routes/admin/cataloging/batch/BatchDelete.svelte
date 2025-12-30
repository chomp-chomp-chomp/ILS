<script lang="ts">
	let criteria = $state({
		materialTypes: [] as string[],
		publicationYearFrom: '',
		publicationYearTo: '',
		language: '',
		noHoldings: false,
		locations: [] as string[]
	});

	let previewRecords = $state<any[]>([]);
	let loading = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');
	let archiveInsteadOfDelete = $state(false);

	const materialTypeOptions = ['book', 'ebook', 'dvd', 'cd', 'serial', 'newspaper', 'magazine'];

	async function preview() {
		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					criteria,
					previewOnly: true,
					archiveInsteadOfDelete
				})
			});

			const data = await response.json();

			if (data.success) {
				previewRecords = data.records || [];
				message = `Found ${data.recordsToDelete} records matching criteria`;
				messageType = 'info';
			}
		} catch (error) {
			message = 'Error previewing records';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function executeDelete() {
		const action = archiveInsteadOfDelete ? 'archive' : 'delete';
		if (!confirm(`Are you sure you want to ${action} ${previewRecords.length} records? This is irreversible!`)) {
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					criteria,
					previewOnly: false,
					archiveInsteadOfDelete
				})
			});

			const data = await response.json();

			if (data.success) {
				message = `Successfully ${action}d ${data.deleted} records`;
				messageType = 'success';
				previewRecords = [];
			}
		} catch (error) {
			message = `Error ${action}ing records`;
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function toggleMaterialType(type: string) {
		if (criteria.materialTypes.includes(type)) {
			criteria.materialTypes = criteria.materialTypes.filter(t => t !== type);
		} else {
			criteria.materialTypes = [...criteria.materialTypes, type];
		}
	}
</script>

<div class="batch-delete">
	<h2>Batch Delete Records</h2>
	<p class="description">Delete multiple records based on complex criteria. Use with caution!</p>

	<div class="warning-box">
		<strong>⚠️ Warning:</strong> Batch deletion is permanent and cannot be undone. Always preview before deleting.
	</div>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<div class="form-section">
		<h3>Delete Criteria</h3>

		<div class="form-group">
			<label>Material Types</label>
			<div class="checkbox-grid">
				{#each materialTypeOptions as type}
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={criteria.materialTypes.includes(type)}
							onchange={() => toggleMaterialType(type)}
						/>
						{type}
					</label>
				{/each}
			</div>
		</div>

		<div class="form-row">
			<div class="form-group">
				<label for="yearFrom">Publication Year From</label>
				<input
					id="yearFrom"
					type="number"
					bind:value={criteria.publicationYearFrom}
					placeholder="e.g., 1900"
					min="1000"
					max="2100"
				/>
			</div>

			<div class="form-group">
				<label for="yearTo">Publication Year To</label>
				<input
					id="yearTo"
					type="number"
					bind:value={criteria.publicationYearTo}
					placeholder="e.g., 2020"
					min="1000"
					max="2100"
				/>
			</div>
		</div>

		<div class="form-group">
			<label>
				<input type="checkbox" bind:checked={criteria.noHoldings} />
				Only records with no holdings
			</label>
		</div>

		<div class="form-group">
			<label>
				<input type="checkbox" bind:checked={archiveInsteadOfDelete} />
				Archive instead of delete (safer option)
			</label>
			<small>Archived records are marked but not deleted</small>
		</div>

		<div class="button-group">
			<button class="btn btn-secondary" onclick={preview} disabled={loading}>
				Preview Records
			</button>

			{#if previewRecords.length > 0}
				<button
					class="btn btn-danger"
					onclick={executeDelete}
					disabled={loading}
				>
					{archiveInsteadOfDelete ? 'Archive' : 'Delete'} {previewRecords.length} Records
				</button>
			{/if}
		</div>
	</div>

	{#if previewRecords.length > 0}
		<div class="preview-section">
			<h3>Records to {archiveInsteadOfDelete ? 'Archive' : 'Delete'} ({previewRecords.length})</h3>

			<table>
				<thead>
					<tr>
						<th>Title</th>
						<th>ISBN</th>
						<th>Type</th>
						<th>Holdings</th>
					</tr>
				</thead>
				<tbody>
					{#each previewRecords as record}
						<tr>
							<td>{record.title}</td>
							<td>{record.isbn || 'N/A'}</td>
							<td><span class="badge">{record.material_type}</span></td>
							<td>{record.holdings_count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.batch-delete {
		max-width: 1000px;
	}

	h2 {
		font-size: 24px;
		color: #333;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 18px;
		color: #333;
		margin-bottom: 16px;
	}

	.description {
		color: #666;
		margin-bottom: 20px;
	}

	.warning-box {
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 4px;
		padding: 12px 16px;
		margin-bottom: 20px;
		color: #856404;
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
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 8px;
		color: #333;
	}

	.form-group input[type="number"] {
		width: 100%;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.form-group small {
		display: block;
		margin-top: 4px;
		color: #666;
		font-size: 13px;
	}

	.checkbox-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 12px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-weight: normal;
	}

	.button-group {
		display: flex;
		gap: 12px;
		margin-top: 20px;
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

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f5f5f5;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		background: #c82333;
	}

	.preview-section {
		margin-top: 30px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		border: 1px solid #ddd;
		border-radius: 4px;
		overflow: hidden;
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
	}

	tbody tr:hover {
		background: #f9f9f9;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		background: #e0e0e0;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
	}
</style>
