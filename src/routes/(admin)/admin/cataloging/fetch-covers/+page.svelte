<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Fetch state
	let totalRecords = $state(0);
	let processedRecords = $state(0);
	let foundCovers = $state(0);
	let remainingRecords = $state(0);
	let isRunning = $state(false);
	let isPaused = $state(false);
	let message = $state('');
	let logs = $state<string[]>([]);
	let batchSize = $state(10);

	// Cleanup state
	let recordsWithCovers = $state(0);
	let cleanupProcessed = $state(0);
	let cleanupRemoved = $state(0);
	let cleanupRemaining = $state(0);
	let isCleaningUp = $state(false);
	let cleanupPaused = $state(false);
	let cleanupMessage = $state('');
	let cleanupLogs = $state<string[]>([]);
	let cleanupBatchSize = $state(50);

	// Records list state
	let recordsWithoutCovers = $state<any[]>([]);
	let showRecordsList = $state(false);
	let recordsPage = $state(1);
	let recordsPerPage = $state(50);
	let loadingRecords = $state(false);

	onMount(async () => {
		await loadStats();
	});

	async function loadStats() {
		try {
			// Count records without covers
			const { data: records, count } = await data.supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.is('cover_image_url', null);

			remainingRecords = count || 0;
			totalRecords = count || 0;

			// Count records with covers
			const { count: withCoversCount } = await data.supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.not('cover_image_url', 'is', null);

			recordsWithCovers = withCoversCount || 0;
			cleanupRemaining = withCoversCount || 0;
		} catch (error: any) {
			message = `Error loading stats: ${error.message}`;
		}
	}

	async function startFetching() {
		isRunning = true;
		isPaused = false;
		processedRecords = 0;
		foundCovers = 0;
		logs = [];
		message = 'Starting cover fetch...';

		addLog(`Starting batch process with batch size: ${batchSize}`);

		while (remainingRecords > 0 && !isPaused) {
			try {
				const response = await fetch('/api/fetch-covers', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ batchSize })
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.error || 'Fetch failed');
				}

				processedRecords += result.processed;
				foundCovers += result.found;
				remainingRecords = result.remaining;

				addLog(
					`Batch complete: Processed ${result.processed}, Found ${result.found}, Remaining ${result.remaining}`
				);

				// Log individual results
				result.results?.forEach((r: any) => {
					if (r.success && r.coverUrl) {
						addLog(`✓ Found cover for: ${r.title}`);
					} else if (!r.coverUrl) {
						addLog(`✗ No cover found for: ${r.title}`);
					}
				});

				if (result.remaining === 0) {
					message = `Complete! Processed ${processedRecords} records, found ${foundCovers} covers.`;
					addLog('All records processed!');
					isRunning = false;
					break;
				}

				// Small delay between batches to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} catch (error: any) {
				message = `Error: ${error.message}`;
				addLog(`Error: ${error.message}`);
				isRunning = false;
				break;
			}
		}

		if (isPaused) {
			message = 'Paused. Click Resume to continue.';
			addLog('Process paused by user');
			isRunning = false;
		}
	}

	function pauseResume() {
		if (isRunning) {
			isPaused = true;
		} else {
			startFetching();
		}
	}

	function reset() {
		isRunning = false;
		isPaused = false;
		processedRecords = 0;
		foundCovers = 0;
		logs = [];
		message = '';
		loadStats();
	}

	function addLog(logMessage: string) {
		const timestamp = new Date().toLocaleTimeString();
		logs = [`[${timestamp}] ${logMessage}`, ...logs];
		if (logs.length > 100) {
			logs = logs.slice(0, 100);
		}
	}

	// Cleanup functions
	async function startCleanup() {
		isCleaningUp = true;
		cleanupPaused = false;
		cleanupProcessed = 0;
		cleanupRemoved = 0;
		cleanupLogs = [];
		cleanupMessage = 'Starting cover cleanup...';

		addCleanupLog(`Starting cleanup with batch size: ${cleanupBatchSize}`);

		while (cleanupRemaining > 0 && !cleanupPaused) {
			try {
				const response = await fetch('/api/cleanup-covers', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ batchSize: cleanupBatchSize })
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.error || 'Cleanup failed');
				}

				cleanupProcessed += result.processed;
				cleanupRemoved += result.removed;
				cleanupRemaining = result.remaining;

				addCleanupLog(
					`Batch complete: Checked ${result.processed}, Removed ${result.removed}, Remaining ${result.remaining}`
				);

				// Log individual results
				result.results?.forEach((r: any) => {
					if (r.removed) {
						addCleanupLog(`✗ Removed invalid cover: ${r.title} (${r.reason})`);
					} else {
						addCleanupLog(`✓ Valid cover kept: ${r.title}`);
					}
				});

				if (result.remaining === 0) {
					cleanupMessage = `Complete! Checked ${cleanupProcessed} records, removed ${cleanupRemoved} invalid covers.`;
					addCleanupLog('All covers verified!');
					isCleaningUp = false;
					// Reload stats to update fetch section
					await loadStats();
					break;
				}

				// Small delay between batches
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} catch (error: any) {
				cleanupMessage = `Error: ${error.message}`;
				addCleanupLog(`Error: ${error.message}`);
				isCleaningUp = false;
				break;
			}
		}

		if (cleanupPaused) {
			cleanupMessage = 'Paused. Click Resume to continue.';
			addCleanupLog('Cleanup paused by user');
			isCleaningUp = false;
		}
	}

	function pauseResumeCleanup() {
		if (isCleaningUp) {
			cleanupPaused = true;
		} else {
			startCleanup();
		}
	}

	function resetCleanup() {
		isCleaningUp = false;
		cleanupPaused = false;
		cleanupProcessed = 0;
		cleanupRemoved = 0;
		cleanupLogs = [];
		cleanupMessage = '';
		loadStats();
	}

	function addCleanupLog(logMessage: string) {
		const timestamp = new Date().toLocaleTimeString();
		cleanupLogs = [`[${timestamp}] ${logMessage}`, ...cleanupLogs];
		if (cleanupLogs.length > 100) {
			cleanupLogs = cleanupLogs.slice(0, 100);
		}
	}

	// Records list functions
	async function loadRecordsWithoutCovers() {
		loadingRecords = true;
		try {
			const offset = (recordsPage - 1) * recordsPerPage;
			const { data: records, error } = await data.supabase
				.from('marc_records')
				.select('id, title_statement, main_entry_personal_name, isbn, publication_info, material_type')
				.is('cover_image_url', null)
				.order('title_statement->a')
				.range(offset, offset + recordsPerPage - 1);

			if (error) {
				console.error('Error loading records:', error);
			} else {
				recordsWithoutCovers = records || [];
			}
		} catch (error) {
			console.error('Error loading records:', error);
		} finally {
			loadingRecords = false;
		}
	}

	async function toggleRecordsList() {
		showRecordsList = !showRecordsList;
		if (showRecordsList && recordsWithoutCovers.length === 0) {
			await loadRecordsWithoutCovers();
		}
	}

	async function changePage(newPage: number) {
		recordsPage = newPage;
		await loadRecordsWithoutCovers();
	}
