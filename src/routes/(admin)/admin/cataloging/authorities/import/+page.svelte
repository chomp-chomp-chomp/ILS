<script lang="ts">
	let query = $state('');
	let type = $state<'names' | 'subjects'>('names');
	let results = $state<any[]>([]);
	let bulkDownloads = $state<{ names: string; subjects: string } | null>(null);
	let unauthorizedSummary = $state<any>(null);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');
	let loading = $state(false);
	let scheduling = $state(false);
	let frequency = $state<'weekly' | 'monthly'>('weekly');
	let scope = $state<'names' | 'subjects' | 'both'>('both');
	let runNow = $state(false);

	async function searchLoc() {
		if (!query) return;
		loading = true;
		message = '';

		try {
			const response = await fetch(
				`/api/authorities/loc?q=${encodeURIComponent(query)}&type=${type}`
			);
			if (!response.ok) {
				throw new Error('Search failed');
			}

			const data = await response.json();
			results = data.authorities || [];
			bulkDownloads = data.bulkDownloads;
		} catch (err: any) {
			message = err.message || 'Failed to search Library of Congress';
			messageType = 'error';
		} finally {
			loading = false;
		}
	}

	async function importAuthority(authority: any) {
		message = '';
		messageType = 'info';
		loading = true;

		try {
			const response = await fetch('/api/authorities/loc', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					uri: authority.uri,
					lccn: authority.lccn
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Import failed');
			}

			message = data.imported ? 'Authority imported' : data.message;
			messageType = 'success';
		} catch (err: any) {
			message = err.message || 'Failed to import authority';
			messageType = 'error';
		} finally {
			loading = false;
		}
	}

	async function loadUnauthorizedSummary() {
		const response = await fetch('/api/authorities/unauthorized?limit=10');
		if (response.ok) {
			const data = await response.json();
			unauthorizedSummary = data.summary;
		}
	}

	async function scheduleSync() {
		scheduling = true;
		message = '';

		try {
			const response = await fetch('/api/authorities/loc/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ frequency, scope, run_now: runNow })
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message || 'Failed to schedule sync');
			}

			message = data.message;
			messageType = 'success';
		} catch (err: any) {
			message = err.message || 'Failed to schedule sync';
			messageType = 'error';
		} finally {
			scheduling = false;
		}
	}

	loadUnauthorizedSummary();
</script>

