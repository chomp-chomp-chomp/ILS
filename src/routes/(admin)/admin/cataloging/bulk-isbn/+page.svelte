<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isbnList = $state('');
	let processing = $state(false);
	let results = $state<any[]>([]);
	let currentIndex = $state(0);
	let showResults = $state(false);

	async function parseLocMarc(marcxml: string) {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(marcxml, 'text/xml');

		const getDatafield = (tag: string, subfield: string) => {
			const field = xmlDoc.querySelector(`datafield[tag="${tag}"] subfield[code="${subfield}"]`);
			return field?.textContent || '';
		};

		const getAllDatafields = (tag: string, subfield: string) => {
			const fields = xmlDoc.querySelectorAll(`datafield[tag="${tag}"] subfield[code="${subfield}"]`);
			return Array.from(fields).map(f => f.textContent || '').filter(t => t);
		};

		return {
			title: getDatafield('245', 'a').replace(/\s*\/\s*$/, '').replace(/\s*:\s*$/, ''),
			subtitle: getDatafield('245', 'b').replace(/\s*\/\s*$/, ''),
			authors: [getDatafield('100', 'a') || getDatafield('110', 'a')].filter(a => a),
			publishers: [getDatafield('260', 'b') || getDatafield('264', 'b')].filter(p => p).map(p => p.replace(/,\s*$/, '')),
			publish_date: getDatafield('260', 'c') || getDatafield('264', 'c'),
			subjects: getAllDatafields('650', 'a'),
			source: 'Library of Congress'
		};
	}

	async function fetchWithTimeout(url: string, timeout = 10000) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeoutId);
			return response;
		} catch (error: any) {
			clearTimeout(timeoutId);
			if (error.name === 'AbortError') {
				throw new Error('Request timeout');
			}
			throw error;
		}
	}

	async function tryOpenLibrary(cleanISBN: string) {
		try {
			const response = await fetchWithTimeout(
				`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`,
				8000
			);
			const bookData = await response.json();

			const key = `ISBN:${cleanISBN}`;
			if (bookData[key]) {
				return {
					title: bookData[key].title,
					subtitle: bookData[key].subtitle,
					authors: bookData[key].authors?.map((a: any) => a.name) || [],
					publishers: bookData[key].publishers?.map((p: any) => p.name) || [],
					publish_date: bookData[key].publish_date,
					number_of_pages: bookData[key].number_of_pages,
					subjects: bookData[key].subjects?.map((s: any) => s.name) || [],
					source: 'OpenLibrary'
				};
			}
			return null;
		} catch (err) {
			console.error(`OpenLibrary error for ${cleanISBN}:`, err);
			return null;
		}
	}

	async function tryLibraryOfCongress(cleanISBN: string) {
		try {
			const query = encodeURIComponent(`bath.isbn=${cleanISBN}`);
			const url = `https://lx2.loc.gov:210/lcdb?operation=searchRetrieve&version=1.1&query=${query}&maximumRecords=1&recordSchema=marcxml`;

			const response = await fetchWithTimeout(url, 10000);
			const xmlText = await response.text();

			if (xmlText.includes('<numberOfRecords>0</numberOfRecords>')) {
				return null;
			}

			return await parseLocMarc(xmlText);
		} catch (err) {
			console.error(`LoC error for ${cleanISBN}:`, err);
			return null;
		}
	}

	async function processBulkISBNs() {
		processing = true;
		showResults = true;
		currentIndex = 0;
		results = [];

		const isbns = isbnList
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.map(line => line.replace(/[^0-9X]/gi, ''));

		for (let i = 0; i < isbns.length; i++) {
			currentIndex = i + 1;
			const isbn = isbns[i];

			// Add placeholder for current ISBN being processed
			results = [...results, {
				isbn,
				status: 'processing',
				source: null,
				data: null
			}];

			try {
				// Try OpenLibrary first
				let bookData = await tryOpenLibrary(isbn);
				let source = 'OpenLibrary';

				// Fallback to LoC if OpenLibrary didn't find it
				if (!bookData) {
					bookData = await tryLibraryOfCongress(isbn);
					source = 'Library of Congress';
				}

				// Update the result
				if (bookData) {
					results[i] = {
						isbn,
						status: 'found',
						source,
						data: bookData
					};
				} else {
					results[i] = {
						isbn,
						status: 'not_found',
						source: null,
						data: null
					};
				}
			} catch (err: any) {
				results[i] = {
					isbn,
					status: 'error',
					error: err.message || 'Unknown error',
					source: null,
					data: null
				};
			}

			// Trigger reactivity
			results = [...results];

			// Small delay to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 300));
		}

		processing = false;
	}

	async function importSelected() {
		const selectedResults = results.filter(r => r.status === 'found' && r.selected);

		if (selectedResults.length === 0) {
			alert('No items selected for import');
			return;
		}

		processing = true;

		try {
			for (const result of selectedResults) {
				const marcRecord = {
					isbn: result.isbn,
					material_type: 'book',
					title_statement: {
						a: result.data.title,
						b: result.data.subtitle
					},
					main_entry_personal_name: result.data.authors[0] ? { a: result.data.authors[0] } : null,
					publication_info: {
						a: '',
						b: result.data.publishers[0] || '',
						c: result.data.publish_date
					},
					physical_description: {
						a: result.data.number_of_pages ? `${result.data.number_of_pages} pages` : null
					},
					subject_topical: result.data.subjects?.slice(0, 5).map((s: string) => ({ a: s })) || [],
					marc_json: {
						source: result.source,
						imported_data: result.data
					}
				};

				const { data: inserted, error: insertError } = await supabase
					.from('marc_records')
					.insert([marcRecord])
					.select();

				if (insertError) throw insertError;

				// Auto-create default holding
				if (inserted && inserted[0]) {
					await supabase.from('holdings').insert([{
						marc_record_id: inserted[0].id,
						location: 'Main Library',
						status: 'available',
						copy_number: 1
					}]);
				}
			}

			goto('/admin/cataloging');
		} catch (err: any) {
			alert(`Error importing: ${err.message}`);
		} finally {
			processing = false;
		}
	}

	function toggleAll(checked: boolean) {
		results = results.map(r => {
			if (r.status === 'found') {
				return { ...r, selected: checked };
			}
			return r;
		});
	}