</script>

<div class="fetch-covers-page">
	<div class="header">
		<h1>Book Cover Management</h1>
		<p>
			Manage cover images for your catalog: verify existing covers and fetch new ones from Google
			Books and Open Library APIs.
		</p>

		<!-- Link to Bulk Operations -->
		<div class="info-banner">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="10" stroke-width="2" />
				<path d="M12 16v-4M12 8h.01" stroke-width="2" stroke-linecap="round" />
			</svg>
			<div>
				<strong>New!</strong> Looking for bulk cover operations with ImageKit CDN support?
				<a href="/admin/cataloging/covers/bulk" class="bulk-link">
					Go to Bulk Cover Operations →
				</a>
			</div>
		</div>
	</div>

	<!-- Cleanup Section -->
	{#if recordsWithCovers > 0}
		<div class="cleanup-section">
			<div class="section-header">
				<h2>🔍 Verify Existing Covers</h2>
				<p>
					You have <strong>{recordsWithCovers}</strong> records with cover URLs. Some may be placeholders
					or broken links. Run this cleanup to verify and remove invalid covers.
				</p>
			</div>

			<!-- Cleanup Stats -->
			<div class="stats-grid">
				<div class="stat-card">
					<div class="stat-value">{recordsWithCovers}</div>
					<div class="stat-label">Records With Covers</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{cleanupProcessed}</div>
					<div class="stat-label">Verified This Session</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{cleanupRemoved}</div>
					<div class="stat-label">Invalid Covers Removed</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{cleanupRemaining}</div>
					<div class="stat-label">Remaining to Check</div>
				</div>
			</div>

			{#if cleanupMessage}
				<div class="message cleanup-message">{cleanupMessage}</div>
			{/if}

			<!-- Cleanup Progress -->
			{#if recordsWithCovers > 0}
				<div class="progress-section">
					<div class="progress-label">
						Progress: {cleanupProcessed} / {recordsWithCovers} ({Math.round(
							(cleanupProcessed / recordsWithCovers) * 100
						)}%)
					</div>
					<div class="progress-bar">
						<div
							class="progress-fill cleanup-progress"
							style="width: {(cleanupProcessed / recordsWithCovers) * 100}%"
						></div>
					</div>
				</div>
			{/if}

			<!-- Cleanup Controls -->
			<div class="controls">
				<div class="batch-size-control">
					<label for="cleanupBatchSize">Batch Size:</label>
					<input
						id="cleanupBatchSize"
						type="number"
						bind:value={cleanupBatchSize}
						min="1"
						max="100"
						disabled={isCleaningUp}
					/>
					<small>Records to check per batch (1-100)</small>
				</div>

				<div class="button-group">
					{#if !isCleaningUp && cleanupProcessed === 0}
						<button
							class="btn-warning"
							onclick={startCleanup}
							disabled={cleanupRemaining === 0}
						>
							Start Cleanup
						</button>
					{:else if isCleaningUp}
						<button class="btn-warning" onclick={pauseResumeCleanup}>Pause</button>
					{:else if cleanupPaused || cleanupProcessed > 0}
						<button class="btn-warning" onclick={pauseResumeCleanup}>
							{cleanupPaused ? 'Resume' : 'Continue'}
						</button>
						<button class="btn-secondary" onclick={resetCleanup}>Reset</button>
					{/if}

					<button class="btn-secondary" onclick={loadStats}>Refresh Stats</button>
				</div>
			</div>

			<!-- Cleanup Log -->
			<div class="log-section">
				<h3>Cleanup Activity Log</h3>
				<div class="log-container">
					{#if cleanupLogs.length === 0}
						<div class="log-empty">No activity yet. Click "Start Cleanup" to begin.</div>
					{:else}
						{#each cleanupLogs as log}
							<div class="log-entry">{log}</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Records Without Covers List -->
	{#if totalRecords > 0}
		<div class="records-list-section">
			<div class="section-header">
				<h2>📚 View Records Without Covers</h2>
				<button class="btn-secondary toggle-btn" onclick={toggleRecordsList}>
					{showRecordsList ? 'Hide List' : `Show ${totalRecords} Records`}
				</button>
			</div>

			{#if showRecordsList}
				{#if loadingRecords}
					<div class="loading">Loading records...</div>
				{:else if recordsWithoutCovers.length > 0}
					<div class="records-table-container">
						<table class="records-table">
							<thead>
								<tr>
									<th>Title</th>
									<th>Author</th>
									<th>ISBN</th>
									<th>Type</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each recordsWithoutCovers as record}
									<tr>
										<td>
											<strong>{record.title_statement?.a || 'Untitled'}</strong>
											{#if record.title_statement?.b}
												<div class="subtitle">{record.title_statement.b}</div>
											{/if}
										</td>
										<td>{record.main_entry_personal_name?.a || '—'}</td>
										<td>{record.isbn || '—'}</td>
										<td>
											<span class="type-badge">{record.material_type || 'book'}</span>
										</td>
										<td>
											<a
												href="/admin/cataloging/edit/{record.id}"
												class="btn-small"
												target="_blank"
											>
												Edit / Upload Cover
											</a>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination -->
					{#if totalRecords > recordsPerPage}
						<div class="pagination">
							<button
								class="btn-secondary"
								onclick={() => changePage(recordsPage - 1)}
								disabled={recordsPage === 1}
							>
								← Previous
							</button>
							<span class="page-info">
								Page {recordsPage} of {Math.ceil(totalRecords / recordsPerPage)}
							</span>
							<button
								class="btn-secondary"
								onclick={() => changePage(recordsPage + 1)}
								disabled={recordsPage >= Math.ceil(totalRecords / recordsPerPage)}
							>
								Next →
							</button>
						</div>
					{/if}
				{:else}
					<div class="no-records">No records without covers found.</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Fetch Section -->
	<div class="fetch-section">
		<div class="section-header">
			<h2>📷 Fetch New Covers</h2>
			<p>
				Automatically fetch cover images for records that don't have covers from Google Books and
				Open Library APIs.
			</p>
		</div>

		<!-- Fetch Stats -->
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{totalRecords}</div>
				<div class="stat-label">Total Records Without Covers</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{processedRecords}</div>
				<div class="stat-label">Processed This Session</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{foundCovers}</div>
				<div class="stat-label">Covers Found</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{remainingRecords}</div>
				<div class="stat-label">Remaining</div>
			</div>
		</div>

		{#if message}
			<div class="message">{message}</div>
		{/if}

		<!-- Fetch Progress Bar -->
		{#if totalRecords > 0}
			<div class="progress-section">
				<div class="progress-label">
					Progress: {processedRecords} / {totalRecords} ({Math.round(
						(processedRecords / totalRecords) * 100
					)}%)
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill"
						style="width: {(processedRecords / totalRecords) * 100}%"
					></div>
				</div>
			</div>
		{/if}

		<!-- Fetch Controls -->
		<div class="controls">
			<div class="batch-size-control">
				<label for="batchSize">Batch Size:</label>
				<input
					id="batchSize"
					type="number"
					bind:value={batchSize}
					min="1"
					max="50"
					disabled={isRunning}
				/>
				<small>Records to process per batch (1-50)</small>
			</div>

			<div class="button-group">
				{#if !isRunning && processedRecords === 0}
					<button class="btn-primary" onclick={startFetching} disabled={remainingRecords === 0}>
						Start Fetching Covers
					</button>
				{:else if isRunning}
					<button class="btn-warning" onclick={pauseResume}>Pause</button>
				{:else if isPaused || processedRecords > 0}
					<button class="btn-primary" onclick={pauseResume}>
						{isPaused ? 'Resume' : 'Continue'}
					</button>
					<button class="btn-secondary" onclick={reset}>Reset</button>
				{/if}

				<button class="btn-secondary" onclick={loadStats}>Refresh Stats</button>
			</div>
		</div>

		<!-- Fetch Log -->
		<div class="log-section">
			<h3>Fetch Activity Log</h3>
			<div class="log-container">
				{#if logs.length === 0}
					<div class="log-empty">No activity yet. Click "Start Fetching Covers" to begin.</div>
				{:else}
					{#each logs as log}
						<div class="log-entry">{log}</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Help Section -->
	<div class="help-section">
		<h3>How This Works</h3>
		<ul>
			<li>
				<strong>Verify Existing Covers:</strong> Checks all records that have cover URLs to ensure they're
				not placeholders or broken links. Removes invalid covers so they can be re-fetched.
			</li>
			<li>
				<strong>Fetch New Covers:</strong> Searches Google Books API first (usually better quality covers),
				then tries Open Library API as a fallback.
			</li>
			<li>Found covers are saved to the database and will display immediately.</li>
			<li>You can pause and resume either process at any time.</li>
			<li>Smaller batch sizes are slower but less likely to hit rate limits.</li>
			<li>
				This does NOT override custom uploaded covers - only fills in missing ones or replaces
				invalid ones.
			</li>
		</ul>
	</div>
</div>

<style>
	.fetch-covers-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.header {
		margin-bottom: 2rem;
	}

	.header h1 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.header p {
		margin: 0;
		color: #666;
	}

	.info-banner {
		display: flex;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: #e3f2fd;
		border: 1px solid #2196f3;
		border-radius: 8px;
		margin-top: 1.5rem;
		align-items: flex-start;
	}

	.info-banner svg {
		flex-shrink: 0;
		color: #2196f3;
		margin-top: 2px;
	}

	.info-banner strong {
		color: #1976d2;
	}

	.bulk-link {
		display: inline-block;
		margin-left: 0.5rem;
		color: #1976d2;
		font-weight: 600;
		text-decoration: none;
		transition: color 0.2s;
	}

	.bulk-link:hover {
		color: #1565c0;
		text-decoration: underline;
	}

	.cleanup-section,
	.fetch-section {
		margin-bottom: 3rem;
		padding: 2rem;
		background: #fff9e6;
		border-radius: 8px;
		border: 2px solid #f39c12;
	}

	.fetch-section {
		background: white;
		border: 1px solid #ddd;
	}

	.section-header {
		margin-bottom: 1.5rem;
	}

	.section-header h2 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.section-header p {
		margin: 0;
		color: #666;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.stat-value {
		font-size: 2.5rem;
		font-weight: bold;
		color: #667eea;
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #666;
	}

	.message {
		background: #d1ecf1;
		color: #0c5460;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		border: 1px solid #bee5eb;
	}

	.cleanup-message {
		background: #fff3cd;
		color: #856404;
		border-color: #ffeaa7;
	}

	.progress-section {
		margin-bottom: 2rem;
	}

	.progress-label {
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.progress-bar {
		width: 100%;
		height: 30px;
		background: #e0e0e0;
		border-radius: 15px;
		overflow: hidden;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
		transition: width 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: bold;
	}

	.cleanup-progress {
		background: linear-gradient(90deg, #f39c12 0%, #e67e22 100%);
	}

	.controls {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.batch-size-control {
		margin-bottom: 1.5rem;
	}

	.batch-size-control label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.batch-size-control input {
		width: 100px;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.batch-size-control small {
		display: block;
		margin-top: 0.25rem;
		color: #666;
	}

	.button-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary,
	.btn-warning {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #5568d3;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-warning {
		background: #f39c12;
		color: white;
	}

	.btn-warning:hover {
		background: #e67e22;
	}

	.log-section {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.log-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #333;
	}

	.log-container {
		max-height: 400px;
		overflow-y: auto;
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 1rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.log-empty {
		color: #999;
		text-align: center;
		padding: 2rem;
	}

	.log-entry {
		padding: 0.25rem 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.help-section {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #ddd;
	}

	.help-section h3 {
		margin: 0 0 1rem 0;
		color: #333;
	}

	.help-section ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	.help-section li {
		margin-bottom: 0.5rem;
		color: #666;
	}

	/* Records List Section */
	.records-list-section {
		margin-bottom: 3rem;
		padding: 2rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #ddd;
	}

	.records-list-section .section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	.loading,
	.no-records {
		text-align: center;
		padding: 2rem;
		color: #666;
	}

	.records-table-container {
		overflow-x: auto;
		margin-bottom: 1.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.records-table {
		width: 100%;
		border-collapse: collapse;
	}

	.records-table thead {
		background: #f8f9fa;
	}

	.records-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #333;
		border-bottom: 2px solid #ddd;
	}

	.records-table td {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.records-table tbody tr:hover {
		background: #f8f9fa;
	}

	.subtitle {
		font-size: 0.875rem;
		color: #666;
		margin-top: 0.25rem;
	}

	.type-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #e0e0e0;
		color: #333;
		border-radius: 4px;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.btn-small {
		padding: 0.5rem 1rem;
		background: #667eea;
		color: white;
		text-decoration: none;
		border-radius: 4px;
		font-size: 0.875rem;
		display: inline-block;
		transition: background 0.2s;
	}

	.btn-small:hover {
		background: #5568d3;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
	}

	.page-info {
		font-weight: 500;
		color: #333;
	}

	.pagination button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
