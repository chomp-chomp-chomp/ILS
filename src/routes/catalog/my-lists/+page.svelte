<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let showCreateModal = $state(false);
	let newListName = $state('');
	let newListDescription = $state('');
	let newListIsPublic = $state(false);
	let creating = $state(false);

	async function createList() {
		if (!newListName.trim()) return;

		creating = true;
		try {
			const response = await fetch('/api/reading-lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newListName.trim(),
					description: newListDescription.trim() || null,
					is_public: newListIsPublic
				})
			});

			if (response.ok) {
				const { list } = await response.json();
				// Navigate to the new list
				goto(`/catalog/my-lists/${list.id}`);
			} else {
				alert('Failed to create list');
			}
		} catch (error) {
			console.error('Error creating list:', error);
			alert('Failed to create list');
		} finally {
			creating = false;
		}
	}

	function openCreateModal() {
		newListName = '';
		newListDescription = '';
		newListIsPublic = false;
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="my-lists-page">
	<header class="page-header">
		<div class="header-top">
			<h1>My Reading Lists</h1>
			<button class="btn-primary" onclick={openCreateModal}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<line x1="12" y1="5" x2="12" y2="19" stroke-width="2" stroke-linecap="round" />
					<line x1="5" y1="12" x2="19" y2="12" stroke-width="2" stroke-linecap="round" />
				</svg>
				New List
			</button>
		</div>
		<p class="header-description">
			Organize your research and reading with personal lists. Share public lists with others.
		</p>
	</header>

	{#if data.lists.length === 0}
		<div class="empty-state">
			<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke-width="2" />
				<polyline points="17 21 17 13 7 13 7 21" stroke-width="2" />
				<polyline points="7 3 7 8 15 8" stroke-width="2" />
			</svg>
			<h2>No Reading Lists Yet</h2>
			<p>Create your first reading list to start organizing books and resources.</p>
			<button class="btn-primary" onclick={openCreateModal}>Create Your First List</button>
		</div>
	{:else}
		<div class="lists-grid">
			{#each data.lists as list}
				<a href="/catalog/my-lists/{list.list_id}" class="list-card">
					<div class="list-card-header">
						<h3>{list.name}</h3>
						{#if list.is_public}
							<span class="badge public">Public</span>
						{:else}
							<span class="badge private">Private</span>
						{/if}
					</div>
					{#if list.description}
						<p class="list-description">{list.description}</p>
					{/if}
					<div class="list-meta">
						<span class="item-count">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
							{list.item_count} {list.item_count === 1 ? 'item' : 'items'}
						</span>
						<span class="updated-date">Updated {formatDate(list.updated_at)}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<!-- Create List Modal -->
{#if showCreateModal}
	<div class="modal-overlay" onclick={closeCreateModal}></div>
	<div class="modal">
		<div class="modal-header">
			<h2>Create Reading List</h2>
			<button class="modal-close" onclick={closeCreateModal}>×</button>
		</div>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				createList();
			}}
		>
			<div class="modal-body">
				<div class="form-group">
					<label for="list-name">List Name *</label>
					<input
						id="list-name"
						type="text"
						bind:value={newListName}
						placeholder="e.g., Summer Reading 2025"
						required
						autofocus
					/>
				</div>

				<div class="form-group">
					<label for="list-description">Description</label>
					<textarea
						id="list-description"
						bind:value={newListDescription}
						placeholder="Optional description of your list"
						rows="3"
					></textarea>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={newListIsPublic} />
						<span>Make this list public (anyone with the link can view it)</span>
					</label>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-secondary" onclick={closeCreateModal}>Cancel</button>
				<button type="submit" class="btn-primary" disabled={creating || !newListName.trim()}>
					{creating ? 'Creating...' : 'Create List'}
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.my-lists-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
	}

	.page-header {
		margin-bottom: 3rem;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
	}

	.header-description {
		margin: 0;
		color: #666;
		font-size: 1rem;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.btn-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

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
		font-size: 1rem;
	}

	.lists-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.list-card {
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.list-card:hover {
		border-color: #667eea;
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
	}

	.list-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.list-card h3 {
		margin: 0;
		font-size: 1.25rem;
		color: #2c3e50;
		flex: 1;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.badge.public {
		background: #e3f2fd;
		color: #1976d2;
	}

	.badge.private {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.list-description {
		margin: 0;
		color: #666;
		font-size: 0.875rem;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.list-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: #666;
		padding-top: 1rem;
		border-top: 1px solid #f0f0f0;
	}

	.item-count {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.item-count svg {
		flex-shrink: 0;
	}

	.updated-date {
		font-size: 0.8125rem;
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

	.form-group:last-child {
		margin-bottom: 0;
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

	.checkbox-label span {
		font-size: 0.875rem;
		color: #666;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		background: #e0e0e0;
		color: #333;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	@media (max-width: 768px) {
		.my-lists-page {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.header-top {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}

		.lists-grid {
			grid-template-columns: 1fr;
		}

		.modal {
			width: 95%;
		}
	}
</style>
