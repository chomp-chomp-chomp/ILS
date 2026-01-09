<script lang="ts">
	import type { PageData } from './$types';
	import ILLRequestQueue from '$lib/components/ILLRequestQueue.svelte';

	let { data }: { data: PageData } = $props();

	let showNewRequestForm = $state(false);
	let message = $state('');
	let formData = $state({
		patron_id: '',
		title: '',
		author: '',
		isbn: '',
		publisher: '',
		publication_year: '',
		material_type: 'book',
		needed_by_date: '',
		pickup_location: '',
		notes: ''
	});

	async function handleStatusChange(id: string, newStatus: string) {
		try {
			const response = await fetch('/api/ill/requests', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, status: newStatus })
			});

			if (!response.ok) throw new Error('Failed to update status');

			message = 'Status updated successfully!';
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error) {
			console.error('Error updating status:', error);
			message = 'Error updating status';
		}
	}

	async function handleSubmit() {
		try {
			const response = await fetch('/api/ill/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					request_type: 'borrowing'
				})
			});

			if (!response.ok) throw new Error('Failed to create request');

			message = 'Borrowing request created successfully!';
			showNewRequestForm = false;
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error) {
			console.error('Error creating request:', error);
			message = 'Error creating request';
		}
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>Borrowing Requests</h1>
		<div class="header-actions">
			<a href="/admin/ill" class="btn btn-secondary">← Back to ILL Dashboard</a>
			<button onclick={() => (showNewRequestForm = true)} class="btn btn-primary">
				New Borrowing Request
			</button>
		</div>
	</div>

	{#if message}
		<div class="message {message.includes('Error') ? 'error' : 'success'}">{message}</div>
	{/if}

	<div class="card">
		<ILLRequestQueue
			requests={data.requests}
			requestType="borrowing"
			onStatusChange={handleStatusChange}
		/>
	</div>
</div>

<!-- New Request Form Modal -->
{#if showNewRequestForm}
	<div class="modal-overlay" onclick={() => (showNewRequestForm = false)}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Create Borrowing Request</h2>
				<button onclick={() => (showNewRequestForm = false)} class="close-btn">×</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="request-form"
			>
				<div class="form-group">
					<label for="patron_id">Patron *</label>
					<select id="patron_id" bind:value={formData.patron_id} required>
						<option value="">Select patron...</option>
						{#each data.patrons as patron}
							<option value={patron.id}>{patron.name} ({patron.email})</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="title">Title *</label>
					<input type="text" id="title" bind:value={formData.title} required />
				</div>

				<div class="form-group">
					<label for="author">Author</label>
					<input type="text" id="author" bind:value={formData.author} />
				</div>

				<div class="form-group">
					<label for="isbn">ISBN</label>
					<input type="text" id="isbn" bind:value={formData.isbn} />
				</div>

				<div class="form-group">
					<label for="publisher">Publisher</label>
					<input type="text" id="publisher" bind:value={formData.publisher} />
				</div>

				<div class="form-group">
					<label for="publication_year">Publication Year</label>
					<input type="text" id="publication_year" bind:value={formData.publication_year} />
				</div>

				<div class="form-group">
					<label for="material_type">Material Type</label>
					<select id="material_type" bind:value={formData.material_type}>
						<option value="book">Book</option>
						<option value="article">Article</option>
						<option value="dvd">DVD</option>
						<option value="periodical">Periodical</option>
						<option value="other">Other</option>
					</select>
				</div>

				<div class="form-group">
					<label for="needed_by_date">Needed By Date</label>
					<input type="date" id="needed_by_date" bind:value={formData.needed_by_date} />
				</div>

				<div class="form-group">
					<label for="pickup_location">Pickup Location</label>
					<input type="text" id="pickup_location" bind:value={formData.pickup_location} />
				</div>

				<div class="form-group full-width">
					<label for="notes">Notes</label>
					<textarea id="notes" bind:value={formData.notes} rows="3"></textarea>
				</div>

				<div class="form-actions">
					<button type="button" onclick={() => (showNewRequestForm = false)} class="btn btn-secondary">
						Cancel
					</button>
					<button type="submit" class="btn btn-primary">Create Request</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 30px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 30px;
	}

	.page-header h1 {
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.message {
		padding: 12px 20px;
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

	.card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 20px;
	}

	.btn {
		display: inline-block;
		padding: 8px 20px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}
	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		max-width: 600px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
	}

	.request-form {
		padding: 20px;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 15px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		margin-bottom: 4px;
		font-weight: 500;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
	}

	.form-actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding-top: 15px;
		border-top: 1px solid #e5e7eb;
	}
</style>
