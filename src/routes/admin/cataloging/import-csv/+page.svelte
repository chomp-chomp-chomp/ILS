<script lang="ts">
	let fileInput: HTMLInputElement;
	let selectedFile: File | null = $state(null);
	let isImporting = $state(false);
	let message = $state('');
	let messageType = $state<'info' | 'success' | 'error'>('info');
	let importResults = $state<any>(null);

	function showMessage(msg: string, type: 'info' | 'success' | 'error' = 'info') {
		message = msg;
		messageType = type;
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files[0];
			message = '';
			importResults = null;
		}
	}

	async function importCSV() {
		if (!selectedFile) {
			showMessage('Please select a CSV file', 'error');
			return;
		}

		isImporting = true;
		showMessage('Processing import...', 'info');
		importResults = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/import/catalog-csv', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Import failed');
			}

			importResults = result;
			showMessage(
				`Import complete: ${result.summary.successful} successful, ${result.summary.failed} failed`,
				result.summary.failed > 0 ? 'info' : 'success'
			);

			// Clear file input
			selectedFile = null;
			if (fileInput) {
				fileInput.value = '';
			}
		} catch (error: any) {
			console.error('Import error:', error);
			showMessage(`Import failed: ${error.message}`, 'error');
		} finally {
			isImporting = false;
		}
	}
</script>

