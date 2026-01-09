<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let loading = $state(false);
	let error = $state('');
	let patronTypes = $state<any[]>([]);

	// Form fields
	let barcode = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let city = $state('');
	let stateProvince = $state('');
	let postalCode = $state('');
	let country = $state('');
	let patronTypeId = $state('');
	let status = $state('active');
	let registrationDate = $state(new Date().toISOString().split('T')[0]);
	let expirationDate = $state('');
	let notes = $state('');
	let staffNotes = $state('');

	onMount(async () => {
		await loadPatronTypes();
		// Auto-generate barcode
		await generateBarcode();
	});

	async function loadPatronTypes() {
		try {
			const { data: typesData, error: fetchError } = await data.supabase
				.from('patron_types')
				.select('*')
				.eq('is_active', true)
				.order('name', { ascending: true });

			if (fetchError) throw fetchError;

			patronTypes = typesData || [];
			if (patronTypes.length > 0 && !patronTypeId) {
				patronTypeId = patronTypes[0].id;
			}
		} catch (err: any) {
			console.error('Error loading patron types:', err);
		}
	}

	async function generateBarcode() {
		try {
			const { data: result, error: rpcError } = await data.supabase
				.rpc('generate_patron_barcode');

			if (rpcError) throw rpcError;

			barcode = result;
		} catch (err: any) {
			console.error('Error generating barcode:', err);
			// Fallback: generate client-side
			barcode = '2' + Math.floor(Math.random() * 9999999999999).toString().padStart(13, '0');
		}
	}

	async function handleSubmit() {
		loading = true;
		error = '';

		// Validate required fields
		if (!firstName.trim() || !lastName.trim() || !barcode.trim() || !patronTypeId) {
			error = 'Please fill in all required fields.';
			loading = false;
			return;
		}

		try {
			const { data: newPatron, error: insertError } = await data.supabase
				.from('patrons')
				.insert({
					barcode,
					first_name: firstName.trim(),
					last_name: lastName.trim(),
					email: email.trim() || null,
					phone: phone.trim() || null,
					address_line1: addressLine1.trim() || null,
					address_line2: addressLine2.trim() || null,
					city: city.trim() || null,
					state_province: stateProvince.trim() || null,
					postal_code: postalCode.trim() || null,
					country: country.trim() || null,
					patron_type_id: patronTypeId,
					status,
					registration_date: registrationDate,
					expiration_date: expirationDate || null,
					notes: notes.trim() || null,
					staff_notes: staffNotes.trim() || null
				})
				.select()
				.single();

			if (insertError) throw insertError;

			goto(`/admin/circulation/patrons/${newPatron.id}`);
		} catch (err: any) {
			error = `Error creating patron: ${err.message}`;
			loading = false;
		}
	}
</script>

<div class="new-patron-page">
	<header class="page-header">
		<h1>Add New Patron</h1>
		<div class="actions">
			<a href="/admin/circulation/patrons" class="btn-secondary">Cancel</a>
		</div>
	</header>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<div class="form-section">
			<h2>Library Card</h2>
			<div class="form-row">
				<div class="form-group">
					<label for="barcode">Barcode *</label>
					<div class="barcode-group">
						<input
							id="barcode"
							type="text"
							bind:value={barcode}
							required
							class="barcode-input"
						/>
						<button type="button" onclick={generateBarcode} class="btn-generate">
							Generate New
						</button>
					</div>
					<small>14-digit library card number</small>
				</div>
			</div>
		</div>

		<div class="form-section">
			<h2>Personal Information</h2>
			<div class="form-row">
				<div class="form-group">
					<label for="firstName">First Name *</label>
					<input id="firstName" type="text" bind:value={firstName} required />
				</div>
				<div class="form-group">
					<label for="lastName">Last Name *</label>
					<input id="lastName" type="text" bind:value={lastName} required />
				</div>
			</div>
			<div class="form-row">
				<div class="form-group">
					<label for="email">Email</label>
					<input id="email" type="email" bind:value={email} />
				</div>
				<div class="form-group">
					<label for="phone">Phone</label>
					<input id="phone" type="tel" bind:value={phone} />
				</div>
			</div>
		</div>

		<div class="form-section">
			<h2>Address</h2>
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
			</div>
			<div class="form-row">
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

		<div class="form-section">
			<h2>Account Details</h2>
			<div class="form-row">
				<div class="form-group">
					<label for="patronType">Patron Type *</label>
					<select id="patronType" bind:value={patronTypeId} required>
						{#each patronTypes as type}
							<option value={type.id}>{type.name} - Max {type.max_checkouts} checkouts</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label for="status">Status</label>
					<select id="status" bind:value={status}>
						<option value="active">Active</option>
						<option value="expired">Expired</option>
						<option value="blocked">Blocked</option>
						<option value="suspended">Suspended</option>
					</select>
				</div>
			</div>
			<div class="form-row">
				<div class="form-group">
					<label for="registrationDate">Registration Date</label>
					<input id="registrationDate" type="date" bind:value={registrationDate} />
				</div>
				<div class="form-group">
					<label for="expirationDate">Expiration Date</label>
					<input id="expirationDate" type="date" bind:value={expirationDate} />
				</div>
			</div>
		</div>

		<div class="form-section">
			<h2>Notes</h2>
			<div class="form-row">
				<div class="form-group full-width">
					<label for="notes">Public Notes</label>
					<textarea id="notes" bind:value={notes} rows="3"></textarea>
					<small>Visible to patrons</small>
				</div>
			</div>
			<div class="form-row">
				<div class="form-group full-width">
					<label for="staffNotes">Staff Notes</label>
					<textarea id="staffNotes" bind:value={staffNotes} rows="3"></textarea>
					<small>Internal only, not visible to patrons</small>
				</div>
			</div>
		</div>

		<div class="form-actions">
			<button type="submit" class="btn-primary" disabled={loading}>
				{loading ? 'Creating Patron...' : 'Create Patron'}
			</button>
			<a href="/admin/circulation/patrons" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>

<style>
	.new-patron-page {
		max-width: 900px;
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

	.error {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		border: 1px solid #fcc;
	}

	form {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.form-section {
		padding: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		color: #333;
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

	small {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: #666;
	}

	.barcode-group {
		display: flex;
		gap: 0.5rem;
	}

	.barcode-input {
		flex: 1;
		font-family: monospace;
		font-weight: 500;
	}

	.btn-generate {
		padding: 0.75rem 1rem;
		background: #f59e0b;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.btn-generate:hover {
		background: #d97706;
	}

	.form-actions {
		padding: 2rem;
		display: flex;
		gap: 1rem;
		background: #f8f9fa;
		border-radius: 0 0 8px 8px;
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
		text-align: center;
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
			align-items: flex-start;
			gap: 1rem;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.form-section {
			padding: 1.5rem;
		}

		.form-actions {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
