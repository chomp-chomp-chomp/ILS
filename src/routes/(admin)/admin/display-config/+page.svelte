<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let fields = $state([...data.fields]);
	let config = $state({ ...data.config });
	let message = $state('');
	let saving = $state(false);
	let activeTab = $state<'fields' | 'results' | 'details'>('fields');

	// Drag and drop
	let draggedIndex = $state<number | null>(null);

	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;

		const newFields = [...fields];
		const draggedItem = newFields[draggedIndex];
		newFields.splice(draggedIndex, 1);
		newFields.splice(index, 0, draggedItem);
		fields = newFields;
		draggedIndex = index;
	}

	function handleDragEnd() {
		// Update display_order based on new positions
		fields = fields.map((field, index) => ({ ...field, display_order: index + 1 }));
		draggedIndex = null;
	}

	async function saveConfiguration() {
		saving = true;
		message = '';

		try {
			// Save display fields
			const fieldsResponse = await fetch('/api/display-config/fields', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fields })
			});

			if (!fieldsResponse.ok) {
				throw new Error('Failed to save display fields');
			}

			// Save display configuration
			const configResponse = await fetch('/api/display-config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			});

			if (!configResponse.ok) {
				throw new Error('Failed to save display configuration');
			}

			message = 'Display configuration saved successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error saving configuration';
			console.error('Save error:', error);
		} finally {
			saving = false;
		}
	}
</script>

<div class="display-config-page">
	<header class="page-header">
		<h1>Display Configuration</h1>
		<p class="subtitle">Customize which fields are shown and how they appear</p>
	</header>

	{#if message}
		<div
			class="message"
			class:success={message.includes('success')}
			class:error={!message.includes('success')}
		>
			{message}
		</div>
	{/if}

	<div class="tabs">
		<button class="tab" class:active={activeTab === 'fields'} onclick={() => (activeTab = 'fields')}>
			Field Configuration
		</button>
		<button class="tab" class:active={activeTab === 'results'} onclick={() => (activeTab = 'results')}>
			Search Results
		</button>
		<button class="tab" class:active={activeTab === 'details'} onclick={() => (activeTab = 'details')}>
			Record Details
		</button>
	</div>

	<div class="tab-content">
		{#if activeTab === 'fields'}
			<div class="fields-panel">
				<div class="panel-header">
					<h2>Display Fields</h2>
					<p>Configure which MARC fields are displayed and how they appear</p>
				</div>

				<div class="fields-list">
					{#each fields as field, index (field.id)}
						<div
							class="field-item"
							draggable="true"
							ondragstart={() => handleDragStart(index)}
							ondragover={(e) => handleDragOver(e, index)}
							ondragend={handleDragEnd}
						>
							<div class="drag-handle">
								<svg width="16" height="16" viewBox="0 0 16 16">
									<path d="M5 3h6M5 8h6M5 13h6" stroke="currentColor" stroke-width="2" />
								</svg>
							</div>

							<div class="field-info">
								<div class="field-name">
									<strong>{field.field_label}</strong>
									<span class="field-key">{field.field_key}</span>
									{#if field.marc_field}
										<span class="marc-tag">MARC {field.marc_field}</span>
									{/if}
								</div>

								<div class="field-controls">
									<div class="control-group">
										<span class="control-label">Show In:</span>
										<label class="checkbox">
											<input type="checkbox" bind:checked={field.show_in_results} />
											Search Results
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={field.show_in_detail} />
											Detail Page
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={field.show_in_brief} />
											Brief View
										</label>
									</div>

									<div class="control-group">
										<label class="checkbox">
											<input type="checkbox" bind:checked={field.make_clickable} />
											Make Clickable
										</label>
										{#if field.make_clickable}
											<select bind:value={field.link_type} class="link-type">
												<option value="search_author">Search by Author</option>
												<option value="search_subject">Search by Subject</option>
												<option value="search_series">Search by Series</option>
												<option value="external_url">External URL</option>
											</select>
										{/if}
									</div>

									<div class="control-group">
										<label>Display Style:</label>
										<select bind:value={field.display_style} class="display-style">
											<option value="text">Plain Text</option>
											<option value="link">Link</option>
											<option value="badge">Badge</option>
											<option value="heading">Heading</option>
											<option value="list">List</option>
										</select>
									</div>
								</div>

								<div class="field-settings">
									<div class="form-group">
										<label>Label</label>
										<input type="text" bind:value={field.field_label} />
									</div>

									<div class="form-group">
										<label>Prefix</label>
										<input type="text" bind:value={field.prefix_text} placeholder="Optional" />
									</div>

									<div class="form-group">
										<label>Suffix</label>
										<input type="text" bind:value={field.suffix_text} placeholder="Optional" />
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if activeTab === 'results'}
			<div class="settings-panel">
				<section class="settings-section">
					<h2>Search Results Appearance</h2>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.results_show_covers} />
							Show book covers
						</label>
					</div>

					{#if config.results_show_covers}
						<div class="form-group">
							<label for="results_cover_size">Cover size</label>
							<select id="results_cover_size" bind:value={config.results_cover_size}>
								<option value="small">Small</option>
								<option value="medium">Medium</option>
								<option value="large">Large</option>
							</select>
						</div>
					{/if}

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.results_show_availability} />
							Show availability status
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.results_show_location} />
							Show location
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.results_show_call_number} />
							Show call number
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.results_show_material_badge} />
							Show material type badge (Book, DVD, etc.)
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.results_compact_mode} />
							Use compact mode (less spacing)
						</label>
					</div>
				</section>

				<section class="settings-section">
					<h2>Cover Images</h2>

					<div class="form-group">
						<label for="cover_source">Cover image source</label>
						<select id="cover_source" bind:value={config.cover_source}>
							<option value="openlibrary">Open Library</option>
							<option value="google">Google Books</option>
							<option value="local">Local Files</option>
						</select>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.cover_fallback_icon} />
							Show placeholder icon when cover is unavailable
						</label>
					</div>
				</section>
			</div>
		{:else if activeTab === 'details'}
			<div class="settings-panel">
				<section class="settings-section">
					<h2>Record Detail Page</h2>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.detail_show_cover} />
							Show book cover
						</label>
					</div>

					{#if config.detail_show_cover}
						<div class="form-group">
							<label for="detail_cover_size">Cover size</label>
							<select id="detail_cover_size" bind:value={config.detail_cover_size}>
								<option value="medium">Medium</option>
								<option value="large">Large</option>
								<option value="xlarge">Extra Large</option>
							</select>
						</div>
					{/if}

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.detail_show_holdings} />
							Show holdings / copies
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.detail_show_related} />
							Show related records
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.detail_show_subjects_as_tags} />
							Display subjects as clickable tags
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.detail_group_by_category} />
							Group fields by category (Description, Physical, etc.)
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.detail_show_marc} />
							Show raw MARC view (for staff)
						</label>
					</div>
				</section>

				<section class="settings-section">
					<h2>Holdings Display</h2>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.holdings_show_barcode} />
							Show barcode
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.holdings_show_call_number} />
							Show call number
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.holdings_show_location} />
							Show location
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.holdings_show_status} />
							Show status
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.holdings_show_notes} />
							Show notes
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.holdings_show_electronic_access} />
							Show electronic access links
						</label>
					</div>
				</section>
			</div>
		{/if}
	</div>

	<div class="form-actions">
		<button class="btn-primary" onclick={saveConfiguration} disabled={saving}>
			{saving ? 'Saving...' : 'Save Configuration'}
		</button>
		<button
			class="btn-secondary"
			onclick={() => {
				fields = [...data.fields];
				config = { ...data.config };
			}}
		>
			Reset
		</button>
	</div>
