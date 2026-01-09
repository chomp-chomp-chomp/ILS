<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const record = data.record;
	let items = $state(data.items || []);

	// Form state
	let showForm = $state(false);
	let editingId = $state<string | null>(null);

	// Item fields
	let barcode = $state('');
	let copyNumber = $state('');
	let callNumber = $state('');
	let location = $state('Main Stacks');
	let collection = $state('General');
	let shelvingLocation = $state('');
	let status = $state('available');
	let condition = $state('good');
	let conditionNotes = $state('');
	let price = $state('');
	let replacementCost = $state('');
	let materialType = $state('book');
	let circulationStatus = $state('circulating');
	let publicNotes = $state('');
	let staffNotes = $state('');

	let saving = $state(false);
	let message = $state('');

	// Status options
	const statusOptions = [
		{ value: 'available', label: 'Available', color: '#4caf50' },
		{ value: 'checked_out', label: 'Checked Out', color: '#ff9800' },
		{ value: 'on_hold', label: 'On Hold', color: '#2196f3' },
		{ value: 'in_transit', label: 'In Transit', color: '#9c27b0' },
		{ value: 'lost', label: 'Lost', color: '#f44336' },
		{ value: 'damaged', label: 'Damaged', color: '#ff5722' },
		{ value: 'missing', label: 'Missing', color: '#795548' },
		{ value: 'on_order', label: 'On Order', color: '#607d8b' },
		{ value: 'in_processing', label: 'In Processing', color: '#00bcd4' },
		{ value: 'withdrawn', label: 'Withdrawn', color: '#9e9e9e' }
	];

	const conditionOptions = ['new', 'good', 'fair', 'poor', 'damaged'];
	const materialTypeOptions = ['book', 'dvd', 'cd', 'audiobook', 'magazine', 'map', 'e-resource'];
	const circulationStatusOptions = [
		{ value: 'circulating', label: 'Circulating' },
		{ value: 'non-circulating', label: 'Non-Circulating' },
		{ value: 'reference_only', label: 'Reference Only' },
		{ value: 'library_use_only', label: 'Library Use Only' }
	];

	function generateBarcode() {
		// Generate a 14-digit barcode: timestamp (10) + random (4)
		const timestamp = Date.now().toString().slice(-10);
		const random = Math.floor(1000 + Math.random() * 9000);
		barcode = `${timestamp}${random}`;
	}

	function newItem() {
		editingId = null;
		showForm = true;
		resetForm();
		// Pre-fill call number from MARC record if available
		callNumber = record.classification?.a || '';
		// Auto-generate barcode
		generateBarcode();
	}

	function editItem(item: any) {
		editingId = item.id;
		showForm = true;
		barcode = item.barcode || '';
		copyNumber = item.copy_number || '';
		callNumber = item.call_number || '';
		location = item.location || 'Main Stacks';
		collection = item.collection || 'General';
		shelvingLocation = item.shelving_location || '';
		status = item.status || 'available';
		condition = item.condition || 'good';
		conditionNotes = item.condition_notes || '';
		price = item.price ? item.price.toString() : '';
		replacementCost = item.replacement_cost ? item.replacement_cost.toString() : '';
		materialType = item.material_type || 'book';
		circulationStatus = item.circulation_status || 'circulating';
		publicNotes = item.public_notes || '';
		staffNotes = item.staff_notes || '';
	}

	function resetForm() {
		barcode = '';
		copyNumber = '';
		callNumber = '';
		location = 'Main Stacks';
		collection = 'General';
		shelvingLocation = '';
		status = 'available';
		condition = 'good';
		conditionNotes = '';
		price = '';
		replacementCost = '';
		materialType = 'book';
		circulationStatus = 'circulating';
		publicNotes = '';
		staffNotes = '';
		message = '';
	}

	function cancelEdit() {
		editingId = null;
		showForm = false;
		resetForm();
	}

	async function saveItem() {
		if (!barcode.trim()) {
			message = 'Barcode is required';
			return;
		}

		saving = true;
		message = '';

		try {
			const itemData: any = {
				marc_record_id: record.id,
				barcode: barcode.trim(),
				copy_number: copyNumber.trim() || null,
				call_number: callNumber.trim() || null,
				location,
				collection,
				shelving_location: shelvingLocation.trim() || null,
				status,
				condition,
				condition_notes: conditionNotes.trim() || null,
				price: price ? parseFloat(price) : null,
				replacement_cost: replacementCost ? parseFloat(replacementCost) : null,
				material_type: materialType,
				circulation_status: circulationStatus,
				public_notes: publicNotes.trim() || null,
				staff_notes: staffNotes.trim() || null
			};

			if (editingId) {
				// Update existing item
				const { error: updateError } = await supabase
					.from('items')
					.update(itemData)
					.eq('id', editingId);

				if (updateError) throw updateError;

				// Update local state
				items = items.map((h) => (h.id === editingId ? { ...h, ...itemData } : h));
				message = 'Item updated successfully!';
			} else {
				// Add new item
				const { data: inserted, error: insertError } = await supabase
					.from('items')
					.insert([itemData])
					.select();

				if (insertError) throw insertError;

				if (inserted && inserted[0]) {
					items = [inserted[0], ...items];
					message = 'Item added successfully!';
				}
			}

			// Close form and reset
			setTimeout(() => {
				showForm = false;
				resetForm();
				editingId = null;
			}, 1500);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	async function deleteItem(itemId: string) {
		if (!confirm('Are you sure you want to delete this item?')) return;

		try {
			const { error: deleteError } = await supabase
				.from('items')
				.delete()
				.eq('id', itemId);

			if (deleteError) throw deleteError;

			items = items.filter((h) => h.id !== itemId);
		} catch (err: any) {
			alert(`Error deleting item: ${err.message}`);
		}
	}

	async function quickStatusUpdate(itemId: string, newStatus: string) {
		try {
			const { error: updateError } = await supabase
				.from('items')
				.update({ status: newStatus })
				.eq('id', itemId);

			if (updateError) throw updateError;

			items = items.map((h) => (h.id === itemId ? { ...h, status: newStatus } : h));
		} catch (err: any) {
			alert(`Error updating status: ${err.message}`);
		}
	}

	function getStatusColor(status: string): string {
		const statusObj = statusOptions.find((s) => s.value === status);
		return statusObj?.color || '#666';
	}
</script>

<div class="holdings-page">
	<header class="page-header">
		<div>
			<h1>Items for: {record.title_statement?.a || 'Untitled'}</h1>
			<p class="subtitle">
				{items.length} cop{items.length === 1 ? 'y' : 'ies'} •
				{items.filter((i) => i.status === 'available').length} available
			</p>
		</div>
		<div class="actions">
			<a href="/admin/cataloging/edit/{record.id}" class="btn-secondary">Back to Record</a>
			<button onclick={newItem} class="btn-primary">Add Item</button>
		</div>
	</header>

	{#if showForm}
		<div class="form-card">
			<h2>{editingId ? 'Edit Item' : 'Add New Item'}</h2>

			{#if message}
				<div class="message" class:success={!message.includes('Error')} class:error={message.includes('Error')}>
					{message}
				</div>
			{/if}

			<div class="form-grid">
				<!-- Barcode and Copy Number -->
				<div class="form-group">
					<label for="barcode">Barcode *</label>
					<div class="input-with-button">
						<input id="barcode" type="text" bind:value={barcode} required />
						<button type="button" class="btn-generate" onclick={generateBarcode}>Generate</button>
					</div>
				</div>

				<div class="form-group">
					<label for="copyNumber">Copy Number</label>
					<input id="copyNumber" type="text" bind:value={copyNumber} placeholder="e.g., c.1, c.2" />
				</div>

				<!-- Call Number -->
				<div class="form-group full-width">
					<label for="callNumber">Call Number</label>
					<input id="callNumber" type="text" bind:value={callNumber} placeholder="Override MARC call number" />
				</div>

				<!-- Location and Collection -->
				<div class="form-group">
					<label for="location">Location</label>
					<input id="location" type="text" bind:value={location} />
				</div>

				<div class="form-group">
					<label for="collection">Collection</label>
					<input id="collection" type="text" bind:value={collection} />
				</div>

				<div class="form-group">
					<label for="shelvingLocation">Shelving Location</label>
					<input id="shelvingLocation" type="text" bind:value={shelvingLocation} placeholder="Specific shelf/area" />
				</div>

				<!-- Status and Condition -->
				<div class="form-group">
					<label for="status">Status</label>
					<select id="status" bind:value={status}>
						{#each statusOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="condition">Condition</label>
					<select id="condition" bind:value={condition}>
						{#each conditionOptions as opt}
							<option value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
						{/each}
					</select>
				</div>

				<div class="form-group full-width">
					<label for="conditionNotes">Condition Notes</label>
					<input id="conditionNotes" type="text" bind:value={conditionNotes} />
				</div>

				<!-- Material Type and Circulation -->
				<div class="form-group">
					<label for="materialType">Material Type</label>
					<select id="materialType" bind:value={materialType}>
						{#each materialTypeOptions as type}
							<option value={type}>{type.toUpperCase()}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="circulationStatus">Circulation</label>
					<select id="circulationStatus" bind:value={circulationStatus}>
						{#each circulationStatusOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				<!-- Price -->
				<div class="form-group">
					<label for="price">Price</label>
					<input id="price" type="number" step="0.01" bind:value={price} placeholder="0.00" />
				</div>

				<div class="form-group">
					<label for="replacementCost">Replacement Cost</label>
					<input id="replacementCost" type="number" step="0.01" bind:value={replacementCost} placeholder="0.00" />
				</div>

				<!-- Notes -->
				<div class="form-group full-width">
					<label for="publicNotes">Public Notes</label>
					<textarea id="publicNotes" bind:value={publicNotes} rows="2"></textarea>
				</div>

				<div class="form-group full-width">
					<label for="staffNotes">Staff Notes (Internal)</label>
					<textarea id="staffNotes" bind:value={staffNotes} rows="2"></textarea>
				</div>
			</div>

			<div class="form-actions">
				<button onclick={cancelEdit} class="btn-secondary" disabled={saving}>Cancel</button>
				<button onclick={saveItem} class="btn-primary" disabled={saving}>
					{saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
				</button>
			</div>
		</div>
	{/if}

	{#if items.length === 0}
		<div class="empty-state">
			<h2>No Items Yet</h2>
			<p>Add physical or electronic copies to this record</p>
			<button onclick={newItem} class="btn-primary">Add First Item</button>
		</div>
	{:else}
		<div class="items-table">
			<table>
				<thead>
					<tr>
						<th>Barcode</th>
						<th>Copy</th>
						<th>Call Number</th>
						<th>Location</th>
						<th>Status</th>
						<th>Condition</th>
						<th>Type</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item}
						<tr>
							<td>
								<code>{item.barcode}</code>
							</td>
							<td>{item.copy_number || '-'}</td>
							<td>{item.call_number || record.classification?.a || '-'}</td>
							<td>
								{item.location}
								{#if item.collection && item.collection !== 'General'}
									<span class="collection-badge">{item.collection}</span>
								{/if}
							</td>
							<td>
								<select
									value={item.status}
									onchange={(e) => quickStatusUpdate(item.id, (e.target as HTMLSelectElement).value)}
									class="status-select"
									style="border-color: {getStatusColor(item.status)};"
								>
									{#each statusOptions as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</td>
							<td>
								<span class="condition-badge" class:good={item.condition === 'good' || item.condition === 'new'}>
									{item.condition || 'good'}
								</span>
							</td>
							<td>{item.material_type?.toUpperCase() || 'BOOK'}</td>
							<td class="actions-cell">
								<button onclick={() => editItem(item)} class="btn-small btn-edit">Edit</button>
								<button onclick={() => deleteItem(item.id)} class="btn-small btn-delete">Delete</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.holdings-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #e0e0e0;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
		font-size: 1.75rem;
	}

	.subtitle {
		color: #666;
		margin: 0;
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
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
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #d0d0d0;
	}

	.form-card {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		border: 1px solid #e0e0e0;
	}

	.form-card h2 {
		margin: 0 0 1.5rem 0;
		color: #2c3e50;
	}

	.message {
		padding: 1rem;
		border-radius: 4px;
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

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
		font-size: 0.875rem;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #e73b42;
	}

	.input-with-button {
		display: flex;
		gap: 0.5rem;
	}

	.input-with-button input {
		flex: 1;
	}

	.btn-generate {
		padding: 0.75rem 1rem;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-generate:hover {
		background: #1976d2;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
		border: 2px dashed #e0e0e0;
	}

	.empty-state h2 {
		color: #2c3e50;
		margin-bottom: 0.5rem;
	}

	.empty-state p {
		color: #666;
		margin-bottom: 2rem;
	}

	.items-table {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		background: #f5f5f5;
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #333;
		font-size: 0.875rem;
		border-bottom: 2px solid #e0e0e0;
	}

	td {
		padding: 1rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.875rem;
	}

	code {
		background: #f5f5f5;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
	}

	.collection-badge {
		display: inline-block;
		background: #e3f2fd;
		color: #1976d2;
		padding: 0.125rem 0.5rem;
		border-radius: 3px;
		font-size: 0.75rem;
		margin-left: 0.5rem;
	}

	.status-select {
		padding: 0.5rem;
		border-radius: 4px;
		border: 2px solid;
		font-size: 0.875rem;
		cursor: pointer;
		background: white;
	}

	.condition-badge {
		display: inline-block;
		background: #fff3cd;
		color: #856404;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.8125rem;
		text-transform: capitalize;
	}

	.condition-badge.good {
		background: #d4edda;
		color: #155724;
	}

	.actions-cell {
		display: flex;
		gap: 0.5rem;
	}

	.btn-small {
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 4px;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-edit {
		background: #e73b42;
		color: white;
	}

	.btn-edit:hover {
		background: #d12d34;
	}

	.btn-delete {
		background: #f44336;
		color: white;
	}

	.btn-delete:hover {
		background: #d32f2f;
	}

	@media (max-width: 768px) {
		.holdings-page {
			padding: 1rem;
		}

		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.actions {
			width: 100%;
			flex-direction: column;
		}

		.actions a,
		.actions button {
			width: 100%;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.items-table {
			overflow-x: auto;
		}

		table {
			min-width: 800px;
		}
	}
</style>
