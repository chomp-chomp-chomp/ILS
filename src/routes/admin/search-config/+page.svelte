<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let fields = $state([...data.fields]);
	let config = $state({ ...data.config });
	let message = $state('');
	let saving = $state(false);
	let activeTab = $state<'fields' | 'settings' | 'facets'>('fields');

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
			// Save search fields
			const fieldsResponse = await fetch('/api/search-config/fields', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fields })
			});

			if (!fieldsResponse.ok) {
				throw new Error('Failed to save search fields');
			}

			// Save search configuration
			const configResponse = await fetch('/api/search-config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			});

			if (!configResponse.ok) {
				throw new Error('Failed to save search configuration');
			}

			message = 'Search configuration saved successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error saving configuration';
			console.error('Save error:', error);
		} finally {
			saving = false;
		}
	}
</script>

<div class="search-config-page">
	<header class="page-header">
		<h1>Search Configuration</h1>
		<p class="subtitle">Customize search form fields and behavior</p>
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
		<button
			class="tab"
			class:active={activeTab === 'fields'}
			onclick={() => (activeTab = 'fields')}
		>
			Search Fields
		</button>
		<button
			class="tab"
			class:active={activeTab === 'settings'}
			onclick={() => (activeTab = 'settings')}
		>
			Search Settings
		</button>
		<button
			class="tab"
			class:active={activeTab === 'facets'}
			onclick={() => (activeTab = 'facets')}
		>
			Facets & Filters
		</button>
	</div>

	<div class="tab-content">
		{#if activeTab === 'fields'}
			<div class="fields-panel">
				<div class="panel-header">
					<h2>Search Form Fields</h2>
					<p>Drag to reorder fields. Toggle visibility and configure labels.</p>
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
								</div>

								<div class="field-controls">
									<label class="checkbox">
										<input type="checkbox" bind:checked={field.is_enabled} />
										Enabled
									</label>

									<label class="checkbox">
										<input type="checkbox" bind:checked={field.is_default_visible} />
										Show in basic search
									</label>

									<label class="checkbox">
										<input type="checkbox" bind:checked={field.show_in_advanced} />
										Show in advanced search
									</label>
								</div>

								<div class="field-settings">
									<div class="form-group">
										<label>Label</label>
										<input type="text" bind:value={field.field_label} />
									</div>

									<div class="form-group">
										<label>Placeholder</label>
										<input type="text" bind:value={field.placeholder_text} />
									</div>

									<div class="form-group">
										<label>Help Text</label>
										<input type="text" bind:value={field.help_text} />
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if activeTab === 'settings'}
			<div class="settings-panel">
				<section class="settings-section">
					<h2>Search Behavior</h2>

					<div class="form-group">
						<label for="default_search_type">Default Search Type</label>
						<select id="default_search_type" bind:value={config.default_search_type}>
							<option value="keyword">Keyword (all fields)</option>
							<option value="title">Title</option>
							<option value="author">Author</option>
							<option value="advanced">Advanced Search</option>
						</select>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.enable_spell_correction} />
							Enable spell correction / "Did you mean?" suggestions
						</label>
					</div>

					{#if config.enable_spell_correction}
						<div class="form-group">
							<label for="spell_threshold">Spell Correction Threshold</label>
							<input
								id="spell_threshold"
								type="number"
								step="0.1"
								min="0"
								max="1"
								bind:value={config.spell_correction_threshold}
							/>
							<small>Similarity threshold (0-1). Lower = more lenient suggestions.</small>
						</div>

						<div class="form-group">
							<label for="min_results">Show suggestions when results are less than</label>
							<input
								id="min_results"
								type="number"
								min="0"
								max="50"
								bind:value={config.min_results_for_suggestion}
							/>
						</div>
					{/if}

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.enable_advanced_search} />
							Enable advanced search
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.enable_boolean_operators} />
							Enable Boolean operators (AND, OR, NOT)
						</label>
					</div>
				</section>

				<section class="settings-section">
					<h2>Results Display</h2>

					<div class="form-group">
						<label for="results_per_page">Results per page</label>
						<input
							id="results_per_page"
							type="number"
							min="5"
							max="100"
							bind:value={config.results_per_page}
						/>
					</div>

					<div class="form-group">
						<label for="results_layout">Default layout</label>
						<select id="results_layout" bind:value={config.results_layout}>
							<option value="list">List</option>
							<option value="grid">Grid</option>
							<option value="compact">Compact</option>
						</select>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.show_covers} />
							Show book covers
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.show_availability} />
							Show availability status
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.show_call_number} />
							Show call numbers
						</label>
					</div>
				</section>

				<section class="settings-section">
					<h2>Sorting Options</h2>

					<div class="form-group">
						<label for="default_sort">Default sort order</label>
						<select id="default_sort" bind:value={config.default_sort}>
							<option value="relevance">Relevance</option>
							<option value="title">Title (A-Z)</option>
							<option value="author">Author (A-Z)</option>
							<option value="date_newest">Publication Date (Newest)</option>
							<option value="date_oldest">Publication Date (Oldest)</option>
						</select>
					</div>
				</section>
			</div>
		{:else if activeTab === 'facets'}
			<div class="facets-panel">
				<section class="settings-section">
					<h2>Faceted Search</h2>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={config.enable_facets} />
							Enable faceted search (filters)
						</label>
					</div>

					{#if config.enable_facets}
						<div class="form-group">
							<label for="max_facet_values">Maximum facet values to show</label>
							<input
								id="max_facet_values"
								type="number"
								min="3"
								max="50"
								bind:value={config.max_facet_values}
							/>
							<small>Number of options to show per facet group before "Show more"</small>
						</div>

						<h3>Available Facets</h3>

						<div class="facet-toggles">
							<div class="form-group checkbox">
								<label>
									<input type="checkbox" bind:checked={config.facet_material_types} />
									Material Types (books, DVDs, etc.)
								</label>
							</div>

							<div class="form-group checkbox">
								<label>
									<input type="checkbox" bind:checked={config.facet_languages} />
									Languages
								</label>
							</div>

							<div class="form-group checkbox">
								<label>
									<input type="checkbox" bind:checked={config.facet_publication_years} />
									Publication Years
								</label>
							</div>

							<div class="form-group checkbox">
								<label>
									<input type="checkbox" bind:checked={config.facet_locations} />
									Locations
								</label>
							</div>

							<div class="form-group checkbox">
								<label>
									<input type="checkbox" bind:checked={config.facet_availability} />
									Availability (available / checked out)
								</label>
							</div>
						</div>
					{/if}
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
	.search-config-page {
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
		gap: 1rem;
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

	.field-controls {
		display: flex;
		gap: 2rem;
		margin-bottom: 1rem;
	}

	.field-settings {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.settings-panel,
	.facets-panel {
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

	.settings-section h3 {
		margin: 2rem 0 1rem 0;
		font-size: 1.125rem;
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
	.form-group input[type='number'],
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

	.checkbox label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.form-group.checkbox input[type='checkbox'],
	.checkbox input[type='checkbox'] {
		width: auto;
		cursor: pointer;
	}

	.form-group small {
		display: block;
		margin-top: 0.25rem;
		color: #666;
		font-size: 0.875rem;
	}

	.facet-toggles {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
