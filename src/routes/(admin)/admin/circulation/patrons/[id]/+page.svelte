<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let patronId = $state('');
	let patron = $state<any>(null);
	let patronType = $state<any>(null);
	let checkouts = $state<any[]>([]);
	let holds = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let editing = $state(false);
	let saving = $state(false);

	// Form fields for editing
	let editForm = $state<any>({});

	onMount(async () => {
		page.subscribe(p => {
			patronId = p.params.id;
			if (patronId) {
				loadPatron();
			}
		});
	});

	async function loadPatron() {
		try {
			loading = true;

			// Load patron details
			const { data: patronData, error: patronError } = await supabase
				.from('patrons')
				.select('*, patron_type:patron_types(*)')
				.eq('id', patronId)
				.single();

			if (patronError) throw patronError;

			patron = patronData;
			patronType = patronData.patron_type;

			// Initialize edit form
			editForm = { ...patron };

			// Load current checkouts
			const { data: checkoutsData, error: checkoutsError } = await supabase
				.from('current_checkouts')
				.select('*')
				.eq('patron_id', patronId);

			if (checkoutsError) throw checkoutsError;
			checkouts = checkoutsData || [];

			// Load active holds
			const { data: holdsData, error: holdsError } = await supabase
				.from('active_holds')
				.select('*')
				.eq('patron_id', patronId);

			if (holdsError) throw holdsError;
			holds = holdsData || [];

		} catch (err: any) {
			error = `Error loading patron: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	async function savePatron() {
		saving = true;
		error = '';

		try {
			const { error: updateError } = await supabase
				.from('patrons')
				.update({
					first_name: editForm.first_name,
					last_name: editForm.last_name,
					email: editForm.email || null,
					phone: editForm.phone || null,
					address_line1: editForm.address_line1 || null,
					address_line2: editForm.address_line2 || null,
					city: editForm.city || null,
					state_province: editForm.state_province || null,
					postal_code: editForm.postal_code || null,
					country: editForm.country || null,
					status: editForm.status,
					expiration_date: editForm.expiration_date || null,
					notes: editForm.notes || null,
					staff_notes: editForm.staff_notes || null
				})
				.eq('id', patronId);

			if (updateError) throw updateError;

			editing = false;
			await loadPatron();
		} catch (err: any) {
			error = `Error saving patron: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	function cancelEdit() {
		editForm = { ...patron };
		editing = false;
		error = '';
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString();
	}

	function formatDateTime(dateString: string | null): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleString();
	}

	function getUrgencyClass(urgency: string): string {
		switch (urgency) {
			case 'overdue': return 'urgency-overdue';
			case 'due_soon': return 'urgency-due-soon';
			default: return '';
		}
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'active': return 'status-active';
			case 'expired': return 'status-expired';
			case 'blocked': return 'status-blocked';
			case 'suspended': return 'status-suspended';
			default: return '';
		}
	}

	async function renewCheckout(checkoutId: string, currentRenewals: number) {
		if (!confirm('Renew this item?')) return;

		try {
			// Check if renewal limit reached
			if (currentRenewals >= patronType.max_renewals) {
				alert(`Cannot renew: maximum renewals (${patronType.max_renewals}) reached.`);
				return;
			}

			// Check if there are holds on this item
			const checkout = checkouts.find(c => c.id === checkoutId);
			const { data: holdsData } = await supabase
				.from('holds')
				.select('id')
				.eq('marc_record_id', checkout.marc_record_id)
				.in('status', ['placed', 'in_transit'])
				.limit(1);

			if (holdsData && holdsData.length > 0) {
				alert('Cannot renew: there are holds on this item.');
				return;
			}

			// Calculate new due date
			const loanPeriodDays = patronType.default_loan_period_days;
			const newDueDate = new Date();
			newDueDate.setDate(newDueDate.getDate() + loanPeriodDays);

			// Update checkout record
			const { error: updateError } = await supabase
				.from('checkouts')
				.update({
					due_date: newDueDate.toISOString(),
					renewal_count: currentRenewals + 1,
					last_renewal_date: new Date().toISOString()
				})
				.eq('id', checkoutId);

			if (updateError) throw updateError;

			// Reload patron data
			await loadPatron();
			alert(`Item renewed successfully. New due date: ${newDueDate.toLocaleDateString()}`);
		} catch (err: any) {
			alert(`Error renewing item: ${err.message}`);
		}
	}

	async function createLogin() {
		if (!patron.email) {
			alert('Patron must have an email address to create a login.');
			return;
		}

		if (patron.user_id) {
			alert('This patron already has a login account.');
			return;
		}

		const password = prompt('Enter a temporary password for this patron (or leave blank to auto-generate):');
		if (password === null) return; // User cancelled

		const tempPassword = password.trim() || generatePassword();

		try {
			// Create Supabase auth user
			const { data: authData, error: authError } = await supabase.auth.admin.createUser({
				email: patron.email,
				password: tempPassword,
				email_confirm: true
			});

			if (authError) throw authError;

			// Link to patron record
			const { error: updateError } = await supabase
				.from('patrons')
				.update({ user_id: authData.user.id })
				.eq('id', patronId);

			if (updateError) throw updateError;

			await loadPatron();
			alert(`Login created successfully!\n\nEmail: ${patron.email}\nTemporary Password: ${tempPassword}\n\nPlease share these credentials with the patron securely.`);
		} catch (err: any) {
			alert(`Error creating login: ${err.message}`);
		}
	}

	function generatePassword(): string {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
		let password = '';
		for (let i = 0; i < 12; i++) {
			password += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return password;
	}
</script>

<div class="patron-detail-page">
	{#if loading}
		<div class="loading">Loading patron details...</div>
	{:else if error && !patron}
		<div class="error">{error}</div>
	{:else if patron}
		<header class="page-header">
			<div>
				<h1>{patron.first_name} {patron.last_name}</h1>
				<p class="barcode">Card: {patron.barcode}</p>
			</div>
			<div class="actions">
				{#if !editing}
					{#if !patron.user_id && patron.email}
						<button onclick={createLogin} class="btn-create-login">Create Login</button>
					{:else if patron.user_id}
						<span class="login-status">✓ Has Login</span>
					{/if}
					<button onclick={() => editing = true} class="btn-primary">Edit Patron</button>
				{/if}
				<a href="/admin/circulation/patrons" class="btn-secondary">Back to List</a>
			</div>
		</header>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		{#if editing}
			<!-- Edit Form -->
			<div class="edit-section">
				<h2>Edit Patron Information</h2>
				<form onsubmit={(e) => { e.preventDefault(); savePatron(); }}>
					<div class="form-row">
						<div class="form-group">
							<label>First Name *</label>
							<input type="text" bind:value={editForm.first_name} required />
						</div>
						<div class="form-group">
							<label>Last Name *</label>
							<input type="text" bind:value={editForm.last_name} required />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>Email</label>
							<input type="email" bind:value={editForm.email} />
						</div>
						<div class="form-group">
							<label>Phone</label>
							<input type="tel" bind:value={editForm.phone} />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group full-width">
							<label>Address Line 1</label>
							<input type="text" bind:value={editForm.address_line1} />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group full-width">
							<label>Address Line 2</label>
							<input type="text" bind:value={editForm.address_line2} />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>City</label>
							<input type="text" bind:value={editForm.city} />
						</div>
						<div class="form-group">
							<label>State/Province</label>
							<input type="text" bind:value={editForm.state_province} />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>Postal Code</label>
							<input type="text" bind:value={editForm.postal_code} />
						</div>
						<div class="form-group">
							<label>Country</label>
							<input type="text" bind:value={editForm.country} />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>Status</label>
							<select bind:value={editForm.status}>
								<option value="active">Active</option>
								<option value="expired">Expired</option>
								<option value="blocked">Blocked</option>
								<option value="suspended">Suspended</option>
							</select>
						</div>
						<div class="form-group">
							<label>Expiration Date</label>
							<input type="date" bind:value={editForm.expiration_date} />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group full-width">
							<label>Public Notes</label>
							<textarea bind:value={editForm.notes} rows="2"></textarea>
						</div>
					</div>
					<div class="form-row">
						<div class="form-group full-width">
							<label>Staff Notes</label>
							<textarea bind:value={editForm.staff_notes} rows="2"></textarea>
						</div>
					</div>
					<div class="form-actions">
						<button type="submit" class="btn-primary" disabled={saving}>
							{saving ? 'Saving...' : 'Save Changes'}
						</button>
						<button type="button" onclick={cancelEdit} class="btn-secondary">
							Cancel
						</button>
					</div>
				</form>
			</div>
		{:else}
			<!-- View Mode -->
			<div class="info-grid">
				<div class="info-card">
					<h2>Account Information</h2>
					<div class="info-row">
						<span class="label">Status:</span>
						<span class="status-badge {getStatusBadgeClass(patron.status)}">
							{patron.status}
						</span>
					</div>
					<div class="info-row">
						<span class="label">Patron Type:</span>
						<span>{patronType.name}</span>
					</div>
					<div class="info-row">
						<span class="label">Registration Date:</span>
						<span>{formatDate(patron.registration_date)}</span>
					</div>
					<div class="info-row">
						<span class="label">Expiration Date:</span>
						<span>{formatDate(patron.expiration_date)}</span>
					</div>
					<div class="info-row">
						<span class="label">Balance:</span>
						<span class:balance-owed={patron.balance > 0}>
							${patron.balance?.toFixed(2) || '0.00'}
						</span>
					</div>
				</div>

				<div class="info-card">
					<h2>Contact Information</h2>
					<div class="info-row">
						<span class="label">Email:</span>
						<span>{patron.email || '—'}</span>
					</div>
					<div class="info-row">
						<span class="label">Phone:</span>
						<span>{patron.phone || '—'}</span>
					</div>
					<div class="info-row">
						<span class="label">Address:</span>
						<span>
							{#if patron.address_line1}
								{patron.address_line1}<br/>
								{#if patron.address_line2}{patron.address_line2}<br/>{/if}
								{#if patron.city || patron.state_province || patron.postal_code}
									{patron.city}{patron.city && patron.state_province ? ', ' : ''}{patron.state_province} {patron.postal_code}
								{/if}
							{:else}
								—
							{/if}
						</span>
					</div>
				</div>
			</div>

			{#if patron.notes || patron.staff_notes}
				<div class="notes-section">
					{#if patron.notes}
						<div class="note-card">
							<h3>Public Notes</h3>
							<p>{patron.notes}</p>
						</div>
					{/if}
					{#if patron.staff_notes}
						<div class="note-card staff-note">
							<h3>Staff Notes (Internal)</h3>
							<p>{patron.staff_notes}</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Current Checkouts -->
			<div class="section">
				<h2>Current Checkouts ({checkouts.length})</h2>
				{#if checkouts.length === 0}
					<p class="empty">No items currently checked out.</p>
				{:else}
					<div class="table-responsive">
						<table>
							<thead>
								<tr>
									<th>Item Barcode</th>
									<th>Title</th>
									<th>Checkout Date</th>
									<th>Due Date</th>
									<th>Renewals</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each checkouts as checkout}
									<tr class={getUrgencyClass(checkout.urgency)}>
										<td class="barcode">{checkout.item_barcode}</td>
										<td>
											<a href="/catalog/record/{checkout.marc_record_id}">
												{checkout.title_statement?.a || 'Untitled'}
											</a>
										</td>
										<td>{formatDate(checkout.checkout_date)}</td>
										<td>{formatDateTime(checkout.due_date)}</td>
										<td class="center">
											{checkout.renewal_count} / {patronType.max_renewals}
										</td>
										<td>
											{#if checkout.urgency === 'overdue'}
												<span class="urgency-badge overdue">OVERDUE</span>
											{:else if checkout.urgency === 'due_soon'}
												<span class="urgency-badge due-soon">Due Soon</span>
											{:else}
												OK
											{/if}
										</td>
										<td class="center">
											<button
												onclick={() => renewCheckout(checkout.id, checkout.renewal_count)}
												class="btn-renew"
												disabled={checkout.renewal_count >= patronType.max_renewals}
											>
												Renew
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Active Holds -->
			<div class="section">
				<h2>Active Holds ({holds.length})</h2>
				{#if holds.length === 0}
					<p class="empty">No active holds.</p>
				{:else}
					<div class="table-responsive">
						<table>
							<thead>
								<tr>
									<th>Title</th>
									<th>Hold Date</th>
									<th>Status</th>
									<th>Queue Position</th>
									<th>Pickup Location</th>
								</tr>
							</thead>
							<tbody>
								{#each holds as hold}
									<tr>
										<td>
											<a href="/catalog/record/{hold.marc_record_id}">
												{hold.title_statement?.a || 'Untitled'}
											</a>
										</td>
										<td>{formatDate(hold.hold_date)}</td>
										<td class="capitalize">{hold.status.replace('_', ' ')}</td>
										<td class="center">{hold.queue_position || '—'}</td>
										<td>{hold.pickup_location || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.patron-detail-page {
		max-width: 1200px;
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

	.barcode {
		font-family: monospace;
		font-size: 0.875rem;
		color: #666;
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 1rem;
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
		margin-bottom: 1.5rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.info-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.info-card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		color: #333;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.label {
		font-weight: 500;
		color: #666;
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-active {
		background: #d4edda;
		color: #155724;
	}

	.status-expired {
		background: #fff3cd;
		color: #856404;
	}

	.status-blocked,
	.status-suspended {
		background: #f8d7da;
		color: #721c24;
	}

	.balance-owed {
		color: #f44336;
		font-weight: 600;
	}

	.notes-section {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.note-card {
		background: #e3f2fd;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #90caf9;
	}

	.note-card.staff-note {
		background: #fff3cd;
		border-color: #ffc107;
	}

	.note-card h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.note-card p {
		margin: 0;
		white-space: pre-wrap;
	}

	.section {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		margin-bottom: 1.5rem;
	}

	.section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
	}

	.empty {
		color: #666;
		font-style: italic;
		margin: 0;
	}

	.table-responsive {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f8f9fa;
		border-bottom: 2px solid #e0e0e0;
	}

	th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
	}

	td {
		padding: 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.875rem;
	}

	tbody tr:hover {
		background: #f8f9fa;
	}

	.urgency-overdue {
		background: #ffebee !important;
	}

	.urgency-due-soon {
		background: #fff3e0 !important;
	}

	.urgency-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.urgency-badge.overdue {
		background: #f44336;
		color: white;
	}

	.urgency-badge.due-soon {
		background: #ff9800;
		color: white;
	}

	.center {
		text-align: center;
	}

	.capitalize {
		text-transform: capitalize;
	}

	.btn-renew {
		padding: 0.375rem 0.75rem;
		background: #28a745;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-renew:hover:not(:disabled) {
		background: #218838;
	}

	.btn-renew:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-create-login {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		background: #28a745;
		color: white;
	}

	.btn-create-login:hover {
		background: #218838;
	}

	.login-status {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		background: #d4edda;
		color: #155724;
		display: inline-block;
	}

	/* Edit Form Styles */
	.edit-section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		margin-bottom: 2rem;
	}

	.edit-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-bottom: 1.5rem;
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
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
		display: inline-block;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.actions {
			width: 100%;
			flex-direction: column;
		}

		.info-grid {
			grid-template-columns: 1fr;
		}

		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