</div>

<style>
	.display-config-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 1.125rem;
	}

	.message {
		padding: 1rem 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		font-weight: 500;
	}

	.message.success {
		background: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 2px solid #e0e0e0;
		margin-bottom: 2rem;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 500;
		color: #666;
		transition: all 0.2s;
	}

	.tab:hover {
		color: #333;
		background: #f5f5f5;
	}

	.tab.active {
		color: #e73b42;
		border-bottom-color: #e73b42;
	}

	.tab-content {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 2rem;
		min-height: 400px;
	}

	.panel-header {
		margin-bottom: 2rem;
	}

	.panel-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.panel-header p {
		margin: 0;
		color: #666;
	}

	.fields-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field-item {
		display: flex;
		gap: 1rem;
		padding: 1.5rem;
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		cursor: move;
	}

	.field-item:hover {
		border-color: #ccc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.drag-handle {
		color: #999;
		padding: 0.5rem;
	}

	.field-info {
		flex: 1;
	}

	.field-name {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.field-name strong {
		font-size: 1.125rem;
		color: #2c3e50;
	}

	.field-key {
		padding: 0.25rem 0.5rem;
		background: #e0e0e0;
		border-radius: 3px;
		font-size: 0.875rem;
		font-family: monospace;
		color: #666;
	}

	.marc-tag {
		padding: 0.25rem 0.5rem;
		background: #667eea;
		color: white;
		border-radius: 3px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.field-controls {
		display: flex;
		gap: 2rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.control-label {
		font-weight: 500;
		color: #666;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.checkbox label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox input[type='checkbox'] {
		width: auto;
		cursor: pointer;
	}

	.link-type,
	.display-style {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.field-settings {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.settings-panel {
		max-width: 800px;
	}

	.settings-section {
		margin-bottom: 3rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.settings-section:last-child {
		border-bottom: none;
	}

	.settings-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.form-group input[type='text'],
	.form-group select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group.checkbox label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.form-group.checkbox input[type='checkbox'] {
		width: auto;
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 2px solid #e0e0e0;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
	}
</style>
