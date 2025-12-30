<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let fields = $state([...data.fields]);
	let config = $state({ ...data.config });
	let facets = $state([...data.facets]);
	let message = $state('');
	let saving = $state(false);
	let refreshingCache = $state(false);
	let activeTab = $state<'fields' | 'settings' | 'facets'>('fields');
	let editingFacet = $state<any>(null);
	let showNewFacetForm = $state(false);

	// Drag and drop for fields
	let draggedIndex = $state<number | null>(null);
	// Drag and drop for facets
	let draggedFacetIndex = $state<number | null>(null);

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

	// Facet drag and drop
	function handleFacetDragStart(index: number) {
		draggedFacetIndex = index;
	}

	function handleFacetDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedFacetIndex === null || draggedFacetIndex === index) return;

		const newFacets = [...facets];
		const draggedItem = newFacets[draggedFacetIndex];
		newFacets.splice(draggedFacetIndex, 1);
		newFacets.splice(index, 0, draggedItem);
		facets = newFacets;
		draggedFacetIndex = index;
	}

	function handleFacetDragEnd() {
		// Update display_order based on new positions
		facets = facets.map((facet, index) => ({ ...facet, display_order: index }));
		draggedFacetIndex = null;
	}

	async function saveFacets() {
		saving = true;
		message = '';

		try {
			// Reorder facets
			const reorderResponse = await fetch('/api/facet-config/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ facets })
			});

			if (!reorderResponse.ok) {
				throw new Error('Failed to save facet order');
			}

			// Update each facet
			const updates = facets.map((facet) =>
				fetch('/api/facet-config', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(facet)
				})
			);

			await Promise.all(updates);

			message = 'Facet configuration saved successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error saving facet configuration';
			console.error('Save error:', error);
		} finally {
			saving = false;
		}
	}

	async function refreshCache(facetKey?: string) {
		refreshingCache = true;
		message = '';

		try {
			const response = await fetch('/api/facet-config/refresh-cache', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ facet_key: facetKey })
			});

			if (!response.ok) {
				throw new Error('Failed to refresh cache');
			}

			const result = await response.json();
			message = result.message;
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error refreshing cache';
			console.error('Refresh cache error:', error);
		} finally {
			refreshingCache = false;
		}
	}

	function editFacet(facet: any) {
		editingFacet = { ...facet };
	}

	function cancelEditFacet() {
		editingFacet = null;
	}

	async function saveEditedFacet() {
		if (!editingFacet) return;

		saving = true;
		message = '';

		try {
			const response = await fetch('/api/facet-config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editingFacet)
			});

			if (!response.ok) {
				throw new Error('Failed to save facet');
			}

			// Update local state
			const index = facets.findIndex((f) => f.id === editingFacet.id);
			if (index !== -1) {
				facets[index] = { ...editingFacet };
			}

			editingFacet = null;
			message = 'Facet saved successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error saving facet';
			console.error('Save error:', error);
		} finally {
			saving = false;
		}
	}

	function createNewFacet() {
		showNewFacetForm = true;
		editingFacet = {
			facet_key: '',
			facet_label: '',
			facet_description: '',
			source_type: 'marc_field',
			source_field: '',
			source_subfield: '',
			display_type: 'checkbox_list',
			display_order: facets.length,
			is_enabled: true,
			is_collapsed_by_default: false,
			show_count: true,
			max_items: 10,
			aggregation_method: 'distinct_values',
			sort_by: 'count_desc',
			filter_param_name: '',
			multi_select: true,
			cache_enabled: true,
			public_visible: true,
			staff_only: false
		};
	}

	async function saveNewFacet() {
		if (!editingFacet) return;

		saving = true;
		message = '';

		try {
			const response = await fetch('/api/facet-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editingFacet)
			});

			if (!response.ok) {
				throw new Error('Failed to create facet');
			}

			const result = await response.json();
			facets = [...facets, result.facet];

			editingFacet = null;
			showNewFacetForm = false;
			message = 'Facet created successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error creating facet';
			console.error('Create error:', error);
		} finally {
			saving = false;
		}
	}

	async function deleteFacet(facetId: string) {
		if (!confirm('Are you sure you want to delete this facet?')) return;

		saving = true;
		message = '';

		try {
			const response = await fetch('/api/facet-config', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: facetId })
			});

			if (!response.ok) {
				throw new Error('Failed to delete facet');
			}

			facets = facets.filter((f) => f.id !== facetId);
			message = 'Facet deleted successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error deleting facet';
			console.error('Delete error:', error);
		} finally {
			saving = false;
		}
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
				<div class="panel-header">
					<div class="header-content">
						<div>
							<h2>Facet Configuration</h2>
							<p>Configure search facets and filters. Drag to reorder.</p>
						</div>
						<div class="header-actions">
							<button
								class="btn-secondary"
								onclick={() => refreshCache()}
								disabled={refreshingCache}
							>
								{refreshingCache ? 'Refreshing...' : 'Refresh All Caches'}
							</button>
							<button class="btn-primary" onclick={createNewFacet}>+ Create New Facet</button>
						</div>
					</div>
				</div>

				{#if showNewFacetForm && editingFacet}
					<div class="facet-editor">
						<div class="editor-header">
							<h3>Create New Facet</h3>
							<button class="btn-close" onclick={() => (showNewFacetForm = false)}>×</button>
						</div>

						<div class="editor-content">
							<div class="form-grid">
								<div class="form-group">
									<label for="facet_key">Facet Key *</label>
									<input
										id="facet_key"
										type="text"
										bind:value={editingFacet.facet_key}
										placeholder="e.g., subject, author, call_number_range"
									/>
									<small>Unique identifier (lowercase, underscores only)</small>
								</div>

								<div class="form-group">
									<label for="facet_label">Display Label *</label>
									<input
										id="facet_label"
										type="text"
										bind:value={editingFacet.facet_label}
										placeholder="e.g., Subject, Author, Call Number"
									/>
								</div>

								<div class="form-group full-width">
									<label for="facet_description">Description</label>
									<input
										id="facet_description"
										type="text"
										bind:value={editingFacet.facet_description}
										placeholder="Help text for users"
									/>
								</div>

								<div class="form-group">
									<label for="source_type">Data Source Type *</label>
									<select id="source_type" bind:value={editingFacet.source_type}>
										<option value="database_column">Database Column</option>
										<option value="marc_field">MARC Field</option>
										<option value="items_field">Items Table Field</option>
										<option value="computed">Computed</option>
									</select>
								</div>

								<div class="form-group">
									<label for="source_field">Source Field *</label>
									<input
										id="source_field"
										type="text"
										bind:value={editingFacet.source_field}
										placeholder="e.g., material_type, publication_info, items.location"
									/>
								</div>

								{#if editingFacet.source_type === 'marc_field'}
									<div class="form-group">
										<label for="source_subfield">MARC Subfield</label>
										<input
											id="source_subfield"
											type="text"
											bind:value={editingFacet.source_subfield}
											placeholder="e.g., a, b, c"
											maxlength="1"
										/>
									</div>
								{/if}

								<div class="form-group">
									<label for="display_type">Display Type</label>
									<select id="display_type" bind:value={editingFacet.display_type}>
										<option value="checkbox_list">Checkbox List</option>
										<option value="date_range">Date Range</option>
										<option value="numeric_range">Numeric Range</option>
										<option value="tag_cloud">Tag Cloud</option>
									</select>
								</div>

								<div class="form-group">
									<label for="aggregation_method">Aggregation Method</label>
									<select id="aggregation_method" bind:value={editingFacet.aggregation_method}>
										<option value="distinct_values">Distinct Values</option>
										<option value="decade_buckets">Decade Buckets</option>
										<option value="year_buckets">Year Buckets</option>
										<option value="custom_ranges">Custom Ranges</option>
									</select>
								</div>

								<div class="form-group">
									<label for="sort_by">Sort By</label>
									<select id="sort_by" bind:value={editingFacet.sort_by}>
										<option value="count_desc">Count (Descending)</option>
										<option value="count_asc">Count (Ascending)</option>
										<option value="label_asc">Label (A-Z)</option>
										<option value="label_desc">Label (Z-A)</option>
										<option value="custom">Custom Order</option>
									</select>
								</div>

								<div class="form-group">
									<label for="max_items">Max Items to Display</label>
									<input
										id="max_items"
										type="number"
										min="3"
										max="50"
										bind:value={editingFacet.max_items}
									/>
								</div>

								<div class="form-group">
									<label for="filter_param">URL Parameter Name</label>
									<input
										id="filter_param"
										type="text"
										bind:value={editingFacet.filter_param_name}
										placeholder="e.g., subjects, authors"
									/>
									<small>Name for URL query parameter</small>
								</div>

								<div class="form-group full-width">
									<div class="checkbox-group">
										<label class="checkbox">
											<input type="checkbox" bind:checked={editingFacet.is_enabled} />
											Enabled
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={editingFacet.show_count} />
											Show Count
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={editingFacet.multi_select} />
											Allow Multiple Selection
										</label>
										<label class="checkbox">
											<input
												type="checkbox"
												bind:checked={editingFacet.is_collapsed_by_default}
											/>
											Collapsed by Default
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={editingFacet.cache_enabled} />
											Enable Caching
										</label>
									</div>
								</div>
							</div>

							<div class="editor-actions">
								<button class="btn-primary" onclick={saveNewFacet} disabled={saving}>
									{saving ? 'Creating...' : 'Create Facet'}
								</button>
								<button
									class="btn-secondary"
									onclick={() => {
										showNewFacetForm = false;
										editingFacet = null;
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{/if}

				<div class="facets-list">
					{#if facets.length === 0}
						<div class="empty-state">
							<p>No facets configured yet.</p>
							<button class="btn-primary" onclick={createNewFacet}>Create Your First Facet</button>
						</div>
					{:else}
						{#each facets as facet, index (facet.id)}
							<div
								class="facet-item"
								class:inactive={!facet.is_active || !facet.is_enabled}
								draggable="true"
								ondragstart={() => handleFacetDragStart(index)}
								ondragover={(e) => handleFacetDragOver(e, index)}
								ondragend={handleFacetDragEnd}
							>
								<div class="drag-handle">
									<svg width="16" height="16" viewBox="0 0 16 16">
										<path d="M5 3h6M5 8h6M5 13h6" stroke="currentColor" stroke-width="2" />
									</svg>
								</div>

								<div class="facet-info">
									<div class="facet-header">
										<div class="facet-name">
											<strong>{facet.facet_label}</strong>
											<span class="facet-key">{facet.facet_key}</span>
											{#if !facet.is_active}
												<span class="badge badge-inactive">Deleted</span>
											{:else if !facet.is_enabled}
												<span class="badge badge-disabled">Disabled</span>
											{:else}
												<span class="badge badge-active">Active</span>
											{/if}
										</div>
										<div class="facet-actions">
											<button
												class="btn-icon"
												onclick={() => refreshCache(facet.facet_key)}
												disabled={refreshingCache}
												title="Refresh cache"
											>
												🔄
											</button>
											<button class="btn-icon" onclick={() => editFacet(facet)} title="Edit">
												✏️
											</button>
											<button
												class="btn-icon"
												onclick={() => deleteFacet(facet.id)}
												title="Delete"
											>
												🗑️
											</button>
										</div>
									</div>

									<div class="facet-details">
										<div class="detail-item">
											<span class="label">Source:</span>
											<span class="value"
												>{facet.source_type} - {facet.source_field}{facet.source_subfield
													? `$${facet.source_subfield}`
													: ''}</span
											>
										</div>
										<div class="detail-item">
											<span class="label">Type:</span>
											<span class="value">{facet.display_type}</span>
										</div>
										<div class="detail-item">
											<span class="label">Method:</span>
											<span class="value">{facet.aggregation_method}</span>
										</div>
										<div class="detail-item">
											<span class="label">Max Items:</span>
											<span class="value">{facet.max_items}</span>
										</div>
									</div>

									<div class="facet-controls">
										<label class="checkbox">
											<input type="checkbox" bind:checked={facet.is_enabled} />
											Enabled
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={facet.show_count} />
											Show Count
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={facet.multi_select} />
											Multi-select
										</label>
										<label class="checkbox">
											<input type="checkbox" bind:checked={facet.is_collapsed_by_default} />
											Collapsed by Default
										</label>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="form-actions">
					<button class="btn-primary" onclick={saveFacets} disabled={saving}>
						{saving ? 'Saving...' : 'Save Facet Configuration'}
					</button>
					<button
						class="btn-secondary"
						onclick={() => {
							facets = [...data.facets];
						}}
					>
						Reset
					</button>
				</div>
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

	/* Facet Configuration Styles */
	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.header-actions {
		display: flex;
		gap: 1rem;
	}

	.facets-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 2rem 0;
	}

	.facet-item {
		display: flex;
		gap: 1rem;
		padding: 1.5rem;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		cursor: move;
		transition: all 0.2s;
	}

	.facet-item:hover {
		border-color: #ccc;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.facet-item.inactive {
		opacity: 0.6;
		background: #f5f5f5;
	}

	.facet-info {
		flex: 1;
	}

	.facet-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.facet-name {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.facet-name strong {
		font-size: 1.125rem;
		color: #2c3e50;
	}

	.facet-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		padding: 0.5rem;
		background: none;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s;
	}

	.btn-icon:hover:not(:disabled) {
		background: #f5f5f5;
		border-color: #ccc;
	}

	.btn-icon:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.facet-details {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail-item .label {
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
		font-weight: 500;
	}

	.detail-item .value {
		font-size: 0.875rem;
		color: #333;
		font-family: monospace;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.badge-active {
		background: #d4edda;
		color: #155724;
	}

	.badge-disabled {
		background: #fff3cd;
		color: #856404;
	}

	.badge-inactive {
		background: #f8d7da;
		color: #721c24;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #666;
	}

	.empty-state p {
		margin-bottom: 1rem;
		font-size: 1.125rem;
	}

	/* Facet Editor */
	.facet-editor {
		background: white;
		border: 2px solid #e73b42;
		border-radius: 8px;
		margin-bottom: 2rem;
		overflow: hidden;
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		background: #e73b42;
		color: white;
	}

	.editor-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	.btn-close {
		background: none;
		border: none;
		color: white;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.btn-close:hover {
		opacity: 0.8;
	}

	.editor-content {
		padding: 2rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.form-grid .full-width {
		grid-column: 1 / -1;
	}

	.checkbox-group {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.editor-actions {
		display: flex;
		gap: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e0e0e0;
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
