<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isbn = $state('');
	let searching = $state(false);
	let results = $state<any>(null);
	let error = $state('');
	let searchLog = $state<string[]>([]);

	async function parseLocMarc(marcxml: string) {
		// Parse MARCXML from Library of Congress
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

	async function tryOpenLibrary(cleanISBN: string) {
		const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`);
		const data = await response.json();

		const key = `ISBN:${cleanISBN}`;
		if (data[key]) {
			return {
				title: data[key].title,
				subtitle: data[key].subtitle,
				authors: data[key].authors?.map((a: any) => a.name) || [],
				publishers: data[key].publishers?.map((p: any) => p.name) || [],
				publish_date: data[key].publish_date,
				number_of_pages: data[key].number_of_pages,
				subjects: data[key].subjects?.map((s: any) => s.name) || [],
				cover: data[key].cover?.large,
				source: 'OpenLibrary'
			};
		}
		return null;
	}

	async function tryLibraryOfCongress(cleanISBN: string) {
		// LoC SRU API - returns MARCXML
		const query = encodeURIComponent(`bath.isbn=${cleanISBN}`);
		const url = `https://lx2.loc.gov:210/lcdb?operation=searchRetrieve&version=1.1&query=${query}&maximumRecords=1&recordSchema=marcxml`;

		const response = await fetch(url);
		const xmlText = await response.text();

		// Check if we got results
		if (xmlText.includes('<numberOfRecords>0</numberOfRecords>')) {
			return null;
		}

		return await parseLocMarc(xmlText);
	}

	async function lookupISBN() {
		searching = true;
		error = '';
		results = null;
		searchLog = [];

		try {
			const cleanISBN = isbn.replace(/[^0-9X]/g, '');

			// Try OpenLibrary first
			searchLog = [...searchLog, 'Searching OpenLibrary...'];
			const olResult = await tryOpenLibrary(cleanISBN);

			if (olResult) {
				results = olResult;
				searchLog = [...searchLog, '✓ Found on OpenLibrary'];
			} else {
				searchLog = [...searchLog, '✗ Not found on OpenLibrary'];

				// Fallback to Library of Congress
				searchLog = [...searchLog, 'Trying Library of Congress...'];
				const locResult = await tryLibraryOfCongress(cleanISBN);

				if (locResult) {
					results = locResult;
					searchLog = [...searchLog, '✓ Found on Library of Congress'];
				} else {
					searchLog = [...searchLog, '✗ Not found on Library of Congress'];
					error = 'No results found for this ISBN on OpenLibrary or Library of Congress';
				}
			}
		} catch (err: any) {
			error = `Error: ${err.message}`;
			searchLog = [...searchLog, `✗ Error: ${err.message}`];
		} finally {
			searching = false;
		}
	}

	async function importRecord() {
		if (!results) return;

		searching = true;
		try {
			const marcRecord = {
				isbn: isbn.replace(/[^0-9X]/g, ''),
				material_type: 'book',
				title_statement: {
					a: results.title,
					b: results.subtitle
				},
				main_entry_personal_name: results.authors[0] ? { a: results.authors[0] } : null,
				publication_info: {
					a: '',
					b: results.publishers[0] || '',
					c: results.publish_date
				},
				physical_description: {
					a: results.number_of_pages ? `${results.number_of_pages} pages` : null
				},
				subject_topical: results.subjects?.slice(0, 5).map((s: string) => ({ a: s })) || [],
				marc_json: {
					source: results.source,
					imported_data: results
				}
			};

			const { data: inserted, error: insertError } = await data.supabase
				.from('marc_records')
				.insert([marcRecord])
				.select();

			if (insertError) throw insertError;

			// Auto-create a default holding for the new record
			if (inserted && inserted[0]) {
				const defaultHolding = {
					marc_record_id: inserted[0].id,
					location: 'Main Library',
					status: 'available',
					copy_number: 1
				};

				await data.supabase.from('holdings').insert([defaultHolding]);
			}

			goto('/admin/cataloging');
		} catch (err) {
			error = `Error importing: ${err.message}`;
		} finally {
			searching = false;
		}
	}
</script>

<div class="isbn-lookup">
	<h1>ISBN Lookup</h1>
	<p class="subtitle">Search for books by ISBN (tries OpenLibrary first, then Library of Congress)</p>

	<div class="lookup-form">
		<div class="form-row">
			<div class="form-group">
				<label for="isbn">ISBN</label>
				<input
					id="isbn"
					type="text"
					bind:value={isbn}
					placeholder="978-0-123456-78-9"
					onkeydown={(e) => e.key === 'Enter' && lookupISBN()}
				/>
			</div>

			<button
				class="btn-search"
				onclick={lookupISBN}
				disabled={searching || !isbn}
			>
				{searching ? 'Searching...' : 'Search'}
			</button>
		</div>
	</div>

	{#if searchLog.length > 0}
		<div class="search-log">
			{#each searchLog as logEntry}
				<div class="log-entry">{logEntry}</div>
			{/each}
		</div>
	{/if}

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if results}
		<div class="results">
			<div class="result-card">
				{#if results.cover}
					<img src={results.cover} alt={results.title} class="cover" />
				{/if}

				<div class="result-details">
					<h2>{results.title}</h2>
					{#if results.subtitle}
						<h3>{results.subtitle}</h3>
					{/if}

					<div class="metadata">
						{#if results.authors.length > 0}
							<p><strong>Author(s):</strong> {results.authors.join(', ')}</p>
						{/if}

						{#if results.publishers.length > 0}
							<p><strong>Publisher:</strong> {results.publishers.join(', ')}</p>
						{/if}

						{#if results.publish_date}
							<p><strong>Published:</strong> {results.publish_date}</p>
						{/if}

						{#if results.number_of_pages}
							<p><strong>Pages:</strong> {results.number_of_pages}</p>
						{/if}

						{#if results.subjects && results.subjects.length > 0}
							<p><strong>Subjects:</strong></p>
							<ul class="subjects">
								{#each results.subjects.slice(0, 10) as subject}
									<li>{subject}</li>
								{/each}
							</ul>
						{/if}

						<p class="source-info">Source: {results.source}</p>
					</div>

					<div class="actions">
						<button class="btn-primary" onclick={importRecord}>
							Import to Catalog
						</button>
						<button class="btn-secondary" onclick={() => (results = null)}>
							Clear
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.isbn-lookup {
		max-width: 1000px;
		background: white;
		padding: 2rem;
		border-radius: 8px;
	}

	h1 {
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		color: #666;
		margin-bottom: 2rem;
	}

	.lookup-form {
		margin-bottom: 2rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: end;
	}

	.search-log {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		font-family: 'Courier New', monospace;
	}

	.log-entry {
		padding: 0.25rem 0;
		color: #666;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	label {
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	input,
	select {
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: #667eea;
	}

	.btn-search,
	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		border: none;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-search {
		background: #667eea;
		color: white;
	}

	.btn-search:hover:not(:disabled) {
		background: #5568d3;
	}

	.btn-search:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 4px;
		border: 1px solid #fcc;
		margin-bottom: 1rem;
	}

	.results {
		margin-top: 2rem;
	}

	.result-card {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 2rem;
		padding: 2rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.cover {
		width: 100%;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.result-details h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.75rem;
	}

	.result-details h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #666;
		font-weight: normal;
	}

	.metadata p {
		margin: 0.5rem 0;
	}

	.subjects {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.subjects li {
		margin: 0.25rem 0;
	}

	.source-info {
		margin-top: 1rem;
		font-size: 0.875rem;
		color: #999;
	}

	.actions {
		margin-top: 2rem;
		display: flex;
		gap: 1rem;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}
</style>
