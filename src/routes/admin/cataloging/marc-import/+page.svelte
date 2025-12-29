<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let file = $state<File | null>(null);
	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let message = $state('');
	let importResults = $state<any[]>([]);
	let showResults = $state(false);
	let selectedRecords = $state<Set<number>>(new Set());
	let checkDuplicates = $state(true);
	let duplicateAction = $state<'skip' | 'import'>('skip');

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			file = target.files[0];
			message = '';
		}
	}

	async function processImport() {
		if (!file) {
			message = 'Error: Please select a file';
			return;
		}

		importing = true;
		message = 'Processing file...';
		importResults = [];

		try {
			const fileContent = await file.text();
			const fileExtension = file.name.split('.').pop()?.toLowerCase();

			let parsedRecords: any[] = [];

			if (fileExtension === 'xml' || fileExtension === 'mrc') {
				// Try to parse as MARCXML
				if (fileContent.trim().startsWith('<')) {
					parsedRecords = parseMARCXML(fileContent);
				} else {
					// Attempt binary MARC parsing (simplified)
					message = 'Error: Binary MARC (.mrc) files require special handling. Please use MARCXML format for now.';
					importing = false;
					return;
				}
			} else {
				message = 'Error: Unsupported file format. Please use .xml (MARCXML) files.';
				importing = false;
				return;
			}

			// Check for duplicates if enabled
			if (checkDuplicates) {
				await checkForDuplicates(parsedRecords);
			} else {
				// Mark all as non-duplicate
				parsedRecords = parsedRecords.map(rec => ({ ...rec, isDuplicate: false }));
			}

			importResults = parsedRecords;
			showResults = true;
			selectAll(); // Auto-select all non-duplicate records
			message = `Found ${parsedRecords.length} record(s). Review and import below.`;
		} catch (error: any) {
			message = `Error processing file: ${error.message}`;
		} finally {
			importing = false;
		}
	}

	function parseMARCXML(xmlContent: string): any[] {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

		// Check for parsing errors
		const parseError = xmlDoc.querySelector('parsererror');
		if (parseError) {
			throw new Error('Invalid XML format');
		}

		const records: any[] = [];
		const recordElements = xmlDoc.querySelectorAll('record');

		recordElements.forEach((recordEl, index) => {
			try {
				const record: any = {
					_index: index,
					marc_json: {},
					isDuplicate: false,
					duplicateInfo: null
				};

				// Parse leader
				const leader = recordEl.querySelector('leader');
				if (leader) {
					record.leader = leader.textContent?.trim();
				}

				// Parse control fields (001, 003, 008, etc.)
				recordEl.querySelectorAll('controlfield').forEach(field => {
					const tag = field.getAttribute('tag');
					const value = field.textContent?.trim();

					if (tag === '001') record.control_number = value;
					if (tag === '003') record.control_number_identifier = value;
					if (tag === '008') record.date_entered = value;
				});

				// Parse data fields
				recordEl.querySelectorAll('datafield').forEach(field => {
					const tag = field.getAttribute('tag');
					const ind1 = field.getAttribute('ind1') || ' ';
					const ind2 = field.getAttribute('ind2') || ' ';

					const subfields: any = {};
					field.querySelectorAll('subfield').forEach(subfield => {
						const code = subfield.getAttribute('code');
						const value = subfield.textContent?.trim();
						if (code && value) {
							subfields[code] = value;
						}
					});

					// Map MARC fields to our schema
					if (tag === '020' && subfields.a) {
						record.isbn = subfields.a.replace(/[^0-9X]/gi, '');
					}
					if (tag === '022' && subfields.a) {
						record.issn = subfields.a;
					}
					if (tag === '100') {
						record.main_entry_personal_name = subfields;
					}
					if (tag === '110') {
						record.main_entry_corporate_name = subfields;
					}
					if (tag === '245') {
						record.title_statement = subfields;
					}
					if (tag === '260' || tag === '264') {
						record.publication_info = subfields;
					}
					if (tag === '300') {
						record.physical_description = subfields;
					}
					if (tag === '490') {
						record.series_statement = subfields;
					}
					if (tag === '500') {
						if (!record.general_note) record.general_note = [];
						record.general_note.push(subfields.a || '');
					}
					if (tag === '504' && subfields.a) {
						record.bibliography_note = subfields.a;
					}
					if (tag === '520' && subfields.a) {
						record.summary = subfields.a;
					}
					if (tag === '650') {
						if (!record.subject_topical) record.subject_topical = [];
						record.subject_topical.push(subfields);
					}
					if (tag === '651') {
						if (!record.subject_geographic) record.subject_geographic = [];
						record.subject_geographic.push(subfields);
					}
					if (tag === '700') {
						if (!record.added_entry_personal_name) record.added_entry_personal_name = [];
						record.added_entry_personal_name.push(subfields);
					}
					if (tag === '710') {
						if (!record.added_entry_corporate_name) record.added_entry_corporate_name = [];
						record.added_entry_corporate_name.push(subfields);
					}
				});

				// Set material type based on leader or default to book
				record.material_type = 'book';

				records.push(record);
			} catch (err) {
				console.error(`Error parsing record ${index}:`, err);
			}
		});

		return records;
	}

	async function checkForDuplicates(records: any[]) {
		// Fetch existing ISBNs and control numbers
		const isbns = records.map(r => r.isbn).filter(Boolean);
		const controlNumbers = records.map(r => r.control_number).filter(Boolean);

		if (isbns.length === 0 && controlNumbers.length === 0) return;

		try {
			const { data: existingRecords } = await data.supabase
				.from('marc_records')
				.select('isbn, control_number')
				.or(`isbn.in.(${isbns.join(',')}),control_number.in.(${controlNumbers.join(',')})`);

			if (existingRecords && existingRecords.length > 0) {
				const existingISBNs = new Set(existingRecords.map(r => r.isbn).filter(Boolean));
				const existingControlNumbers = new Set(existingRecords.map(r => r.control_number).filter(Boolean));

				records.forEach(record => {
					if (
						(record.isbn && existingISBNs.has(record.isbn)) ||
						(record.control_number && existingControlNumbers.has(record.control_number))
					) {
						record.isDuplicate = true;
						record.duplicateInfo = record.isbn || record.control_number;
					}
				});
			}
		} catch (error) {
			console.error('Error checking duplicates:', error);
		}
	}

	function toggleRecordSelection(index: number) {
		if (selectedRecords.has(index)) {
			selectedRecords.delete(index);
		} else {
			selectedRecords.add(index);
		}
		selectedRecords = new Set(selectedRecords);
	}

	function selectAll() {
		selectedRecords = new Set(
			importResults
				.map((r, i) => i)
				.filter(i => !importResults[i].isDuplicate || duplicateAction === 'import')
		);
	}

	function clearSelection() {
		selectedRecords = new Set();
	}

	async function importSelected() {
		if (selectedRecords.size === 0) {
			message = 'Error: Please select at least one record to import';
			return;
		}

		importing = true;
		let successCount = 0;
		let errorCount = 0;

		try {
			for (const index of selectedRecords) {
				const record = importResults[index];
				if (!record) continue;

				try {
					// Remove temporary fields
					const { _index, isDuplicate, duplicateInfo, ...cleanRecord } = record;

					const { error } = await data.supabase
						.from('marc_records')
						.insert([{
							...cleanRecord,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						}]);

					if (error) throw error;

					successCount++;
				} catch (err: any) {
					console.error(`Error importing record ${index}:`, err);
					errorCount++;
				}
			}

			if (errorCount === 0) {
				message = `✓ Successfully imported ${successCount} record(s)!`;
				setTimeout(() => {
					goto('/admin/cataloging');
				}, 2000);
			} else {
				message = `Imported ${successCount} record(s), ${errorCount} failed.`;
			}
		} catch (error: any) {
			message = `Error during import: ${error.message}`;
		} finally {
			importing = false;
		}
	}

	function resetImport() {
		file = null;
		importResults = [];
		showResults = false;
		selectedRecords = new Set();
		message = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="import-page">
	<header class="page-header">
		<h1>MARC Import</h1>
		<a href="/admin/cataloging" class="btn-secondary">← Back to Catalog</a>
	</header>

	<div class="import-card">
		<div class="card-section">
			<h2>Upload MARC File</h2>
			<p class="help-text">
				Import bibliographic records from MARCXML files. Binary MARC (.mrc) support coming soon.
			</p>

			<div class="file-input-wrapper">
				<input
					type="file"
					accept=".xml,.mrc"
					onchange={handleFileChange}
					bind:this={fileInput}
					disabled={importing}
				/>
				{#if file}
					<p class="file-name">Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)</p>
				{/if}
			</div>

			<div class="import-options">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={checkDuplicates} />
					<span>Check for duplicates (ISBN/Control Number)</span>
				</label>

				{#if checkDuplicates}
					<div class="duplicate-action-options">
						<label>
							<input type="radio" bind:group={duplicateAction} value="skip" />
							Skip duplicates (recommended)
						</label>
						<label>
							<input type="radio" bind:group={duplicateAction} value="import" />
							Import duplicates anyway
						</label>
					</div>
				{/if}
			</div>

			<button
				class="btn-primary"
				onclick={processImport}
				disabled={!file || importing}
			>
				{importing ? 'Processing...' : 'Process File'}
			</button>
		</div>

		{#if message}
			<div class={message.startsWith('Error') ? 'message error' : message.startsWith('✓') ? 'message success' : 'message info'}>
				{message}
			</div>
		{/if}

		{#if showResults && importResults.length > 0}
			<div class="card-section results-section">
				<div class="results-header">
					<h2>Import Preview ({importResults.length} records found)</h2>
					<div class="results-actions">
						<button class="btn-sm" onclick={selectAll}>
							Select All Non-Duplicates
						</button>
						<button class="btn-sm" onclick={clearSelection}>
							Clear Selection
						</button>
						<button class="btn-sm btn-reset" onclick={resetImport}>
							Start Over
						</button>
					</div>
				</div>

				<div class="selected-count">
					<strong>{selectedRecords.size}</strong> record(s) selected for import
				</div>

				<div class="records-table-wrapper">
					<table class="records-table">
						<thead>
							<tr>
								<th>
									<input
										type="checkbox"
										checked={selectedRecords.size === importResults.length}
										onchange={() => selectedRecords.size === importResults.length ? clearSelection() : selectAll()}
									/>
								</th>
								<th>#</th>
								<th>Title</th>
								<th>Author</th>
								<th>ISBN</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each importResults as record, index}
								<tr class:duplicate={record.isDuplicate} class:selected={selectedRecords.has(index)}>
									<td>
										<input
											type="checkbox"
											checked={selectedRecords.has(index)}
											onchange={() => toggleRecordSelection(index)}
										/>
									</td>
									<td>{index + 1}</td>
									<td>{record.title_statement?.a || 'Untitled'}</td>
									<td>{record.main_entry_personal_name?.a || '—'}</td>
									<td>{record.isbn || '—'}</td>
									<td>
										{#if record.isDuplicate}
											<span class="badge badge-warning">Duplicate</span>
										{:else}
											<span class="badge badge-success">New</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="import-actions">
					<button
						class="btn-primary btn-lg"
						onclick={importSelected}
						disabled={importing || selectedRecords.size === 0}
					>
						{importing ? 'Importing...' : `Import ${selectedRecords.size} Selected Record(s)`}
					</button>
					<button class="btn-cancel" onclick={resetImport}>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.import-page {
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

	.import-card {
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
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.help-text {
		color: #666;
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.file-input-wrapper input[type="file"] {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed #d0d0d0;
		border-radius: 8px;
		background: #f9f9f9;
		cursor: pointer;
	}

	.file-name {
		margin-top: 0.75rem;
		color: #666;
		font-size: 0.875rem;
	}

	.import-options {
		margin: 1.5rem 0;
		padding: 1rem;
		background: #f0f9ff;
		border-radius: 4px;
		border-left: 3px solid #e73b42;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.checkbox-label input {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #e73b42;
	}

	.duplicate-action-options {
		margin-left: 1.75rem;
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.duplicate-action-options label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.duplicate-action-options input[type="radio"] {
		accent-color: #e73b42;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
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

	.message {
		padding: 1rem 2rem;
		margin: 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border-top: 1px solid #c3e6cb;
		border-bottom-color: #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border-top: 1px solid #f5c6cb;
		border-bottom-color: #f5c6cb;
	}

	.message.info {
		background: #d1ecf1;
		color: #0c5460;
		border-top: 1px solid #bee5eb;
		border-bottom-color: #bee5eb;
	}

	.results-section {
		background: #f9f9f9;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.results-actions {
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

	.btn-reset {
		background: #f44336;
		color: white;
	}

	.btn-reset:hover {
		background: #d32f2f;
	}

	.selected-count {
		background: #e73b42;
		color: white;
		padding: 0.75rem 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.records-table-wrapper {
		overflow-x: auto;
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
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

	.records-table tbody tr.duplicate {
		background: #fef3c7;
	}

	.records-table tbody tr.duplicate.selected {
		background: #fde68a;
	}

	.records-table input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #e73b42;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge-success {
		background: #d4edda;
		color: #155724;
	}

	.badge-warning {
		background: #fff3cd;
		color: #856404;
	}

	.import-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.btn-lg {
		padding: 1rem 2rem;
		font-size: 1rem;
	}

	.btn-cancel {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		background: #e0e0e0;
		color: #333;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-cancel:hover {
		background: #d0d0d0;
	}
</style>