</script>

<div class="bulk-isbn-page">
	<h1>Bulk ISBN Upload</h1>
	<p class="subtitle">Paste multiple ISBNs (one per line) to import in batch</p>

	<div class="upload-form">
		<div class="form-group">
			<label for="isbnList">ISBN List</label>
			<textarea
				id="isbnList"
				bind:value={isbnList}
				rows="15"
				placeholder="978-0-123456-78-9&#10;978-0-987654-32-1&#10;978-0-555555-55-5"
				disabled={processing}
			></textarea>
			<p class="help-text">Enter one ISBN per line. Hyphens and spaces will be removed automatically.</p>
		</div>

		<button
			class="btn-primary"
			onclick={processBulkISBNs}
			disabled={processing || !isbnList.trim()}
		>
			{processing ? `Processing ${currentIndex}...` : 'Lookup All ISBNs'}
		</button>
	</div>

	{#if showResults}
		<div class="results-section">
			<div class="results-header">
				<h2>Results ({results.length} ISBNs processed)</h2>
				<div class="bulk-actions">
					<label class="checkbox-label">
						<input
							type="checkbox"
							onchange={(e) => toggleAll(e.currentTarget.checked)}
						/>
						<span>Select All Found</span>
					</label>
					<button class="btn-import" onclick={importSelected}>
						Import Selected
					</button>
				</div>
			</div>

			<div class="results-list">
				{#each results as result}
					<div class="result-card {result.status}">
						{#if result.status === 'found'}
							<div class="result-checkbox">
								<input
									type="checkbox"
									bind:checked={result.selected}
								/>
							</div>
							<div class="result-content">
								<h3>{result.data.title}</h3>
								{#if result.data.authors.length > 0}
									<p class="author">{result.data.authors.join(', ')}</p>
								{/if}
								<p class="metadata">
									ISBN: {result.isbn}
									{#if result.data.publish_date}
										• {result.data.publish_date}
									{/if}
									{#if result.data.publishers.length > 0}
										• {result.data.publishers[0]}
									{/if}
								</p>
								<p class="source">Source: {result.source}</p>
							</div>
						{:else if result.status === 'not_found'}
							<div class="result-content">
								<p class="error-text">ISBN {result.isbn}: Not found</p>
							</div>
						{:else if result.status === 'processing'}
							<div class="result-content">
								<p class="processing-text">ISBN {result.isbn}: Searching...</p>
							</div>
						{:else}
							<div class="result-content">
								<p class="error-text">ISBN {result.isbn}: Error - {result.error}</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.bulk-isbn-page {
		max-width: 1200px;
		background: white;
		padding: 2rem;
		border-radius: var(--radius-md);
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		color: var(--text-muted);
		margin-bottom: 2rem;
	}

	.upload-form {
		margin-bottom: 2rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	textarea {
		width: 100%;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		resize: vertical;
	}

	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	.help-text {
		margin: 0.5rem 0 0 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.btn-primary {
		padding: 0.75rem 2rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
		transition: var(--transition-smooth);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.results-section {
		margin-top: 3rem;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border);
	}

	.results-header h2 {
		margin: 0;
	}

	.bulk-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.btn-import {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1rem;
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.result-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		padding: 1rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}

	.result-card.found {
		background: #f0fdf4;
		border-color: #86efac;
	}

	.result-card.not_found {
		background: #fef2f2;
		border-color: #fecaca;
	}

	.result-card.processing {
		background: #f0f9ff;
		border-color: #bae6fd;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.result-card.error {
		background: #fff7ed;
		border-color: #fed7aa;
	}

	.result-checkbox {
		display: flex;
		align-items: flex-start;
		padding-top: 0.25rem;
	}

	.result-checkbox input[type="checkbox"] {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.result-content h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.author {
		margin: 0 0 0.5rem 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.metadata {
		margin: 0 0 0.5rem 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.source {
		margin: 0;
		font-size: 0.75rem;
		color: #10b981;
		font-weight: 600;
	}

	.processing-text {
		margin: 0;
		color: #0284c7;
		font-weight: 500;
		font-style: italic;
	}

	.error-text {
		margin: 0;
		color: #dc2626;
		font-weight: 500;
	}
</style>
