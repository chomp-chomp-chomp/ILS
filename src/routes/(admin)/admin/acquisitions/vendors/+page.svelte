<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let vendors = $state<any[]>([]);
	let loading = $state(true);
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let message = $state('');

	// Form fields
	let name = $state('');
	let code = $state('');
	let status = $state('active');
	let contactPerson = $state('');
	let email = $state('');
	let phone = $state('');
	let fax = $state('');
	let website = $state('');
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let city = $state('');
	let stateProvince = $state('');
	let postalCode = $state('');
	let country = $state('USA');
	let taxId = $state('');
	let paymentTerms = $state('Net 30');
	let currency = $state('USD');
	let discountPercent = $state(0);
	let notes = $state('');
	let isActive = $state(true);

	onMount(async () => {
		await loadVendors();
	});

	async function loadVendors() {
		loading = true;
		const { data: vendorsData } = await supabase
			.from('vendors')
			.select('*')
			.order('name');

		vendors = vendorsData || [];
		loading = false;
	}

	function resetForm() {
		name = '';
		code = '';
		status = 'active';
		contactPerson = '';
		email = '';
		phone = '';
		fax = '';
		website = '';
		addressLine1 = '';
		addressLine2 = '';
		city = '';
		stateProvince = '';
		postalCode = '';
		country = 'USA';
		taxId = '';
		paymentTerms = 'Net 30';
		currency = 'USD';
		discountPercent = 0;
		notes = '';
		isActive = true;
	}

	function editVendor(vendor: any) {
		editingId = vendor.id;
		showForm = true;
		name = vendor.name || '';
		code = vendor.code || '';
		status = vendor.status || 'active';
		contactPerson = vendor.contact_person || '';
		email = vendor.email || '';
		phone = vendor.phone || '';
		fax = vendor.fax || '';
		website = vendor.website || '';
		addressLine1 = vendor.address_line1 || '';
		addressLine2 = vendor.address_line2 || '';
		city = vendor.city || '';
		stateProvince = vendor.state_province || '';
		postalCode = vendor.postal_code || '';
		country = vendor.country || 'USA';
		taxId = vendor.tax_id || '';
		paymentTerms = vendor.payment_terms || 'Net 30';
		currency = vendor.currency || 'USD';
		discountPercent = vendor.discount_percent || 0;
		notes = vendor.notes || '';
		isActive = vendor.is_active !== false;
	}

	async function saveVendor() {
		if (!name.trim()) {
			message = 'Vendor name is required';
			return;
		}

		const vendorData = {
			name: name.trim(),
			code: code.trim() || null,
			status,
			contact_person: contactPerson.trim() || null,
			email: email.trim() || null,
			phone: phone.trim() || null,
			fax: fax.trim() || null,
			website: website.trim() || null,
			address_line1: addressLine1.trim() || null,
			address_line2: addressLine2.trim() || null,
			city: city.trim() || null,
			state_province: stateProvince.trim() || null,
			postal_code: postalCode.trim() || null,
			country: country.trim() || null,
			tax_id: taxId.trim() || null,
			payment_terms: paymentTerms.trim() || null,
			currency,
			discount_percent: discountPercent || 0,
			notes: notes.trim() || null,
			is_active: isActive
		};

		try {
			if (editingId) {
				const { error } = await supabase
					.from('vendors')
					.update(vendorData)
					.eq('id', editingId);

				if (error) throw error;
				message = 'Vendor updated successfully!';
			} else {
				const { error } = await supabase.from('vendors').insert([vendorData]);

				if (error) throw error;
				message = 'Vendor created successfully!';
			}

			showForm = false;
			editingId = null;
			resetForm();
			await loadVendors();

			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}

	async function deleteVendor(vendorId: string) {
		if (!confirm('Are you sure you want to delete this vendor?')) return;

		try {
			const { error } = await supabase.from('vendors').delete().eq('id', vendorId);

			if (error) throw error;

			message = 'Vendor deleted successfully!';
			await loadVendors();
			setTimeout(() => (message = ''), 3000);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		}
	}
</script>

<div class="vendors-page">
	<header class="page-header">
		<div>
			<h1>Vendor Management</h1>
			<p class="subtitle">Manage library material suppliers and service providers</p>
		</div>
		<a href="/admin/acquisitions" class="btn-back">← Back to Acquisitions</a>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<div class="actions-bar">
		<button
			class="btn-primary"
			onclick={() => {
				if (!showForm) {
					resetForm();
					editingId = null;
				}
				showForm = !showForm;
			}}
		>
			{showForm ? 'Cancel' : '+ Add Vendor'}
		</button>
	</div>

	{#if showForm}
		<div class="vendor-form">
			<h3>{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h3>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveVendor();
				}}
			>
				<!-- Basic Information -->
				<div class="form-section">
					<h4>Basic Information</h4>
					<div class="form-row">
						<div class="form-group">
							<label for="name">Vendor Name *</label>
							<input id="name" type="text" bind:value={name} required />
						</div>

						<div class="form-group">
							<label for="code">Vendor Code</label>
							<input id="code" type="text" bind:value={code} placeholder="Internal code" />
						</div>

						<div class="form-group">
							<label for="status">Status</label>
							<select id="status" bind:value={status}>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
								<option value="suspended">Suspended</option>
							</select>
						</div>
					</div>
				</div>

				<!-- Contact Information -->
				<div class="form-section">
					<h4>Contact Information</h4>
					<div class="form-row">
						<div class="form-group">
							<label for="contactPerson">Contact Person</label>
							<input id="contactPerson" type="text" bind:value={contactPerson} />
						</div>

						<div class="form-group">
							<label for="email">Email</label>
							<input id="email" type="email" bind:value={email} />
						</div>

						<div class="form-group">
							<label for="phone">Phone</label>
							<input id="phone" type="tel" bind:value={phone} />
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="fax">Fax</label>
							<input id="fax" type="tel" bind:value={fax} />
						</div>

						<div class="form-group">
							<label for="website">Website</label>
							<input id="website" type="url" bind:value={website} placeholder="https://..." />
						</div>
					</div>
				</div>

				<!-- Address -->
				<div class="form-section">
					<h4>Address</h4>
					<div class="form-row">
						<div class="form-group full-width">
							<label for="addressLine1">Address Line 1</label>
							<input id="addressLine1" type="text" bind:value={addressLine1} />
						</div>
					</div>

					<div class="form-row">
						<div class="form-group full-width">
							<label for="addressLine2">Address Line 2</label>
							<input id="addressLine2" type="text" bind:value={addressLine2} />
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="city">City</label>
							<input id="city" type="text" bind:value={city} />
						</div>

						<div class="form-group">
							<label for="stateProvince">State/Province</label>
							<input id="stateProvince" type="text" bind:value={stateProvince} />
						</div>

						<div class="form-group">
							<label for="postalCode">Postal Code</label>
							<input id="postalCode" type="text" bind:value={postalCode} />
						</div>

						<div class="form-group">
							<label for="country">Country</label>
							<input id="country" type="text" bind:value={country} />
						</div>
					</div>
				</div>

				<!-- Business Details -->
				<div class="form-section">
					<h4>Business Details</h4>
					<div class="form-row">
						<div class="form-group">
							<label for="taxId">Tax ID</label>
							<input id="taxId" type="text" bind:value={taxId} />
						</div>

						<div class="form-group">
							<label for="paymentTerms">Payment Terms</label>
							<select id="paymentTerms" bind:value={paymentTerms}>
								<option value="Net 15">Net 15</option>
								<option value="Net 30">Net 30</option>
								<option value="Net 60">Net 60</option>
								<option value="Net 90">Net 90</option>
								<option value="Due on receipt">Due on receipt</option>
							</select>
						</div>

						<div class="form-group">
							<label for="currency">Currency</label>
							<select id="currency" bind:value={currency}>
								<option value="USD">USD</option>
								<option value="EUR">EUR</option>
								<option value="GBP">GBP</option>
								<option value="CAD">CAD</option>
							</select>
						</div>

						<div class="form-group">
							<label for="discountPercent">Discount %</label>
							<input
								id="discountPercent"
								type="number"
								bind:value={discountPercent}
								min="0"
								max="100"
								step="0.01"
							/>
						</div>
					</div>
				</div>

				<!-- Notes -->
				<div class="form-section">
					<h4>Notes</h4>
					<div class="form-row">
						<div class="form-group full-width">
							<label for="notes">Internal Notes</label>
							<textarea id="notes" bind:value={notes} rows="4"></textarea>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label class="checkbox-label">
								<input type="checkbox" bind:checked={isActive} />
								<span>Active Vendor</span>
							</label>
						</div>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary">
						{editingId ? 'Update Vendor' : 'Create Vendor'}
					</button>
					<button
						type="button"
						class="btn-secondary"
						onclick={() => {
							showForm = false;
							editingId = null;
							resetForm();
						}}
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	<div class="vendors-list">
		{#if loading}
			<p class="loading">Loading vendors...</p>
		{:else if vendors.length === 0}
			<div class="empty-state">
				<p>No vendors yet. Add your first vendor to start managing acquisitions.</p>
			</div>
		{:else}
			<h3>Vendors ({vendors.length})</h3>
			<div class="vendors-grid">
				{#each vendors as vendor}
					<div class="vendor-card">
						<div class="vendor-header">
							<div>
								<h4>{vendor.name}</h4>
								{#if vendor.code}
									<span class="vendor-code">{vendor.code}</span>
								{/if}
							</div>
							<span class="status-badge {vendor.status}">{vendor.status}</span>
						</div>

						<div class="vendor-details">
							{#if vendor.contact_person}
								<div class="detail-item">
									<strong>Contact:</strong>
									{vendor.contact_person}
								</div>
							{/if}
							{#if vendor.email}
								<div class="detail-item">
									<strong>Email:</strong>
									<a href="mailto:{vendor.email}">{vendor.email}</a>
								</div>
							{/if}
							{#if vendor.phone}
								<div class="detail-item">
									<strong>Phone:</strong>
									{vendor.phone}
								</div>
							{/if}
							{#if vendor.payment_terms}
								<div class="detail-item">
									<strong>Terms:</strong>
									{vendor.payment_terms}
								</div>
							{/if}
							{#if vendor.discount_percent}
								<div class="detail-item">
									<strong>Discount:</strong>
									{vendor.discount_percent}%
								</div>
							{/if}
						</div>

						<div class="vendor-actions">
							<button class="btn-edit" onclick={() => editVendor(vendor)}>Edit</button>
							<button class="btn-delete" onclick={() => deleteVendor(vendor.id)}>Delete</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.vendors-page {
		max-width: 1400px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: var(--transition-smooth);
	}

	.btn-back:hover {
		background: var(--border);
	}

	.message {
		padding: 1rem;
		border-radius: var(--radius-sm);
		margin-bottom: 1.5rem;
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

	.actions-bar {
		margin-bottom: 2rem;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
		transition: var(--transition-smooth);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.vendor-form {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
		border: 2px solid var(--accent);
	}

	.vendor-form h3 {
		margin: 0 0 1.5rem 0;
	}

	.form-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h4 {
		margin: 0 0 1rem 0;
		color: var(--text-muted);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-row:last-child {
		margin-bottom: 0;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	input,
	select,
	textarea {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	textarea {
		resize: vertical;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding-top: 0.5rem;
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		margin: 0;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.vendors-list h3 {
		margin: 0 0 1.5rem 0;
	}

	.vendors-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.vendor-card {
		background: white;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.vendor-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.vendor-card h4 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.125rem;
	}

	.vendor-code {
		display: inline-block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		background: var(--bg-secondary);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.active {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.inactive {
		background: #e2e3e5;
		color: #6c757d;
	}

	.status-badge.suspended {
		background: #f8d7da;
		color: #721c24;
	}

	.vendor-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.detail-item {
		color: var(--text-muted);
	}

	.detail-item strong {
		color: var(--text-primary);
	}

	.detail-item a {
		color: var(--accent);
		text-decoration: none;
	}

	.detail-item a:hover {
		text-decoration: underline;
	}

	.vendor-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.btn-edit,
	.btn-delete {
		flex: 1;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
		transition: var(--transition-smooth);
	}

	.btn-edit {
		background: var(--info);
		color: white;
	}

	.btn-edit:hover {
		background: var(--info-hover);
	}

	.btn-delete {
		background: var(--danger);
		color: white;
	}

	.btn-delete:hover {
		background: var(--danger-hover);
	}
</style>
