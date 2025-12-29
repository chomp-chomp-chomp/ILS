<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let records = $state<any[]>([]);
	let filteredRecords = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let exporting = $state(false);
	let message = $state('');

	let searchQuery = $state('');
	let selectedRecords = $state<Set<string>>(new Set());
	let exportFormat = $state<'marcxml' | 'marc'>('marcxml');
	let exportScope = $state<'selected' | 'all'>('selected');

	onMount(async () => {
		await loadRecords();
	});

	async function loadRecords() {
		try {
			const { data: recordsData, error: fetchError } = await data.supabase
				.from('marc_records')
				.select('*')
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;

			records = recordsData || [];
			applyFilters();
		} catch (err: any) {
			error = `Error loading records: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		let filtered = [...records];

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(record => {
				const title = record.title_statement?.a?.toLowerCase() || '';
				const author = record.main_entry_personal_name?.a?.toLowerCase() || '';
				const isbn = record.isbn?.toLowerCase() || '';
				return title.includes(query) || author.includes(query) || isbn.includes(query);
			});
		}

		filteredRecords = filtered;
	}

	$effect(() => {
		searchQuery;
		if (records.length > 0) {
			applyFilters();
		}
	});

	function toggleRecordSelection(id: string) {
		if (selectedRecords.has(id)) {
			selectedRecords.delete(id);
		} else {
			selectedRecords.add(id);
		}
		selectedRecords = new Set(selectedRecords);
	}

	function selectAll() {
		selectedRecords = new Set(filteredRecords.map(r => r.id));
	}

	function clearSelection() {
		selectedRecords = new Set();
	}

	function convertToMARCXML(records: any[]): string {
		let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xml += '<collection xmlns="http://www.loc.gov/MARC21/slim">\n';

		records.forEach(record => {
			xml += '  <record>\n';

			// Leader
			if (record.leader) {
				xml += `    <leader>${escapeXML(record.leader)}</leader>\n`;
			} else {
				xml += '    <leader>00000nam a2200000 a 4500</leader>\n';
			}

			// Control fields
			if (record.control_number) {
				xml += `    <controlfield tag="001">${escapeXML(record.control_number)}</controlfield>\n`;
			}
			if (record.control_number_identifier) {
				xml += `    <controlfield tag="003">${escapeXML(record.control_number_identifier)}</controlfield>\n`;
			}
			if (record.date_entered) {
				xml += `    <controlfield tag="008">${escapeXML(record.date_entered)}</controlfield>\n`;
			}

			// Data fields
			if (record.isbn) {
				xml += '    <datafield tag="020" ind1=" " ind2=" ">\n';
				xml += `      <subfield code="a">${escapeXML(record.isbn)}</subfield>\n`;
				xml += '    </datafield>\n';
			}

			if (record.main_entry_personal_name) {
				xml += '    <datafield tag="100" ind1="1" ind2=" ">\n';
				Object.entries(record.main_entry_personal_name).forEach(([code, value]) => {
					xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
				});
				xml += '    </datafield>\n';
			}

			if (record.main_entry_corporate_name) {
				xml += '    <datafield tag="110" ind1="2" ind2=" ">\n';
				Object.entries(record.main_entry_corporate_name).forEach(([code, value]) => {
					xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
				});
				xml += '    </datafield>\n';
			}

			if (record.title_statement) {
				xml += '    <datafield tag="245" ind1="1" ind2="0">\n';
				Object.entries(record.title_statement).forEach(([code, value]) => {
					if (value) {
						xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
					}
				});
				xml += '    </datafield>\n';
			}

			if (record.publication_info) {
				xml += '    <datafield tag="264" ind1=" " ind2="1">\n';
				Object.entries(record.publication_info).forEach(([code, value]) => {
					if (value) {
						xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
					}
				});
				xml += '    </datafield>\n';
			}

			if (record.physical_description) {
				xml += '    <datafield tag="300" ind1=" " ind2=" ">\n';
				Object.entries(record.physical_description).forEach(([code, value]) => {
					if (value) {
						xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
					}
				});
				xml += '    </datafield>\n';
			}

			if (record.series_statement) {
				xml += '    <datafield tag="490" ind1="0" ind2=" ">\n';
				Object.entries(record.series_statement).forEach(([code, value]) => {
					if (value) {
						xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
					}
				});
				xml += '    </datafield>\n';
			}

			if (record.general_note && Array.isArray(record.general_note)) {
				record.general_note.forEach((note: string) => {
					if (note) {
						xml += '    <datafield tag="500" ind1=" " ind2=" ">\n';
						xml += `      <subfield code="a">${escapeXML(note)}</subfield>\n`;
						xml += '    </datafield>\n';
					}
				});
			}

			if (record.summary) {
				xml += '    <datafield tag="520" ind1=" " ind2=" ">\n';
				xml += `      <subfield code="a">${escapeXML(record.summary)}</subfield>\n`;
				xml += '    </datafield>\n';
			}

			if (record.subject_topical && Array.isArray(record.subject_topical)) {
				record.subject_topical.forEach((subject: any) => {
					xml += '    <datafield tag="650" ind1=" " ind2="0">\n';
					Object.entries(subject).forEach(([code, value]) => {
						if (value) {
							xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
						}
					});
					xml += '    </datafield>\n';
				});
			}

			if (record.subject_geographic && Array.isArray(record.subject_geographic)) {
				record.subject_geographic.forEach((subject: any) => {
					xml += '    <datafield tag="651" ind1=" " ind2="0">\n';
					Object.entries(subject).forEach(([code, value]) => {
						if (value) {
							xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
						}
					});
					xml += '    </datafield>\n';
				});
			}

			if (record.added_entry_personal_name && Array.isArray(record.added_entry_personal_name)) {
				record.added_entry_personal_name.forEach((name: any) => {
					xml += '    <datafield tag="700" ind1="1" ind2=" ">\n';
					Object.entries(name).forEach(([code, value]) => {
						if (value) {
							xml += `      <subfield code="${code}">${escapeXML(String(value))}</subfield>\n`;
						}
					});
					xml += '    </datafield>\n';
				});
			}

			xml += '  </record>\n';
		});

		xml += '</collection>\n';
		return xml;
	}

	function escapeXML(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	async function performExport() {
		if (exportScope === 'selected' && selectedRecords.size === 0) {
			message = 'Error: Please select at least one record to export';
			return;
		}

		exporting = true;
		message = '';

		try {
			let recordsToExport: any[] = [];

			if (exportScope === 'all') {
				recordsToExport = records;
			} else {
				recordsToExport = records.filter(r => selectedRecords.has(r.id));
			}

			if (recordsToExport.length === 0) {
				message = 'Error: No records to export';
				exporting = false;
				return;
			}

			let content: string;
			let filename: string;
			let mimeType: string;

			if (exportFormat === 'marcxml') {
				content = convertToMARCXML(recordsToExport);
				filename = `marc_export_${new Date().toISOString().split('T')[0]}.xml`;
				mimeType = 'application/xml';
			} else {
				// Binary MARC not yet implemented
				message = 'Error: Binary MARC export not yet implemented. Please use MARCXML format.';
				exporting = false;
				return;
			}

			// Create and download file
			const blob = new Blob([content], { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			message = `✓ Successfully exported ${recordsToExport.length} record(s) to ${filename}`;
		} catch (err: any) {
			message = `Error: ${err.message}`;
		} finally {
			exporting = false;
		}
	}
</script>

<div class="export-page">
	<header class="page-header">
		<h1>MARC Export</h1>
		<a href="/admin/cataloging" class="btn-secondary">← Back to Catalog</a>
	</header>

	{#if loading}
		<div class="loading">Loading records...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else}
		<div class="export-card">
			<div class="card-section">
				<h2>Export Options</h2>

				<div class="export-options">
					<div class="option-group">
						<label><strong>Export Format:</strong></label>
						<div class="radio-group">
							<label>
								<input type="radio" bind:group={exportFormat} value="marcxml" />
								MARCXML (.xml) - Recommended
							</label>
							<label>
								<input type="radio" bind:group={exportFormat} value="marc" disabled />
								Binary MARC (.mrc) - Coming Soon
							</label>
						</div>
					</div>

					<div class="option-group">
						<label><strong>Export Scope:</strong></label>
						<div class="radio-group">
							<label>
								<input type="radio" bind:group={exportScope} value="selected" />
								Selected records ({selectedRecords.size})
							</label>
							<label>
								<input type="radio" bind:group={exportScope} value="all" />
								All records ({records.length})
							</label>
						</div>
					</div>
				</div>

				<button
					class="btn-primary btn-export"
					onclick={performExport}
					disabled={exporting || (exportScope === 'selected' && selectedRecords.size === 0)}
				>
					{exporting ? 'Exporting...' : 'Export Records'}
				</button>

				{#if message}
					<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
						{message}
					</div>
				{/if}
			</div>

			{#if exportScope === 'selected'}
				<div class="card-section selection-section">
					<div class="selection-header">
						<h2>Select Records to Export</h2>
						<div class="selection-actions">
							<button class="btn-sm" onclick={selectAll}>
								Select All ({filteredRecords.length})
							</button>
							<button class="btn-sm" onclick={clearSelection}>
								Clear Selection
							</button>
						</div>
					</div>

					<div class="search-bar">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search by title, author, or ISBN..."
							class="search-input"
						/>
					</div>

					<p class="count">
						Showing {filteredRecords.length} of {records.length} record(s)
					</p>

					<div class="records-table-wrapper">
						<table class="records-table">
							<thead>
								<tr>
									<th>
										<input
											type="checkbox"
											checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
											onchange={() => selectedRecords.size === filteredRecords.length ? clearSelection() : selectAll()}
										/>
									</th>
									<th>Title</th>
									<th>Author</th>
									<th>ISBN</th>
									<th>Material Type</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredRecords as record}
									<tr class:selected={selectedRecords.has(record.id)}>
										<td>
											<input
												type="checkbox"
												checked={selectedRecords.has(record.id)}
												onchange={() => toggleRecordSelection(record.id)}
											/>
										</td>
										<td>{record.title_statement?.a || 'Untitled'}</td>
										<td>{record.main_entry_personal_name?.a || '—'}</td>
										<td>{record.isbn || '—'}</td>
										<td>{record.material_type || 'book'}</td>
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
	.export-page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		background: #e0e0e0;
		color: #333;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
	}

	.error {
		color: #c33;
		background: #fee;
		border: 1px solid #fcc;
	}

	.export-card {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.card-section {
		padding: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.card-section:last-child {
		border-bottom: none;
	}

	.card-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.export-options {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.option-group label:first-child {
		display: block;
		margin-bottom: 0.75rem;
		color: #2c3e50;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.radio-group input[type="radio"] {
		accent-color: #e73b42;
		cursor: pointer;
	}

	.btn-primary {
		padding: 1rem 2rem;
		border-radius: 4px;
		font-size: 1rem;
		background: #e73b42;
		color: white;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		font-weight: 500;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-export {
		width: 100%;
	}

	.message {
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: 4px;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.selection-section {
		background: #f9f9f9;
	}

	.selection-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.selection-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-sm {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.8rem;
		background: #e0e0e0;
		color: #333;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-sm:hover {
		background: #d0d0d0;
	}

	.search-bar {
		margin-bottom: 1rem;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.search-input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.count {
		color: #666;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.records-table-wrapper {
		overflow-x: auto;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		max-height: 500px;
		overflow-y: auto;
	}

	.records-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
	}

	.records-table th,
	.records-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid #e0e0e0;
	}

	.records-table th {
		background: #f5f5f5;
		font-weight: 600;
		color: #2c3e50;
		font-size: 0.875rem;
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.records-table td {
		font-size: 0.875rem;
		color: #555;
	}

	.records-table tbody tr:hover {
		background: #f9f9f9;
	}

	.records-table tbody tr.selected {
		background: #fff5f5;
	}

	.records-table input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #e73b42;
	}
</style>
