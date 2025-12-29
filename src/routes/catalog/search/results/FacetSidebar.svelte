<script lang="ts">
	import type { FacetGroup } from './+page.server';
	import type { SearchParams } from './+page.server';

	interface Props {
		facets: FacetGroup;
		currentFilters: SearchParams;
		onFilterChange: (updates: Record<string, any>) => void;
	}

	let { facets, currentFilters, onFilterChange }: Props = $props();

	let expandedSections = $state({
		material_types: true,
		languages: true,
		years: true,
		availability: true,
		locations: true
	});

	function toggleSection(section: keyof typeof expandedSections) {
		expandedSections[section] = !expandedSections[section];
	}

	function toggleFacet(facetType: string, value: string) {
		const currentValues = getCurrentValues(facetType);
		const newValues = currentValues.includes(value)
			? currentValues.filter((v) => v !== value)
			: [...currentValues, value];

		onFilterChange({ [facetType]: newValues });
	}

	function getCurrentValues(facetType: string): string[] {
		switch (facetType) {
			case 'material_types':
				return currentFilters.material_types || [];
			case 'languages':
				return currentFilters.languages || [];
			case 'availability':
				return currentFilters.availability || [];
			case 'locations':
				return currentFilters.locations || [];
			default:
				return [];
		}
	}

	function isSelected(facetType: string, value: string): boolean {
		return getCurrentValues(facetType).includes(value);
	}
</script>

<div class="facet-sidebar">
	<!-- Material Type Facet -->
	{#if facets.material_types.length > 0}
		<div class="facet-group">
			<button class="facet-header" onclick={() => toggleSection('material_types')}>
				<h3>Material Type</h3>
				<span class="toggle-icon">{expandedSections.material_types ? '−' : '+'}</span>
			</button>
			{#if expandedSections.material_types}
				<div class="facet-list">
					{#each facets.material_types as facet}
						<label class="facet-item">
							<input
								type="checkbox"
								checked={isSelected('material_types', facet.value)}
								onchange={() => toggleFacet('material_types', facet.value)}
							/>
							<span class="facet-label">{facet.label}</span>
							<span class="facet-count">{facet.count.toLocaleString()}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Availability Facet -->
	{#if facets.availability.length > 0}
		<div class="facet-group">
			<button class="facet-header" onclick={() => toggleSection('availability')}>
				<h3>Availability</h3>
				<span class="toggle-icon">{expandedSections.availability ? '−' : '+'}</span>
			</button>
			{#if expandedSections.availability}
				<div class="facet-list">
					{#each facets.availability as facet}
						<label class="facet-item">
							<input
								type="checkbox"
								checked={isSelected('availability', facet.value)}
								onchange={() => toggleFacet('availability', facet.value)}
							/>
							<span class="facet-label">{facet.label}</span>
							<span class="facet-count">{facet.count.toLocaleString()}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Location Facet -->
	{#if facets.locations.length > 0}
		<div class="facet-group">
			<button class="facet-header" onclick={() => toggleSection('locations')}>
				<h3>Location</h3>
				<span class="toggle-icon">{expandedSections.locations ? '−' : '+'}</span>
			</button>
			{#if expandedSections.locations}
				<div class="facet-list">
					{#each facets.locations as facet}
						<label class="facet-item">
							<input
								type="checkbox"
								checked={isSelected('locations', facet.value)}
								onchange={() => toggleFacet('locations', facet.value)}
							/>
							<span class="facet-label">{facet.label}</span>
							<span class="facet-count">{facet.count.toLocaleString()}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Language Facet -->
	{#if facets.languages.length > 0}
		<div class="facet-group">
			<button class="facet-header" onclick={() => toggleSection('languages')}>
				<h3>Language</h3>
				<span class="toggle-icon">{expandedSections.languages ? '−' : '+'}</span>
			</button>
			{#if expandedSections.languages}
				<div class="facet-list">
					{#each facets.languages as facet}
						<label class="facet-item">
							<input
								type="checkbox"
								checked={isSelected('languages', facet.value)}
								onchange={() => toggleFacet('languages', facet.value)}
							/>
							<span class="facet-label">{facet.label}</span>
							<span class="facet-count">{facet.count.toLocaleString()}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Publication Year Facet -->
	{#if facets.publication_years.length > 0}
		<div class="facet-group">
			<button class="facet-header" onclick={() => toggleSection('years')}>
				<h3>Publication Year</h3>
				<span class="toggle-icon">{expandedSections.years ? '−' : '+'}</span>
			</button>
			{#if expandedSections.years}
				<div class="facet-list">
					{#each facets.publication_years as facet}
						<button
							class="facet-year-button"
							onclick={() => {
								const decade = parseInt(facet.value);
								onFilterChange({
									year_from: String(decade),
									year_to: String(decade + 9)
								});
							}}
						>
							<span class="facet-label">{facet.label}</span>
							<span class="facet-count">{facet.count.toLocaleString()}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.facet-sidebar {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		overflow: hidden;
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
</style>
