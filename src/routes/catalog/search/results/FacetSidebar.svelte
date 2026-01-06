<script lang="ts">
	import type { FacetGroup } from './+page.server';
	import type { SearchParams } from './+page.server';
	import type { FacetConfig } from '$lib/utils/facets';

	interface Props {
		facets: FacetGroup;
		facetConfigs: FacetConfig[];
		currentFilters: SearchParams;
		onFilterChange: (updates: Record<string, any>) => void;
	}

	let { facets, facetConfigs, currentFilters, onFilterChange }: Props = $props();

	// Initialize expanded sections dynamically based on facet configs
	let expandedSections = $state<Record<string, boolean>>(
		Object.fromEntries(facetConfigs.map((config) => [config.facet_key, !config.is_collapsed_by_default]))
	);

	function toggleSection(section: string) {
		expandedSections[section] = !expandedSections[section];
	}

	function toggleFacet(filterParamName: string, value: string) {
		const currentValues = getCurrentValues(filterParamName);
		const newValues = currentValues.includes(value)
			? currentValues.filter((v) => v !== value)
			: [...currentValues, value];

		onFilterChange({ [filterParamName]: newValues });
	}

	function getCurrentValues(filterParamName: string): string[] {
		// Check if the filter exists in currentFilters
		const filterValue = (currentFilters as any)[filterParamName];
		if (Array.isArray(filterValue)) {
			return filterValue;
		}
		return [];
	}

	function isSelected(filterParamName: string, value: string): boolean {
		return getCurrentValues(filterParamName).includes(value);
	}

	// Get facet values for a specific facet key
	function getFacetValues(facetKey: string) {
		const values = facets[facetKey];
		if (!values || !Array.isArray(values)) {
			return [];
		}
		return values;
	}
</script>

<div class="facet-sidebar">
	<!-- Dynamic Facets based on configuration -->
	{#each facetConfigs as config (config.id)}
		{@const facetValues = getFacetValues(config.facet_key)}
		{#if facetValues.length > 0}
			<div class="facet-group">
				<button class="facet-header" onclick={() => toggleSection(config.facet_key)}>
					<h3>{config.facet_label}</h3>
					<span class="toggle-icon">{expandedSections[config.facet_key] ? '−' : '+'}</span>
				</button>
				{#if expandedSections[config.facet_key]}
					<div class="facet-list">
						{#if config.display_type === 'checkbox_list'}
							{#each facetValues as facet}
								{@const displayLabel = (() => {
									const raw = facet.label ?? facet.value ?? 'Unknown';
									const text = String(raw).trim();
									return text || 'Unknown';
								})()}
								<label class="facet-item">
									{@const displayLabel = facet.label?.trim() || facet.value?.trim() || 'Unknown'}
									<input
										type="checkbox"
										checked={isSelected(config.filter_param_name, facet.value)}
										onchange={() => toggleFacet(config.filter_param_name, facet.value ?? displayLabel)}
										aria-label={displayLabel}
									/>
									<span class="facet-label">{displayLabel}</span>
									{#if config.show_count}
										<span class="facet-count">{facet.count.toLocaleString()}</span>
									{/if}
								</label>
							{/each}
						{:else if config.display_type === 'date_range'}
							<!-- Date range slider or buttons -->
							{#each facetValues as facet}
								{@const displayLabel = (() => {
									const raw = facet.label ?? facet.value ?? 'Unknown';
									const text = String(raw).trim();
									return text || 'Unknown';
								})()}
								<button
									class="facet-year-button"
									onclick={() => {
										if (config.aggregation_method === 'decade_buckets') {
											const decade = parseInt(facet.value);
											onFilterChange({
												year_from: String(decade),
												year_to: String(decade + 9)
											});
										} else if (config.aggregation_method === 'year_buckets') {
											onFilterChange({
												year_from: facet.value,
												year_to: facet.value
											});
										}
									}}
								>
									<span class="facet-label">{displayLabel}</span>
									{#if config.show_count}
										<span class="facet-count">{facet.count.toLocaleString()}</span>
									{/if}
								</button>
							{/each}
						{:else if config.display_type === 'tag_cloud'}
							<!-- Tag cloud view -->
							<div class="tag-cloud">
								{#each facetValues as facet}
									{@const displayLabel = (() => {
										const raw = facet.label ?? facet.value ?? 'Unknown';
										const text = String(raw).trim();
										return text || 'Unknown';
									})()}
									<button
										class="tag-item"
										class:selected={isSelected(config.filter_param_name, facet.value)}
										onclick={() => toggleFacet(config.filter_param_name, facet.value ?? displayLabel)}
									>
										{displayLabel}
										{#if config.show_count}
											<span class="tag-count">({facet.count})</span>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.facet-sidebar {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		overflow: hidden;
		max-width: 100%;
	}

	.facet-group {
		border-bottom: 1px solid #e0e0e0;
	}

	.facet-group:last-child {
		border-bottom: none;
	}

	.facet-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #f8f9fa;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.facet-header:hover {
		background: #e9ecef;
	}

	.facet-header h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #333;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.toggle-icon {
		font-size: 1.25rem;
		color: #666;
		font-weight: bold;
		line-height: 1;
	}

	.facet-list {
		padding: 0.5rem;
	}

	.facet-item {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s;
		gap: 0.5rem;
	}

	.facet-item:hover {
		background: #f8f9fa;
	}

	.facet-item input[type='checkbox'] {
		margin: 0;
		cursor: pointer;
		flex-shrink: 0;
	}

	.facet-label {
		flex: 1;
		font-size: 0.875rem;
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		word-wrap: break-word;
		min-width: 0;
	}

	.facet-count {
		font-size: 0.75rem;
		color: #666;
		background: #e9ecef;
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
		font-weight: 500;
	}

	.facet-year-button {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.facet-year-button:hover {
		background: #f8f9fa;
	}

	.facet-year-button .facet-label {
		text-align: left;
	}

	/* Tag Cloud Styles */
	.tag-cloud {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.tag-item {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 20px;
		cursor: pointer;
		font-size: 0.875rem;
		color: #333;
		transition: all 0.2s;
	}

	.tag-item:hover {
		background: #e9ecef;
		border-color: #ccc;
	}

	.tag-item.selected {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
	}

	.tag-count {
		font-size: 0.75rem;
		opacity: 0.8;
	}
</style>
