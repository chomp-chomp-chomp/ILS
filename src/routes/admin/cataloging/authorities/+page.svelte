<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.searchQuery || '');
	let selectedType = $state(data.type || '');
	let selectedSource = $state(data.source || '');
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');

	// Authority types
	const authorityTypes = [
		{ value: '', label: 'All Types' },
		{ value: 'personal_name', label: 'Personal Names' },
		{ value: 'corporate_name', label: 'Corporate Names' },
		{ value: 'meeting_name', label: 'Meeting Names' },
		{ value: 'geographic_name', label: 'Geographic Names' },
		{ value: 'topical_subject', label: 'Topical Subjects' },
		{ value: 'genre_form', label: 'Genre/Form' }
	];

	const sources = [
		{ value: '', label: 'All Sources' },
		{ value: 'lcnaf', label: 'LC Names (LCNAF)' },
		{ value: 'lcsh', label: 'LC Subjects (LCSH)' },
		{ value: 'local', label: 'Local' },
		{ value: 'viaf', label: 'VIAF' },
		{ value: 'fast', label: 'FAST' }
	];

	function formatType(type: string): string {
		const typeMap: Record<string, string> = {
			personal_name: 'Personal Name',
			corporate_name: 'Corporate Name',
			meeting_name: 'Meeting Name',
			geographic_name: 'Geographic Name',
			topical_subject: 'Topical Subject',
			genre_form: 'Genre/Form'
		};
		return typeMap[type] || type;
	}

	function formatSource(source: string): string {
		const sourceMap: Record<string, string> = {
			lcnaf: 'LCNAF',
			lcsh: 'LCSH',
			local: 'Local',
			viaf: 'VIAF',
			fast: 'FAST'
		};
		return sourceMap[source] || source;
	}

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		if (selectedType) params.set('type', selectedType);
		if (selectedSource) params.set('source', selectedSource);
		goto(`/admin/cataloging/authorities?${params.toString()}`);
	}

	function clearFilters() {
		searchQuery = '';
		selectedType = '';
		selectedSource = '';
		goto('/admin/cataloging/authorities');
	}

	async function deleteAuthority(id: string, heading: string) {
		if (!confirm(`Delete authority "${heading}"?\n\nThis will fail if the authority is in use.`)) {
			return;
		}

		try {
			const response = await fetch(`/api/authorities?id=${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to delete');
			}

			message = 'Authority deleted successfully';
			messageType = 'success';

			// Reload page
			setTimeout(() => window.location.reload(), 1500);
		} catch (error: any) {
			message = error.message || 'Failed to delete authority';
			messageType = 'error';
		}
	}
</script>

<svelte:head>
	<title>Authority Control - Admin</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>Authority Control</h1>
		<p>Manage authorized headings for names and subjects</p>
	</header>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<!-- Statistics -->
	{#if data.stats}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{data.stats.total || 0}</div>
				<div class="stat-label">Total Authorities</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{data.stats.total_links || 0}</div>
				<div class="stat-label">Linked Records</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{data.stats.by_source?.lcnaf || 0}</div>
				<div class="stat-label">LC Names</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{data.stats.by_source?.lcsh || 0}</div>
				<div class="stat-label">LC Subjects</div>
			</div>
		</div>
	{/if}

	<!-- Actions -->
	<div class="actions-bar">
		<a href="/admin/cataloging/authorities/new" class="btn-primary">
			Add New Authority
		</a>
		<a href="/admin/cataloging/authorities/import" class="btn-secondary">
			Import from Library of Congress
		</a>
		<a href="/admin/cataloging/authorities/browse" class="btn-secondary">
			Browse Authorities
		</a>
		<a href="/admin/cataloging/authorities/corrections" class="btn-secondary">
			Batch Corrections
		</a>
		<a href="/admin/cataloging/authorities/reports" class="btn-secondary">
			Reports
		</a>
	</div>

	<!-- Search and Filters -->
	<div class="search-section">
		<div class="search-bar">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search authorities (heading, variant, or LCCN)..."
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button class="btn-primary" onclick={handleSearch}>Search</button>
		</div>

		<div class="filters">
			<select bind:value={selectedType} onchange={handleSearch}>
				{#each authorityTypes as type}
					<option value={type.value}>{type.label}</option>
				{/each}
			</select>

			<select bind:value={selectedSource} onchange={handleSearch}>
				{#each sources as source}
					<option value={source.value}>{source.label}</option>
				{/each}
			</select>

			{#if searchQuery || selectedType || selectedSource}
				<button class="btn-cancel" onclick={clearFilters}>Clear Filters</button>
			{/if}
		</div>
	</div>

	<!-- Results -->
	<div class="results-section">
		<div class="results-header">
			<p>
				Showing {data.authorities.length} of {data.total} authorities
				{#if searchQuery}
					matching "{searchQuery}"
				{/if}
			</p>
		</div>

		{#if data.authorities.length === 0}
			<div class="no-results">
				<p>No authorities found.</p>
				{#if searchQuery || selectedType || selectedSource}
					<button class="btn-secondary" onclick={clearFilters}>Clear filters</button>
				{:else}
					<p>
						<a href="/admin/cataloging/authorities/import">Import from Library of Congress</a> or
						<a href="/admin/cataloging/authorities/new">add a local authority</a>.
					</p>
				{/if}
			</div>
		{:else}
			<table class="authorities-table">
				<thead>
					<tr>
						<th>Heading</th>
						<th>Type</th>
						<th>Source</th>
						<th>LCCN</th>
						<th>Usage</th>
						<th>Variants</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.authorities as authority}
						<tr>
							<td>
								<strong>{authority.heading}</strong>
								{#if authority.birth_date || authority.death_date}
									<span class="dates">
										({authority.birth_date || '?'}–{authority.death_date || '?'})
									</span>
								{/if}
								{#if authority.note}
									<div class="note">{authority.note}</div>
								{/if}
							</td>
							<td>
								<span class="badge type-badge">
									{formatType(authority.type)}
								</span>
							</td>
							<td>
								<span class="badge source-badge source-{authority.source}">
									{formatSource(authority.source)}
								</span>
							</td>
							<td>
								{#if authority.lccn}
									<a
										href="https://id.loc.gov/authorities/{authority.type.includes('subject')
											? 'subjects'
											: 'names'}/{authority.lccn}"
										target="_blank"
										rel="noopener noreferrer"
									>
										{authority.lccn}
									</a>
								{:else}
									—
								{/if}
							</td>
							<td class="usage-count">
								{authority.usage_count || 0}
							</td>
							<td>
								{#if authority.variant_forms && authority.variant_forms.length > 0}
									<details class="variants">
										<summary>{authority.variant_forms.length} variant(s)</summary>
										<ul>
											{#each authority.variant_forms as variant}
												<li>{variant}</li>
											{/each}
										</ul>
									</details>
								{:else}
									—
								{/if}
							</td>
							<td class="actions-cell">
								<a href="/admin/cataloging/authorities/{authority.id}" class="btn-small">Edit</a>
								<button
									class="btn-small btn-danger"
									onclick={() => deleteAuthority(authority.id, authority.heading)}
								>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Pagination -->
			{#if data.total > data.limit}
				<div class="pagination">
					{#if data.page > 1}
						<a
							href="?page={data.page - 1}{searchQuery ? `&q=${searchQuery}` : ''}{selectedType
								? `&type=${selectedType}`
								: ''}{selectedSource ? `&source=${selectedSource}` : ''}"
							class="btn-secondary"
						>
							Previous
						</a>
					{/if}

					<span class="page-info">
						Page {data.page} of {Math.ceil(data.total / data.limit)}
					</span>

					{#if data.page < Math.ceil(data.total / data.limit)}
						<a
							href="?page={data.page + 1}{searchQuery ? `&q=${searchQuery}` : ''}{selectedType
								? `&type=${selectedType}`
								: ''}{selectedSource ? `&source=${selectedSource}` : ''}"
							class="btn-secondary"
						>
							Next
						</a>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	.page-header {
		margin-bottom: 30px;
	}

	.page-header h1 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.page-header p {
		margin: 0;
		color: #666;
	}

	.message {
		padding: 12px 20px;
		margin-bottom: 20px;
		border-radius: 4px;
		border-left: 4px solid;
	}

	.message.success {
		background: #d4edda;
		border-color: #28a745;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border-color: #dc3545;
		color: #721c24;
	}

	.message.info {
		background: #d1ecf1;
		border-color: #17a2b8;
		color: #0c5460;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
		margin-bottom: 30px;
	}

	.stat-card {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.stat-value {
		font-size: 32px;
		font-weight: bold;
		color: #e73b42;
		margin-bottom: 8px;
	}

	.stat-label {
		font-size: 14px;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.actions-bar {
		display: flex;
		gap: 12px;
		margin-bottom: 30px;
		flex-wrap: wrap;
	}

	.search-section {
		background: white;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 30px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.search-bar {
		display: flex;
		gap: 12px;
		margin-bottom: 20px;
	}

	.search-bar input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.filters {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.filters select {
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		font-size: 14px;
	}

	.results-section {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.results-header {
		margin-bottom: 20px;
		padding-bottom: 12px;
		border-bottom: 1px solid #eee;
	}

	.results-header p {
		margin: 0;
		color: #666;
		font-size: 14px;
	}

	.no-results {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.authorities-table {
		width: 100%;
		border-collapse: collapse;
	}

	.authorities-table th,
	.authorities-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.authorities-table th {
		background: #f8f9fa;
		font-weight: 600;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #666;
	}

	.authorities-table tr:hover {
		background: #f8f9fa;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.type-badge {
		background: #e3f2fd;
		color: #1976d2;
	}

	.source-badge {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.source-badge.source-lcnaf,
	.source-badge.source-lcsh {
		background: #e8f5e9;
		color: #388e3c;
	}

	.source-badge.source-local {
		background: #fff3e0;
		color: #f57c00;
	}

	.dates {
		color: #666;
		font-size: 13px;
	}

	.note {
		color: #666;
		font-size: 13px;
		margin-top: 4px;
		font-style: italic;
	}

	.usage-count {
		font-weight: 600;
		color: #e73b42;
	}

	.variants summary {
		cursor: pointer;
		color: #667eea;
		font-size: 13px;
	}

	.variants ul {
		margin: 8px 0 0 0;
		padding-left: 20px;
	}

	.variants li {
		font-size: 13px;
		color: #666;
		margin: 4px 0;
	}

	.actions-cell {
		display: flex;
		gap: 8px;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 20px;
		margin-top: 30px;
		padding-top: 20px;
		border-top: 1px solid #eee;
	}

	.page-info {
		color: #666;
		font-size: 14px;
	}

	.btn-primary,
	.btn-secondary,
	.btn-cancel,
	.btn-small,
	.btn-danger {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d32f2f;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f8f9fa;
	}

	.btn-cancel {
		background: #666;
		color: white;
	}

	.btn-cancel:hover {
		background: #555;
	}

	.btn-small {
		padding: 6px 12px;
		font-size: 13px;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
		padding: 6px 12px;
		font-size: 13px;
	}

	.btn-danger:hover {
		background: #c82333;
	}
</style>
