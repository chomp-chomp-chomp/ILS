<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import BookCover from '$lib/components/BookCover.svelte';

	let { data }: { data: PageData } = $props();

	let showSettings = $state(false);
	let showDeleteConfirm = $state(false);
	let editName = $state(data.list.name);
	let editDescription = $state(data.list.description || '');
	let editIsPublic = $state(data.list.is_public);
	let updating = $state(false);
	let deleting = $state(false);

	async function updateList() {
		updating = true;
		try {
			const response = await fetch(`/api/reading-lists/${data.list.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editName.trim(),
					description: editDescription.trim() || null,
					is_public: editIsPublic
				})
			});

			if (response.ok) {
				location.reload();
			} else {
				alert('Failed to update list');
			}
		} catch (error) {
			console.error('Error updating list:', error);
			alert('Failed to update list');
		} finally {
			updating = false;
		}
	}

	async function deleteList() {
		deleting = true;
		try {
			const response = await fetch(`/api/reading-lists/${data.list.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				goto('/catalog/my-lists');
			} else {
				alert('Failed to delete list');
				deleting = false;
			}
		} catch (error) {
			console.error('Error deleting list:', error);
			alert('Failed to delete list');
			deleting = false;
		}
	}

	async function removeItem(itemId: string) {
		if (!confirm('Remove this item from the list?')) return;

		try {
			const response = await fetch(`/api/reading-lists/${data.list.id}/items/${itemId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				location.reload();
			} else {
				alert('Failed to remove item');
			}
		} catch (error) {
			console.error('Error removing item:', error);
			alert('Failed to remove item');
		}
	}

	function copyShareLink() {
		const url = window.location.href;
		navigator.clipboard
			.writeText(url)
			.then(() => alert('Link copied to clipboard!'))
			.catch(() => alert('Failed to copy link'));
	}

	function exportList() {
		// Build CSV
		const headers = ['Title', 'Author', 'ISBN', 'Publisher', 'Year', 'Material Type'];
		let csvContent = headers.map((h) => `"${h}"`).join(',') + '\n';

		data.items.forEach((item: any) => {
			const record = item.marc_records;
			const row = [
				(record.title_statement?.a || '').replace(/"/g, '""'),
				(record.main_entry_personal_name?.a || '').replace(/"/g, '""'),
				(record.isbn || '').replace(/"/g, '""'),
				(record.publication_info?.b || '').replace(/"/g, '""'),
				(record.publication_info?.c || '').replace(/"/g, '""'),
				(record.material_type || '').replace(/"/g, '""')
			];
			csvContent += row.map((v) => `"${v}"`).join(',') + '\n';
		});

		// Download
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		const filename = `${data.list.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

		link.setAttribute('href', url);
		link.setAttribute('download', filename);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="list-detail-page">
	<header class="page-header">
		<div class="header-main">
			<div>
				<h1>{data.list.name}</h1>
				{#if data.list.description}
					<p class="list-description">{data.list.description}</p>
				{/if}
				<div class="list-meta">
					{#if data.list.is_public}
						<span class="badge public">Public</span>
					{:else}
						<span class="badge private">Private</span>
					{/if}
					<span class="item-count">{data.items.length} {data.items.length === 1 ? 'item' : 'items'}</span>
				</div>
			</div>
			<div class="header-actions">
				<button class="btn-secondary" onclick={exportList}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<polyline
							points="7 10 12 15 17 10"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<line
							x1="12"
							y1="15"
							x2="12"
							y2="3"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Export
				</button>
				{#if data.list.is_public}
					<button class="btn-secondary" onclick={copyShareLink}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle cx="18" cy="5" r="3" stroke-width="2" />
							<circle cx="6" cy="12" r="3" stroke-width="2" />
							<circle cx="18" cy="19" r="3" stroke-width="2" />
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke-width="2" />
							<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke-width="2" />
						</svg>
						Share
					</button>
				{/if}
				<button class="btn-secondary" onclick={() => (showSettings = true)}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="3" stroke-width="2" />
						<path
							d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
					Settings
				</button>
			</div>
		</div>
	</header>

	{#if data.items.length === 0}
		<div class="empty-state">
			<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path
					d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<h2>No Items Yet</h2>
			<p>Search the catalog and add items to this list to start organizing your research.</p>
			<a href="/catalog" class="btn-primary">Search Catalog</a>
		</div>
	{:else}
		<div class="items-list">
			{#each data.items as item}
				{@const record = item.marc_records}
				<article class="item-card">
					<div class="item-cover">
						<BookCover isbn={record.isbn} size="small" />
					</div>
					<div class="item-content">
						<h3>
							<a href="/catalog/record/{record.id}">
								{record.title_statement?.a || 'Untitled'}
							</a>
						</h3>
						{#if record.title_statement?.b}
							<p class="subtitle">{record.title_statement.b}</p>
						{/if}
						{#if record.main_entry_personal_name?.a}
							<p class="author">by {record.main_entry_personal_name.a}</p>
						{/if}
						{#if record.publication_info}
							<p class="publication">
								{#if record.publication_info.b}{record.publication_info.b}{/if}
								{#if record.publication_info.c}{#if record.publication_info.b}, {/if}{record.publication_info
										.c}{/if}
							</p>
						{/if}
						{#if item.notes}
							<div class="item-notes">
								<strong>Notes:</strong>
								{item.notes}
							</div>
						{/if}
					</div>
					<div class="item-actions">
						<button class="btn-remove" onclick={() => removeItem(item.id)} title="Remove from list">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<polyline
									points="3 6 5 6 21 6"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<!-- Settings Modal -->
{#if showSettings}
	<div class="modal-overlay" onclick={() => (showSettings = false)}></div>
	<div class="modal">
		<div class="modal-header">
			<h2>List Settings</h2>
			<button class="modal-close" onclick={() => (showSettings = false)}>×</button>
		</div>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				updateList();
			}}
		>
			<div class="modal-body">
				<div class="form-group">
					<label for="edit-name">List Name *</label>
					<input id="edit-name" type="text" bind:value={editName} required />
				</div>

				<div class="form-group">
					<label for="edit-description">Description</label>
					<textarea id="edit-description" bind:value={editDescription} rows="3"></textarea>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={editIsPublic} />
						<span>Make this list public</span>
					</label>
				</div>

				<div class="danger-zone">
					<h3>Danger Zone</h3>
					<p>Once you delete a list, all items will be removed permanently.</p>
					<button type="button" class="btn-danger" onclick={() => (showDeleteConfirm = true)}>
						Delete List
					</button>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-secondary" onclick={() => (showSettings = false)}
					>Cancel</button
				>
				<button type="submit" class="btn-primary" disabled={updating || !editName.trim()}>
					{updating ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</form>
	</div>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteConfirm}
	<div class="modal-overlay" onclick={() => (showDeleteConfirm = false)}></div>
	<div class="modal modal-small">
		<div class="modal-header">
			<h2>Delete List?</h2>
			<button class="modal-close" onclick={() => (showDeleteConfirm = false)}>×</button>
		</div>
		<div class="modal-body">
			<p>
				Are you sure you want to delete <strong>{data.list.name}</strong>? This action cannot be
				undone.
			</p>
		</div>
		<div class="modal-footer">
			<button class="btn-secondary" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
			<button class="btn-danger" onclick={deleteList} disabled={deleting}>
				{deleting ? 'Deleting...' : 'Delete List'}
			</button>
		</div>
	</div>
{/if}

<style>
	.list-detail-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
	}

	.page-header {
		margin-bottom: 3rem;
	}

	.header-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
	}

	.list-description {
		margin: 0 0 1rem 0;
		color: #666;
		font-size: 1rem;
		line-height: 1.6;
	}

	.list-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge.public {
		background: #e3f2fd;
		color: #1976d2;
	}

	.badge.private {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.item-count {
		font-size: 0.875rem;
		color: #666;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
	}

	.btn-primary,
	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
		text-decoration: none;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.btn-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-secondary svg,
	.btn-primary svg {
		flex-shrink: 0;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.empty-state svg {
		color: #ccc;
		margin-bottom: 1.5rem;
	}

	.empty-state h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.empty-state p {
		margin: 0 0 2rem 0;
		color: #666;
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.item-card {
		display: grid;
		grid-template-columns: 80px 1fr auto;
		gap: 1.5rem;
		padding: 1.5rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.item-cover {
		width: 80px;
	}

	.item-content {
		min-width: 0;
	}

	.item-content h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.item-content h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.item-content h3 a:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.subtitle {
		margin: 0 0 0.5rem 0;
		color: #666;
		font-style: italic;
		font-size: 0.875rem;
	}

	.author {
		margin: 0 0 0.25rem 0;
		color: #333;
		font-size: 0.875rem;
	}

	.publication {
		margin: 0 0 0.75rem 0;
		color: #666;
		font-size: 0.875rem;
	}

	.item-notes {
		margin-top: 1rem;
		padding: 0.75rem;
		background: #f8f9fa;
		border-radius: 4px;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.item-notes strong {
		color: #333;
	}

	.item-actions {
		display: flex;
		align-items: flex-start;
	}

	.btn-remove {
		padding: 0.5rem;
		background: none;
		border: 1px solid #ddd;
		border-radius: 4px;
		color: #666;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-remove:hover {
		background: #fee;
		border-color: #f44336;
		color: #f44336;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow: hidden;
		z-index: 2001;
		animation: modalSlideIn 0.3s ease-out;
	}

	.modal-small {
		max-width: 400px;
	}

	@keyframes modalSlideIn {
		from {
			transform: translate(-50%, -60%);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%);
			opacity: 1;
		}
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
		font-size: 1.25rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.modal-close:hover {
		background: #f0f0f0;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		max-height: calc(90vh - 160px);
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
		font-size: 0.875rem;
	}

	input[type='text'],
	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	input[type='text']:focus,
	textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: normal;
	}

	.checkbox-label input[type='checkbox'] {
		margin-top: 0.125rem;
		cursor: pointer;
	}

	.danger-zone {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid #e0e0e0;
	}

	.danger-zone h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: #d32f2f;
	}

	.danger-zone p {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		color: #666;
	}

	.btn-danger {
		padding: 0.75rem 1.5rem;
		background: #f44336;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-danger:hover {
		background: #d32f2f;
	}

	.btn-danger:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	@media (max-width: 768px) {
		.list-detail-page {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.header-main {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
		}

		.header-actions button {
			flex: 1;
		}

		.item-card {
			grid-template-columns: 60px 1fr;
			gap: 1rem;
		}

		.item-cover {
			width: 60px;
		}

		.item-actions {
			grid-column: 1 / -1;
			justify-content: center;
		}

		.modal {
			width: 95%;
		}
	}
</style>
