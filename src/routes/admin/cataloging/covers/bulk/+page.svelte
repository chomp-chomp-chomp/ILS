<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Migration state
	let migrateTotal = $state(0);
	let migrateProcessed = $state(0);
	let migrateSucceeded = $state(0);
	let migrateFailed = $state(0);
	let migrateRemaining = $state(0);
	let isMigrating = $state(false);
	let migratePaused = $state(false);
	let migrateMessage = $state('');
	let migrateLogs = $state<string[]>([]);
	let migrateBatchSize = $state(10);

	// Refetch state
	let refetchTotal = $state(0);
	let refetchProcessed = $state(0);
	let refetchSucceeded = $state(0);
	let refetchFailed = $state(0);
	let refetchRemaining = $state(0);
	let isRefetching = $state(false);
	let refetchPaused = $state(false);
	let refetchMessage = $state('');
	let refetchLogs = $state<string[]>([]);
	let refetchBatchSize = $state(10);

	onMount(async () => {
		await loadStats();
	});

	async function loadStats() {
		try {
			// Count records with cover_image_url (need migration)
			const { count: migrateCount } = await data.supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('cover_image_url', 'is', null);

			migrateRemaining = migrateCount || 0;
			migrateTotal = migrateCount || 0;

			// Count records with ISBNs (can be re-fetched)
			const { count: refetchCount } = await data.supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('isbn', 'is', null);

			refetchRemaining = refetchCount || 0;
			refetchTotal = refetchCount || 0;
		} catch (error: any) {
			console.error('Error loading stats:', error);
		}
	}

	function addMigrateLog(message: string) {
		migrateLogs = [message, ...migrateLogs].slice(0, 100);
	}

	function addRefetchLog(message: string) {
		refetchLogs = [message, ...refetchLogs].slice(0, 100);
	}

	async function startMigration() {
		isMigrating = true;
		migratePaused = false;
		migrateProcessed = 0;
		migrateSucceeded = 0;
		migrateFailed = 0;
		migrateLogs = [];
		migrateMessage = 'Starting migration to ImageKit...';

		addMigrateLog(`Starting bulk migration with batch size: ${migrateBatchSize}`);

		while (migrateRemaining > 0 && !migratePaused) {
			try {
				const response = await fetch('/api/covers/bulk-migrate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ batchSize: migrateBatchSize, operation: 'migrate' })
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.error || 'Migration failed');
				}

				migrateProcessed += result.processed;
				migrateSucceeded += result.succeeded;
				migrateFailed += result.failed;
				migrateRemaining = result.remaining;

				addMigrateLog(
					`Batch complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.remaining} remaining`
				);

				// Log individual results
				result.results?.forEach((r: any) => {
					if (r.success) {
						addMigrateLog(`✓ Migrated: ${r.title}`);
					} else {
						addMigrateLog(`✗ Failed: ${r.title} - ${r.error}`);
					}
				});

				if (result.remaining === 0) {
					migrateMessage = `Migration complete! Processed ${migrateProcessed} records.`;
					addMigrateLog('🎉 Migration complete!');
					break;
				}

				// Small delay between batches
				await new Promise(resolve => setTimeout(resolve, 500));
			} catch (error: any) {
				migrateMessage = `Error: ${error.message}`;
				addMigrateLog(`❌ Error: ${error.message}`);
				break;
			}
		}

		if (migratePaused) {
			migrateMessage = 'Migration paused';
			addMigrateLog('⏸️ Migration paused');
		}

		isMigrating = false;
	}

	async function startRefetch() {
		isRefetching = true;
		refetchPaused = false;
		refetchProcessed = 0;
		refetchSucceeded = 0;
		refetchFailed = 0;
		refetchLogs = [];
		refetchMessage = 'Starting re-fetch from Open Library...';

		addRefetchLog(`Starting bulk re-fetch with batch size: ${refetchBatchSize}`);

		while (refetchRemaining > 0 && !refetchPaused) {
			try {
				const response = await fetch('/api/covers/bulk-migrate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ batchSize: refetchBatchSize, operation: 'refetch' })
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.error || 'Re-fetch failed');
				}

				refetchProcessed += result.processed;
				refetchSucceeded += result.succeeded;
				refetchFailed += result.failed;
				refetchRemaining = result.remaining;

				addRefetchLog(
					`Batch complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.remaining} remaining`
				);

				// Log individual results
				result.results?.forEach((r: any) => {
					if (r.success) {
						addRefetchLog(`✓ Re-fetched: ${r.title}`);
					} else {
						addRefetchLog(`✗ Failed: ${r.title} - ${r.error}`);
					}
				});

				if (result.remaining === 0) {
					refetchMessage = `Re-fetch complete! Processed ${refetchProcessed} records.`;
					addRefetchLog('🎉 Re-fetch complete!');
					break;
				}

				// Small delay between batches
				await new Promise(resolve => setTimeout(resolve, 500));
			} catch (error: any) {
				refetchMessage = `Error: ${error.message}`;
				addRefetchLog(`❌ Error: ${error.message}`);
				break;
			}
		}

		if (refetchPaused) {
			refetchMessage = 'Re-fetch paused';
			addRefetchLog('⏸️ Re-fetch paused');
		}

		isRefetching = false;
	}

	function pauseMigration() {
		migratePaused = true;
		migrateMessage = 'Pausing migration...';
	}

	function pauseRefetch() {
		refetchPaused = true;
		refetchMessage = 'Pausing re-fetch...';
	}
