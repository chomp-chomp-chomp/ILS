<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	const record = $derived(data.record);
	const relatedRecords = $state(data.relatedRecords || []);

	// State for adding new related record
	let addingRelated = $state(false);
	let searchTerm = $state('');
	let searchResults = $state<any[]>([]);
	let selectedRecordId = $state('');
	let selectedRelationType = $state('related_work');
	let relationshipNote = $state('');
	let displayOrder = $state(0);
	let message = $state('');
	let messageType = $state<'success' | 'error'>('success');

	const relationshipTypes = [
		{ value: 'related_work', label: 'Related Work' },
		{ value: 'translation', label: 'Translation' },
		{ value: 'original', label: 'Original Work' },
		{ value: 'earlier_edition', label: 'Earlier Edition' },
		{ value: 'later_edition', label: 'Later Edition' },
		{ value: 'adaptation', label: 'Adaptation (e.g., movie based on book)' },
		{ value: 'adapted_from', label: 'Adapted From (source material)' },
		{ value: 'companion', label: 'Companion Volume' },
		{ value: 'part_of', label: 'Part Of (larger work)' },
		{ value: 'has_part', label: 'Contains (as a part)' },
		{ value: 'supplement', label: 'Supplement' },
		{ value: 'supplement_to', label: 'Supplement To' },
		{ value: 'continues', label: 'Continues (serial)' },
		{ value: 'continued_by', label: 'Continued By (serial)' }
	];

	async function searchRecords() {
		if (!searchTerm.trim()) {
			searchResults = [];
			return;
		}

		const response = await fetch(
			`/api/records/search?q=${encodeURIComponent(searchTerm)}&limit=10`
		);

		if (response.ok) {
			const data = await response.json();
			// Filter out current record and already related records
			const relatedIds = relatedRecords.map((r) => r.target_record_id);
			searchResults = data.results.filter(
				(r: any) => r.id !== record.id && !relatedIds.includes(r.id)
			);
		}
	}

	function selectRecord(recordId: string) {
		selectedRecordId = recordId;
	}

	async function addRelatedRecord() {
		if (!selectedRecordId) {
			message = 'Please select a record to link';
			messageType = 'error';
			return;
		}

		try {
			const response = await fetch('/api/related-records', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source_record_id: record.id,
					target_record_id: selectedRecordId,
					relationship_type: selectedRelationType,
					relationship_note: relationshipNote || null,
					display_order: displayOrder
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to add related record');
			}

			message = 'Related record added successfully';
			messageType = 'success';

			// Refresh page to show new related record
			setTimeout(() => {
				location.reload();
			}, 1000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Failed to add related record';
			messageType = 'error';
		}
	}

	async function deleteRelatedRecord(relatedId: string) {
		if (!confirm('Are you sure you want to remove this related record link?')) {
			return;
		}

		try {
			const response = await fetch(`/api/related-records/${relatedId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete related record');
			}

			message = 'Related record removed successfully';
			messageType = 'success';

			// Remove from local state
			const index = relatedRecords.findIndex((r) => r.id === relatedId);
			if (index > -1) {
				relatedRecords.splice(index, 1);
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'Failed to remove related record';
			messageType = 'error';
		}
	}
</script>

<div class="page">
	<div class="header">
		<div>
			<h1>Manage Related Records</h1>
			<p class="record-title">
				For: <strong>{record.title_statement?.a || 'Untitled'}</strong>
			</p>
		</div>
		<a href="/admin/cataloging/{record.id}" class="btn-secondary">← Back to Record</a>
	</div>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<!-- Existing Related Records -->
	<div class="section">
		<h2>Current Related Records ({relatedRecords.length})</h2>

		{#if relatedRecords.length > 0}
			<table class="related-table">
				<thead>
					<tr>
						<th>Type</th>
						<th>Related Record</th>
						<th>Note</th>
						<th>Order</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each relatedRecords as related}
						<tr>
							<td>
								<span class="relationship-type">
									{relationshipTypes.find((t) => t.value === related.relationship_type)?.label ||
										related.relationship_type}
								</span>
							</td>
							<td>
								<div class="record-info">
									<a
										href="/catalog/record/{related.target_record_id}"
										target="_blank"
										class="record-link"
									>
										{related.target_record?.title_statement?.a || 'Unknown'}
									</a>
									{#if related.target_record?.main_entry_personal_name?.a}
										<span class="author">
											by {related.target_record.main_entry_personal_name.a}
										</span>
									{/if}
								</div>
							</td>
							<td class="note-cell">
								{related.relationship_note || '-'}
							</td>
							<td>{related.display_order}</td>
							<td>
								<button class="btn-delete" onclick={() => deleteRelatedRecord(related.id)}>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="empty-message">No related records linked yet.</p>
		{/if}
	</div>

	<!-- Add New Related Record -->
	<div class="section">
		<h2>Add New Related Record</h2>

		<div class="form">
			<div class="form-group">
				<label for="search">Search for Record to Link</label>
				<div class="search-box">
					<input
						id="search"
						type="text"
						bind:value={searchTerm}
						placeholder="Search by title, author, ISBN..."
						oninput={searchRecords}
					/>
				</div>

				{#if searchResults.length > 0}
					<div class="search-results">
						{#each searchResults as result}
							<button
								class="search-result-item"
								class:selected={selectedRecordId === result.id}
								onclick={() => selectRecord(result.id)}
							>
								<div class="result-title">{result.title_statement?.a || 'Untitled'}</div>
								{#if result.main_entry_personal_name?.a}
									<div class="result-author">by {result.main_entry_personal_name.a}</div>
								{/if}
								{#if result.publication_info?.c}
									<div class="result-year">({result.publication_info.c})</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="form-group">
				<label for="relationship-type">Relationship Type</label>
				<select id="relationship-type" bind:value={selectedRelationType}>
					{#each relationshipTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>

			<div class="form-group">
				<label for="relationship-note">Relationship Note (optional)</label>
				<textarea
					id="relationship-note"
					bind:value={relationshipNote}
					placeholder="Optional description of the relationship..."
					rows="3"
				></textarea>
			</div>

			<div class="form-group">
				<label for="display-order">Display Order (0 = first)</label>
				<input id="display-order" type="number" bind:value={displayOrder} min="0" />
			</div>

			<div class="form-actions">
				<button class="btn-primary" onclick={addRelatedRecord} disabled={!selectedRecordId}>
					Add Related Record
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.record-title {
		margin: 0;
		color: #666;
		font-size: 1rem;
	}

	.message {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
	}

	.message.success {
		background: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
	}

	.section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		margin-bottom: 2rem;
	}

	.section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.related-table {
		width: 100%;
		border-collapse: collapse;
	}

	.related-table th {
		text-align: left;
		padding: 0.75rem;
		background: #f8f9fa;
		border-bottom: 2px solid #e0e0e0;
		font-weight: 600;
		color: #666;
	}

	.related-table td {
		padding: 1rem 0.75rem;
		border-bottom: 1px solid #e0e0e0;
		vertical-align: top;
	}

	.relationship-type {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.record-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.record-link {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
	}

	.record-link:hover {
		text-decoration: underline;
	}

	.author {
		font-size: 0.875rem;
		color: #666;
		font-style: italic;
	}

	.note-cell {
		max-width: 300px;
		font-size: 0.875rem;
		color: #666;
	}

	.empty-message {
		text-align: center;
		padding: 2rem;
		color: #999;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-weight: 500;
		color: #333;
	}

	.search-box input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.search-results {
		border: 1px solid #ddd;
		border-radius: 4px;
		max-height: 300px;
		overflow-y: auto;
	}

	.search-result-item {
		width: 100%;
		padding: 1rem;
		border: none;
		border-bottom: 1px solid #e0e0e0;
		background: white;
		text-align: left;
		cursor: pointer;
		transition: background 0.2s;
	}

	.search-result-item:last-child {
		border-bottom: none;
	}

	.search-result-item:hover {
		background: #f8f9fa;
	}

	.search-result-item.selected {
		background: #e3f2fd;
		border-left: 4px solid #667eea;
	}

	.result-title {
		font-weight: 500;
		color: #2c3e50;
		margin-bottom: 0.25rem;
	}

	.result-author {
		font-size: 0.875rem;
		color: #666;
		font-style: italic;
	}

	.result-year {
		font-size: 0.875rem;
		color: #999;
	}

	select,
	textarea,
	input[type='number'] {
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary,
	.btn-secondary,
	.btn-delete {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #c62828;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
		text-decoration: none;
		display: inline-block;
	}

	.btn-secondary:hover {
		background: #f8f9fa;
	}

	.btn-delete {
		background: #f44336;
		color: white;
		padding: 0.5rem 1rem;
	}

	.btn-delete:hover {
		background: #d32f2f;
	}
</style>
