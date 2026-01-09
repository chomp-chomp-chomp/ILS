<script lang="ts">
	let isExporting = $state(false);
	let message = $state('');
	let messageType = $state<'info' | 'success' | 'error'>('info');

	function showMessage(msg: string, type: 'info' | 'success' | 'error' = 'info') {
		message = msg;
		messageType = type;
		setTimeout(() => {
			message = '';
		}, 5000);
	}

	async function exportCatalog() {
		isExporting = true;
		showMessage('Generating CSV export...', 'info');

		try {
			const response = await fetch('/api/export/catalog-csv');

			if (!response.ok) {
				throw new Error('Export failed');
			}

			// Get the file blob and trigger download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `catalog-export-${new Date().toISOString().split('T')[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			showMessage('Export downloaded successfully!', 'success');
		} catch (error: any) {
			console.error('Export error:', error);
			showMessage(`Export failed: ${error.message}`, 'error');
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="export-page">
	<div class="page-header">
		<h1>Export Catalog to CSV</h1>
		<p class="subtitle">
			Download the entire catalog as a CSV file with all bibliographic and holdings data.
		</p>
		<a href="/admin/cataloging" class="back-link">← Back to Cataloging</a>
	</div>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<div class="content-section">
		<h2>What's Included</h2>
		<p>The CSV export includes the following fields for each record:</p>
		<ul class="field-list">
			<li><strong>Title</strong> - Main title of the work</li>
			<li><strong>Author</strong> - Main entry personal name</li>
			<li><strong>Publisher</strong> - Publishing company</li>
			<li><strong>Year</strong> - Publication year</li>
			<li><strong>ISBN</strong> - International Standard Book Number</li>
			<li><strong>Call Number</strong> - Shelving classification</li>
			<li><strong>Location</strong> - Physical location in library</li>
			<li><strong>Number of Copies</strong> - Count of copies at that location</li>
			<li><strong>Cover Present</strong> - Y/N indicator for cover image availability</li>
		</ul>

		<div class="note">
			<h3>Note:</h3>
			<p>
				Records with copies in multiple locations will appear on separate rows (one row per location).
				This format makes it easy to import into spreadsheet applications like Excel or Google Sheets.
			</p>
		</div>
	</div>

	<div class="action-section">
		<button class="btn-primary" onclick={exportCatalog} disabled={isExporting}>
			{#if isExporting}
				<span class="spinner"></span>
				Generating Export...
			{:else}
				📥 Download Catalog CSV
			{/if}
		</button>
	</div>
</div>

<style>
	.export-page {
		max-width: 900px;
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

	.content-section {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.content-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.content-section p {
		margin: 0 0 1rem 0;
		line-height: 1.6;
		color: #555;
	}

	.field-list {
		margin: 1.5rem 0;
		padding-left: 1.5rem;
	}

	.field-list li {
		margin-bottom: 0.75rem;
		line-height: 1.6;
		color: #333;
	}

	.note {
		background: #fff8e1;
		border-left: 4px solid #ffc107;
		padding: 1rem 1.25rem;
		border-radius: 4px;
		margin-top: 2rem;
	}

	.note h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
		color: #f57c00;
	}

	.note p {
		margin: 0;
		color: #666;
	}

	.action-section {
		text-align: center;
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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

	@media (max-width: 768px) {
		.export-page {
			padding: 1rem;
		}

		.page-header h1 {
			font-size: 1.5rem;
		}

		.content-section {
			padding: 1.5rem;
		}

		.btn-primary {
			width: 100%;
			padding: 1rem 1.5rem;
		}
	}
</style>
