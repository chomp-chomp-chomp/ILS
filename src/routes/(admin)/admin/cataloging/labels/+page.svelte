<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let items = $state<any[]>([]);
	let selectedItems = $state<Set<string>>(new Set());
	let loading = $state(false);
	let searchQuery = $state('');

	// Label options
	let labelType = $state<'spine' | 'barcode'>('spine');
	let labelSize = $state('avery-5160'); // Default Avery template
	let printPreview = $state(false);

	const labelSizes = {
		'avery-5160': { name: 'Avery 5160 (1" x 2.625")', width: '2.625in', height: '1in', perRow: 3 },
		'avery-5161': { name: 'Avery 5161 (1" x 4")', width: '4in', height: '1in', perRow: 2 },
		'avery-5163': { name: 'Avery 5163 (2" x 4")', width: '4in', height: '2in', perRow: 2 },
		'avery-5164': { name: 'Avery 5164 (3.33" x 4")', width: '4in', height: '3.33in', perRow: 2 },
		'avery-8160': { name: 'Avery 8160 (1" x 2.625")', width: '2.625in', height: '1in', perRow: 3 }
	};

	onMount(async () => {
		await loadItems();
	});

	async function loadItems() {
		loading = true;
		try {
			const { data: itemsData, error: fetchError } = await data.supabase
				.from('items')
				.select('*, marc_record:marc_records(*)')
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;

			items = itemsData || [];
		} catch (err: any) {
			alert(`Error loading items: ${err.message}`);
		} finally {
			loading = false;
		}
	}

	function toggleItem(itemId: string) {
		const newSelection = new Set(selectedItems);
		if (newSelection.has(itemId)) {
			newSelection.delete(itemId);
		} else {
			newSelection.add(itemId);
		}
		selectedItems = newSelection;
	}

	function selectAll() {
		selectedItems = new Set(filteredItems.map((i) => i.id));
	}

	function clearSelection() {
		selectedItems = new Set();
	}

	function showPreview() {
		if (selectedItems.size === 0) {
			alert('Please select at least one item');
			return;
		}
		printPreview = true;
	}

	function print() {
		window.print();
	}

	const filteredItems = $derived.by(() => {
		if (!searchQuery.trim()) return items;

		const query = searchQuery.toLowerCase();
		return items.filter((item) => {
			const title = item.marc_record?.title_statement?.a?.toLowerCase() || '';
			const barcode = item.barcode?.toLowerCase() || '';
			const callNumber = item.call_number?.toLowerCase() || '';
			return title.includes(query) || barcode.includes(query) || callNumber.includes(query);
		});
	});

	const selectedItemsList = $derived.by(() => {
		return items.filter((item) => selectedItems.has(item.id));
	});

	function formatCallNumber(callNumber: string): string[] {
		// Split call number into lines for better display
		if (!callNumber) return [''];

		// Try to split on common separators
		const parts = callNumber.split(/[\s.]+/);
		if (parts.length <= 3) return [callNumber];

		// Return first part, middle parts, last part
		return [parts[0], parts.slice(1, -1).join(' '), parts[parts.length - 1]];
	}
</script>

