<script lang="ts">
	import type { PageData} from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="admin-page">
	<h1>Facets Debug</h1>
	<p>Diagnostic information about facet configuration</p>

	<section class="section">
		<h2>Search Configuration</h2>
		{#if data.searchError}
			<div class="error">Error: {data.searchError}</div>
		{:else if !data.searchConfig}
			<div class="warning">No active search configuration found</div>
		{:else}
			<div class="success">✓ Configuration loaded</div>
			<table>
				<tr><td>Enable Facets:</td><td class:enabled={data.searchConfig.enable_facets}>{data.searchConfig.enable_facets ? '✓' : '✗'}</td></tr>
				<tr><td>Material Types:</td><td class:enabled={data.searchConfig.facet_material_types}>{data.searchConfig.facet_material_types ? '✓' : '✗'}</td></tr>
				<tr><td>Languages:</td><td class:enabled={data.searchConfig.facet_languages}>{data.searchConfig.facet_languages ? '✓' : '✗'}</td></tr>
			</table>
		{/if}
	</section>

	<section class="section">
		<h2>Facet Configurations ({data.facetConfigs.length})</h2>
		{#if data.facetError}
			<div class="error">Error: {data.facetError}</div>
		{:else if data.facetConfigs.length === 0}
			<div class="warning">No configurations found. Run migration 018_faceted_search_configuration.sql</div>
		{:else}
			<table class="data">
				<tr><th>Key</th><th>Label</th><th>Enabled</th><th>Order</th></tr>
				{#each data.facetConfigs as config}
					<tr>
						<td><code>{config.facet_key}</code></td>
						<td>{config.facet_label}</td>
						<td class:enabled={config.is_enabled}>{config.is_enabled ? '✓' : '✗'}</td>
						<td>{config.display_order}</td>
					</tr>
				{/each}
			</table>
		{/if}
	</section>

	<section class="section">
		<h2>Sample Data ({data.sampleResults.total} records)</h2>
		{#if data.resultsError}
			<div class="error">Error: {data.resultsError}</div>
		{:else if data.sampleResults.total === 0}
			<div class="warning">No catalog records found</div>
		{:else}
			<div class="grid">
				<div>
					<h3>Material Types</h3>
					{#each data.sampleResults.materialTypes as item}
						<div>{item.type}: {item.count}</div>
					{/each}
				</div>
				<div>
					<h3>Languages</h3>
					{#each data.sampleResults.languages as item}
						<div>{item.lang}: {item.count}</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<div class="actions">
		<a href="/admin/search-config" class="btn">Search Configuration</a>
		<a href="/catalog/search?q=test" class="btn" target="_blank">Test Search</a>
	</div>
</div>

<style>
	.admin-page { max-width: 1200px; margin: 0 auto; }
	h1 { color: var(--accent); margin-bottom: 0.5rem; }
	p { color: var(--text-muted); margin-bottom: 2rem; }
	.section { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
	.section h2 { color: var(--accent); margin-bottom: 1rem; font-size: 1.2rem; }
	.success { background: #d4edda; color: #155724; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
	.error { background: #f8d7da; color: #721c24; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
	.warning { background: #fff3cd; color: #856404; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
	table { width: 100%; margin-top: 0.5rem; }
	table td, table th { padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border); }
	table th { background: var(--bg-secondary); font-weight: 600; }
	.enabled { color: var(--success); }
	code { background: var(--bg-secondary); padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
	.grid h3 { margin-bottom: 0.5rem; }
	.actions { display: flex; gap: 1rem; margin-top: 2rem; }
	.btn { background: var(--accent); color: white; padding: 0.75rem 1.5rem; border-radius: 4px; text-decoration: none; display: inline-block; }
	.btn:hover { background: var(--accent-hover); }
</style>