<div class="import-page">
	<div class="page-header">
		<h1>Import Catalog from CSV</h1>
		<p class="subtitle">
			Update catalog records and create copies by uploading a CSV file.
		</p>
		<a href="/admin/cataloging" class="back-link">← Back to Cataloging</a>
	</div>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<div class="content-section">
		<h2>How It Works</h2>
		<p>The CSV import tool matches records by ISBN and can:</p>
		<ul class="feature-list">
			<li>✅ Update title, author, publisher, and year metadata</li>
			<li>✅ Create additional copies if location, call number, and copy count provided</li>
			<li>✅ Create new locations and publishers as needed</li>
			<li>❌ Cannot create new titles (ISBN must exist in catalog)</li>
			<li>❌ Cannot change ISBNs (use ISBN to match existing records)</li>
		</ul>

		<div class="warning-box">
			<h3>⚠️ Important Notes</h3>
			<ul>
				<li>Records with multiple locations should be on separate CSV rows</li>
				<li>Copy naming follows: c.1, c.2, c.3, etc.</li>
				<li>If copy count is higher than existing, new copies will be created</li>
				<li>If copy count is lower, existing copies will NOT be deleted</li>
				<li>All ISBNs must match existing records in the catalog</li>
			</ul>
		</div>

		<h3>Required CSV Format</h3>
		<p>Your CSV must have these columns in order:</p>
		<div class="csv-format">
			<code>Title, Author, Publisher, Year, ISBN, Call Number, Location, Number of Copies, Cover Present</code>
		</div>
		<p class="format-note">
			<strong>Tip:</strong> Download a catalog export first to get the correct format,
			then modify as needed.
		</p>
	</div>

	<div class="upload-section">
		<h2>Upload CSV File</h2>
		<div class="file-input-wrapper">
			<input
				bind:this={fileInput}
				type="file"
				accept=".csv,text/csv"
				onchange={handleFileSelect}
				id="csv-file"
				class="file-input"
			/>
			<label for="csv-file" class="file-label">
				{#if selectedFile}
					<span class="file-icon">📄</span>
					<span class="file-name">{selectedFile.name}</span>
					<span class="file-size">
						({(selectedFile.size / 1024).toFixed(1)} KB)
					</span>
				{:else}
					<span class="file-icon">📁</span>
					<span>Choose CSV file...</span>
				{/if}
			</label>
		</div>

		<button class="btn-primary" onclick={importCSV} disabled={!selectedFile || isImporting}>
			{#if isImporting}
				<span class="spinner"></span>
				Processing Import...
			{:else}
				📥 Import CSV
			{/if}
		</button>
	</div>

	{#if importResults}
		<div class="results-section">
			<h2>Import Results</h2>
			<div class="summary-grid">
				<div class="summary-card">
					<div class="summary-label">Total Rows</div>
					<div class="summary-value">{importResults.summary.total}</div>
				</div>
				<div class="summary-card success">
					<div class="summary-label">Successful</div>
					<div class="summary-value">{importResults.summary.successful}</div>
				</div>
				<div class="summary-card error">
					<div class="summary-label">Failed</div>
					<div class="summary-value">{importResults.summary.failed}</div>
				</div>
				<div class="summary-card info">
					<div class="summary-label">Updated Records</div>
					<div class="summary-value">{importResults.summary.updatedRecords}</div>
				</div>
				<div class="summary-card info">
					<div class="summary-label">Created Copies</div>
					<div class="summary-value">{importResults.summary.createdCopies}</div>
				</div>
			</div>

			<details class="results-details">
				<summary>View Detailed Results ({importResults.results.length} rows)</summary>
				<div class="results-table-wrapper">
					<table class="results-table">
						<thead>
							<tr>
								<th>Row</th>
								<th>ISBN</th>
								<th>Title</th>
								<th>Action</th>
								<th>Status</th>
								<th>Error</th>
							</tr>
						</thead>
						<tbody>
							{#each importResults.results as result}
								<tr class={result.success ? 'success-row' : 'error-row'}>
									<td>{result.row}</td>
									<td>{result.isbn}</td>
									<td>{result.title}</td>
									<td>{result.action}</td>
									<td>
										{#if result.success}
											<span class="status-badge success">✓ Success</span>
										{:else}
											<span class="status-badge error">✗ Failed</span>
										{/if}
									</td>
									<td class="error-cell">{result.error || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	{/if}
</div>

<style>
	.import-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.subtitle {
		margin: 0 0 1rem 0;
		color: #666;
		font-size: 1.1rem;
	}

	.back-link {
		display: inline-block;
		color: #667eea;
		text-decoration: none;
		font-size: 0.95rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.message {
		padding: 1rem 1.25rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		font-weight: 500;
	}

	.message.info {
		background: #e3f2fd;
		color: #1976d2;
		border: 1px solid #90caf9;
	}

	.message.success {
		background: #e8f5e9;
		color: #388e3c;
		border: 1px solid #81c784;
	}

	.message.error {
		background: #ffebee;
		color: #c62828;
		border: 1px solid #ef9a9a;
	}

	.content-section,
	.upload-section,
	.results-section {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.content-section h2,
	.upload-section h2,
	.results-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.content-section h3 {
		margin: 1.5rem 0 0.75rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.feature-list,
	.warning-box ul {
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.feature-list li,
	.warning-box li {
		margin-bottom: 0.75rem;
		line-height: 1.6;
	}

	.warning-box {
		background: #fff3e0;
		border-left: 4px solid #ff9800;
		padding: 1rem 1.25rem;
		border-radius: 4px;
		margin: 1.5rem 0;
	}

	.warning-box h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
		color: #f57c00;
	}

	.csv-format {
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 1rem;
		margin: 1rem 0;
	}

	.csv-format code {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		color: #333;
	}

	.format-note {
		color: #666;
		font-size: 0.95rem;
		font-style: italic;
	}

	.file-input-wrapper {
		margin-bottom: 1.5rem;
	}

	.file-input {
		display: none;
	}

	.file-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		background: #f8f9fa;
		border: 2px dashed #ccc;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.file-label:hover {
		background: #e9ecef;
		border-color: #999;
	}

	.file-icon {
		font-size: 1.5rem;
	}

	.file-name {
		flex: 1;
		font-weight: 500;
		color: #2c3e50;
	}

	.file-size {
		color: #666;
		font-size: 0.9rem;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 2.5rem;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d32f2f;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(231, 59, 66, 0.4);
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
		transform: none;
	}

	.spinner {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top: 3px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.summary-card {
		background: #f8f9fa;
		padding: 1.25rem;
		border-radius: 8px;
		text-align: center;
		border: 2px solid #e0e0e0;
	}

	.summary-card.success {
		background: #e8f5e9;
		border-color: #81c784;
	}

	.summary-card.error {
		background: #ffebee;
		border-color: #ef9a9a;
	}

	.summary-card.info {
		background: #e3f2fd;
		border-color: #90caf9;
	}

	.summary-label {
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.summary-value {
		font-size: 2rem;
		font-weight: bold;
		color: #2c3e50;
	}

	.results-details {
		margin-top: 2rem;
	}

	.results-details summary {
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 600;
		color: #2c3e50;
	}

	.results-details summary:hover {
		background: #e9ecef;
	}

	.results-table-wrapper {
		overflow-x: auto;
		margin-top: 1rem;
	}

	.results-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.results-table th {
		background: #f8f9fa;
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		border-bottom: 2px solid #ddd;
	}

	.results-table td {
		padding: 0.75rem;
		border-bottom: 1px solid #eee;
	}

	.results-table tr:hover {
		background: #f8f9fa;
	}

	.success-row {
		background: rgba(76, 175, 80, 0.05);
	}

	.error-row {
		background: rgba(244, 67, 54, 0.05);
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.status-badge.success {
		background: #4caf50;
		color: white;
	}

	.status-badge.error {
		background: #f44336;
		color: white;
	}

	.error-cell {
		color: #c62828;
		font-size: 0.875rem;
	}

	@media (max-width: 768px) {
		.import-page {
			padding: 1rem;
		}

		.page-header h1 {
			font-size: 1.5rem;
		}

		.content-section,
		.upload-section,
		.results-section {
			padding: 1.5rem;
		}

		.btn-primary {
			width: 100%;
			padding: 1rem 1.5rem;
		}

		.summary-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
