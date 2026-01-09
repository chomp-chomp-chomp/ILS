<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let loading = $state(true);
	let error = $state('');
	let duplicateGroups = $state<Map<string, any[]>>(new Map());
	let selectedForDeletion = $state<Set<string>>(new Set());
	let processing = $state(false);

	onMount(async () => {
		await loadDuplicates();
	});

	async function loadDuplicates() {
		try {
			const { data: recordsData, error: fetchError } = await supabase
				.from('marc_records')
				.select('*')
				.order('created_at', { ascending: true }); // Oldest first

			if (fetchError) throw fetchError;

			// Group by ISBN
			const isbnMap = new Map<string, any[]>();

			recordsData?.forEach(record => {
				if (record.isbn) {
					const isbn = record.isbn.replace(/[^0-9X]/gi, '');
					if (isbn) {
						if (!isbnMap.has(isbn)) {
							isbnMap.set(isbn, []);
						}
						isbnMap.get(isbn)!.push(record);
					}
				}
			});

			// Keep only groups with duplicates (more than 1 record)
			const dupes = new Map<string, any[]>();
			isbnMap.forEach((records, isbn) => {
				if (records.length > 1) {
					dupes.set(isbn, records);
				}
			});

			duplicateGroups = dupes;
		} catch (err: any) {
			error = `Error loading duplicates: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function toggleSelection(recordId: string) {
		const newSelection = new Set(selectedForDeletion);
		if (newSelection.has(recordId)) {
			newSelection.delete(recordId);
		} else {
			newSelection.add(recordId);
		}
		selectedForDeletion = newSelection;
	}

	function selectAllButFirst(isbn: string) {
		const records = duplicateGroups.get(isbn);
		if (!records) return;

		const newSelection = new Set(selectedForDeletion);
		// Keep first (oldest), delete the rest
		records.slice(1).forEach(record => {
			newSelection.add(record.id);
		});
		selectedForDeletion = newSelection;
	}

	function selectAllButLast(isbn: string) {
		const records = duplicateGroups.get(isbn);
		if (!records) return;

		const newSelection = new Set(selectedForDeletion);
		// Keep last (newest), delete the rest
		records.slice(0, -1).forEach(record => {
			newSelection.add(record.id);
		});
		selectedForDeletion = newSelection;
	}

	function clearSelectionForGroup(isbn: string) {
		const records = duplicateGroups.get(isbn);
		if (!records) return;

		const newSelection = new Set(selectedForDeletion);
		records.forEach(record => {
			newSelection.delete(record.id);
		});
		selectedForDeletion = newSelection;
	}

	function selectAllDuplicates() {
		const newSelection = new Set(selectedForDeletion);
		duplicateGroups.forEach((records) => {
			// Keep first (oldest), delete the rest
			records.slice(1).forEach(record => {
				newSelection.add(record.id);
			});
		});
		selectedForDeletion = newSelection;
	}

	async function deleteSelected() {
		if (selectedForDeletion.size === 0) {
			alert('No records selected for deletion');
			return;
		}

		const confirmed = confirm(
			`Are you sure you want to delete ${selectedForDeletion.size} record(s)? This action cannot be undone.`
		);

		if (!confirmed) return;

		processing = true;

		try {
			const idsToDelete = Array.from(selectedForDeletion);
			console.log('Deleting records:', idsToDelete);

			// Delete records one at a time to avoid RLS issues
			let deletedCount = 0;
			let failedCount = 0;
			const errors: string[] = [];

			for (const id of idsToDelete) {
				const { error: deleteError } = await supabase
					.from('marc_records')
					.delete()
					.eq('id', id);

				if (deleteError) {
					console.error('Delete error for record', id, deleteError);
					errors.push(`${id}: ${deleteError.message}`);
					failedCount++;
				} else {
					deletedCount++;
				}
			}

			// Reload duplicates
			selectedForDeletion = new Set();
			await loadDuplicates();

			if (failedCount > 0) {
				alert(
					`Deleted ${deletedCount} record(s). Failed to delete ${failedCount} record(s).\n\nErrors:\n${errors.join('\n')}`
				);
			} else {
				alert(`Successfully deleted ${deletedCount} record(s)`);
			}
		} catch (err: any) {
			console.error('Delete error:', err);
			alert(`Error deleting records: ${err.message}`);
		} finally {
			processing = false;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString();
	}
</script>

<div class="page-container">
	<div class="page-header">
		<div>
			<h1>Duplicate Management</h1>
			<p class="subtitle">Review and remove duplicate records</p>
		</div>
		<div class="actions">
			<a href="/admin/cataloging" class="btn-secondary">Back to Cataloging</a>
		</div>
	</div>

	{#if loading}
		<div class="loading">Loading duplicates...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if duplicateGroups.size === 0}
		<div class="empty-state">
			<h2>No Duplicates Found</h2>
			<p>Your catalog is clean! No duplicate ISBNs detected.</p>
		</div>
	{:else}
		<div class="controls-bar">
			<div class="stats">
				<strong>{duplicateGroups.size}</strong> ISBN{duplicateGroups.size === 1 ? '' : 's'} with duplicates
				<span class="separator">•</span>
				<strong>{selectedForDeletion.size}</strong> record{selectedForDeletion.size === 1 ? '' : 's'} selected for deletion
			</div>
			<div class="bulk-actions">
				<button onclick={() => selectAllDuplicates()} class="btn-action">
					Select All Duplicates (Keep Oldest)
				</button>
				<button
					onclick={() => deleteSelected()}
					disabled={selectedForDeletion.size === 0 || processing}
					class="btn-delete-selected"
				>
					{processing ? 'Deleting...' : `Delete Selected (${selectedForDeletion.size})`}
				</button>
			</div>
		</div>

		<div class="duplicate-groups">
			{#each Array.from(duplicateGroups.entries()) as [isbn, records]}
				<div class="duplicate-group">
					<div class="group-header">
						<div class="group-info">
							<h3>ISBN: {isbn}</h3>
							<span class="count">{records.length} copies found</span>
						</div>
						<div class="group-actions">
							<button onclick={() => selectAllButFirst(isbn)} class="btn-quick">
								Keep Oldest
							</button>
							<button onclick={() => selectAllButLast(isbn)} class="btn-quick">
								Keep Newest
							</button>
							<button onclick={() => clearSelectionForGroup(isbn)} class="btn-quick">
								Clear Selection
							</button>
						</div>
					</div>

					<div class="records-grid">
						{#each records as record, index}
							<div
								class="record-item"
								class:selected={selectedForDeletion.has(record.id)}
								class:oldest={index === 0}
								class:newest={index === records.length - 1}
							>
								<div class="record-header">
									<label class="checkbox-label">
										<input
											type="checkbox"
											checked={selectedForDeletion.has(record.id)}
											onchange={() => toggleSelection(record.id)}
										/>
										<span class="record-title">
											{record.title_statement?.a || 'Untitled'}
										</span>
									</label>
									<div class="badges">
										{#if index === 0}
											<span class="badge badge-oldest">Oldest</span>
										{/if}
										{#if index === records.length - 1}
											<span class="badge badge-newest">Newest</span>
										{/if}
									</div>
								</div>
								<div class="record-details">
									{#if record.main_entry_personal_name?.a}
										<p><strong>Author:</strong> {record.main_entry_personal_name.a}</p>
									{/if}
									{#if record.publication?.c}
										<p><strong>Published:</strong> {record.publication.c}</p>
									{/if}
									{#if record.publisher}
										<p><strong>Publisher:</strong> {record.publisher}</p>
									{/if}
									<p><strong>Added:</strong> {formatDate(record.created_at)}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #e0e0e0;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
	}

	.subtitle {
		color: #666;
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s;
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		font-size: 1.125rem;
	}

	.error {
		color: #f44336;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
		border: 2px dashed #e0e0e0;
	}

	.empty-state h2 {
		color: #2c3e50;
		margin-bottom: 0.5rem;
	}

	.empty-state p {
		color: #666;
	}

	.controls-bar {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.stats {
		color: #666;
		font-size: 0.875rem;
	}

	.stats strong {
		color: #e73b42;
		font-size: 1rem;
	}

	.separator {
		margin: 0 0.5rem;
		color: #ccc;
	}

	.bulk-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-action {
		padding: 0.75rem 1.5rem;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-action:hover {
		background: #d12d34;
	}

	.btn-delete-selected {
		padding: 0.75rem 1.5rem;
		background: #f44336;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		font-weight: 600;
	}

	.btn-delete-selected:hover:not(:disabled) {
		background: #d32f2f;
		box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
	}

	.btn-delete-selected:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.duplicate-groups {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.duplicate-group {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		overflow: hidden;
	}

	.group-header {
		background: #f5f5f5;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.group-info h3 {
		margin: 0 0 0.25rem 0;
		color: #2c3e50;
		font-size: 1.125rem;
	}

	.count {
		color: #f59e0b;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.group-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn-quick {
		padding: 0.5rem 1rem;
		background: white;
		color: #666;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-quick:hover {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
	}

	.records-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1rem;
		padding: 1.5rem;
	}

	.record-item {
		border: 2px solid #e0e0e0;
		border-radius: 6px;
		padding: 1rem;
		transition: all 0.2s;
		background: white;
	}

	.record-item.selected {
		border-color: #f44336;
		background: #fff5f5;
	}

	.record-item.oldest {
		border-left: 4px solid #4caf50;
	}

	.record-item.newest {
		border-left: 4px solid #2196f3;
	}

	.record-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		flex: 1;
	}

	.checkbox-label input[type="checkbox"] {
		margin-top: 0.25rem;
		width: 18px;
		height: 18px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.record-title {
		font-weight: 600;
		color: #2c3e50;
		line-height: 1.4;
	}

	.badges {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.badge-oldest {
		background: #4caf50;
		color: white;
	}

	.badge-newest {
		background: #2196f3;
		color: white;
	}

	.record-details {
		font-size: 0.8125rem;
		color: #666;
	}

	.record-details p {
		margin: 0.25rem 0;
	}

	.record-details strong {
		color: #333;
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 1rem;
		}

		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.controls-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.bulk-actions {
			flex-direction: column;
		}

		.group-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.group-actions {
			width: 100%;
		}

		.btn-quick {
			flex: 1;
		}

		.records-grid {
			grid-template-columns: 1fr;
			padding: 1rem;
		}
	}
</style>
