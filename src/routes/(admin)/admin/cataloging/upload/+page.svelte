<script lang="ts">
	import type { PageData } from './$types';
	import { supabase } from '$lib/supabase';

	let { data }: { data: PageData } = $props();

	let uploading = $state(false);
	let message = $state('');
	let file = $state<File | null>(null);
	let records = $state<any[]>([]);

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			file = input.files[0];
			message = '';
		}
	}

	async function uploadFile() {
		if (!file) return;

		uploading = true;
		message = '';
		records = [];

		try {
			const text = await file.text();

			// Basic MARC text parsing (simplified)
			// This handles line-by-line MARC format
			const lines = text.split('\n');
			let currentRecord: any = {};
			let tempRecords: any[] = [];

			for (const line of lines) {
				const trimmed = line.trim();

				// Skip empty lines
				if (!trimmed) {
					if (Object.keys(currentRecord).length > 0) {
						tempRecords.push(currentRecord);
						currentRecord = {};
					}
					continue;
				}

				// Parse MARC field (format: TAG INDICATORS $a data $b data)
				const match = trimmed.match(/^(\d{3})\s+(.*)$/);
				if (match) {
					const tag = match[1];
					const content = match[2];

					// Handle different MARC fields
					switch (tag) {
						case '020': // ISBN
							const isbnMatch = content.match(/\$a\s*([0-9X-]+)/i);
							if (isbnMatch) currentRecord.isbn = isbnMatch[1].replace(/-/g, '');
							break;
						case '245': // Title
							const titleMatch = content.match(/\$a\s*([^$]+)/);
							const subtitleMatch = content.match(/\$b\s*([^$]+)/);
							currentRecord.title = titleMatch ? titleMatch[1].trim() : '';
							if (subtitleMatch) currentRecord.subtitle = subtitleMatch[1].trim();
							break;
						case '100': // Main author
							const authorMatch = content.match(/\$a\s*([^$]+)/);
							if (authorMatch) currentRecord.author = authorMatch[1].trim();
							break;
						case '260':
						case '264': // Publication info
							const placeMatch = content.match(/\$a\s*([^$]+)/);
							const pubMatch = content.match(/\$b\s*([^$]+)/);
							const yearMatch = content.match(/\$c\s*([^$]+)/);
							if (placeMatch) currentRecord.publicationPlace = placeMatch[1].trim();
							if (pubMatch) currentRecord.publisher = pubMatch[1].trim();
							if (yearMatch) currentRecord.publicationYear = yearMatch[1].trim();
							break;
						case '650': // Subjects
							const subjectMatch = content.match(/\$a\s*([^$]+)/);
							if (subjectMatch) {
								if (!currentRecord.subjects) currentRecord.subjects = [];
								currentRecord.subjects.push(subjectMatch[1].trim());
							}
							break;
					}
				}
			}

			// Add last record
			if (Object.keys(currentRecord).length > 0) {
				tempRecords.push(currentRecord);
			}

			records = tempRecords;
			message = `Parsed ${records.length} record(s) from file. Review below and import.`;
		} catch (error) {
			message = `Error: ${error.message}`;
		} finally {
			uploading = false;
		}
	}

	async function importRecords() {
		uploading = true;
		message = '';

		try {
			let imported = 0;

			for (const record of records) {
				const marcRecord = {
					isbn: record.isbn || null,
					material_type: 'book',
					title_statement: {
						a: record.title || 'Untitled',
						b: record.subtitle || null
					},
					main_entry_personal_name: record.author ? { a: record.author } : null,
					publication_info: {
						a: record.publicationPlace || null,
						b: record.publisher || null,
						c: record.publicationYear || null
					},
					subject_topical: record.subjects?.map((s: string) => ({ a: s })) || []
				};

				const { error: insertError } = await supabase
					.from('marc_records')
					.insert([marcRecord]);

				if (!insertError) {
					imported++;
				}
			}

			message = `Successfully imported ${imported} of ${records.length} records!`;
			records = [];
			file = null;
		} catch (error) {
			message = `Error importing: ${error.message}`;
		} finally {
			uploading = false;
		}
	}
