<script lang="ts">
	import { onMount } from 'svelte';

	let stats = $state<any>(null);
	let unauthorized = $state<any>(null);
	let topAuthorities = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		await loadReports();
	});

	async function loadReports() {
		loading = true;

		try {
			// Fetch general stats
			const statsResponse = await fetch('/api/authorities');
			const statsData = await statsResponse.json();

			// Fetch unauthorized headings summary
			const unauthorizedResponse = await fetch('/api/authorities/unauthorized?limit=10');
			const unauthorizedData = await unauthorizedResponse.json();

			// Fetch top authorities
			const topResponse = await fetch('/api/authorities?limit=20');
			const topData = await topResponse.json();

			stats = {
				total: statsData.total || 0,
				byType: {},
				bySource: {}
			};

			unauthorized = unauthorizedData.summary;
			topAuthorities = topData.authorities || [];
		} catch (error) {
			console.error('Error loading reports:', error);
		} finally {
			loading = false;
		}
	}

	function calculateCoverage(): number {
		if (unauthorized?.coverage !== undefined) {
			return unauthorized.coverage;
		}
		if (!unauthorized || !stats) return 0;
		const totalHeadings = stats.total + (unauthorized.total_unauthorized || 0);
		if (totalHeadings === 0) return 100;
		return Math.round((stats.total / totalHeadings) * 100);
	}
</script>

<svelte:head>
	<title>Authority Reports - Admin</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>Authority Control Reports</h1>
		<p>Statistics and usage reports for authority records</p>
	</header>

	{#if loading}
		<div class="loading">Loading reports...</div>
	{:else}
		<!-- Coverage Report -->
		<section class="report-section">
			<h2>Authority Coverage</h2>
			<div class="coverage-chart">
				<div class="coverage-stat">
					<div class="stat-circle">
						<div class="stat-value">{calculateCoverage()}%</div>
					</div>
					<div class="stat-label">Authority Coverage</div>
				</div>

				<div class="coverage-details">
					<div class="detail-item">
						<strong>{stats?.total || 0}</strong>
						<span>Authorized headings</span>
					</div>
					<div class="detail-item">
						<strong>{unauthorized?.total_unauthorized || 0}</strong>
						<span>Unauthorized headings</span>
					</div>
					<div class="detail-item">
						<strong>{unauthorized?.unique_headings || 0}</strong>
						<span>Unique unauthorized forms</span>
					</div>
				</div>
			</div>

			{#if unauthorized && unauthorized.total_unauthorized > 0}
				<div class="action-required">
					<p>
						⚠️ You have {unauthorized.total_unauthorized} unauthorized headings.
					</p>
					<a href="/admin/cataloging/authorities/corrections" class="btn-primary">
						Go to Batch Corrections
					</a>
				</div>
			{/if}
		</section>

		<!-- Top Unauthorized Headings -->
		{#if unauthorized?.top_headings && unauthorized.top_headings.length > 0}
			<section class="report-section">
				<h2>Top Unauthorized Headings</h2>
				<p class="section-description">Most common headings without authority control</p>

				<table class="report-table">
					<thead>
						<tr>
							<th>Heading</th>
							<th>Occurrences</th>
						</tr>
					</thead>
					<tbody>
						{#each unauthorized.top_headings as item}
							<tr>
								<td>{item.heading}</td>
								<td class="number">{item.count}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		<!-- Most Used Authorities -->
		{#if topAuthorities.length > 0}
			<section class="report-section">
				<h2>Most Used Authorities</h2>
				<p class="section-description">Authority records used most frequently in the catalog</p>

				<table class="report-table">
					<thead>
						<tr>
							<th>Heading</th>
							<th>Type</th>
							<th>Source</th>
							<th>Usage Count</th>
						</tr>
					</thead>
					<tbody>
						{#each topAuthorities.slice(0, 20) as authority}
							<tr>
								<td>
									<a href="/admin/cataloging/authorities/{authority.id}">
										{authority.heading}
									</a>
								</td>
								<td>
									<span class="badge type-badge">
										{authority.type.replace('_', ' ')}
									</span>
								</td>
								<td>
									<span class="badge source-badge">
										{authority.source.toUpperCase()}
									</span>
								</td>
								<td class="number">{authority.usage_count || 0}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		<!-- Actions -->
		<section class="report-section">
			<h2>Quick Actions</h2>
			<div class="actions-grid">
				<a href="/admin/cataloging/authorities/corrections" class="action-card">
					<h3>Batch Corrections</h3>
					<p>Fix unauthorized headings</p>
				</a>
				<a href="/admin/cataloging/authorities/import" class="action-card">
					<h3>Import from LoC</h3>
					<p>Add authorities from Library of Congress</p>
				</a>
				<a href="/admin/cataloging/authorities" class="action-card">
					<h3>Manage Authorities</h3>
					<p>Search and edit authority records</p>
				</a>
			</div>
		</section>
	{/if}
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

	.loading {
		text-align: center;
		padding: 60px 20px;
		color: #666;
	}

	.report-section {
		background: white;
		border-radius: 8px;
		padding: 30px;
		margin-bottom: 30px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.report-section h2 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.section-description {
		margin: 0 0 20px 0;
		color: #666;
		font-size: 14px;
	}

	.coverage-chart {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 40px;
		align-items: center;
		margin: 30px 0;
	}

	.coverage-stat {
		text-align: center;
	}

	.stat-circle {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 12px;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.stat-value {
		font-size: 48px;
		font-weight: bold;
		color: white;
	}

	.stat-label {
		font-size: 14px;
		color: #666;
		font-weight: 500;
	}

	.coverage-details {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}

	.detail-item {
		text-align: center;
		padding: 20px;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.detail-item strong {
		display: block;
		font-size: 32px;
		color: #e73b42;
		margin-bottom: 8px;
	}

	.detail-item span {
		font-size: 13px;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.action-required {
		background: #fff3cd;
		border-left: 4px solid #ffc107;
		padding: 16px 20px;
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 20px;
	}

	.action-required p {
		margin: 0;
		color: #856404;
		font-weight: 500;
	}

	.report-table {
		width: 100%;
		border-collapse: collapse;
	}

	.report-table th,
	.report-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.report-table th {
		background: #f8f9fa;
		font-weight: 600;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #666;
	}

	.report-table tr:hover {
		background: #f8f9fa;
	}

	.report-table .number {
		text-align: right;
		font-weight: 600;
		color: #e73b42;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.type-badge {
		background: #e3f2fd;
		color: #1976d2;
	}

	.source-badge {
		background: #e8f5e9;
		color: #388e3c;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 20px;
		margin-top: 20px;
	}

	.action-card {
		padding: 24px;
		background: #f8f9fa;
		border-radius: 8px;
		text-decoration: none;
		color: #333;
		transition: all 0.2s;
		border: 2px solid transparent;
	}

	.action-card:hover {
		background: white;
		border-color: #667eea;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.action-card h3 {
		margin: 0 0 8px 0;
		color: #667eea;
	}

	.action-card p {
		margin: 0;
		font-size: 14px;
		color: #666;
	}

	.btn-primary {
		padding: 10px 20px;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: #d32f2f;
	}
</style>
