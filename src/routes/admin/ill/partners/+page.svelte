<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchTerm = $state(data.search);
	let showInactive = $state(!data.activeOnly);
	let message = $state('');
	let editingPartner: any = $state(null);
	let showForm = $state(false);

	// Form state
	let formData = $state({
		id: '',
		library_name: '',
		library_code: '',
		library_type: 'public',
		contact_name: '',
		contact_email: '',
		contact_phone: '',
		address_line1: '',
		address_line2: '',
		city: '',
		state: '',
		postal_code: '',
		country: 'USA',
		ill_email: '',
		ill_phone: '',
		shipping_notes: '',
		agreement_type: 'reciprocal',
		lending_allowed: true,
		borrowing_allowed: true,
		max_loans_per_patron: 5,
		loan_period_days: 21,
		renewal_allowed: true,
		is_active: true,
		notes: ''
	});

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchTerm) params.set('search', searchTerm);
		if (showInactive) params.set('active', 'false');
		goto(`/admin/ill/partners?${params.toString()}`);
	}

	function openAddForm() {
		editingPartner = null;
		formData = {
			id: '',
			library_name: '',
			library_code: '',
			library_type: 'public',
			contact_name: '',
			contact_email: '',
			contact_phone: '',
			address_line1: '',
			address_line2: '',
			city: '',
			state: '',
			postal_code: '',
			country: 'USA',
			ill_email: '',
			ill_phone: '',
			shipping_notes: '',
			agreement_type: 'reciprocal',
			lending_allowed: true,
			borrowing_allowed: true,
			max_loans_per_patron: 5,
			loan_period_days: 21,
			renewal_allowed: true,
			is_active: true,
			notes: ''
		};
		showForm = true;
	}

	function openEditForm(partner: any) {
		editingPartner = partner;
		formData = { ...partner };
		showForm = true;
	}

	function closeForm() {
		showForm = false;
		editingPartner = null;
	}

	async function handleSubmit() {
		try {
			const method = editingPartner ? 'PUT' : 'POST';
			const response = await fetch('/api/ill/partners', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			if (!response.ok) throw new Error('Failed to save partner');

			message = `Partner ${editingPartner ? 'updated' : 'created'} successfully!`;
			closeForm();
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error) {
			console.error('Error saving partner:', error);
			message = 'Error saving partner library';
		}
	}

	async function handleDelete(id: string, name: string) {
		if (!confirm(`Are you sure you want to delete ${name}?`)) return;

		try {
			const response = await fetch(`/api/ill/partners?id=${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to delete partner');
			}

			message = 'Partner deleted successfully!';
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error: any) {
			console.error('Error deleting partner:', error);
			message = error.message || 'Error deleting partner library';
		}
	}

	async function toggleActive(partner: any) {
		try {
			const response = await fetch('/api/ill/partners', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: partner.id,
					is_active: !partner.is_active
				})
			});

			if (!response.ok) throw new Error('Failed to update partner');

			message = `Partner ${partner.is_active ? 'deactivated' : 'activated'}!`;
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error) {
			console.error('Error updating partner:', error);
			message = 'Error updating partner library';
		}
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>Partner Libraries</h1>
		<div class="header-actions">
			<a href="/admin/ill" class="btn btn-secondary">← Back to ILL Dashboard</a>
			<button onclick={openAddForm} class="btn btn-primary">Add Partner Library</button>
		</div>
	</div>

	{#if message}
		<div class="message {message.includes('Error') ? 'error' : 'success'}">{message}</div>
	{/if}

	<!-- Search and Filters -->
	<div class="card">
		<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="search-form">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search by library name, code, or city..."
				class="search-input"
			/>
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={showInactive} />
				Show inactive partners
			</label>
			<button type="submit" class="btn btn-primary">Search</button>
		</form>
	</div>

	<!-- Partners List -->
	<div class="card">
		<h2>Partner Libraries ({data.partners.length})</h2>

		{#if data.partners.length > 0}
			<div class="table-responsive">
				<table>
					<thead>
						<tr>
							<th>Library Name</th>
							<th>Code</th>
							<th>Type</th>
							<th>Location</th>
							<th>Contact</th>
							<th>Agreement</th>
							<th>Stats</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.partners as partner}
							<tr class:inactive={!partner.is_active}>
								<td>
									<strong>{partner.library_name}</strong>
								</td>
								<td>{partner.library_code || 'N/A'}</td>
								<td>
									<span class="badge badge-secondary">{partner.library_type || 'N/A'}</span>
								</td>
								<td>
									{partner.city || 'N/A'}, {partner.state || 'N/A'}
								</td>
								<td>
									{#if partner.ill_email}
										<a href="mailto:{partner.ill_email}">{partner.ill_email}</a>
									{:else}
										N/A
									{/if}
								</td>
								<td>{partner.agreement_type || 'N/A'}</td>
								<td>
									<small>
										Borrowed: {partner.total_borrowed}<br />
										Lent: {partner.total_lent}
									</small>
								</td>
								<td>
									{#if partner.is_active}
										<span class="badge badge-success">Active</span>
									{:else}
										<span class="badge badge-secondary">Inactive</span>
									{/if}
								</td>
								<td>
									<div class="action-buttons">
										<button onclick={() => openEditForm(partner)} class="btn btn-sm btn-secondary">
											Edit
										</button>
										<button
											onclick={() => toggleActive(partner)}
											class="btn btn-sm {partner.is_active ? 'btn-warning' : 'btn-success'}"
										>
											{partner.is_active ? 'Deactivate' : 'Activate'}
										</button>
										<button
											onclick={() => handleDelete(partner.id, partner.library_name)}
											class="btn btn-sm btn-error"
										>
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="empty-state">No partner libraries found. Add your first partner to get started!</p>
		{/if}
	</div>
</div>

<!-- Add/Edit Modal -->
{#if showForm}
	<div class="modal-overlay" onclick={closeForm}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{editingPartner ? 'Edit Partner Library' : 'Add Partner Library'}</h2>
				<button onclick={closeForm} class="close-btn">×</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="partner-form">
				<div class="form-section">
					<h3>Library Information</h3>
					<div class="form-grid">
						<div class="form-group">
							<label for="library_name">Library Name *</label>
							<input
								type="text"
								id="library_name"
								bind:value={formData.library_name}
								required
							/>
						</div>

						<div class="form-group">
							<label for="library_code">Library Code</label>
							<input type="text" id="library_code" bind:value={formData.library_code} />
						</div>

						<div class="form-group">
							<label for="library_type">Library Type</label>
							<select id="library_type" bind:value={formData.library_type}>
								<option value="public">Public</option>
								<option value="academic">Academic</option>
								<option value="special">Special</option>
								<option value="school">School</option>
								<option value="government">Government</option>
							</select>
						</div>
					</div>
				</div>

				<div class="form-section">
					<h3>Contact Information</h3>
					<div class="form-grid">
						<div class="form-group">
							<label for="contact_name">Contact Name</label>
							<input type="text" id="contact_name" bind:value={formData.contact_name} />
						</div>

						<div class="form-group">
							<label for="contact_email">Contact Email</label>
							<input type="email" id="contact_email" bind:value={formData.contact_email} />
						</div>

						<div class="form-group">
							<label for="contact_phone">Contact Phone</label>
							<input type="tel" id="contact_phone" bind:value={formData.contact_phone} />
						</div>

						<div class="form-group">
							<label for="ill_email">ILL Email</label>
							<input type="email" id="ill_email" bind:value={formData.ill_email} />
						</div>

						<div class="form-group">
							<label for="ill_phone">ILL Phone</label>
							<input type="tel" id="ill_phone" bind:value={formData.ill_phone} />
						</div>
					</div>
				</div>

				<div class="form-section">
					<h3>Address</h3>
					<div class="form-grid">
						<div class="form-group full-width">
							<label for="address_line1">Address Line 1</label>
							<input type="text" id="address_line1" bind:value={formData.address_line1} />
						</div>

						<div class="form-group full-width">
							<label for="address_line2">Address Line 2</label>
							<input type="text" id="address_line2" bind:value={formData.address_line2} />
						</div>

						<div class="form-group">
							<label for="city">City</label>
							<input type="text" id="city" bind:value={formData.city} />
						</div>

						<div class="form-group">
							<label for="state">State</label>
							<input type="text" id="state" bind:value={formData.state} />
						</div>

						<div class="form-group">
							<label for="postal_code">Postal Code</label>
							<input type="text" id="postal_code" bind:value={formData.postal_code} />
						</div>

						<div class="form-group">
							<label for="country">Country</label>
							<input type="text" id="country" bind:value={formData.country} />
						</div>
					</div>
				</div>

				<div class="form-section">
					<h3>ILL Agreement</h3>
					<div class="form-grid">
						<div class="form-group">
							<label for="agreement_type">Agreement Type</label>
							<select id="agreement_type" bind:value={formData.agreement_type}>
								<option value="reciprocal">Reciprocal</option>
								<option value="fee-based">Fee-Based</option>
								<option value="consortial">Consortial</option>
							</select>
						</div>

						<div class="form-group">
							<label for="max_loans">Max Loans per Patron</label>
							<input
								type="number"
								id="max_loans"
								bind:value={formData.max_loans_per_patron}
								min="1"
							/>
						</div>

						<div class="form-group">
							<label for="loan_period">Loan Period (days)</label>
							<input type="number" id="loan_period" bind:value={formData.loan_period_days} min="1" />
						</div>

						<div class="form-group checkbox-group">
							<label>
								<input type="checkbox" bind:checked={formData.lending_allowed} />
								Lending Allowed
							</label>
						</div>

						<div class="form-group checkbox-group">
							<label>
								<input type="checkbox" bind:checked={formData.borrowing_allowed} />
								Borrowing Allowed
							</label>
						</div>

						<div class="form-group checkbox-group">
							<label>
								<input type="checkbox" bind:checked={formData.renewal_allowed} />
								Renewal Allowed
							</label>
						</div>

						<div class="form-group checkbox-group">
							<label>
								<input type="checkbox" bind:checked={formData.is_active} />
								Active
							</label>
						</div>
					</div>
				</div>

				<div class="form-section">
					<div class="form-group full-width">
						<label for="shipping_notes">Shipping Notes</label>
						<textarea id="shipping_notes" bind:value={formData.shipping_notes} rows="2"></textarea>
					</div>

					<div class="form-group full-width">
						<label for="notes">General Notes</label>
						<textarea id="notes" bind:value={formData.notes} rows="3"></textarea>
					</div>
				</div>

				<div class="form-actions">
					<button type="button" onclick={closeForm} class="btn btn-secondary">Cancel</button>
					<button type="submit" class="btn btn-primary">
						{editingPartner ? 'Update' : 'Create'} Partner
					</button>
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
		margin-bottom: 20px;
	}

	.card h2 {
		margin: 0 0 20px 0;
	}

	.search-form {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.search-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.table-responsive {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #e5e7eb;
	}

	th {
		background: #f9fafb;
		font-weight: 600;
	}

	tbody tr:hover {
		background: #f9fafb;
	}

	tbody tr.inactive {
		opacity: 0.6;
	}

	.action-buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.badge-success {
		background: #10b981;
		color: white;
	}
	.badge-secondary {
		background: #6b7280;
		color: white;
	}

	.empty-state {
		text-align: center;
		color: #6b7280;
		padding: 40px;
	}

	.btn {
		display: inline-block;
		padding: 8px 20px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}
	.btn-primary:hover {
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
	.btn-success {
		background: #10b981;
		color: white;
	}
	.btn-warning {
		background: #f59e0b;
		color: white;
	}
	.btn-error {
		background: #ef4444;
		color: white;
	}
	.btn-sm {
		padding: 4px 12px;
		font-size: 14px;
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
		overflow-y: auto;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		max-width: 800px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		margin: 20px;
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
		color: #6b7280;
	}

	.partner-form {
		padding: 20px;
	}

	.form-section {
		margin-bottom: 30px;
	}

	.form-section h3 {
		margin: 0 0 15px 0;
		color: #374151;
		font-size: 16px;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 8px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
		color: #374151;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-family: inherit;
	}

	.form-group.checkbox-group {
		flex-direction: row;
		align-items: center;
	}

	.form-group.checkbox-group label {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding-top: 20px;
		border-top: 1px solid #e5e7eb;
	}
</style>