</script>

<div class="marc-upload">
	<h1>MARC File Upload</h1>
	<p class="subtitle">Import bibliographic records from MARC files</p>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<div class="upload-section">
		<div class="file-input-wrapper">
			<input
				type="file"
				id="marc-file"
				accept=".mrc,.txt,.marc"
				onchange={handleFileSelect}
			/>
			<label for="marc-file" class="file-label">
				{file ? file.name : 'Choose MARC file (.mrc or .txt)'}
			</label>
		</div>

		<button
			class="btn-primary"
			onclick={uploadFile}
			disabled={!file || uploading}
		>
			{uploading ? 'Processing...' : 'Parse File'}
		</button>
	</div>

	<div class="info-box">
		<h3>Supported Formats:</h3>
		<ul>
			<li><strong>.txt</strong> - Line-by-line MARC format (currently supported)</li>
			<li><strong>.mrc</strong> - Binary MARC21 (requires server-side library - coming soon)</li>
		</ul>
		<p><strong>Example .txt format:</strong></p>
		<pre>020  $a 9780062316097
245  $a Sapiens $b A Brief History of Humankind
100  $a Harari, Yuval Noah
260  $a New York $b Harper $c 2015
650  $a Human evolution
650  $a Civilization</pre>
	</div>

	{#if records.length > 0}
		<div class="preview-section">
			<h2>Preview ({records.length} records)</h2>

			<div class="records-preview">
				{#each records as record, index}
					<div class="preview-card">
						<h4>{record.title || 'Untitled'}</h4>
						{#if record.subtitle}
							<p class="subtitle-text">{record.subtitle}</p>
						{/if}
						{#if record.author}
							<p><strong>Author:</strong> {record.author}</p>
						{/if}
						{#if record.isbn}
							<p><strong>ISBN:</strong> {record.isbn}</p>
						{/if}
						{#if record.publisher || record.publicationYear}
							<p>
								<strong>Published:</strong>
								{record.publisher || ''} {record.publicationYear || ''}
							</p>
						{/if}
						{#if record.subjects && record.subjects.length > 0}
							<p><strong>Subjects:</strong> {record.subjects.join(', ')}</p>
						{/if}
					</div>
				{/each}
			</div>

			<div class="import-actions">
				<button class="btn-primary" onclick={importRecords} disabled={uploading}>
					{uploading ? 'Importing...' : `Import ${records.length} Record(s)`}
				</button>
				<button class="btn-secondary" onclick={() => { records = []; file = null; }}>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.marc-upload {
		max-width: 1000px;
		padding: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		color: var(--text-muted);
		margin-bottom: 2rem;
	}

	.message {
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
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

	.upload-section {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		align-items: center;
	}

	.file-input-wrapper {
		flex: 1;
	}

	input[type='file'] {
		display: none;
	}

	.file-label {
		display: block;
		padding: 0.75rem 1.5rem;
		background: white;
		border: 2px dashed var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.file-label:hover {
		border-color: var(--accent);
		background: var(--bg-secondary);
	}

	.info-box {
		background: var(--bg-secondary);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
	}

	.info-box h3 {
		margin: 0 0 1rem 0;
	}

	.info-box ul {
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;
	}

	.info-box li {
		margin-bottom: 0.5rem;
	}

	.info-box pre {
		background: white;
		padding: 1rem;
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-size: 0.875rem;
		border: 1px solid var(--border);
	}

	.preview-section {
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.preview-section h2 {
		margin: 0 0 1.5rem 0;
	}

	.records-preview {
		display: grid;
		gap: 1rem;
		margin-bottom: 2rem;
		max-height: 500px;
		overflow-y: auto;
	}

	.preview-card {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}

	.preview-card h4 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
	}

	.subtitle-text {
		font-style: italic;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
	}

	.preview-card p {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.import-actions {
		display: flex;
		gap: 1rem;
	}
</style>
