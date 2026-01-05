<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let records = $state<any[]>([]);
	let filteredRecords = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let duplicates = $state<Set<string>>(new Set());

	// Search and filter state
	let searchQuery = $state('');
	let sortBy = $state<'title' | 'author' | 'date'>('date');
	let showDuplicatesOnly = $state(false);

	// Batch editing state
	let selectedRecords = $state<Set<string>>(new Set());
	let showBatchEditModal = $state(false);
	let batchEditing = $state(false);
	let batchMessage = $state('');

	let batchFields = $state({
		updateMaterialType: false,
		addSubjects: false,
		replaceSubjects: false,
		addNote: false
	});

	let batchValues = $state({
		materialType: 'book',
		subjectsToAdd: '',
		subjectsToReplace: '',
		noteToAdd: ''
	});

	onMount(async () => {
		await loadRecords();
	});

	async function loadRecords() {
		try {
			const { data: recordsData, error: fetchError } = await data.supabase
				.from('marc_records')
				.select('*')
				.eq('status', 'active')  // Only show active records, not archived or deleted
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;

			records = recordsData || [];
			findDuplicates();
			applyFilters();
		} catch (err: any) {
			error = `Error loading records: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function findDuplicates() {
		const isbnMap = new Map<string, number>();
		duplicates = new Set();

		records.forEach(record => {
			if (record.isbn) {
				const isbn = record.isbn.replace(/[^0-9X]/gi, '');
				if (isbn) {
					isbnMap.set(isbn, (isbnMap.get(isbn) || 0) + 1);
				}
			}
		});

		// Mark ISBNs that appear more than once
		records.forEach(record => {
			if (record.isbn) {
				const isbn = record.isbn.replace(/[^0-9X]/gi, '');
				if (isbnMap.get(isbn)! > 1) {
					duplicates.add(record.id);
				}
			}
		});
	}

	function applyFilters() {
		let filtered = [...records];

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(record => {
				const title = record.title_statement?.a?.toLowerCase() || '';
				const author = record.main_entry_personal_name?.a?.toLowerCase() || '';
				const isbn = record.isbn?.toLowerCase() || '';
				return title.includes(query) || author.includes(query) || isbn.includes(query);
			});
		}

		// Apply duplicates filter
		if (showDuplicatesOnly) {
			filtered = filtered.filter(record => duplicates.has(record.id));
		}

		// Apply sorting
		filtered.sort((a, b) => {
			if (sortBy === 'title') {
				const titleA = a.title_statement?.a || '';
				const titleB = b.title_statement?.a || '';
				return titleA.localeCompare(titleB);
			} else if (sortBy === 'author') {
				const authorA = a.main_entry_personal_name?.a || '';
				const authorB = b.main_entry_personal_name?.a || '';
				return authorA.localeCompare(authorB);
			} else {
				// Sort by date (newest first)
				return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
			}
		});

		filteredRecords = filtered;
	}

	// Reactive: reapply filters when search/sort changes
	$effect(() => {
		searchQuery;
		sortBy;
		showDuplicatesOnly;
		if (records.length > 0) {
			applyFilters();
		}
	});

	async function deleteRecord(id: string) {
		if (!confirm('Are you sure you want to delete this record?')) return;

		try {
			const { error: deleteError } = await data.supabase
				.from('marc_records')
				.delete()
				.eq('id', id);

			if (deleteError) throw deleteError;

			records = records.filter((r) => r.id !== id);
			findDuplicates();
			applyFilters();
		} catch (err: any) {
			alert(`Error deleting record: ${err.message}`);
		}
	}

	// Batch editing functions
	function toggleRecordSelection(id: string) {
		if (selectedRecords.has(id)) {
			selectedRecords.delete(id);
		} else {
			selectedRecords.add(id);
		}
		selectedRecords = new Set(selectedRecords); // Trigger reactivity
	}

	function selectAll() {
		selectedRecords = new Set(filteredRecords.map(r => r.id));
	}

	function clearSelection() {
		selectedRecords = new Set();
	}

	function openBatchEditModal() {
		if (selectedRecords.size === 0) {
			alert('Please select at least one record to edit');
			return;
		}
		showBatchEditModal = true;
	}

	function closeBatchEditModal() {
		showBatchEditModal = false;
		batchMessage = '';
	}

	function hasSelectedFields() {
		return batchFields.updateMaterialType || batchFields.addSubjects ||
		       batchFields.replaceSubjects || batchFields.addNote;
	}

	async function applyBatchEdits() {
		if (!hasSelectedFields()) {
			batchMessage = 'Error: Please select at least one field to update';
			return;
		}

		if (!confirm(`Apply these changes to ${selectedRecords.size} record(s)? This cannot be undone.`)) {
			return;
		}

		batchEditing = true;
		batchMessage = '';

		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		try {
			// Process each selected record
			for (const recordId of selectedRecords) {
				try {
					const record = records.find(r => r.id === recordId);
					if (!record) continue;

					// Build update object
					const updates: any = {
						updated_at: new Date().toISOString()
					};

					// Material Type
					if (batchFields.updateMaterialType) {
						updates.material_type = batchValues.materialType;
					}

					// Add subjects
					if (batchFields.addSubjects && batchValues.subjectsToAdd.trim()) {
						const newSubjects = batchValues.subjectsToAdd
							.split(',')
							.map(s => s.trim())
							.filter(s => s)
							.map(s => ({ a: s }));

						const existingSubjects = record.subject_topical || [];
						updates.subject_topical = [...existingSubjects, ...newSubjects];
					}

					// Replace subjects
					if (batchFields.replaceSubjects) {
						const subjects = batchValues.subjectsToReplace
							.split(',')
							.map(s => s.trim())
							.filter(s => s)
							.map(s => ({ a: s }));

						updates.subject_topical = subjects;
					}

					// Add note
					if (batchFields.addNote && batchValues.noteToAdd.trim()) {
						const existingNotes = record.general_note || [];
						updates.general_note = [...existingNotes, batchValues.noteToAdd.trim()];
					}

					// Apply update
					const { error: updateError } = await data.supabase
						.from('marc_records')
						.update(updates)
						.eq('id', recordId);

					if (updateError) {
						throw updateError;
					}

					// Update local record
					const recordIndex = records.findIndex(r => r.id === recordId);
					if (recordIndex !== -1) {
						records[recordIndex] = { ...records[recordIndex], ...updates };
					}

					successCount++;
				} catch (err: any) {
					errorCount++;
					errors.push(`Record ${recordId.substring(0, 8)}: ${err.message}`);
				}
			}

			// Show results
			if (errorCount === 0) {
				batchMessage = `✓ Successfully updated ${successCount} record(s)`;
				setTimeout(() => {
					closeBatchEditModal();
					clearSelection();
					applyFilters(); // Refresh display
				}, 2000);
			} else {
				batchMessage = `Updated ${successCount} record(s), ${errorCount} failed:\n${errors.slice(0, 3).join('\n')}`;
			}
		} catch (err: any) {
			batchMessage = `Error: ${err.message}`;
		} finally {
			batchEditing = false;
		}
	}
</script>

<div class="cataloging-page">
	<header class="page-header">
		<h1>Catalog Records</h1>
		<div class="actions">
			<a href="/admin/cataloging/new" class="btn-primary">Create New Record</a>
			<a href="/admin/cataloging/isbn-lookup" class="btn-secondary">ISBN Lookup</a>
			<a href="/admin/cataloging/archives" class="btn-secondary">📦 Archives</a>
			<a href="/admin/cataloging/trash" class="btn-secondary">🗑️ Trash</a>
			<a href="/admin/cataloging/templates" class="btn-secondary">Templates</a>
			<a href="/admin/cataloging/marc-import" class="btn-secondary">MARC Import</a>
			<a href="/admin/cataloging/marc-export" class="btn-secondary">MARC Export</a>
			<a href="/admin/cataloging/export-csv" class="btn-secondary">📊 Export to CSV</a>
			<a href="/admin/cataloging/import-csv" class="btn-secondary">📤 Import from CSV</a>
			<a href="/admin/cataloging/covers/bulk" class="btn-secondary">📷 Manage Covers</a>
			<a href="/admin/cataloging/holdings/bulk" class="btn-secondary">📦 Bulk Create Holdings</a>
			{#if duplicates.size > 0}
				<a href="/admin/cataloging/duplicates" class="btn-duplicates">
					Manage Duplicates ({duplicates.size})
				</a>
			{/if}
		</div>
	</header>

	{#if loading}
		<div class="loading">Loading records...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if records.length === 0}
		<div class="empty-state">
			<h2>No Records Yet</h2>
			<p>Start building your catalog by adding your first record!</p>
			<div class="empty-actions">
				<a href="/admin/cataloging/isbn-lookup" class="btn-primary">
					Try ISBN Lookup
				</a>
				<a href="/admin/cataloging/new" class="btn-secondary">
					Create Manually
				</a>
			</div>
		</div>
	{:else}
		<div class="controls">
			<div class="search-group">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by title, author, or ISBN..."
					class="search-input"
				/>
			</div>
			<div class="filter-controls">
				<select bind:value={sortBy} class="sort-select">
					<option value="date">Sort by Date (Newest First)</option>
					<option value="title">Sort by Title</option>
					<option value="author">Sort by Author</option>
				</select>
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={showDuplicatesOnly} />
					<span>Show Duplicates Only ({duplicates.size})</span>
				</label>
			</div>
		</div>

		{#if selectedRecords.size > 0}
			<div class="batch-actions-bar">
				<div class="batch-info">
					<strong>{selectedRecords.size}</strong> record{selectedRecords.size === 1 ? '' : 's'} selected
				</div>
				<div class="batch-buttons">
					<button class="btn-batch-edit" onclick={openBatchEditModal}>
						Bulk Edit
					</button>
					<button class="btn-batch-clear" onclick={clearSelection}>
						Clear Selection
					</button>
				</div>
			</div>
		{/if}

		<div class="records-list">
			<p class="count">
				Showing {filteredRecords.length} of {records.length} record{records.length === 1 ? '' : 's'}
				{#if duplicates.size > 0}
					<span class="duplicates-info">• {duplicates.size} duplicate{duplicates.size === 1 ? '' : 's'} found</span>
				{/if}
				{#if filteredRecords.length > 0}
					<button class="btn-select-all" onclick={selectAll}>
						Select All {filteredRecords.length}
					</button>
				{/if}
			</p>

			{#each filteredRecords as record}
				<div class="record-card" class:duplicate={duplicates.has(record.id)} class:selected={selectedRecords.has(record.id)}>
					<div class="record-checkbox">
						<input
							type="checkbox"
							checked={selectedRecords.has(record.id)}
							onchange={() => toggleRecordSelection(record.id)}
							aria-label="Select record"
						/>
					</div>
					<div class="record-main">
						<h3>
							<a href="/catalog/record/{record.id}">
								{record.title_statement?.a || 'Untitled'}
							</a>
							{#if duplicates.has(record.id)}
								<span class="duplicate-badge">Duplicate</span>
							{/if}
						</h3>
						{#if record.main_entry_personal_name?.a}
							<p class="author">{record.main_entry_personal_name.a}</p>
						{/if}
						{#if record.isbn}
							<p class="isbn">ISBN: {record.isbn}</p>
						{/if}
						{#if record.publication_info?.c}
							<p class="year">Published: {record.publication_info.c}</p>
						{/if}
					</div>
					<div class="record-actions">
						<a href="/admin/cataloging/edit/{record.id}" class="btn-edit">Edit</a>
						<a href="/admin/cataloging/{record.id}/holdings" class="btn-holdings">Holdings</a>
						<button onclick={() => deleteRecord(record.id)} class="btn-delete">
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showBatchEditModal}
	<div class="modal-backdrop" onclick={closeBatchEditModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Bulk Edit {selectedRecords.size} Record{selectedRecords.size === 1 ? '' : 's'}</h2>
				<button class="modal-close" onclick={closeBatchEditModal}>×</button>
			</div>

			{#if batchMessage}
				<div class={batchMessage.startsWith('Error') ? 'message error' : 'message success'}>
					{batchMessage}
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); applyBatchEdits(); }}>
				<div class="batch-form">
					<p class="form-note">
						Select which fields to update and provide values. Changes will apply to all selected records.
					</p>

					<div class="batch-field">
						<label>
							<input type="checkbox" bind:checked={batchFields.updateMaterialType} />
							<strong>Material Type</strong>
						</label>
						{#if batchFields.updateMaterialType}
							<select bind:value={batchValues.materialType}>
								<option value="book">Book</option>
								<option value="ebook">E-book</option>
								<option value="audiobook">Audiobook</option>
								<option value="dvd">DVD</option>
								<option value="cdrom">CD-ROM</option>
								<option value="serial">Serial</option>
							</select>
						{/if}
					</div>

					<div class="batch-field">
						<label>
							<input type="checkbox" bind:checked={batchFields.addSubjects} />
							<strong>Add Subject Headings</strong>
						</label>
						{#if batchFields.addSubjects}
							<input
								type="text"
								bind:value={batchValues.subjectsToAdd}
								placeholder="Comma-separated subjects (e.g., Fiction, Fantasy)"
							/>
							<small>These will be added to existing subjects (not replaced)</small>
						{/if}
					</div>

					<div class="batch-field">
						<label>
							<input type="checkbox" bind:checked={batchFields.replaceSubjects} />
							<strong>Replace All Subject Headings</strong>
						</label>
						{#if batchFields.replaceSubjects}
							<input
								type="text"
								bind:value={batchValues.subjectsToReplace}
								placeholder="Comma-separated subjects (e.g., Fiction, Fantasy)"
							/>
							<small>This will replace all existing subjects</small>
						{/if}
					</div>

					<div class="batch-field">
						<label>
							<input type="checkbox" bind:checked={batchFields.addNote} />
							<strong>Add General Note</strong>
						</label>
						{#if batchFields.addNote}
							<textarea
								bind:value={batchValues.noteToAdd}
								rows="3"
								placeholder="Note to add to all selected records"
							></textarea>
						{/if}
					</div>
				</div>

				<div class="modal-actions">
					<button type="submit" class="btn-primary" disabled={batchEditing || !hasSelectedFields()}>
						{batchEditing ? 'Applying...' : 'Apply Changes'}
					</button>
					<button type="button" class="btn-cancel" onclick={closeBatchEditModal}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.cataloging-page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d12d34;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-duplicates {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s;
		background: #f59e0b;
		color: white;
		font-weight: 600;
	}

	.btn-duplicates:hover {
		background: #d97706;
	}

	.controls {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
	}

	.search-group {
		margin-bottom: 1rem;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.filter-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.sort-select {
		padding: 0.5rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
	}

	.sort-select:focus {
		outline: none;
		border-color: #e73b42;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: #666;
	}

	.checkbox-label input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
	}

	.error {
		color: #c33;
		background: #fee;
		border: 1px solid #fcc;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
	}

	.empty-state h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.empty-state p {
		color: #666;
		margin-bottom: 2rem;
	}

	.empty-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.count {
		color: #666;
		margin-bottom: 1rem;
	}

	.duplicates-info {
		color: #e73b42;
		font-weight: 500;
	}

	.records-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.batch-actions-bar {
		background: #e73b42;
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 2px 8px rgba(231, 59, 66, 0.2);
	}

	.batch-info {
		font-size: 0.95rem;
	}

	.batch-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.btn-batch-edit,
	.btn-batch-clear {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		font-weight: 500;
	}

	.btn-batch-edit {
		background: white;
		color: #e73b42;
	}

	.btn-batch-edit:hover {
		background: #f5f5f5;
	}

	.btn-batch-clear {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.5);
	}

	.btn-batch-clear:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.btn-select-all {
		margin-left: 1rem;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		cursor: pointer;
		border: 1px solid #e73b42;
		background: transparent;
		color: #e73b42;
		transition: all 0.2s;
	}

	.btn-select-all:hover {
		background: #e73b42;
		color: white;
	}

	.record-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		transition: all 0.2s;
	}

	.record-card.selected {
		border-color: #e73b42;
		background: #fff5f5;
	}

	.record-card.duplicate {
		border-left: 4px solid #f59e0b;
		background: #fffbeb;
	}

	.record-card.duplicate.selected {
		background: #fef3c7;
	}

	.record-checkbox {
		display: flex;
		align-items: flex-start;
		padding-top: 0.5rem;
	}

	.record-checkbox input[type="checkbox"] {
		width: 20px;
		height: 20px;
		cursor: pointer;
		accent-color: #e73b42;
	}

	.record-main {
		flex: 1;
	}

	.record-main h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.record-main h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.record-main h3 a:hover {
		color: #e73b42;
		text-decoration: underline;
	}

	.duplicate-badge {
		background: #f59e0b;
		color: white;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.record-main p {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		color: #666;
	}

	.author {
		font-style: italic;
	}

	.record-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-edit,
	.btn-holdings,
	.btn-delete {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
	}

	.btn-edit {
		background: #e73b42;
		color: white;
	}

	.btn-edit:hover {
		background: #d12d34;
	}

	.btn-holdings {
		background: #f59e0b;
		color: white;
	}

	.btn-holdings:hover {
		background: #d97706;
	}

	.btn-delete {
		background: #f44336;
		color: white;
	}

	.btn-delete:hover {
		background: #d32f2f;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.actions {
			width: 100%;
			flex-direction: column;
		}

		.actions a {
			width: 100%;
			text-align: center;
		}

		.filter-controls {
			flex-direction: column;
			align-items: flex-start;
			width: 100%;
		}

		.sort-select {
			width: 100%;
		}

		.record-card {
			flex-direction: column;
		}

		.record-actions {
			width: 100%;
			justify-content: stretch;
		}

		.btn-edit,
		.btn-holdings,
		.btn-delete {
			flex: 1;
		}
	}

	@media (max-width: 480px) {
		.controls {
			padding: 1rem;
		}

		.record-card {
			padding: 1rem;
		}

		.record-actions {
			flex-direction: column;
		}

		.btn-edit,
		.btn-holdings,
		.btn-delete {
			width: 100%;
		}
	}

	/* Modal styles */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		color: #999;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.modal-close:hover {
		background: #f5f5f5;
		color: #333;
	}

	.message {
		margin: 1rem 1.5rem;
		padding: 1rem;
		border-radius: 4px;
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
		white-space: pre-line;
	}

	.batch-form {
		padding: 1.5rem;
	}

	.form-note {
		background: #f0f9ff;
		border-left: 3px solid #e73b42;
		padding: 0.75rem 1rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
		color: #666;
	}

	.batch-field {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.batch-field:last-of-type {
		border-bottom: none;
	}

	.batch-field label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		cursor: pointer;
		font-size: 0.95rem;
	}

	.batch-field label input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #e73b42;
	}

	.batch-field input[type="text"],
	.batch-field select,
	.batch-field textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		box-sizing: border-box;
	}

	.batch-field input:focus,
	.batch-field select:focus,
	.batch-field textarea:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.batch-field small {
		display: block;
		margin-top: 0.5rem;
		color: #666;
		font-size: 0.8rem;
		font-style: italic;
	}

	.modal-actions {
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.modal-actions .btn-primary,
	.modal-actions .btn-cancel {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		font-weight: 500;
	}

	.modal-actions .btn-primary {
		background: #e73b42;
		color: white;
	}

	.modal-actions .btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.modal-actions .btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-actions .btn-cancel {
		background: #e0e0e0;
		color: #333;
	}

	.modal-actions .btn-cancel:hover {
		background: #d0d0d0;
	}
</style>