<svelte:head>
	<title>Import Authorities - Library of Congress</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>Library of Congress Authorities</h1>
		<p>Search LCNAF/LCSH, import records, and schedule regular updates.</p>
	</header>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<section class="card">
		<div class="search-grid">
			<input
				type="text"
				placeholder="Search LCNAF/LCSH (e.g., Twain, Mark)"
				bind:value={query}
				onkeydown={(e) => e.key === 'Enter' && searchLoc()}
			/>
			<select bind:value={type}>
				<option value="names">Names (LCNAF)</option>
				<option value="subjects">Subjects (LCSH)</option>
			</select>
			<button class="btn-primary" onclick={searchLoc} disabled={loading}>
				{loading ? 'Searching…' : 'Search LoC'}
			</button>
		</div>

		{#if bulkDownloads}
			<div class="bulk-downloads">
				<h3>Bulk files</h3>
				<p>Use bulk RDF dumps for offline synchronization.</p>
				<ul>
					<li>
						<a href={bulkDownloads.names} target="_blank" rel="noopener noreferrer">LCNAF (Names)</a>
					</li>
					<li>
						<a href={bulkDownloads.subjects} target="_blank" rel="noopener noreferrer">LCSH (Subjects)</a>
					</li>
				</ul>
			</div>
		{/if}

		{#if results.length > 0}
			<div class="results">
				<h3>{results.length} results</h3>
				<ul>
					{#each results as authority}
						<li>
							<div class="heading-row">
								<div>
									<div class="heading">
										{authority.label || authority.heading}
										{#if authority.uri}
											<a href={authority.uri} target="_blank" rel="noopener noreferrer" class="loc-link" title="View at Library of Congress">
												🔗
											</a>
										{/if}
									</div>
									<div class="meta">
										{#if authority.lccn}<span class="badge">LCCN {authority.lccn}</span>{/if}
										<span class="badge">{type === 'subjects' ? 'LCSH' : 'LCNAF'}</span>
									</div>
								</div>
								<button class="btn-primary" onclick={() => importAuthority(authority)} disabled={loading}>
									Import
								</button>
							</div>

							{#if authority.variants?.length}
								<div class="variants">
									<strong>Variants:</strong> {authority.variants.slice(0, 4).join(', ')}
								</div>
							{/if}

							{#if authority.related?.length}
								<div class="variants">
									<strong>See also:</strong> {authority.related.slice(0, 4).join(', ')}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{:else if !loading}
			<p class="muted">Search above to retrieve authority records.</p>
		{/if}
	</section>

	<section class="card">
		<div class="section-header">
			<h2>Scheduled Updates</h2>
			<button class="btn-primary" onclick={scheduleSync} disabled={scheduling}>
				{scheduling ? 'Scheduling…' : 'Save Schedule'}
			</button>
		</div>
		<div class="schedule-grid">
			<label>
				<span>Frequency</span>
				<select bind:value={frequency}>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
				</select>
			</label>
			<label>
				<span>Scope</span>
				<select bind:value={scope}>
					<option value="names">Names</option>
					<option value="subjects">Subjects</option>
					<option value="both">Both</option>
				</select>
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={runNow} />
				Run immediately
			</label>
		</div>
	</section>

	<section class="card">
		<h2>Unauthorized Headings</h2>
		{#if unauthorizedSummary}
			<div class="coverage">
				<div class="stat">
					<div class="stat-value">{unauthorizedSummary.coverage || 0}%</div>
					<div class="stat-label">Authority coverage</div>
				</div>
				<div class="stat">
					<div class="stat-value">{unauthorizedSummary.total_unauthorized}</div>
					<div class="stat-label">Unauthorized headings</div>
				</div>
				<div class="stat">
					<div class="stat-value">{unauthorizedSummary.unique_headings}</div>
					<div class="stat-label">Unique forms</div>
				</div>
			</div>
			{#if unauthorizedSummary.top_headings?.length}
				<ul class="top-headings">
					{#each unauthorizedSummary.top_headings as item}
						<li>{item.heading} <span class="badge badge-muted">{item.count}</span></li>
					{/each}
				</ul>
			{/if}
			<a class="btn-secondary" href="/admin/cataloging/authorities/corrections">
				Open Batch Corrections
			</a>
		{:else}
			<p class="muted">Loading unauthorized headings…</p>
		{/if}
	</section>
</div>

<style>
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.page-header h1 {
		margin: 0 0 6px 0;
	}

	.page-header p {
		margin: 0;
		color: #555;
	}

	.card {
		background: #fff;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
	}

	.search-grid {
		display: grid;
		grid-template-columns: 1fr 200px 160px;
		gap: 10px;
		align-items: center;
	}

	.search-grid input,
	.search-grid select {
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 6px;
	}

	.btn-primary,
	.btn-secondary {
		padding: 10px 16px;
		border: none;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.message {
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 8px;
		border: 1px solid transparent;
	}

	.message.success {
		background: #d4edda;
		border-color: #c3e6cb;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border-color: #f5c6cb;
		color: #721c24;
	}

	.message.info {
		background: #e7f1ff;
		border-color: #d0e2ff;
		color: #0b4f9c;
	}

	.results ul,
	.top-headings {
		list-style: none;
		padding: 0;
		margin: 12px 0 0 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.results li {
		border: 1px solid #eee;
		border-radius: 6px;
		padding: 12px;
	}

	.heading-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.heading {
		font-weight: 700;
		color: #333;
	}

	.meta {
		display: flex;
		gap: 6px;
		margin-top: 4px;
	}

	.variants {
		margin-top: 6px;
		color: #555;
		font-size: 14px;
	}

	.badge {
		display: inline-block;
		padding: 3px 8px;
		border-radius: 12px;
		background: #e3f2fd;
		color: #1976d2;
		font-size: 12px;
	}

	.badge-muted {
		background: #f1f1f1;
		color: #444;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.schedule-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
		align-items: center;
	}

	.schedule-grid label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
	}

	.schedule-grid select {
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 6px;
	}

	.checkbox {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}

	.bulk-downloads {
		margin-top: 12px;
		padding: 12px;
		background: #f8f9fa;
		border-radius: 6px;
	}

	.bulk-downloads ul {
		list-style: none;
		margin: 6px 0 0 0;
		padding: 0;
	}

	.bulk-downloads li {
		margin: 4px 0;
	}

	.coverage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 12px;
		margin-bottom: 10px;
	}

	.stat {
		background: #f8f9fa;
		padding: 12px;
		border-radius: 6px;
		text-align: center;
	}

	.stat-value {
		font-size: 28px;
		font-weight: 700;
		color: #e73b42;
	}

	.stat-label {
		font-size: 12px;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.muted {
		color: #666;
		font-size: 14px;
	}

	.loc-link {
		margin-left: 8px;
		text-decoration: none;
		font-size: 16px;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.loc-link:hover {
		opacity: 1;
	}

	@media (max-width: 768px) {
		.search-grid {
			grid-template-columns: 1fr;
		}

		.heading-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
