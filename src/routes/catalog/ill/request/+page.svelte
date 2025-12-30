<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let message = $state('');
	let submitting = $state(false);

	let formData = $state({
		title: '',
		author: '',
		isbn: '',
		issn: '',
		publisher: '',
		publication_year: '',
		edition: '',
		material_type: 'book',
		needed_by_date: '',
		pickup_location: '',
		notes: ''
	});

	async function handleSubmit() {
		if (!data.patron) {
			message = 'Error: Patron information not found';
			return;
		}

		submitting = true;
		try {
			const response = await fetch('/api/ill/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					request_type: 'borrowing',
					patron_id: data.patron.id,
					patron_name: data.patron.name,
					patron_email: data.patron.email,
					status: 'pending'
				})
			});

			if (!response.ok) throw new Error('Failed to create request');

			message = 'Your ILL request has been submitted successfully! You will be notified when it is approved.';
			setTimeout(() => {
				goto('/catalog/ill/my-requests');
			}, 2000);
		} catch (error) {
			console.error('Error creating request:', error);
			message = 'Error submitting request. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>Request Interlibrary Loan</h1>
		<a href="/catalog" class="btn btn-secondary">← Back to Catalog</a>
	</div>

	<div class="info-box">
		<h3>What is Interlibrary Loan (ILL)?</h3>
		<p>
			Interlibrary Loan allows you to request books and materials that are not in our collection.
			We will search our partner libraries and try to borrow the item for you. Please allow 1-2
			weeks for processing.
		</p>
		<ul>
			<li>Free for most materials</li>
			<li>Standard loan period: 3 weeks</li>
			<li>You will be notified when the item arrives</li>
			<li>Items must be returned by the due date</li>
		</ul>
	</div>

	{#if message}
		<div class="message {message.includes('Error') ? 'error' : 'success'}">{message}</div>
	{/if}

	<div class="card">
		<h2>Request Form</h2>
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="ill-form">
			<div class="form-section">
				<h3>Item Information</h3>
				<div class="form-grid">
					<div class="form-group full-width">
						<label for="title">Title *</label>
						<input
							type="text"
							id="title"
							bind:value={formData.title}
							required
							placeholder="Enter the full title of the item"
						/>
					</div>

					<div class="form-group">
						<label for="author">Author/Creator</label>
						<input
							type="text"
							id="author"
							bind:value={formData.author}
							placeholder="Author's name"
						/>
					</div>

					<div class="form-group">
						<label for="material_type">Material Type *</label>
						<select id="material_type" bind:value={formData.material_type} required>
							<option value="book">Book</option>
							<option value="article">Journal Article</option>
							<option value="dvd">DVD/Video</option>
							<option value="cd">CD/Audio</option>
							<option value="periodical">Magazine/Periodical</option>
							<option value="other">Other</option>
						</select>
					</div>

					<div class="form-group">
						<label for="isbn">ISBN (if known)</label>
						<input type="text" id="isbn" bind:value={formData.isbn} placeholder="978-0-00-000000-0" />
					</div>

					<div class="form-group">
						<label for="issn">ISSN (for journals)</label>
						<input type="text" id="issn" bind:value={formData.issn} placeholder="0000-0000" />
					</div>

					<div class="form-group">
						<label for="publisher">Publisher</label>
						<input type="text" id="publisher" bind:value={formData.publisher} />
					</div>

					<div class="form-group">
						<label for="publication_year">Publication Year</label>
						<input type="text" id="publication_year" bind:value={formData.publication_year} placeholder="2023" />
					</div>

					<div class="form-group">
						<label for="edition">Edition</label>
						<input type="text" id="edition" bind:value={formData.edition} placeholder="1st, 2nd, etc." />
					</div>
				</div>
			</div>

			<div class="form-section">
				<h3>Request Details</h3>
				<div class="form-grid">
					<div class="form-group">
						<label for="needed_by_date">Needed By Date (optional)</label>
						<input type="date" id="needed_by_date" bind:value={formData.needed_by_date} />
					</div>

					<div class="form-group">
						<label for="pickup_location">Preferred Pickup Location</label>
						<input
							type="text"
							id="pickup_location"
							bind:value={formData.pickup_location}
							placeholder="e.g., Main Library"
						/>
					</div>

					<div class="form-group full-width">
						<label for="notes">Additional Information</label>
						<textarea
							id="notes"
							bind:value={formData.notes}
							rows="4"
							placeholder="Any additional information that might help us locate this item..."
						></textarea>
					</div>
				</div>
			</div>

			<div class="form-section patron-info">
				<h3>Your Information</h3>
				<div class="info-grid">
					<div class="info-item">
						<strong>Name:</strong> {data.patron?.name || 'N/A'}
					</div>
					<div class="info-item">
						<strong>Email:</strong> {data.patron?.email || 'N/A'}
					</div>
					{#if data.patron?.barcode}
						<div class="info-item">
							<strong>Barcode:</strong> {data.patron.barcode}
						</div>
					{/if}
				</div>
			</div>

			<div class="form-actions">
				<button type="button" onclick={() => goto('/catalog')} class="btn btn-secondary">
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					{submitting ? 'Submitting...' : 'Submit Request'}
				</button>
			</div>
		</form>
	</div>

	<div class="help-box">
		<h3>Need Help?</h3>
		<p>
			If you have questions about interlibrary loan or need assistance completing this form, please
			contact the library.
		</p>
		<a href="/catalog/ill/my-requests" class="btn btn-secondary">View My ILL Requests</a>
	</div>
</div>

<style>
	.container {
		max-width: 900px;
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
		color: #333;
	}

	.info-box {
		background: #f0f9ff;
		border-left: 4px solid #3b82f6;
		padding: 20px;
		margin-bottom: 30px;
		border-radius: 4px;
	}

	.info-box h3 {
		margin: 0 0 12px 0;
		color: #1e40af;
	}

	.info-box p {
		margin: 0 0 12px 0;
	}

	.info-box ul {
		margin: 0;
		padding-left: 20px;
	}

	.info-box li {
		margin-bottom: 6px;
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
		padding: 30px;
		margin-bottom: 30px;
	}

	.card h2 {
		margin: 0 0 30px 0;
		color: #333;
		border-bottom: 2px solid #e73b42;
		padding-bottom: 12px;
	}

	.ill-form {
		display: flex;
		flex-direction: column;
		gap: 30px;
	}

	.form-section {
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 30px;
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h3 {
		margin: 0 0 20px 0;
		color: #374151;
		font-size: 18px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		margin-bottom: 6px;
		font-weight: 500;
		color: #374151;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 10px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-family: inherit;
		font-size: 14px;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.patron-info {
		background: #f9fafb;
		padding: 20px;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 15px;
	}

	.info-item {
		color: #374151;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding-top: 20px;
	}

	.btn {
		display: inline-block;
		padding: 10px 24px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d32f36;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f9fafb;
	}

	.help-box {
		background: #fffbeb;
		border-left: 4px solid #f59e0b;
		padding: 20px;
		border-radius: 4px;
	}

	.help-box h3 {
		margin: 0 0 12px 0;
		color: #92400e;
	}

	.help-box p {
		margin: 0 0 15px 0;
	}

	@media (max-width: 768px) {
		.form-grid {
			grid-template-columns: 1fr;
		}

		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 15px;
		}
	}
</style>
