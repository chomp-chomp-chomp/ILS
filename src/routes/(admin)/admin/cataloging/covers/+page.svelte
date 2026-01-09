<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Tab state
	let activeTab = $state<'overview' | 'queue' | 'upload' | 'search'>('overview');

	// Statistics state
	let stats = $state(data.stats);
	let loadingStats = $state(false);

	// Queue state
	let queueItems = $state(data.queueItems);
	let failedItems = $state(data.failedItems);
	let processingQueue = $state(false);
	let queueMessage = $state('');

	// Upload state
	let uploadFile = $state<File | null>(null);
	let uploadRecordId = $state('');
	let uploadISBN = $state('');
	let uploading = $state(false);
	let uploadMessage = $state('');

	// Search and fetch state
	let searchRecordId = $state('');
	let fetchingSingle = $state(false);
	let fetchMessage = $state('');
	let selectedRecords = $state<string[]>([]);

	// Bulk operations state
	let bulkQueueLimit = $state(100);
	let bulkPriority = $state(50);
	let bulkMaterialType = $state('');
	let bulkQueueing = $state(false);
	let bulkMessage = $state('');

	onMount(() => {
		refreshStats();
	});

	async function refreshStats() {
		loadingStats = true;
		try {
			const response = await fetch('/api/covers/bulk?action=stats');
			const result = await response.json();
			if (result.success) {
				stats = result.stats;
			}
		} catch (error) {
			console.error('Failed to load stats:', error);
		} finally {
			loadingStats = false;
		}
	}

	async function queueMissingCovers() {
		bulkQueueing = true;
		bulkMessage = '';
		try {
			const response = await fetch('/api/covers/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'queue-missing',
					limit: bulkQueueLimit,
					priority: bulkPriority,
					materialType: bulkMaterialType || null
				})
			});

			const result = await response.json();
			if (result.success) {
				bulkMessage = `✓ ${result.message}`;
				await refreshStats();
				await loadQueue();
			} else {
				bulkMessage = `✗ ${result.message}`;
			}
		} catch (error) {
			bulkMessage = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			bulkQueueing = false;
		}
	}

	async function processQueue() {
		processingQueue = true;
		queueMessage = 'Processing queue...';
		try {
			const response = await fetch('/api/covers/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'process',
					limit: 10
				})
			});

			const result = await response.json();
			if (result.success) {
				queueMessage = `✓ ${result.message}`;
				await refreshStats();
				await loadQueue();
			} else {
				queueMessage = `✗ ${result.message}`;
			}
		} catch (error) {
			queueMessage = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			processingQueue = false;
		}
	}

	async function retryFailed() {
		processingQueue = true;
		queueMessage = 'Retrying failed items...';
		try {
			const response = await fetch('/api/covers/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'retry-failed'
				})
			});

			const result = await response.json();
			if (result.success) {
				queueMessage = `✓ ${result.message}`;
				await loadQueue();
			} else {
				queueMessage = `✗ ${result.message}`;
			}
		} catch (error) {
			queueMessage = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			processingQueue = false;
		}
	}

	async function loadQueue() {
		try {
			const [pendingResponse, failedResponse] = await Promise.all([
				fetch('/api/covers/bulk?status=pending&limit=20'),
				fetch('/api/covers/bulk?status=failed&limit=20')
			]);

			const pendingResult = await pendingResponse.json();
			const failedResult = await failedResponse.json();

			if (pendingResult.success) {
				queueItems = pendingResult.queueItems;
			}
			if (failedResult.success) {
				failedItems = failedResult.queueItems;
			}
		} catch (error) {
			console.error('Failed to load queue:', error);
		}
	}

	async function fetchSingleCover() {
		if (!searchRecordId) {
			fetchMessage = 'Please enter a record ID';
			return;
		}

		fetchingSingle = true;
		fetchMessage = 'Fetching cover...';
		try {
			const response = await fetch('/api/covers/fetch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					recordId: searchRecordId,
					saveToDatabase: true
				})
			});

			const result = await response.json();
			if (result.success) {
				fetchMessage = `✓ ${result.message}`;
				await refreshStats();
			} else {
				fetchMessage = `✗ ${result.message}`;
			}
		} catch (error) {
			fetchMessage = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			fetchingSingle = false;
		}
	}

	async function handleUpload() {
		if (!uploadFile || !uploadRecordId) {
			uploadMessage = 'Please select a file and enter a record ID';
			return;
		}

		uploading = true;
		uploadMessage = 'Uploading...';
		try {
			const formData = new FormData();
			formData.append('file', uploadFile);
			formData.append('recordId', uploadRecordId);
			if (uploadISBN) formData.append('isbn', uploadISBN);

			const response = await fetch('/api/covers/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			if (result.success) {
				uploadMessage = `✓ ${result.message}`;
				uploadFile = null;
				uploadRecordId = '';
				uploadISBN = '';
				await refreshStats();
			} else {
				uploadMessage = `✗ ${result.message || 'Upload failed'}`;
			}
		} catch (error) {
			uploadMessage = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			uploading = false;
		}
	}

	function toggleRecordSelection(recordId: string) {
		if (selectedRecords.includes(recordId)) {
			selectedRecords = selectedRecords.filter((id) => id !== recordId);
		} else {
			selectedRecords = [...selectedRecords, recordId];
		}
	}

	async function queueSelectedRecords() {
		if (selectedRecords.length === 0) {
			bulkMessage = 'Please select records to queue';
			return;
		}

		bulkQueueing = true;
		bulkMessage = 'Queueing selected records...';
		try {
			const response = await fetch('/api/covers/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'queue',
					recordIds: selectedRecords,
					priority: bulkPriority
				})
			});

			const result = await response.json();
			if (result.success) {
				bulkMessage = `✓ ${result.message}`;
				selectedRecords = [];
				await refreshStats();
				await loadQueue();
			} else {
				bulkMessage = `✗ ${result.message}`;
			}
		} catch (error) {
			bulkMessage = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			bulkQueueing = false;
		}
	}
