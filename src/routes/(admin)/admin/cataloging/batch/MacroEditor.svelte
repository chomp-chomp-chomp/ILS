<script lang="ts">
	import { onMount } from 'svelte';

	let macros = $state<any[]>([]);
	let selectedMacro = $state<any | null>(null);
	let loading = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');
	let showCreateForm = $state(false);

	let newMacro = $state({
		name: '',
		description: '',
		category: 'custom',
		operations: [] as any[],
		isPublic: false
	});

	onMount(async () => {
		await loadMacros();
	});

	async function loadMacros() {
		loading = true;
		try {
			const response = await fetch('/api/batch/macros');
			const data = await response.json();
			if (data.success) {
				macros = data.macros;
			}
		} catch (error) {
			console.error('Error loading macros:', error);
		} finally {
			loading = false;
		}
	}

	async function executeMacro(macroId: string) {
		if (!confirm('Execute this macro on all records? Preview first to see changes.')) {
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/macros/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					macroId,
					previewOnly: true
				})
			});

			const data = await response.json();

			if (data.success) {
				message = `Preview: ${data.summary.recordsAffected} records would be affected`;
				messageType = 'info';
			}
		} catch (error) {
			message = 'Error executing macro';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function saveMacro() {
		if (!newMacro.name || newMacro.operations.length === 0) {
			message = 'Name and at least one operation required';
			messageType = 'error';
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/macros', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newMacro)
			});

			const data = await response.json();

			if (data.success) {
				message = 'Macro saved successfully';
				messageType = 'success';
				showCreateForm = false;
				newMacro = { name: '', description: '', category: 'custom', operations: [], isPublic: false };
				await loadMacros();
			}
		} catch (error) {
			message = 'Error saving macro';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function addOperation() {
		newMacro.operations = [...newMacro.operations, {
			operation: 'add_field',
			field: '',
			value: ''
		}];
	}

	function removeOperation(index: number) {
		newMacro.operations = newMacro.operations.filter((_, i) => i !== index);
	}
</script>

<div class="macro-editor">
	<div class="header">
		<div>
			<h2>MARC Editing Macros</h2>
			<p class="description">Create and execute reusable MARC transformation scripts.</p>
		</div>
		<button class="btn btn-primary" onclick={() => showCreateForm = !showCreateForm}>
			{showCreateForm ? 'Cancel' : '+ Create Macro'}
		</button>
	</div>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	{#if showCreateForm}
		<div class="create-form">
			<h3>Create New Macro</h3>

			<div class="form-group">
				<label for="macroName">Macro Name *</label>
				<input
					id="macroName"
					type="text"
					bind:value={newMacro.name}
					placeholder="e.g., Add Fiction Genre"
				/>
			</div>

			<div class="form-group">
				<label for="macroDesc">Description</label>
				<textarea
					id="macroDesc"
					bind:value={newMacro.description}
					placeholder="Describe what this macro does"
					rows="2"
				></textarea>
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="macroCategory">Category</label>
					<select id="macroCategory" bind:value={newMacro.category}>
						<option value="custom">Custom</option>
						<option value="subject_headings">Subject Headings</option>
						<option value="call_numbers">Call Numbers</option>
						<option value="publication_dates">Publication Dates</option>
					</select>
				</div>

				<div class="form-group">
					<label>
						<input type="checkbox" bind:checked={newMacro.isPublic} />
						Make public (share with other users)
					</label>
				</div>
			</div>

			<div class="operations-section">
				<div class="section-header">
					<h4>Operations</h4>
					<button class="btn btn-small" onclick={addOperation}>+ Add Operation</button>
				</div>

				{#each newMacro.operations as operation, index}
					<div class="operation-card">
						<div class="operation-header">
							<span>Operation {index + 1}</span>
							<button class="btn-text-danger" onclick={() => removeOperation(index)}>Remove</button>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label>Operation Type</label>
								<select bind:value={operation.operation}>
									<option value="add_field">Add Field</option>
									<option value="update_subfield">Update Subfield</option>
									<option value="remove_field">Remove Field</option>
									<option value="add_prefix">Add Prefix</option>
									<option value="add_suffix">Add Suffix</option>
									<option value="transform_field">Transform Field</option>
								</select>
							</div>

							<div class="form-group">
								<label>Field Name</label>
								<input type="text" bind:value={operation.field} placeholder="e.g., subject_topical" />
							</div>
						</div>

						{#if operation.operation !== 'remove_field'}
							<div class="form-group">
								<label>Value</label>
								<input type="text" bind:value={operation.value} placeholder="New value" />
							</div>
						{/if}
					</div>
				{/each}

				{#if newMacro.operations.length === 0}
					<p class="empty-state">No operations added yet. Click "Add Operation" to start.</p>
				{/if}
			</div>

			<div class="button-group">
				<button class="btn btn-secondary" onclick={() => showCreateForm = false}>Cancel</button>
				<button class="btn btn-primary" onclick={saveMacro} disabled={loading}>Save Macro</button>
			</div>
		</div>
	{/if}

	<div class="macros-list">
		<h3>Saved Macros ({macros.length})</h3>

		{#if macros.length === 0}
			<p class="empty-state">No macros found. Create your first macro above!</p>
		{:else}
			<div class="macros-grid">
				{#each macros as macro}
					<div class="macro-card">
						<div class="macro-header">
							<h4>{macro.name}</h4>
							{#if macro.is_public}
								<span class="badge">Public</span>
							{/if}
						</div>

						<p class="macro-description">{macro.description || 'No description'}</p>

						<div class="macro-meta">
							<span class="category">{macro.category}</span>
							<span class="usage">Used {macro.times_used || 0} times</span>
						</div>

						<div class="macro-actions">
							<button class="btn btn-small btn-secondary" onclick={() => executeMacro(macro.id)}>
								Execute
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.macro-editor {
		max-width: 1200px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
	}

	h2 {
		font-size: 24px;
		color: #333;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 20px;
		color: #333;
		margin-bottom: 16px;
	}

	h4 {
		font-size: 16px;
		color: #333;
		margin: 0;
	}

	.description {
		color: #666;
		margin: 0;
	}

	.message {
		padding: 12px 16px;
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

	.message.info {
		background: #d1ecf1;
		color: #0c5460;
		border: 1px solid #bee5eb;
	}

	.create-form {
		background: #f9f9f9;
		padding: 20px;
		border-radius: 8px;
		margin-bottom: 30px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 8px;
		color: #333;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-bottom: 16px;
	}

	.operations-section {
		margin: 20px 0;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.operation-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 16px;
		margin-bottom: 12px;
	}

	.operation-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid #eee;
	}

	.btn-text-danger {
		background: none;
		border: none;
		color: #dc3545;
		cursor: pointer;
		font-size: 14px;
	}

	.btn-text-danger:hover {
		text-decoration: underline;
	}

	.button-group {
		display: flex;
		gap: 12px;
		margin-top: 20px;
	}

	.btn {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12a31;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f5f5f5;
	}

	.btn-small {
		padding: 6px 12px;
		font-size: 13px;
	}

	.macros-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}

	.macro-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 20px;
		transition: box-shadow 0.2s;
	}

	.macro-card:hover {
		box-shadow: 0 4px 8px rgba(0,0,0,0.1);
	}

	.macro-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.macro-description {
		color: #666;
		font-size: 14px;
		margin-bottom: 16px;
	}

	.macro-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
		color: #666;
		margin-bottom: 16px;
	}

	.category {
		text-transform: capitalize;
	}

	.macro-actions {
		display: flex;
		gap: 8px;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		background: #e0e0e0;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.empty-state {
		text-align: center;
		color: #999;
		padding: 40px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 16px;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.macros-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
