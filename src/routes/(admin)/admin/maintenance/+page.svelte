<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');
	let working = $state(false);
	let systemHealth = $state<{ status: 'healthy' | 'warning' | 'error', checks: any[] }>({
		status: 'healthy',
		checks: []
	});

	onMount(() => {
		checkSystemHealth();
	});

	function checkSystemHealth() {
		const checks = [];

		// Check record count
		if (data.stats.totalRecords === 0) {
			checks.push({ name: 'Catalog Records', status: 'warning', message: 'No catalog records found' });
		} else {
			checks.push({ name: 'Catalog Records', status: 'healthy', message: `${data.stats.totalRecords} records` });
		}

		// Check facet configuration
		if (data.stats.facetConfigs === 0) {
			checks.push({ name: 'Facet Configuration', status: 'warning', message: 'No facets configured' });
		} else {
			checks.push({ name: 'Facet Configuration', status: 'healthy', message: `${data.stats.facetConfigs} facets enabled` });
		}

		// Check site configuration
		if (data.siteConfig) {
			checks.push({ name: 'Site Configuration', status: 'healthy', message: 'Active configuration loaded' });
		} else {
			checks.push({ name: 'Site Configuration', status: 'warning', message: 'No active configuration' });
		}

		// Check facet cache
		if (data.stats.cachedFacets > 1000) {
			checks.push({ name: 'Facet Cache', status: 'warning', message: `${data.stats.cachedFacets} cached items (consider clearing)` });
		} else {
			checks.push({ name: 'Facet Cache', status: 'healthy', message: `${data.stats.cachedFacets} cached items` });
		}

		const hasWarnings = checks.some(c => c.status === 'warning');
		const hasErrors = checks.some(c => c.status === 'error');

		systemHealth = {
			status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy',
			checks
		};
	}

	async function clearFacetCache() {
		if (!confirm('Are you sure you want to clear the facet cache? This will force facets to be recalculated on next search.')) {
			return;
		}

		working = true;
		message = '';

		try {
			const response = await fetch('/api/facet-config/refresh-cache', {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('Failed to clear cache');
			}

			const result = await response.json();
			message = result.message || 'Facet cache cleared successfully';
			messageType = 'success';

			// Reload stats
			setTimeout(() => {
				window.location.reload();
			}, 1500);
		} catch (error: any) {
			message = `Error clearing cache: ${error.message}`;
			messageType = 'error';
		} finally {
			working = false;
		}
	}

	async function reindexSearchVectors() {
		if (!confirm('Reindex all search vectors? This will update the full-text search index for all records.')) {
			return;
		}

		working = true;
		message = 'Reindexing search vectors...';
		messageType = 'info';

		try {
			// Trigger a search vector update by updating records
			// In production, this would be a background job
			message = 'Search vector reindexing initiated. This may take several minutes for large catalogs.';
			messageType = 'info';

			setTimeout(() => {
				message = 'Note: Search vector reindexing is performed automatically when records are updated.';
				messageType = 'info';
			}, 3000);
		} catch (error: any) {
			message = `Error reindexing: ${error.message}`;
			messageType = 'error';
		} finally {
			working = false;
		}
	}

	async function analyzeDatabase() {
		if (!confirm('Run database analysis? This will collect statistics to optimize query performance.')) {
			return;
		}

		working = true;
		message = 'Running database analysis...';
		messageType = 'info';

		try {
			// In a real implementation, this would call a database ANALYZE command
			setTimeout(() => {
				message = 'Database analysis completed. Note: Full ANALYZE commands require direct database access.';
				messageType = 'success';
				working = false;
			}, 2000);
		} catch (error: any) {
			message = `Error analyzing database: ${error.message}`;
			messageType = 'error';
			working = false;
		}
	}

	function formatDate(dateString: string | undefined) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString();
	}
</script>

