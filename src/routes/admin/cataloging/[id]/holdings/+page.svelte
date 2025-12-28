<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const record = data.record;
	let holdings = $state(data.holdings || []);

	// New holding form
	let showForm = $state(false);
	let callNumber = $state('');
	let location = $state('Main Library');
	let sublocation = $state('');
	let barcode = $state('');
	let copyNumber = $state(1);
	let volume = $state('');
	let status = $state('available');
	let isElectronic = $state(false);
	let url = $state('');
	let accessRestrictions = $state('');

	let saving = $state(false);
	let message = $state('');

	async function addHolding() {
		saving = true;
		message = '';

		try {
			const newHolding = {
				marc_record_id: record.id,
				call_number: callNumber || null,
				location: location || 'Main Library',
				sublocation: sublocation || null,
				barcode: barcode || null,
				copy_number: copyNumber || 1,
				volume: volume || null,
				status: status || 'available',
				is_electronic: isElectronic,
				url: url || null,
				access_restrictions: accessRestrictions || null,
			};

			const { data: inserted, error: insertError } = await data.supabase
				.from('holdings')
				.insert([newHolding])
				.select();

			if (insertError) throw insertError;

			if (inserted && inserted[0]) {
				holdings = [inserted[0], ...holdings];
			}

			// Reset form
			showForm = false;
			callNumber = '';
			location = 'Main Library';
			sublocation = '';
			barcode = '';
			copyNumber = 1;
			volume = '';
			status = 'available';
			isElectronic = false;
			url = '';
			accessRestrictions = '';

			message = 'Holding added successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (err) {
			message = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	async function deleteHolding(holdingId: string) {
		if (!confirm('Are you sure you want to delete this holding?')) return;

		try {
			const { error: deleteError } = await data.supabase
				.from('holdings')
				.delete()
				.eq('id', holdingId);

			if (deleteError) throw deleteError;

			holdings = holdings.filter((h) => h.id !== holdingId);
			message = 'Holding deleted successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (err) {
			alert(`Error deleting: ${err.message}`);
		}
	}

	async function updateStatus(holdingId: string, newStatus: string) {
		try {
			const { error: updateError } = await data.supabase
				.from('holdings')
				.update({ status: newStatus })
				.eq('id', holdingId);

			if (updateError) throw updateError;

			holdings = holdings.map((h) =>
				h.id === holdingId ? { ...h, status: newStatus } : h
			);

			message = 'Status updated!';
			setTimeout(() => (message = ''), 2000);
		} catch (err) {
			alert(`Error updating: ${err.message}`);
		}
	}
</script>

<div class="holdings-page">
	<header class="page-header">
		<div>
			<h1>Manage Holdings</h1>
			<p class="record-title">{record.title_statement?.a || 'Untitled'}</p>
		</div>
		<a href="/admin/cataloging/edit/{record.id}" class="btn-back">← Back to Record</a>
	</header>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<div class="actions-bar">
		<button class="btn-primary" onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : '+ Add Holding'}
		</button>
	</div>

	{#if showForm}
		<div class="add-form">
			<h3>Add New Holding</h3>

			<form onsubmit={(e) => { e.preventDefault(); addHolding(); }}>
				<div class="form-row">
					<div class="form-group">
						<label for="callNumber">Call Number</label>
						<input
							id="callNumber"
							type="text"
							bind:value={callNumber}
							placeholder="e.g., 823.914 SMI"
						/>
					</div>

					<div class="form-group">
						<label for="barcode">Barcode</label>
						<input id="barcode" type="text" bind:value={barcode} placeholder="Barcode" />
					</div>

					<div class="form-group">
						<label for="copyNumber">Copy #</label>
						<input id="copyNumber" type="number" bind:value={copyNumber} min="1" />
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="location">Location</label>
						<select id="location" bind:value={location}>
							<option value="Main Library">Main Library</option>
							<option value="Reference">Reference</option>
							<option value="Special Collections">Special Collections</option>
							<option value="Children's Section">Children's Section</option>
							<option value="Young Adult">Young Adult</option>
							<option value="Periodicals">Periodicals</option>
							<option value="Archive">Archive</option>
						</select>
					</div>

					<div class="form-group">
						<label for="sublocation">Sublocation/Shelf</label>
						<input
							id="sublocation"
							type="text"
							bind:value={sublocation}
							placeholder="e.g., Shelf A3"
						/>
					</div>

					<div class="form-group">
						<label for="volume">Volume/Edition</label>
						<input id="volume" type="text" bind:value={volume} placeholder="Vol. 1" />
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="status">Status</label>
						<select id="status" bind:value={status}>
							<option value="available">Available</option>
							<option value="checked_out">Checked Out</option>
							<option value="missing">Missing</option>
							<option value="damaged">Damaged</option>
							<option value="on_order">On Order</option>
							<option value="in_processing">In Processing</option>
						</select>
					</div>

					<div class="form-group">
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={isElectronic} />
							<span>Electronic Resource</span>
						</label>
					</div>
				</div>

				{#if isElectronic}
					<div class="form-row">
						<div class="form-group">
							<label for="url">URL</label>
							<input id="url" type="url" bind:value={url} placeholder="https://..." />
						</div>

						<div class="form-group">
							<label for="accessRestrictions">Access Restrictions</label>
							<input
								id="accessRestrictions"
								type="text"
								bind:value={accessRestrictions}
								placeholder="e.g., Library card required"
							/>
						</div>
					</div>
				{/if}

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={saving}>
						{saving ? 'Adding...' : 'Add Holding'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (showForm = false)}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	<div class="holdings-list">
		{#if holdings.length === 0}
			<div class="empty-state">
				<p>No holdings yet. Add the first holding to make this item available.</p>
			</div>
		{:else}
			<h3>Current Holdings ({holdings.length})</h3>
			{#each holdings as holding}
				<div class="holding-card">
					<div class="holding-main">
						{#if holding.call_number}
							<div class="call-number">{holding.call_number}</div>
						{/if}
						<div class="details">
							<span class="detail-item">
								<strong>Location:</strong>
								{holding.location}
								{#if holding.sublocation} - {holding.sublocation}{/if}
							</span>
							{#if holding.barcode}
								<span class="detail-item"><strong>Barcode:</strong> {holding.barcode}</span>
							{/if}
							<span class="detail-item">
								<strong>Copy:</strong>
								{holding.copy_number || 1}
							</span>
							{#if holding.volume}
								<span class="detail-item"><strong>Volume:</strong> {holding.volume}</span>
							{/if}
							{#if holding.is_electronic}
								<span class="detail-item">
									<strong>Type:</strong> Electronic
									{#if holding.url}
										- <a href={holding.url} target="_blank">Access Link</a>
									{/if}
								</span>
							{/if}
						</div>
					</div>

					<div class="holding-actions">
						<select
							value={holding.status}
							onchange={(e) => updateStatus(holding.id, e.currentTarget.value)}
							class="status-select"
						>
							<option value="available">Available</option>
							<option value="checked_out">Checked Out</option>
							<option value="missing">Missing</option>
							<option value="damaged">Damaged</option>
							<option value="on_order">On Order</option>
							<option value="in_processing">In Processing</option>
						</select>

						<button class="btn-delete-small" onclick={() => deleteHolding(holding.id)}>
							Delete
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.holdings-page {
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

	.record-title {
		margin: 0;
		color: #666;
		font-style: italic;
	}

	.btn-back {
		padding: 0.75rem 1.5rem;
		background: #e0e0e0;
		color: #333;
		text-decoration: none;
		border-radius: 4px;
	}

	.btn-back:hover {
		background: #d0d0d0;
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

	.actions-bar {
		margin-bottom: 2rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		font-size: 1rem;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #5568d3;
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

	.add-form {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		border: 2px solid #667eea;
	}

	.add-form h3 {
		margin: 0 0 1.5rem 0;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	label {
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	input,
	select {
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: #667eea;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding-top: 2rem;
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

	.holdings-list h3 {
		margin: 0 0 1rem 0;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
		color: #666;
	}

	.holding-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.holding-main {
		flex: 1;
	}

	.call-number {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #2c3e50;
	}

	.details {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.detail-item {
		color: #666;
	}

	.holding-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.status-select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.btn-delete-small {
		padding: 0.5rem 1rem;
		background: #f44336;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.btn-delete-small:hover {
		background: #d32f2f;
	}
</style>
