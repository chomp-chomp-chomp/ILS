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

	onMount(async () => {
		await loadRecords();
	});

	async function loadRecords() {
		try {
			const { data: recordsData, error: fetchError } = await data.supabase
				.from('marc_records')
				.select('*')
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
</script>

<div class="cataloging-page">
	<header class="page-header">
		<h1>Catalog Records</h1>
		<div class="actions">
			<a href="/admin/cataloging/new" class="btn-primary">Create New Record</a>
			<a href="/admin/cataloging/isbn-lookup" class="btn-secondary">ISBN Lookup</a>
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

		<div class="records-list">
			<p class="count">
				Showing {filteredRecords.length} of {records.length} record{records.length === 1 ? '' : 's'}
				{#if duplicates.size > 0}
					<span class="duplicates-info">• {duplicates.size} duplicate{duplicates.size === 1 ? '' : 's'} found</span>
				{/if}
			</p>

			{#each filteredRecords as record}
				<div class="record-card" class:duplicate={duplicates.has(record.id)}>
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

	.record-card.duplicate {
		border-left: 4px solid #f59e0b;
		background: #fffbeb;
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
</style>