<svelte:head>
	{#if printPreview}
		<style>
			@media print {
				body * {
					visibility: hidden;
				}
				.print-area,
				.print-area * {
					visibility: visible;
				}
				.print-area {
					position: absolute;
					left: 0;
					top: 0;
					width: 100%;
				}
				.no-print {
					display: none !important;
				}
			}
		</style>
	{/if}
</svelte:head>

<div class="labels-page">
	{#if !printPreview}
		<header class="page-header no-print">
			<div>
				<h1>Print Labels</h1>
				<p class="subtitle">Generate spine labels and barcode labels for items</p>
			</div>
			<div class="actions">
				<a href="/admin/cataloging" class="btn-secondary">Back to Cataloging</a>
			</div>
		</header>

		<div class="label-options no-print">
			<div class="options-row">
				<div class="form-group">
					<label>Label Type</label>
					<div class="radio-group">
						<label class="radio-label">
							<input type="radio" bind:group={labelType} value="spine" />
							<span>Spine Labels (Call Number)</span>
						</label>
						<label class="radio-label">
							<input type="radio" bind:group={labelType} value="barcode" />
							<span>Barcode Labels</span>
						</label>
					</div>
				</div>

				<div class="form-group">
					<label for="labelSize">Label Size</label>
					<select id="labelSize" bind:value={labelSize}>
						{#each Object.entries(labelSizes) as [value, size]}
							<option {value}>{size.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="selection-actions">
				<span class="selection-count">{selectedItems.size} item(s) selected</span>
				<button onclick={selectAll} class="btn-action">Select All</button>
				<button onclick={clearSelection} class="btn-action">Clear Selection</button>
				<button
					onclick={showPreview}
					class="btn-primary"
					disabled={selectedItems.size === 0}
				>
					Preview & Print ({selectedItems.size})
				</button>
			</div>
		</div>

		<div class="search-box no-print">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by title, barcode, or call number..."
			/>
		</div>

		<div class="items-list no-print">
			{#if loading}
				<div class="loading">Loading items...</div>
			{:else if filteredItems.length === 0}
				<div class="empty">No items found</div>
			{:else}
				{#each filteredItems as item}
					<div class="item-card" class:selected={selectedItems.has(item.id)}>
						<label class="item-checkbox">
							<input
								type="checkbox"
								checked={selectedItems.has(item.id)}
								onchange={() => toggleItem(item.id)}
							/>
							<div class="item-info">
								<div class="item-title">
									{item.marc_record?.title_statement?.a || 'Untitled'}
								</div>
								<div class="item-meta">
									<span><strong>Barcode:</strong> {item.barcode}</span>
									<span><strong>Call #:</strong> {item.call_number || 'N/A'}</span>
									<span><strong>Location:</strong> {item.location}</span>
								</div>
							</div>
						</label>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<!-- Print Preview -->
		<div class="print-controls no-print">
			<button onclick={() => (printPreview = false)} class="btn-secondary">
				← Back to Selection
			</button>
			<button onclick={print} class="btn-primary">Print Labels</button>
		</div>

		<div class="print-area">
			<div
				class="labels-grid"
				style="grid-template-columns: repeat({labelSizes[labelSize].perRow}, 1fr);"
			>
				{#each selectedItemsList as item}
					{#if labelType === 'spine'}
						<!-- Spine Label -->
						<div
							class="label spine-label"
							style="width: {labelSizes[labelSize].width}; height: {labelSizes[labelSize]
								.height};"
						>
							<div class="call-number-lines">
								{#each formatCallNumber(item.call_number || item.marc_record?.classification?.a || '') as line}
									<div class="call-number-line">{line}</div>
								{/each}
							</div>
							<div class="label-author">
								{item.marc_record?.main_entry_personal_name?.a || ''}
							</div>
						</div>
					{:else}
						<!-- Barcode Label -->
						<div
							class="label barcode-label"
							style="width: {labelSizes[labelSize].width}; height: {labelSizes[labelSize]
								.height};"
						>
							<div class="barcode-number">{item.barcode}</div>
							<svg class="barcode-svg" viewBox="0 0 100 30">
								<!-- Simple barcode visualization -->
								{#each item.barcode.split('') as digit, i}
									<rect x={i * 7} y="0" width="6" height="25" fill="black" />
								{/each}
							</svg>
							<div class="barcode-text">{item.barcode}</div>
							<div class="label-title-small">
								{(item.marc_record?.title_statement?.a || '').substring(0, 30)}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.labels-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #e0e0e0;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
	}

	.subtitle {
		color: #666;
		margin: 0;
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary,
	.btn-secondary,
	.btn-action {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.2s;
		display: inline-block;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-action {
		background: white;
		color: #666;
		border: 1px solid #d0d0d0;
	}

	.btn-action:hover {
		background: #f5f5f5;
		border-color: #e73b42;
		color: #e73b42;
	}

	.label-options {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
	}

	.options-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: #333;
		font-size: 0.875rem;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.radio-label input[type='radio'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.form-group select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.selection-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	.selection-count {
		font-weight: 600;
		color: #e73b42;
		margin-right: auto;
	}

	.search-box {
		margin-bottom: 1.5rem;
	}

	.search-box input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.search-box input:focus {
		outline: none;
		border-color: #e73b42;
	}

	.items-list {
		display: grid;
		gap: 0.75rem;
	}

	.item-card {
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.item-card.selected {
		border-color: #e73b42;
		background: #fff5f5;
	}

	.item-checkbox {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		cursor: pointer;
	}

	.item-checkbox input[type='checkbox'] {
		margin-top: 0.25rem;
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.item-info {
		flex: 1;
	}

	.item-title {
		font-weight: 600;
		color: #2c3e50;
		margin-bottom: 0.5rem;
	}

	.item-meta {
		display: flex;
		gap: 1.5rem;
		font-size: 0.875rem;
		color: #666;
		flex-wrap: wrap;
	}

	.loading,
	.empty {
		text-align: center;
		padding: 3rem;
		color: #666;
	}

	/* Print Preview */
	.print-controls {
		display: flex;
		justify-content: space-between;
		margin-bottom: 2rem;
		padding: 1rem;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.print-area {
		background: white;
		padding: 0.5in;
	}

	.labels-grid {
		display: grid;
		gap: 0;
	}

	.label {
		border: 1px solid #ddd;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 0.25rem;
		box-sizing: border-box;
		page-break-inside: avoid;
	}

	.spine-label {
		text-align: center;
		font-family: 'Courier New', monospace;
	}

	.call-number-lines {
		font-size: 14px;
		font-weight: bold;
		line-height: 1.2;
	}

	.call-number-line {
		white-space: nowrap;
	}

	.label-author {
		font-size: 10px;
		margin-top: 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.barcode-label {
		text-align: center;
	}

	.barcode-number {
		font-size: 8px;
		font-weight: bold;
		margin-bottom: 0.125rem;
	}

	.barcode-svg {
		width: 90%;
		height: 40%;
	}

	.barcode-text {
		font-size: 10px;
		font-family: 'Courier New', monospace;
		margin-top: 0.125rem;
	}

	.label-title-small {
		font-size: 7px;
		margin-top: 0.125rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	@media print {
		.labels-grid {
			gap: 0 !important;
		}

		.label {
			border: 1px dashed #999;
		}
	}

	@media (max-width: 768px) {
		.labels-page {
			padding: 1rem;
		}

		.options-row {
			grid-template-columns: 1fr;
		}

		.selection-actions {
			flex-wrap: wrap;
		}

		.item-meta {
			flex-direction: column;
			gap: 0.25rem;
		}
	}
</style>