</script>

<div class="cover-management-page">
	<div class="header">
		<h1>📚 Book Cover Management</h1>
		<p>
			Comprehensive cover image management with multiple sources, upload support, and automated
			fetching
		</p>
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'overview'}
			onclick={() => (activeTab = 'overview')}
		>
			Overview & Stats
		</button>
		<button class="tab" class:active={activeTab === 'queue'} onclick={() => (activeTab = 'queue')}>
			Queue Management
		</button>
		<button class="tab" class:active={activeTab === 'upload'} onclick={() => (activeTab = 'upload')}>
			Upload Cover
		</button>
		<button class="tab" class:active={activeTab === 'search'} onclick={() => (activeTab = 'search')}>
			Search & Fetch
		</button>
	</div>

	<!-- Overview Tab -->
	{#if activeTab === 'overview'}
		<div class="tab-content">
			<div class="section">
				<div class="section-header">
					<h2>📊 Coverage Statistics</h2>
					<button class="btn-secondary" onclick={refreshStats} disabled={loadingStats}>
						{loadingStats ? 'Loading...' : '🔄 Refresh'}
					</button>
				</div>

				{#if stats}
					<div class="stats-grid">
						<div class="stat-card primary">
							<div class="stat-value">{stats.coverage_percentage}%</div>
							<div class="stat-label">Coverage</div>
							<div class="stat-detail">
								{stats.records_with_covers} / {stats.total_records} records
							</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">{stats.real_covers}</div>
							<div class="stat-label">Real Covers</div>
							<div class="stat-detail">Non-placeholder images</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">{stats.placeholder_covers}</div>
							<div class="stat-label">Placeholders</div>
							<div class="stat-detail">Generated/fallback</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">{stats.avg_quality_score || 0}</div>
							<div class="stat-label">Avg Quality</div>
							<div class="stat-detail">Out of 100</div>
						</div>
					</div>

					<div class="section">
						<h3>By Source</h3>
						<div class="source-stats">
							<div class="source-item">
								<span class="source-label">OpenLibrary:</span>
								<span class="source-value">{stats.openlibrary_count}</span>
							</div>
							<div class="source-item">
								<span class="source-label">Google Books:</span>
								<span class="source-value">{stats.google_count}</span>
							</div>
							<div class="source-item">
								<span class="source-label">LibraryThing:</span>
								<span class="source-value">{stats.librarything_count}</span>
							</div>
							<div class="source-item">
								<span class="source-label">Uploaded:</span>
								<span class="source-value">{stats.upload_count}</span>
							</div>
							<div class="source-item">
								<span class="source-label">Generated:</span>
								<span class="source-value">{stats.generated_count}</span>
							</div>
						</div>
					</div>

					<div class="section">
						<h3>Queue Status</h3>
						<div class="queue-stats">
							<div class="queue-stat">
								<span class="queue-label">Pending:</span>
								<span class="queue-value pending">{stats.pending_fetches}</span>
							</div>
							<div class="queue-stat">
								<span class="queue-label">Failed:</span>
								<span class="queue-value failed">{stats.failed_fetches}</span>
							</div>
						</div>
					</div>
				{:else}
					<div class="loading">Loading statistics...</div>
				{/if}
			</div>

			<!-- Bulk Operations -->
			<div class="section">
				<h2>🚀 Bulk Operations</h2>

				<div class="bulk-controls">
					<div class="form-group">
						<label for="bulkLimit">Records to queue:</label>
						<input
							id="bulkLimit"
							type="number"
							bind:value={bulkQueueLimit}
							min="1"
							max="1000"
							disabled={bulkQueueing}
						/>
					</div>

					<div class="form-group">
						<label for="bulkPriority">Priority (0-100):</label>
						<input
							id="bulkPriority"
							type="number"
							bind:value={bulkPriority}
							min="0"
							max="100"
							disabled={bulkQueueing}
						/>
					</div>

					<div class="form-group">
						<label for="bulkType">Material type (optional):</label>
						<select id="bulkType" bind:value={bulkMaterialType} disabled={bulkQueueing}>
							<option value="">All types</option>
							<option value="book">Book</option>
							<option value="ebook">eBook</option>
							<option value="dvd">DVD</option>
							<option value="audiobook">Audiobook</option>
						</select>
					</div>
				</div>

				<div class="button-group">
					<button class="btn-primary" onclick={queueMissingCovers} disabled={bulkQueueing}>
						{bulkQueueing ? 'Queueing...' : 'Queue Missing Covers'}
					</button>
					<button class="btn-primary" onclick={processQueue} disabled={processingQueue}>
						{processingQueue ? 'Processing...' : 'Process Queue (10 items)'}
					</button>
				</div>

				{#if bulkMessage}
					<div class="message" class:success={bulkMessage.startsWith('✓')}>
						{bulkMessage}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Queue Management Tab -->
	{#if activeTab === 'queue'}
		<div class="tab-content">
			<div class="section">
				<div class="section-header">
					<h2>⏳ Pending Queue ({queueItems.length})</h2>
					<button class="btn-secondary" onclick={loadQueue}>🔄 Refresh</button>
				</div>

				{#if queueItems.length > 0}
					<div class="queue-list">
						{#each queueItems as item}
							<div class="queue-item">
								<div class="queue-item-info">
									<div class="queue-item-title">{item.title || 'Untitled'}</div>
									<div class="queue-item-meta">
										{#if item.author}
											<span>By: {item.author}</span>
										{/if}
										{#if item.isbn}
											<span>ISBN: {item.isbn}</span>
										{/if}
										<span>Priority: {item.priority}</span>
										<span>Attempts: {item.attempts}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="empty-state">No items in queue</div>
				{/if}
			</div>

			{#if failedItems.length > 0}
				<div class="section">
					<div class="section-header">
						<h2>❌ Failed Items ({failedItems.length})</h2>
						<button class="btn-secondary" onclick={retryFailed} disabled={processingQueue}>
							♻️ Retry All
						</button>
					</div>

					<div class="queue-list">
						{#each failedItems as item}
							<div class="queue-item failed">
								<div class="queue-item-info">
									<div class="queue-item-title">{item.title || 'Untitled'}</div>
									<div class="queue-item-meta">
										{#if item.error_message}
											<span class="error-text">Error: {item.error_message}</span>
										{/if}
										<span>Attempts: {item.attempts}/{item.max_attempts}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if queueMessage}
				<div class="message" class:success={queueMessage.startsWith('✓')}>
					{queueMessage}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Upload Tab -->
	{#if activeTab === 'upload'}
		<div class="tab-content">
			<div class="section">
				<h2>📤 Upload Custom Cover</h2>

				<div class="upload-form">
					<div class="form-group">
						<label for="uploadRecordId">Record ID (required):</label>
						<input
							id="uploadRecordId"
							type="text"
							bind:value={uploadRecordId}
							placeholder="Enter MARC record ID"
							disabled={uploading}
						/>
						<small>The UUID of the MARC record</small>
					</div>

					<div class="form-group">
						<label for="uploadISBN">ISBN (optional):</label>
						<input
							id="uploadISBN"
							type="text"
							bind:value={uploadISBN}
							placeholder="ISBN associated with this cover"
							disabled={uploading}
						/>
					</div>

					<div class="form-group">
						<label for="uploadFile">Cover Image:</label>
						<input
							id="uploadFile"
							type="file"
							accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								uploadFile = target.files?.[0] || null;
							}}
							disabled={uploading}
						/>
						<small>JPEG, PNG, WebP, or GIF (max 5MB)</small>
					</div>

					<button class="btn-primary" onclick={handleUpload} disabled={uploading || !uploadFile || !uploadRecordId}>
						{uploading ? 'Uploading...' : 'Upload Cover'}
					</button>

					{#if uploadMessage}
						<div class="message" class:success={uploadMessage.startsWith('✓')}>
							{uploadMessage}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Search & Fetch Tab -->
	{#if activeTab === 'search'}
		<div class="tab-content">
			<div class="section">
				<h2>🔍 Fetch Single Cover</h2>

				<div class="search-form">
					<div class="form-group">
						<label for="searchRecordId">Record ID:</label>
						<input
							id="searchRecordId"
							type="text"
							bind:value={searchRecordId}
							placeholder="Enter MARC record ID"
							disabled={fetchingSingle}
						/>
					</div>

					<button
						class="btn-primary"
						onclick={fetchSingleCover}
						disabled={fetchingSingle || !searchRecordId}
					>
						{fetchingSingle ? 'Fetching...' : 'Fetch Cover'}
					</button>

					{#if fetchMessage}
						<div class="message" class:success={fetchMessage.startsWith('✓')}>
							{fetchMessage}
						</div>
					{/if}
				</div>
			</div>

			<!-- Records without covers -->
			{#if data.recordsWithoutCovers.length > 0}
				<div class="section">
					<div class="section-header">
						<h2>📋 Records Without Covers</h2>
						<button
							class="btn-primary"
							onclick={queueSelectedRecords}
							disabled={selectedRecords.length === 0 || bulkQueueing}
						>
							Queue Selected ({selectedRecords.length})
						</button>
					</div>

					<div class="records-table-container">
						<table class="records-table">
							<thead>
								<tr>
									<th><input type="checkbox" /></th>
									<th>Title</th>
									<th>Author</th>
									<th>ISBN</th>
									<th>Type</th>
								</tr>
							</thead>
							<tbody>
								{#each data.recordsWithoutCovers as record}
									<tr>
										<td>
											<input
												type="checkbox"
												checked={selectedRecords.includes(record.id)}
												onchange={() => toggleRecordSelection(record.id)}
											/>
										</td>
										<td>
											<strong>{record.title_statement?.a || 'Untitled'}</strong>
										</td>
										<td>{record.main_entry_personal_name?.a || '—'}</td>
										<td>{record.isbn || '—'}</td>
										<td>
											<span class="type-badge">{record.material_type || 'book'}</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.cover-management-page {
		max-width: 1400px;
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

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 2px solid #e0e0e0;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 1rem;
		color: #666;
		transition: all 0.2s;
	}

	.tab:hover {
		color: #333;
		background: #f8f9fa;
	}

	.tab.active {
		color: #e73b42;
		border-bottom-color: #e73b42;
	}

	.tab-content {
		animation: fadeIn 0.3s;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Sections */
	.section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.section h2,
	.section h3 {
		margin: 0 0 1rem 0;
		color: #333;
	}

	/* Statistics */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		text-align: center;
		border: 2px solid #e0e0e0;
	}

	.stat-card.primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
	}

	.stat-value {
		font-size: 2.5rem;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		opacity: 0.8;
		margin-bottom: 0.25rem;
	}

	.stat-detail {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.source-stats,
	.queue-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.source-item,
	.queue-stat {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: #f8f9fa;
		border-radius: 4px;
	}

	.source-label,
	.queue-label {
		font-weight: 500;
		color: #666;
	}

	.source-value {
		font-weight: bold;
		color: #333;
	}

	.queue-value {
		font-weight: bold;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
	}

	.queue-value.pending {
		background: #fff3cd;
		color: #856404;
	}

	.queue-value.failed {
		background: #f8d7da;
		color: #721c24;
	}

	/* Forms */
	.bulk-controls,
	.upload-form,
	.search-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-weight: 500;
		color: #333;
	}

	.form-group input,
	.form-group select {
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.form-group small {
		color: #666;
		font-size: 0.875rem;
	}

	/* Buttons */
	.button-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #c92a2f;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #d0d0d0;
	}

	.btn-primary:disabled,
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Messages */
	.message {
		padding: 1rem;
		border-radius: 4px;
		margin-top: 1rem;
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border-color: #c3e6cb;
	}

	/* Queue List */
	.queue-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.queue-item {
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
		border-left: 4px solid #667eea;
	}

	.queue-item.failed {
		border-left-color: #e73b42;
		background: #fff5f5;
	}

	.queue-item-title {
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: #333;
	}

	.queue-item-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: #666;
		flex-wrap: wrap;
	}

	.error-text {
		color: #e73b42;
	}

	/* Records Table */
	.records-table-container {
		overflow-x: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
		margin-top: 1rem;
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
		border-bottom: 2px solid #ddd;
	}

	.records-table td {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.records-table tbody tr:hover {
		background: #f8f9fa;
	}

	.type-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #e0e0e0;
		border-radius: 4px;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.empty-state,
	.loading {
		text-align: center;
		padding: 3rem;
		color: #999;
	}
</style>
