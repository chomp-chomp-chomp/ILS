<script lang="ts">
	import { onMount } from 'svelte';

	let duplicates = $state<any[]>([]);
	let loading = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');
	let method = $state('isbn');
	let threshold = $state(0.8);
	let selectedDuplicate = $state<any | null>(null);
	let mergeStrategy = $state('field_by_field');

	onMount(async () => {
		await loadDuplicates();
	});

	async function loadDuplicates() {
		loading = true;
		try {
			const response = await fetch(`/api/batch/duplicates?method=${method}&threshold=${threshold}&status=pending`);
			const data = await response.json();
			if (data.success) {
				duplicates = data.duplicates || [];
			}
		} catch (error) {
			console.error('Error loading duplicates:', error);
		} finally {
			loading = false;
		}
	}

	async function findNewDuplicates() {
		loading = true;
		message = '';

		try {
			const response = await fetch(`/api/batch/duplicates?method=${method}&threshold=${threshold}&status=new`);
			const data = await response.json();

			if (data.success) {
				duplicates = data.duplicates;
				message = `Found ${data.count} potential duplicate pairs`;
				messageType = 'info';
			}
		} catch (error) {
			message = 'Error finding duplicates';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function markAsNotDuplicate(duplicateId: string) {
		try {
			const response = await fetch('/api/batch/duplicates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					duplicateId,
					status: 'not_duplicate'
				})
			});

			if (response.ok) {
				duplicates = duplicates.filter(d => d.id !== duplicateId);
				message = 'Marked as not duplicate';
				messageType = 'success';
			}
		} catch (error) {
			console.error('Error:', error);
		}
	}

	async function mergeRecords(duplicate: any) {
		if (!confirm('Merge these records? This will delete one and keep the other.')) {
			return;
		}

		loading = true;
		message = '';

		try {
			// Automatically choose the record with more data as target
			const targetId = duplicate.record_a.isbn ? duplicate.record_a.id : duplicate.record_b.id;
			const sourceId = targetId === duplicate.record_a.id ? duplicate.record_b.id : duplicate.record_a.id;

			const response = await fetch('/api/batch/merge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourceRecordIds: [sourceId],
					targetRecordId: targetId,
					mergeStrategy,
					duplicateRecordId: duplicate.id
				})
			});

			const data = await response.json();

			if (data.success) {
				message = 'Records merged successfully';
				messageType = 'success';
				duplicates = duplicates.filter(d => d.id !== duplicate.id);
			}
		} catch (error) {
			message = 'Error merging records';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function viewDetails(duplicate: any) {
		selectedDuplicate = duplicate;
	}
</script>

<div class="deduplication">
	<h2>Record Deduplication</h2>
	<p class="description">Find and merge duplicate MARC records to maintain catalog quality.</p>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<div class="controls">
		<div class="form-row">
			<div class="form-group">
				<label for="method">Detection Method</label>
				<select id="method" bind:value={method}>
					<option value="isbn">ISBN Match</option>
					<option value="title">Title Similarity</option>
					<option value="all">All Methods</option>
				</select>
			</div>

			{#if method === 'title' || method === 'all'}
				<div class="form-group">
					<label for="threshold">Similarity Threshold</label>
					<input
						id="threshold"
						type="number"
						bind:value={threshold}
						min="0.5"
						max="1.0"
						step="0.05"
					/>
					<small>{(threshold * 100).toFixed(0)}% similarity required</small>
				</div>
			{/if}
		</div>

		<button class="btn btn-primary" onclick={findNewDuplicates} disabled={loading}>
			{loading ? 'Searching...' : 'Find Duplicates'}
		</button>
	</div>

	<div class="duplicates-list">
		<h3>Potential Duplicates ({duplicates.length})</h3>

		{#if duplicates.length === 0}
			<p class="empty-state">No duplicates found. Try different detection settings.</p>
		{:else}
			{#each duplicates as duplicate}
				<div class="duplicate-card">
					<div class="duplicate-header">
						<div>
							<span class="match-badge">{duplicate.match_method}</span>
							<span class="similarity-badge">{(duplicate.similarity_score * 100).toFixed(0)}% match</span>
						</div>
					</div>

					<div class="record-comparison">
						<div class="record-column">
							<h4>Record A</h4>
							<p class="record-title">{duplicate.record_a?.title_statement?.a || 'Unknown'}</p>
							<p class="record-meta">
								{#if duplicate.record_a?.isbn}ISBN: {duplicate.record_a.isbn}<br />{/if}
								{#if duplicate.record_a?.main_entry_personal_name?.a}
									Author: {duplicate.record_a.main_entry_personal_name.a}<br />
								{/if}
								{#if duplicate.record_a?.publication_info?.c}
									Year: {duplicate.record_a.publication_info.c}
								{/if}
							</p>
						</div>

						<div class="divider"></div>

						<div class="record-column">
							<h4>Record B</h4>
							<p class="record-title">{duplicate.record_b?.title_statement?.a || 'Unknown'}</p>
							<p class="record-meta">
								{#if duplicate.record_b?.isbn}ISBN: {duplicate.record_b.isbn}<br />{/if}
								{#if duplicate.record_b?.main_entry_personal_name?.a}
									Author: {duplicate.record_b.main_entry_personal_name.a}<br />
								{/if}
								{#if duplicate.record_b?.publication_info?.c}
									Year: {duplicate.record_b.publication_info.c}
								{/if}
							</p>
						</div>
					</div>

					<div class="duplicate-actions">
						<button class="btn btn-small btn-secondary" onclick={() => viewDetails(duplicate)}>
							View Details
						</button>
						<button class="btn btn-small btn-primary" onclick={() => mergeRecords(duplicate)}>
							Merge Records
						</button>
						<button class="btn btn-small btn-text" onclick={() => markAsNotDuplicate(duplicate.id)}>
							Not Duplicate
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	{#if selectedDuplicate}
		<div class="modal-overlay" onclick={() => selectedDuplicate = null}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h3>Duplicate Details</h3>
					<button class="close-btn" onclick={() => selectedDuplicate = null}>×</button>
				</div>
				<div class="modal-body">
					<p>Detailed side-by-side comparison would go here.</p>
					<p>Similarity: {(selectedDuplicate.similarity_score * 100).toFixed(0)}%</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.deduplication {
		max-width: 1200px;
	}

	h2 {
		font-size: 24px;
		color: #333;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 20px;
		color: #333;
		margin-bottom: 16px;
	}

	h4 {
		font-size: 14px;
		color: #666;
		margin-bottom: 8px;
		text-transform: uppercase;
		font-weight: 600;
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

	.controls {
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

	.form-group select,
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

	.btn-small {
		padding: 6px 12px;
		font-size: 13px;
	}

	.btn-text {
		background: none;
		color: #666;
		padding: 6px 12px;
	}

	.btn-text:hover {
		color: #333;
		background: #f5f5f5;
	}

	.duplicates-list {
		margin-top: 30px;
	}

	.duplicate-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 16px;
	}

	.duplicate-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.match-badge,
	.similarity-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		margin-right: 8px;
	}

	.match-badge {
		background: #e0e0e0;
		color: #333;
		text-transform: uppercase;
	}

	.similarity-badge {
		background: #d1ecf1;
		color: #0c5460;
	}

	.record-comparison {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 20px;
		margin-bottom: 16px;
	}

	.record-column {
		padding: 16px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.record-title {
		font-weight: 600;
		margin-bottom: 8px;
		color: #333;
	}

	.record-meta {
		font-size: 13px;
		color: #666;
		line-height: 1.6;
	}

	.divider {
		width: 2px;
		background: #ddd;
	}

	.duplicate-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.empty-state {
		text-align: center;
		color: #999;
		padding: 40px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		max-width: 800px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
	}

	.modal-header {
		padding: 20px;
		border-bottom: 1px solid #ddd;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-body {
		padding: 20px;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 32px;
		cursor: pointer;
		color: #666;
		line-height: 1;
	}

	.close-btn:hover {
		color: #333;
	}

	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.record-comparison {
			grid-template-columns: 1fr;
		}

		.divider {
			display: none;
		}

		.duplicate-actions {
			flex-direction: column;
		}
	}
</style>
