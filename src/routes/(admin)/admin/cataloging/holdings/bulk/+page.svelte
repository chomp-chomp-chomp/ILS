<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let recordsWithoutHoldings = $state(0);
	let totalRecords = $state(0);
	let isProcessing = $state(false);
	let message = $state('');
	let messageType = $state<'info' | 'success' | 'error'>('info');
	let createdCount = $state(0);
	let logs = $state<string[]>([]);

	onMount(async () => {
		await loadStats();
	});

	async function loadStats() {
		try {
			// Count total records
			const { count: totalCount } = await supabase
				.from('marc_records')
				.select('id', { count: 'exact', head: true });

			totalRecords = totalCount || 0;

			// Count records that already have items
			const { data: existingItems } = await supabase
				.from('items')
				.select('marc_record_id');

			const recordsWithItems = new Set(existingItems?.map(h => h.marc_record_id) || []);
			recordsWithoutHoldings = totalRecords - recordsWithItems.size;

			addLog(`Found ${recordsWithoutHoldings} records without items out of ${totalRecords} total records`);
		} catch (error: any) {
			console.error('Error loading stats:', error);
			showMessage('Failed to load statistics', 'error');
		}
	}

	function addLog(msg: string) {
		const timestamp = new Date().toLocaleTimeString();
		logs = [`[${timestamp}] ${msg}`, ...logs].slice(0, 50);
	}

	function showMessage(msg: string, type: 'info' | 'success' | 'error' = 'info') {
		message = msg;
		messageType = type;
		setTimeout(() => {
			message = '';
		}, 5000);
	}

	async function createHoldings() {
		if (!confirm(`This will create holdings for ${recordsWithoutHoldings} records. Each will receive:\n\n- Copy: c.1\n- Location: The Kitchen\n- Call Number: TX683.[Author Initial][Random##] [Year]\n\nContinue?`)) {
			return;
		}

		isProcessing = true;
		logs = [];
		createdCount = 0;

		addLog('Starting bulk holdings creation...');
		showMessage('Creating holdings...', 'info');

		try {
			const response = await fetch('/api/holdings/bulk-create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to create holdings');
			}

			createdCount = result.created;
			addLog(`Successfully created ${result.created} holdings`);
			showMessage(result.message, 'success');

			// Refresh stats
			await loadStats();
		} catch (error: any) {
			console.error('Error creating holdings:', error);
			addLog(`Error: ${error.message}`);
			showMessage(`Failed to create holdings: ${error.message}`, 'error');
		} finally {
			isProcessing = false;
		}
	}
</script>

<div class="bulk-holdings-page">
	<div class="page-header">
		<h1>Bulk Holdings Creation</h1>
		<p class="subtitle">
			Create holdings for all catalog records that don't already have them.
		</p>
		<a href="/admin/cataloging" class="back-link">← Back to Cataloging</a>
	</div>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<div class="stats-section">
		<h2>Statistics</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-label">Total Records</div>
				<div class="stat-value">{totalRecords.toLocaleString()}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Records Without Holdings</div>
				<div class="stat-value highlight">{recordsWithoutHoldings.toLocaleString()}</div>
			</div>
			{#if createdCount > 0}
				<div class="stat-card">
					<div class="stat-label">Holdings Created</div>
					<div class="stat-value success">{createdCount.toLocaleString()}</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="info-section">
		<h2>What This Does</h2>
		<p>This tool will create a holding record for each MARC record that doesn't already have one.</p>
		<p><strong>Each holding will have:</strong></p>
		<ul>
			<li><strong>Copy Number:</strong> c.1</li>
			<li><strong>Location:</strong> The Kitchen</li>
			<li>
				<strong>Call Number:</strong> TX683.[FirstLetterLastName][RandomDigits] [Year]
				<br />
				<span class="example">Example: TX683.C46 2025</span>
			</li>
			<li><strong>Status:</strong> Available</li>
			<li><strong>Barcode:</strong> Auto-generated 14-digit barcode</li>
		</ul>
	</div>

	<div class="action-section">
		<button
			class="btn-primary"
			onclick={createHoldings}
			disabled={isProcessing || recordsWithoutHoldings === 0}
		>
			{#if isProcessing}
				<span class="spinner"></span>
				Creating Holdings...
			{:else if recordsWithoutHoldings === 0}
				All Records Have Holdings
			{:else}
				Create {recordsWithoutHoldings.toLocaleString()} Holdings
			{/if}
		</button>
	</div>

	{#if logs.length > 0}
		<div class="logs-section">
			<h3>Activity Log</h3>
			<div class="logs">
				{#each logs as log}
					<div class="log-entry">{log}</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.bulk-holdings-page {
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

	.stats-section,
	.info-section,
	.action-section,
	.logs-section {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.stats-section h2,
	.info-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 1.25rem;
		text-align: center;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: bold;
		color: #2c3e50;
	}

	.stat-value.highlight {
		color: #667eea;
	}

	.stat-value.success {
		color: #4caf50;
	}

	.info-section ul {
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.info-section li {
		margin-bottom: 0.75rem;
		line-height: 1.6;
	}

	.example {
		display: inline-block;
		margin-top: 0.25rem;
		padding: 0.25rem 0.75rem;
		background: #f0f0f0;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		color: #666;
	}

	.action-section {
		text-align: center;
		padding: 2rem;
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

	.logs-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: #2c3e50;
	}

	.logs {
		background: #1e1e1e;
		border-radius: 8px;
		padding: 1rem;
		max-height: 400px;
		overflow-y: auto;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.log-entry {
		color: #d4d4d4;
		padding: 0.25rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	@media (max-width: 768px) {
		.bulk-holdings-page {
			padding: 1rem;
		}

		.page-header h1 {
			font-size: 1.5rem;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.btn-primary {
			width: 100%;
			padding: 1rem 1.5rem;
		}
	}
</style>
