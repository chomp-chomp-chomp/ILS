<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let totalRecords = $state(0);
	let processedRecords = $state(0);
	let foundCovers = $state(0);
	let remainingRecords = $state(0);
	let isRunning = $state(false);
	let isPaused = $state(false);
	let message = $state('');
	let logs = $state<string[]>([]);
	let batchSize = $state(10);

	onMount(async () => {
		await loadStats();
	});

	async function loadStats() {
		try {
			const { data: records, count } = await data.supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true })
				.is('cover_image_url', null);

			remainingRecords = count || 0;
			totalRecords = count || 0;
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
</script>

<div class="fetch-covers-page">
	<div class="header">
		<h1>Fetch Book Covers</h1>
		<p>
			Automatically fetch and save cover images for all catalog records from Google Books and Open
			Library APIs.
		</p>
	</div>

	<!-- Stats -->
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

	<!-- Progress Bar -->
	{#if totalRecords > 0}
		<div class="progress-section">
			<div class="progress-label">
				Progress: {processedRecords} / {totalRecords} ({Math.round((processedRecords / totalRecords) * 100)}%)
			</div>
			<div class="progress-bar">
				<div
					class="progress-fill"
					style="width: {(processedRecords / totalRecords) * 100}%"
				></div>
			</div>
		</div>
	{/if}

	<!-- Controls -->
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

	<!-- Log -->
	<div class="log-section">
		<h2>Activity Log</h2>
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

	<!-- Help -->
	<div class="help-section">
		<h3>How This Works</h3>
		<ul>
			<li>This tool fetches cover images for records that don't have custom covers uploaded.</li>
			<li>It searches Google Books API first (usually better quality covers).</li>
			<li>If not found, it tries Open Library API as a fallback.</li>
			<li>Found covers are saved to the database and will display immediately.</li>
			<li>You can pause and resume the process at any time.</li>
			<li>Smaller batch sizes are slower but less likely to hit rate limits.</li>
			<li>
				This does NOT override custom uploaded covers - only fills in missing ones.
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

	.log-section h2 {
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
</style>