</script>

<svelte:head>
	<title>Bulk Cover Operations - Library System</title>
</svelte:head>

<div class="bulk-covers-page">
	<header class="page-header">
		<div class="header-content">
			<div>
				<h1>Bulk Cover Operations</h1>
				<p class="subtitle">Migrate existing covers to ImageKit or re-fetch from Open Library</p>
			</div>
			<a href="/admin/cataloging" class="btn-secondary">← Back to Cataloging</a>
		</div>
	</header>

	<div class="operations-grid">
		<!-- Migration to ImageKit -->
		<section class="operation-card">
			<div class="card-header">
				<h2>📦 Migrate to ImageKit</h2>
				<p>Upload existing covers to ImageKit CDN for better performance and reliability</p>
			</div>

			<div class="stats">
				<div class="stat">
					<span class="stat-label">Records with Covers</span>
					<span class="stat-value">{migrateTotal.toLocaleString()}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Processed</span>
					<span class="stat-value">{migrateProcessed.toLocaleString()}</span>
				</div>
				<div class="stat success">
					<span class="stat-label">Succeeded</span>
					<span class="stat-value">{migrateSucceeded.toLocaleString()}</span>
				</div>
				<div class="stat error">
					<span class="stat-label">Failed</span>
					<span class="stat-value">{migrateFailed.toLocaleString()}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Remaining</span>
					<span class="stat-value">{migrateRemaining.toLocaleString()}</span>
				</div>
			</div>

			<div class="controls">
				<div class="batch-size">
					<label for="migrate-batch">
						Batch Size:
						<input
							id="migrate-batch"
							type="number"
							bind:value={migrateBatchSize}
							min="1"
							max="50"
							disabled={isMigrating}
						/>
					</label>
				</div>

				<div class="buttons">
					{#if !isMigrating}
						<button
							class="btn-primary"
							onclick={startMigration}
							disabled={migrateRemaining === 0}
						>
							Start Migration
						</button>
					{:else}
						<button class="btn-secondary" onclick={pauseMigration}>Pause</button>
					{/if}
					<button class="btn-secondary" onclick={loadStats}>Refresh Stats</button>
				</div>
			</div>

			{#if migrateMessage}
				<div class="message">{migrateMessage}</div>
			{/if}

			{#if migrateLogs.length > 0}
				<div class="logs">
					<h3>Migration Log</h3>
					<div class="log-content">
						{#each migrateLogs as log}
							<div class="log-entry">{log}</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>

		<!-- Re-fetch from Open Library -->
		<section class="operation-card">
			<div class="card-header">
				<h2>🔄 Re-fetch from Open Library</h2>
				<p>Re-download covers from Open Library and upload to ImageKit</p>
			</div>

			<div class="stats">
				<div class="stat">
					<span class="stat-label">Records with ISBNs</span>
					<span class="stat-value">{refetchTotal.toLocaleString()}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Processed</span>
					<span class="stat-value">{refetchProcessed.toLocaleString()}</span>
				</div>
				<div class="stat success">
					<span class="stat-label">Succeeded</span>
					<span class="stat-value">{refetchSucceeded.toLocaleString()}</span>
				</div>
				<div class="stat error">
					<span class="stat-label">Failed</span>
					<span class="stat-value">{refetchFailed.toLocaleString()}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Remaining</span>
					<span class="stat-value">{refetchRemaining.toLocaleString()}</span>
				</div>
			</div>

			<div class="controls">
				<div class="batch-size">
					<label for="refetch-batch">
						Batch Size:
						<input
							id="refetch-batch"
							type="number"
							bind:value={refetchBatchSize}
							min="1"
							max="50"
							disabled={isRefetching}
						/>
					</label>
				</div>

				<div class="buttons">
					{#if !isRefetching}
						<button
							class="btn-primary"
							onclick={startRefetch}
							disabled={refetchRemaining === 0}
						>
							Start Re-fetch
						</button>
					{:else}
						<button class="btn-secondary" onclick={pauseRefetch}>Pause</button>
					{/if}
					<button class="btn-secondary" onclick={loadStats}>Refresh Stats</button>
				</div>
			</div>

			{#if refetchMessage}
				<div class="message">{refetchMessage}</div>
			{/if}

			{#if refetchLogs.length > 0}
				<div class="logs">
					<h3>Re-fetch Log</h3>
					<div class="log-content">
						{#each refetchLogs as log}
							<div class="log-entry">{log}</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	</div>

	<section class="info-section">
		<h3>ℹ️ Information</h3>
		<ul>
			<li>
				<strong>Migrate to ImageKit:</strong> Takes existing cover URLs from your database and re-uploads
				them to ImageKit CDN for better performance and reliability.
			</li>
			<li>
				<strong>Re-fetch from Open Library:</strong> Downloads fresh covers from Open Library and uploads
				them to ImageKit. Use this to get updated or higher quality covers.
			</li>
			<li>
				Both operations will automatically update the database with the new ImageKit URLs and create
				proper cover records.
			</li>
			<li>You can pause and resume operations at any time.</li>
			<li>Adjust batch size based on your needs (smaller = slower but more reliable).</li>
		</ul>
	</section>
</div>

<style>
	.bulk-covers-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 20px;
	}

	.page-header {
		background: white;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
	}

	h1 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 1.75rem;
	}

	.subtitle {
		margin: 0;
		color: #666;
	}

	.operations-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
		gap: 20px;
		margin-bottom: 20px;
	}

	.operation-card {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.card-header h2 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 1.25rem;
	}

	.card-header p {
		margin: 0 0 20px 0;
		color: #666;
		font-size: 0.9rem;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		padding: 12px;
		background: #f5f5f5;
		border-radius: 6px;
		text-align: center;
	}

	.stat.success {
		background: #d4edda;
	}

	.stat.error {
		background: #f8d7da;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
		margin-bottom: 4px;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: bold;
		color: #333;
	}

	.controls {
		margin-bottom: 20px;
	}

	.batch-size {
		margin-bottom: 12px;
	}

	.batch-size label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		color: #666;
	}

	.batch-size input {
		width: 80px;
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.buttons {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.message {
		padding: 12px;
		background: #e3f2fd;
		border-left: 4px solid #2196f3;
		border-radius: 4px;
		margin-bottom: 20px;
		font-size: 0.9rem;
	}

	.logs {
		margin-top: 20px;
	}

	.logs h3 {
		margin: 0 0 12px 0;
		font-size: 1rem;
		color: #333;
	}

	.log-content {
		background: #f5f5f5;
		border-radius: 6px;
		padding: 12px;
		max-height: 400px;
		overflow-y: auto;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
	}

	.log-entry {
		padding: 4px 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.info-section {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.info-section h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.info-section ul {
		margin: 0;
		padding-left: 20px;
	}

	.info-section li {
		margin-bottom: 8px;
		color: #666;
		line-height: 1.5;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 500;
		transition: background 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d32f2f;
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.95rem;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
		border-color: #ccc;
	}

	@media (max-width: 768px) {
		.operations-grid {
			grid-template-columns: 1fr;
		}

		.header-content {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