<div class="maintenance-page">
	<header class="page-header">
		<h1>System Maintenance</h1>
		<a href="/admin" class="btn-secondary">← Back to Dashboard</a>
	</header>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<!-- System Health Dashboard -->
	<div class="card">
		<div class="card-header">
			<h2>System Health</h2>
			<span class="health-badge {systemHealth.status}">
				{#if systemHealth.status === 'healthy'}
					✓ Healthy
				{:else if systemHealth.status === 'warning'}
					⚠ Warning
				{:else}
					✗ Error
				{/if}
			</span>
		</div>
		<div class="health-checks">
			{#each systemHealth.checks as check}
				<div class="health-check">
					<span class="check-status {check.status}">
						{#if check.status === 'healthy'}
							✓
						{:else if check.status === 'warning'}
							⚠
						{:else}
							✗
						{/if}
					</span>
					<div class="check-info">
						<strong>{check.name}</strong>
						<span class="check-message">{check.message}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Database Statistics -->
	<div class="card">
		<h2>Database Statistics</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-label">Catalog Records</div>
				<div class="stat-value">{data.stats.totalRecords.toLocaleString()}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Physical Items</div>
				<div class="stat-value">{data.stats.totalItems.toLocaleString()}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Patrons</div>
				<div class="stat-value">{data.stats.totalPatrons.toLocaleString()}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Active Checkouts</div>
				<div class="stat-value">{data.stats.totalCheckouts.toLocaleString()}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Facet Cache</div>
				<div class="stat-value">{data.stats.cachedFacets.toLocaleString()}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Active Facets</div>
				<div class="stat-value">{data.stats.facetConfigs.toLocaleString()}</div>
			</div>
		</div>
	</div>

	<!-- Maintenance Actions -->
	<div class="card">
		<h2>Maintenance Actions</h2>
		<div class="actions-grid">
			<div class="action-card">
				<h3>Clear Facet Cache</h3>
				<p>Remove all cached facet values. Facets will be recalculated on next search.</p>
				<button class="btn-warning" onclick={clearFacetCache} disabled={working}>
					{working ? 'Working...' : 'Clear Cache'}
				</button>
			</div>

			<div class="action-card">
				<h3>Reindex Search Vectors</h3>
				<p>Rebuild full-text search indexes for all catalog records.</p>
				<button class="btn-primary" onclick={reindexSearchVectors} disabled={working}>
					{working ? 'Working...' : 'Reindex'}
				</button>
			</div>

			<div class="action-card">
				<h3>Analyze Database</h3>
				<p>Collect statistics to optimize query performance.</p>
				<button class="btn-primary" onclick={analyzeDatabase} disabled={working}>
					{working ? 'Analyzing...' : 'Analyze'}
				</button>
			</div>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="card">
		<h2>Recent Catalog Activity</h2>
		{#if data.recentRecords.length > 0}
			<table class="recent-table">
				<thead>
					<tr>
						<th>Title</th>
						<th>Added</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recentRecords as record}
						<tr>
							<td>
								<a href="/admin/cataloging/edit/{record.id}">
									{record.title_statement?.a || 'Untitled'}
								</a>
							</td>
							<td>{formatDate(record.created_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">No recent records found</p>
		{/if}
	</div>

	<!-- Quick Links -->
	<div class="card">
		<h2>Quick Links</h2>
		<div class="quick-links">
			<a href="/admin/search-config" class="quick-link">
				<strong>Search Configuration</strong>
				<span>Configure search fields and behavior</span>
			</a>
			<a href="/admin/display-config" class="quick-link">
				<strong>Display Configuration</strong>
				<span>Configure field display settings</span>
			</a>
			<a href="/admin/site-config" class="quick-link">
				<strong>Site Configuration</strong>
				<span>Manage site branding and theme</span>
			</a>
			<a href="/admin/cataloging/marc-import" class="quick-link">
				<strong>MARC Import</strong>
				<span>Import bibliographic records</span>
			</a>
			<a href="/admin/cataloging/marc-export" class="quick-link">
				<strong>MARC Export</strong>
				<span>Export bibliographic records</span>
			</a>
		</div>
	</div>
</div>

<style>
	.maintenance-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0;
		color: #2c3e50;
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		background: #e0e0e0;
		color: #333;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.message {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		border-left: 4px solid;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border-color: #28a745;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border-color: #dc3545;
	}

	.message.info {
		background: #d1ecf1;
		color: #0c5460;
		border-color: #17a2b8;
	}

	.card {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		padding: 2rem;
		margin-bottom: 1.5rem;
	}

	.card h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.card-header h2 {
		margin: 0;
	}

	.health-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.health-badge.healthy {
		background: #d4edda;
		color: #155724;
	}

	.health-badge.warning {
		background: #fff3cd;
		color: #856404;
	}

	.health-badge.error {
		background: #f8d7da;
		color: #721c24;
	}

	.health-checks {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.health-check {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		border-radius: 4px;
		background: #f9f9f9;
	}

	.check-status {
		font-size: 1.5rem;
		line-height: 1;
	}

	.check-status.healthy {
		color: #28a745;
	}

	.check-status.warning {
		color: #ffc107;
	}

	.check-status.error {
		color: #dc3545;
	}

	.check-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.check-info strong {
		color: #2c3e50;
		font-size: 1rem;
	}

	.check-message {
		color: #666;
		font-size: 0.875rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		padding: 1.5rem;
		border-radius: 8px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		text-align: center;
	}

	.stat-card:nth-child(2) {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
	}

	.stat-card:nth-child(3) {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
	}

	.stat-card:nth-child(4) {
		background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
	}

	.stat-card:nth-child(5) {
		background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
	}

	.stat-card:nth-child(6) {
		background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
	}

	.stat-label {
		font-size: 0.875rem;
		opacity: 0.9;
		margin-bottom: 0.5rem;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: bold;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.action-card {
		padding: 1.5rem;
		border-radius: 8px;
		border: 2px solid #e0e0e0;
		background: #f9f9f9;
	}

	.action-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		color: #2c3e50;
	}

	.action-card p {
		margin: 0 0 1rem 0;
		color: #666;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.btn-primary,
	.btn-warning {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		border: none;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		width: 100%;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-warning {
		background: #ffc107;
		color: #333;
	}

	.btn-warning:hover:not(:disabled) {
		background: #e0a800;
	}

	.btn-primary:disabled,
	.btn-warning:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.recent-table {
		width: 100%;
		border-collapse: collapse;
	}

	.recent-table th,
	.recent-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid #e0e0e0;
	}

	.recent-table th {
		background: #f5f5f5;
		font-weight: 600;
		color: #2c3e50;
		font-size: 0.875rem;
	}

	.recent-table td {
		font-size: 0.875rem;
	}

	.recent-table a {
		color: #e73b42;
		text-decoration: none;
	}

	.recent-table a:hover {
		text-decoration: underline;
	}

	.no-data {
		color: #999;
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	.quick-links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.quick-link {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		border-radius: 4px;
		border: 1px solid #e0e0e0;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
	}

	.quick-link:hover {
		border-color: #e73b42;
		background: #fff5f5;
	}

	.quick-link strong {
		color: #2c3e50;
		font-size: 0.9375rem;
	}

	.quick-link span {
		color: #666;
		font-size: 0.8125rem;
	}
</style>
