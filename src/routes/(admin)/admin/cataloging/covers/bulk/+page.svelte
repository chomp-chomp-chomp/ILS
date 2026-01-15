<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

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

	// Fetch missing state
	let fetchMissingTotal = $state(0);
	let fetchMissingProcessed = $state(0);
	let fetchMissingSucceeded = $state(0);
	let fetchMissingFailed = $state(0);
	let fetchMissingRemaining = $state(0);
	let isFetchingMissing = $state(false);
	let fetchMissingPaused = $state(false);
	let fetchMissingMessage = $state('');
	let fetchMissingLogs = $state<string[]>([]);
	let fetchMissingBatchSize = $state(10);

	// Local upload state
	let selectedFiles: FileList | null = $state(null);
	let isUploading = $state(false);
	let uploadMessage = $state('');
	let uploadLogs = $state<string[]>([]);
	let uploadSucceeded = $state(0);
	let uploadFailed = $state(0);

	/**
	 * Helper function to handle error responses from API endpoints
	 * Checks response status and content type before parsing
	 * @param response - Fetch Response object
	 * @param defaultMessage - Default error message if parsing fails
	 * @returns Promise<never> - Always throws an error
	 */
	async function handleErrorResponse(response: Response, defaultMessage: string): Promise<never> {
		let errorMessage = defaultMessage;
		const contentType = response.headers.get('content-type');
		
		if (contentType?.includes('application/json')) {
			try {
				const errorData = await response.json();
				errorMessage = errorData.error || errorMessage;
			} catch {
				errorMessage = `Server error (${response.status})`;
			}
		} else {
			// HTML or other response - likely a server error page
			errorMessage = `Server error (${response.status}): Unable to parse response`;
		}
		
		throw new Error(errorMessage);
	}

	onMount(async () => {
		await loadStats();
	});

	async function loadStats() {
		try {
			// Count records with cover_image_url (need migration)
			const { count: migrateCount } = await supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('cover_image_url', 'is', null);

			migrateRemaining = migrateCount || 0;
			migrateTotal = migrateCount || 0;

			// Count records with ISBNs (can be re-fetched)
			const { count: refetchCount } = await supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('isbn', 'is', null);

			refetchRemaining = refetchCount || 0;
			refetchTotal = refetchCount || 0;

			// Count records with ISBNs but no covers (fetch missing)
			const { count: fetchMissingCount } = await supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('isbn', 'is', null)
				.is('cover_image_url', null);

			fetchMissingRemaining = fetchMissingCount || 0;
			fetchMissingTotal = fetchMissingCount || 0;
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

	function addFetchMissingLog(message: string) {
		fetchMissingLogs = [message, ...fetchMissingLogs].slice(0, 100);
	}

	function addUploadLog(message: string) {
		uploadLogs = [message, ...uploadLogs].slice(0, 100);
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

				// Check if response is OK before parsing JSON
				if (!response.ok) {
					await handleErrorResponse(response, 'Migration failed');
				}

				const result = await response.json();

				migrateProcessed += result.processed;
				migrateSucceeded += result.succeeded;
				migrateFailed += result.failed;
				migrateRemaining = result.remaining;

				// Log debug info from server
				if (result.debug && result.debug.length > 0) {
					addMigrateLog('🔍 Debug info:');
					result.debug.forEach((msg: string) => {
						addMigrateLog(`  ${msg}`);
					});
				}

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

				// Check if response is OK before parsing JSON
				if (!response.ok) {
					await handleErrorResponse(response, 'Re-fetch failed');
				}

				const result = await response.json();

				refetchProcessed += result.processed;
				refetchSucceeded += result.succeeded;
				refetchFailed += result.failed;
				refetchRemaining = result.remaining;

				// Log debug info from server
				if (result.debug && result.debug.length > 0) {
					addRefetchLog('🔍 Debug info:');
					result.debug.forEach((msg: string) => {
						addRefetchLog(`  ${msg}`);
					});
				}

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

	async function startFetchMissing() {
		isFetchingMissing = true;
		fetchMissingPaused = false;
		fetchMissingProcessed = 0;
		fetchMissingSucceeded = 0;
		fetchMissingFailed = 0;
		fetchMissingLogs = [];
		fetchMissingMessage = 'Fetching missing covers from Open Library...';

		addFetchMissingLog(`Starting fetch-missing with batch size: ${fetchMissingBatchSize}`);

		while (fetchMissingRemaining > 0 && !fetchMissingPaused) {
			try {
				const response = await fetch('/api/covers/bulk-migrate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ batchSize: fetchMissingBatchSize, operation: 'fetch-missing' })
				});

				// Check if response is OK before parsing JSON
				if (!response.ok) {
					await handleErrorResponse(response, 'Fetch-missing failed');
				}

				const result = await response.json();

				fetchMissingProcessed += result.processed;
				fetchMissingSucceeded += result.succeeded;
				fetchMissingFailed += result.failed;
				fetchMissingRemaining = result.remaining;

				// Log debug info from server
				if (result.debug && result.debug.length > 0) {
					addFetchMissingLog('🔍 Debug info:');
					result.debug.forEach((msg: string) => {
						addFetchMissingLog(`  ${msg}`);
					});
				}

				addFetchMissingLog(
					`Batch complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.remaining} remaining`
				);

				// Log individual results
				result.results?.forEach((r: any) => {
					if (r.success) {
						addFetchMissingLog(`✓ Fetched: ${r.title}`);
					} else {
						addFetchMissingLog(`✗ Failed: ${r.title} - ${r.error}`);
					}
				});

				// Small delay between batches
				if (fetchMissingRemaining > 0) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}
			} catch (error: any) {
				fetchMissingMessage = `Error: ${error.message}`;
				addFetchMissingLog(`❌ Error: ${error.message}`);
				break;
			}
		}

		isFetchingMissing = false;
		fetchMissingMessage = fetchMissingPaused
			? 'Fetch-missing paused'
			: '🎉 Fetch-missing complete!';

		addFetchMissingLog('🎉 Fetch-missing complete!');
		await loadStats();
	}

	function pauseFetchMissing() {
		fetchMissingPaused = true;
		fetchMissingMessage = 'Pausing fetch-missing...';
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		selectedFiles = input.files;
	}

	async function uploadLocalFiles() {
		if (!selectedFiles || selectedFiles.length === 0) {
			uploadMessage = 'Please select files to upload';
			return;
		}

		isUploading = true;
		uploadSucceeded = 0;
		uploadFailed = 0;
		uploadLogs = [];
		uploadMessage = `Uploading ${selectedFiles.length} file(s)...`;

		addUploadLog(`Starting upload of ${selectedFiles.length} file(s)`);

		try {
			const formData = new FormData();
			for (let i = 0; i < selectedFiles.length; i++) {
				formData.append('files', selectedFiles[i]);
			}

			const response = await fetch('/api/covers/bulk-upload', {
				method: 'POST',
				body: formData
			});

			// Check if response is OK before parsing JSON
			if (!response.ok) {
				await handleErrorResponse(response, 'Upload failed');
			}

			const result = await response.json();

			uploadSucceeded = result.succeeded;
			uploadFailed = result.failed;
			uploadMessage = `Upload complete! ${result.succeeded} succeeded, ${result.failed} failed`;

			// Log individual results
			result.results?.forEach((r: any) => {
				if (r.success) {
					addUploadLog(`✓ Uploaded: ${r.filename} → ${r.title}`);
				} else {
					addUploadLog(`✗ Failed: ${r.filename} - ${r.error}`);
				}
			});

			addUploadLog(`🎉 Upload complete! ${result.succeeded}/${result.total} successful`);

			// Clear file input
			selectedFiles = null;
			const fileInput = document.getElementById('file-input') as HTMLInputElement;
			if (fileInput) fileInput.value = '';

			// Refresh stats
			await loadStats();
		} catch (error: any) {
			uploadMessage = `Error: ${error.message}`;
			addUploadLog(`❌ Error: ${error.message}`);
		} finally {
			isUploading = false;
		}
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
							on:click={startMigration}
							disabled={migrateRemaining === 0}
						>
							Start Migration
						</button>
					{:else}
						<button class="btn-secondary" on:click={pauseMigration}>Pause</button>
					{/if}
					<button class="btn-secondary" on:click={loadStats}>Refresh Stats</button>
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
				<p>Re-download covers from Open Library (with Google Books fallback) and upload to ImageKit</p>
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
							on:click={startRefetch}
							disabled={refetchRemaining === 0}
						>
							Start Re-fetch
						</button>
					{:else}
						<button class="btn-secondary" on:click={pauseRefetch}>Pause</button>
					{/if}
					<button class="btn-secondary" on:click={loadStats}>Refresh Stats</button>
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

		<!-- Fetch Missing Covers -->
		<section class="operation-card">
			<div class="card-header">
				<h2>🔍 Fetch Missing Covers</h2>
				<p>Fetch covers ONLY for records that don't have any cover yet (from Open Library with Google Books fallback)</p>
			</div>

			<div class="stats">
				<div class="stat">
					<span class="stat-label">Records Missing Covers</span>
					<span class="stat-value">{fetchMissingTotal.toLocaleString()}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Processed</span>
					<span class="stat-value">{fetchMissingProcessed.toLocaleString()}</span>
				</div>
				<div class="stat success">
					<span class="stat-label">Succeeded</span>
					<span class="stat-value">{fetchMissingSucceeded.toLocaleString()}</span>
				</div>
				<div class="stat error">
					<span class="stat-label">Failed</span>
					<span class="stat-value">{fetchMissingFailed.toLocaleString()}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Remaining</span>
					<span class="stat-value">{fetchMissingRemaining.toLocaleString()}</span>
				</div>
			</div>

			<div class="controls">
				<div class="batch-size">
					<label for="fetch-missing-batch">
						Batch Size:
						<input
							id="fetch-missing-batch"
							type="number"
							bind:value={fetchMissingBatchSize}
							min="1"
							max="50"
							disabled={isFetchingMissing}
						/>
					</label>
				</div>

				<div class="buttons">
					{#if !isFetchingMissing}
						<button
							class="btn-primary"
							on:click={startFetchMissing}
							disabled={fetchMissingRemaining === 0}
						>
							Start Fetch Missing
						</button>
					{:else}
						<button class="btn-secondary" on:click={pauseFetchMissing}>Pause</button>
					{/if}
					<button class="btn-secondary" on:click={loadStats}>Refresh Stats</button>
				</div>
			</div>

			{#if fetchMissingMessage}
				<div class="message">{fetchMissingMessage}</div>
			{/if}

			{#if fetchMissingLogs.length > 0}
				<div class="logs">
					<h3>Fetch Missing Log</h3>
					<div class="log-content">
						{#each fetchMissingLogs as log}
							<div class="log-entry">{log}</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>

		<!-- Local File Upload -->
		<section class="operation-card local-upload">
			<div class="card-header">
				<h2>📁 Upload Local Files</h2>
				<p>Upload cover images from your computer (match by ISBN or record ID in filename)</p>
			</div>

			<div class="stats">
				<div class="stat">
					<span class="stat-label">Selected Files</span>
					<span class="stat-value">{selectedFiles?.length || 0}</span>
				</div>
				<div class="stat success">
					<span class="stat-label">Succeeded</span>
					<span class="stat-value">{uploadSucceeded}</span>
				</div>
				<div class="stat error">
					<span class="stat-label">Failed</span>
					<span class="stat-value">{uploadFailed}</span>
				</div>
			</div>

			<div class="controls">
				<div class="file-input-wrapper">
					<input
						id="file-input"
						type="file"
						multiple
						accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
						on:change={handleFileSelect}
						disabled={isUploading}
					/>
					<label for="file-input" class="file-input-label">
						{selectedFiles && selectedFiles.length > 0
							? `${selectedFiles.length} file(s) selected`
							: 'Choose Files'}
					</label>
				</div>

				<div class="buttons">
					<button
						class="btn-primary"
						on:click={uploadLocalFiles}
						disabled={isUploading || !selectedFiles || selectedFiles.length === 0}
					>
						{isUploading ? 'Uploading...' : 'Upload Files'}
					</button>
				</div>
			</div>

			{#if uploadMessage}
				<div class="message">{uploadMessage}</div>
			{/if}

			{#if uploadLogs.length > 0}
				<div class="logs">
					<h3>Upload Log</h3>
					<div class="log-content">
						{#each uploadLogs as log}
							<div class="log-entry">{log}</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="file-naming-guide">
				<h4>📝 File Naming Guide</h4>
				<p>Name your files using one of these patterns:</p>
				<ul>
					<li><code>9780062316097.jpg</code> - ISBN only</li>
					<li><code>cover-9780062316097.png</code> - With "cover-" prefix</li>
					<li><code>123e4567-e89b-12d3-a456-426614174000.jpg</code> - Record ID (UUID)</li>
				</ul>
				<p class="help-text">
					The system will automatically match files to records by extracting the ISBN or record ID
					from the filename.
				</p>
			</div>
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
				<strong>Re-fetch from Open Library:</strong> Downloads fresh covers from Open Library (with
				Google Books fallback) and uploads them to ImageKit. Use this to get updated or higher
				quality covers.
			</li>
			<li>
				<strong>Upload Local Files:</strong> Upload cover images from your computer. Name files with
				ISBNs or record IDs (e.g., <code>9780062316097.jpg</code>) for automatic matching.
			</li>
			<li>
				All operations will automatically update the database with the new ImageKit URLs and create
				proper cover records.
			</li>
			<li>You can pause and resume batch operations at any time.</li>
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

	.local-upload {
		grid-column: 1 / -1;
	}

	.file-input-wrapper {
		margin-bottom: 12px;
	}

	.file-input-wrapper input[type='file'] {
		display: none;
	}

	.file-input-label {
		display: inline-block;
		padding: 10px 20px;
		background: #f5f5f5;
		border: 2px dashed #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.95rem;
		color: #666;
		transition: all 0.2s;
	}

	.file-input-label:hover {
		background: #e8e8e8;
		border-color: #ccc;
	}

	.file-naming-guide {
		margin-top: 20px;
		padding: 16px;
		background: #f9f9f9;
		border-left: 4px solid #e73b42;
		border-radius: 4px;
	}

	.file-naming-guide h4 {
		margin: 0 0 8px 0;
		font-size: 0.95rem;
		color: #333;
	}

	.file-naming-guide p {
		margin: 8px 0;
		font-size: 0.9rem;
		color: #666;
	}

	.file-naming-guide ul {
		margin: 8px 0;
		padding-left: 20px;
	}

	.file-naming-guide li {
		margin-bottom: 4px;
		font-size: 0.9rem;
		color: #666;
	}

	.file-naming-guide code {
		background: #e8e8e8;
		padding: 2px 6px;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
	}

	.help-text {
		font-size: 0.85rem !important;
		color: #888 !important;
		font-style: italic;
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
