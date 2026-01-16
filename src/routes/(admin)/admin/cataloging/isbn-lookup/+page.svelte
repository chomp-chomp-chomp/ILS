<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
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
		try {
			// LoC SRU API - returns MARCXML
			const query = encodeURIComponent(`bath.isbn=${cleanISBN}`);
			const url = `https://lx2.loc.gov:210/lcdb?operation=searchRetrieve&version=1.1&query=${query}&maximumRecords=1&recordSchema=marcxml`;

			// Add timeout with AbortController
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeoutId);
			
			const xmlText = await response.text();

			// Check if we got results
			if (xmlText.includes('<numberOfRecords>0</numberOfRecords>')) {
				return null;
			}

			return await parseLocMarc(xmlText);
		} catch (error) {
			console.warn(`LoC API error for ${cleanISBN}:`, error);
			return null;
		}
	}

	/**
	 * Query OCLC Classify API for bibliographic data and call numbers
	 * Returns Dewey Decimal and LC classification numbers for shelving
	 * Free API - no authentication required
	 */
	async function tryOCLCClassify(cleanISBN: string) {
		const url = `https://classify.oclc.org/classify2/Classify?isbn=${cleanISBN}&summary=true`;

		const response = await fetch(url);
		const xmlText = await response.text();

		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

		// Check response code (0 = single work match, 2 = multiple works, 4 = single edition)
		const responseCode = xmlDoc.querySelector('response')?.getAttribute('code');
		if (!responseCode || !['0', '2', '4'].includes(responseCode)) {
			return null;
		}

		// Extract data
		const work = xmlDoc.querySelector('work');
		const author = work?.getAttribute('author') ||
		               xmlDoc.querySelector('author')?.textContent || '';
		const title = work?.getAttribute('title') || '';

		// Get call numbers (most popular preferred, fallback to most recent)
		const dewey = xmlDoc.querySelector('ddc mostPopular')?.getAttribute('sfa') ||
		              xmlDoc.querySelector('ddc mostRecent')?.getAttribute('sfa') || '';
		const lcc = xmlDoc.querySelector('lcc mostPopular')?.getAttribute('sfa') ||
		            xmlDoc.querySelector('lcc mostRecent')?.getAttribute('sfa') || '';

		// Get first edition for additional data
		const edition = xmlDoc.querySelector('edition');
		const language = edition?.getAttribute('language') || '';
		const pubYear = edition?.getAttribute('pubyear') || '';
		const oclcNumber = edition?.getAttribute('oclc') || '';

		// Get VIAF ID for authority control
		const viafId = xmlDoc.querySelector('author')?.getAttribute('viaf') || '';

		return {
			title: title,
			subtitle: '',
			authors: author ? [author] : [],
			publishers: [],
			publish_date: pubYear,
			dewey_call_number: dewey,
			lcc_call_number: lcc,
			language: language,
			oclc_number: oclcNumber,
			viaf_id: viafId,
			subjects: [],
			source: 'OCLC WorldCat'
		};
	}

	/**
	 * Try HathiTrust Bibliographic API for digital links
	 */
	async function tryHathiTrust(cleanISBN: string) {
		try {
			const url = `https://catalog.hathitrust.org/api/volumes/brief/isbn/${cleanISBN}.json`;
			
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
			
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeoutId);
			
			if (!response.ok) return null;
			
			const data = await response.json();
			
			if (!data.items || data.items.length === 0) return null;
			
			// Extract record info
			const recordKey = Object.keys(data.records || {})[0];
			const record = data.records?.[recordKey];
			
			if (!record) return null;
			
			// Build digital links
			const digitalLinks = data.items.map((item: any) => ({
				url: item.itemURL,
				provider: 'HathiTrust',
				access: item.rights === 'pd' ? 'public' : 'restricted',
				type: item.usRightsString || item.rights,
				format: 'online_reader'
			}));
			
			return {
				title: record.titles?.[0] || '',
				digital_links: digitalLinks,
				oclc_number: record.oclcs?.[0],
				lccn: record.lccns?.[0],
				source: 'HathiTrust'
			};
		} catch (error) {
			console.warn(`HathiTrust API error for ${cleanISBN}:`, error);
			return null;
		}
	}

	/**
	 * Try Harvard LibraryCloud for academic metadata
	 */
	async function tryHarvard(cleanISBN: string) {
		try {
			const url = `https://api.lib.harvard.edu/v2/items.json?identifier=${cleanISBN}&limit=1`;
			
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 8000);
			
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeoutId);
			
			if (!response.ok) return null;
			
			const data = await response.json();
			
			if (!data.items?.mods || data.items.mods.length === 0) return null;
			
			const mods = data.items.mods[0];
			
			// Extract data from MODS format
			const titleInfo = Array.isArray(mods.titleInfo) ? mods.titleInfo[0] : mods.titleInfo;
			const names = Array.isArray(mods.name) ? mods.name : (mods.name ? [mods.name] : []);
			const originInfo = Array.isArray(mods.originInfo) ? mods.originInfo[0] : mods.originInfo;
			const subjectArray = Array.isArray(mods.subject) ? mods.subject : (mods.subject ? [mods.subject] : []);
			
			// Extract call numbers
			const classArray = Array.isArray(mods.classification) ? mods.classification : (mods.classification ? [mods.classification] : []);
			let dewey = '';
			let lcc = '';
			
			classArray.forEach((cls: any) => {
				const text = cls['#text'] || cls;
				const authority = cls['@authority'];
				
				if (authority === 'ddc' || /^\d{3}/.test(text)) {
					dewey = text;
				} else if (authority === 'lcc' || /^[A-Z]/.test(text)) {
					lcc = text;
				}
			});
			
			return {
				title: titleInfo?.title || '',
				subtitle: titleInfo?.subTitle || '',
				authors: names.map((n: any) => n.namePart).filter((n: string) => n),
				publishers: originInfo?.publisher ? [originInfo.publisher] : [],
				publish_date: originInfo?.dateIssued || '',
				subjects: subjectArray.map((s: any) => s.topic).filter((t: string) => t),
				dewey_call_number: dewey,
				lcc_call_number: lcc,
				table_of_contents: mods.tableOfContents || '',
				summary: mods.abstract || '',
				source: 'Harvard LibraryCloud'
			};
		} catch (error) {
			console.warn(`Harvard API error for ${cleanISBN}:`, error);
			return null;
		}
	}

	/**
	 * Try Google Books for digital links and previews
	 */
	async function tryGoogleBooksEnhanced(cleanISBN: string) {
		try {
			const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`;
			
			const response = await fetch(url);
			if (!response.ok) return null;
			
			const data = await response.json();
			
			if (!data.items || data.items.length === 0) return null;
			
			const book = data.items[0];
			const volumeInfo = book.volumeInfo;
			const accessInfo = book.accessInfo;
			
			// Build digital links
			const digitalLinks = [];
			if (accessInfo?.viewability && accessInfo.viewability !== 'NO_PAGES') {
				digitalLinks.push({
					url: volumeInfo.previewLink || volumeInfo.infoLink,
					provider: 'Google Books',
					type: accessInfo.viewability,
					access: accessInfo.viewability === 'ALL_PAGES' ? 'public' : 'preview',
					format: 'online_reader'
				});
			}
			
			return {
				digital_links: digitalLinks,
				cover: volumeInfo.imageLinks?.thumbnail,
				source: 'Google Books'
			};
		} catch (error) {
			console.warn(`Google Books API error for ${cleanISBN}:`, error);
			return null;
		}
	}

	async function lookupISBN() {
		searching = true;
		error = '';
		results = null;
		searchLog = [];

		try {
			const cleanISBN = isbn.replace(/[^0-9X]/g, '');

			// Try OpenLibrary first (best for popular books, covers, descriptions)
			searchLog = [...searchLog, '1/7 Searching OpenLibrary...'];
			const olResult = await tryOpenLibrary(cleanISBN);

			if (olResult) {
				results = olResult;
				searchLog = [...searchLog, '  ✓ Found on OpenLibrary'];

				// Supplement with Library of Congress for better MARC data
				searchLog = [...searchLog, '  → Supplementing with Library of Congress...'];
				const locResult = await tryLibraryOfCongress(cleanISBN);
				
				if (locResult) {
					// Merge: Keep OpenLibrary's cover/pages but add LoC's superior MARC data
					results = {
						...results,
						// Prefer LoC subject headings (LCSH controlled vocabulary)
						subjects: locResult.subjects && locResult.subjects.length > 0 ? locResult.subjects : results.subjects,
						// Prefer LoC call numbers if available
						lc_call_number: locResult.lc_call_number || results.lc_call_number,
						dewey_call_number: locResult.dewey_call_number || results.dewey_call_number,
						// Add other LoC-specific fields
						variant_title: locResult.variant_title || results.variant_title,
						edition: locResult.edition || results.edition,
						language_note: locResult.language_note || results.language_note,
						// Keep ISSN if LoC has it
						issn: locResult.issn || results.issn
					};
					searchLog = [...searchLog, '  ✓ Added MARC data from Library of Congress'];
				} else {
					searchLog = [...searchLog, '  ✗ Library of Congress data not available'];
				}

				// Also try OCLC supplement for additional call numbers
				searchLog = [...searchLog, '  → Getting call numbers from OCLC WorldCat...'];
				const oclcResult = await tryOCLCClassify(cleanISBN);
				if (oclcResult?.dewey_call_number || oclcResult?.lcc_call_number) {
					results = {
						...results,
						// Use OCLC call numbers only if we don't have them from LoC
						dewey_call_number: results.dewey_call_number || oclcResult.dewey_call_number,
						lcc_call_number: results.lcc_call_number || oclcResult.lcc_call_number,
						viaf_id: oclcResult.viaf_id,
						oclc_number: oclcResult.oclc_number
					};
					searchLog = [...searchLog, '  ✓ Added call numbers from OCLC'];
				} else {
					searchLog = [...searchLog, '  ✗ No call numbers available from OCLC'];
				}

				// NEW: Try HathiTrust for digital links
				searchLog = [...searchLog, '  → Checking HathiTrust for digital access...'];
				const hathiResult = await tryHathiTrust(cleanISBN);
				if (hathiResult?.digital_links && hathiResult.digital_links.length > 0) {
					results = {
						...results,
						digital_links: hathiResult.digital_links,
						oclc_number: results.oclc_number || hathiResult.oclc_number,
						lccn: results.lccn || hathiResult.lccn
					};
					searchLog = [...searchLog, `  ✓ Found ${hathiResult.digital_links.length} digital copy(ies) on HathiTrust`];
				} else {
					searchLog = [...searchLog, '  ✗ No digital copies found on HathiTrust'];
				}

				// NEW: Try Harvard for enhanced academic metadata
				searchLog = [...searchLog, '  → Checking Harvard LibraryCloud...'];
				const harvardResult = await tryHarvard(cleanISBN);
				if (harvardResult) {
					results = {
						...results,
						// Use Harvard call numbers if we don't have them
						dewey_call_number: results.dewey_call_number || harvardResult.dewey_call_number,
						lcc_call_number: results.lcc_call_number || harvardResult.lcc_call_number,
						// Add TOC if available
						table_of_contents: harvardResult.table_of_contents || results.table_of_contents,
						// Supplement subjects
						subjects: [...new Set([...(results.subjects || []), ...(harvardResult.subjects || [])])].slice(0, 10)
					};
					searchLog = [...searchLog, '  ✓ Added academic metadata from Harvard'];
				} else {
					searchLog = [...searchLog, '  ✗ Not found in Harvard LibraryCloud'];
				}

				// NEW: Try Google Books for digital preview links
				searchLog = [...searchLog, '  → Checking Google Books for previews...'];
				const googleResult = await tryGoogleBooksEnhanced(cleanISBN);
				if (googleResult?.digital_links && googleResult.digital_links.length > 0) {
					results = {
						...results,
						digital_links: [...(results.digital_links || []), ...googleResult.digital_links]
					};
					searchLog = [...searchLog, '  ✓ Found preview on Google Books'];
				} else {
					searchLog = [...searchLog, '  ✗ No preview available on Google Books'];
				}
			} else {
				searchLog = [...searchLog, '  ✗ Not found on OpenLibrary'];

				// Fallback to Library of Congress
				searchLog = [...searchLog, '2/7 Trying Library of Congress...'];
				const locResult = await tryLibraryOfCongress(cleanISBN);

				if (locResult) {
					results = locResult;
					searchLog = [...searchLog, '  ✓ Found on Library of Congress'];

					// OCLC supplement for additional call numbers
					searchLog = [...searchLog, '  → Getting call numbers from OCLC WorldCat...'];
					const oclcResult = await tryOCLCClassify(cleanISBN);
					if (oclcResult?.dewey_call_number || oclcResult?.lcc_call_number) {
						results = {
							...results,
							dewey_call_number: results.dewey_call_number || oclcResult.dewey_call_number,
							lcc_call_number: results.lcc_call_number || oclcResult.lcc_call_number,
							viaf_id: oclcResult.viaf_id,
							oclc_number: oclcResult.oclc_number
						};
						searchLog = [...searchLog, '  ✓ Added call numbers from OCLC'];
					} else {
						searchLog = [...searchLog, '  ✗ No call numbers available from OCLC'];
					}

					// Try new sources
					searchLog = [...searchLog, '  → Checking HathiTrust...'];
					const hathiResult = await tryHathiTrust(cleanISBN);
					if (hathiResult?.digital_links && hathiResult.digital_links.length > 0) {
						results = {
							...results,
							digital_links: hathiResult.digital_links
						};
						searchLog = [...searchLog, `  ✓ Found digital copies on HathiTrust`];
					}

					searchLog = [...searchLog, '  → Checking Harvard...'];
					const harvardResult = await tryHarvard(cleanISBN);
					if (harvardResult) {
						results = {
							...results,
							dewey_call_number: results.dewey_call_number || harvardResult.dewey_call_number,
							lcc_call_number: results.lcc_call_number || harvardResult.lcc_call_number,
							table_of_contents: harvardResult.table_of_contents
						};
						searchLog = [...searchLog, '  ✓ Added data from Harvard'];
					}
				} else {
					searchLog = [...searchLog, '  ✗ Not found on Library of Congress'];

					// Try OCLC
					searchLog = [...searchLog, '3/7 Trying OCLC WorldCat...'];
					const oclcResult = await tryOCLCClassify(cleanISBN);

					if (oclcResult?.title) {
						results = oclcResult;
						searchLog = [...searchLog, '  ✓ Found on OCLC WorldCat'];

						// Still try new sources
						searchLog = [...searchLog, '  → Checking digital sources...'];
						const hathiResult = await tryHathiTrust(cleanISBN);
						if (hathiResult?.digital_links) {
							results.digital_links = hathiResult.digital_links;
						}
					} else {
						searchLog = [...searchLog, '  ✗ Not found on OCLC WorldCat'];

						// Last resort: Try HathiTrust alone
						searchLog = [...searchLog, '4/7 Trying HathiTrust...'];
						const hathiResult = await tryHathiTrust(cleanISBN);
						if (hathiResult?.title) {
							results = hathiResult;
							searchLog = [...searchLog, '  ✓ Found on HathiTrust'];
						} else {
							// Final attempt: Harvard
							searchLog = [...searchLog, '5/7 Trying Harvard LibraryCloud...'];
							const harvardResult = await tryHarvard(cleanISBN);
							if (harvardResult?.title) {
								results = harvardResult;
								searchLog = [...searchLog, '  ✓ Found on Harvard'];
							} else {
								searchLog = [...searchLog, '  ✗ Not found on Harvard'];
								error = 'No results found for this ISBN on any source (OpenLibrary, LoC, OCLC, HathiTrust, Harvard, Google Books)';
							}
						}
					}
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
				summary: results.summary || null,
				table_of_contents: results.table_of_contents || null,
				marc_json: {
					source: results.source,
					imported_data: results,
					dewey_call_number: results.dewey_call_number,
					lcc_call_number: results.lcc_call_number,
					oclc_number: results.oclc_number,
					viaf_id: results.viaf_id,
					digital_links: results.digital_links || []
				}
			};

			const { data: inserted, error: insertError } = await supabase
				.from('marc_records')
				.insert([marcRecord])
				.select();

			if (insertError) throw insertError;

			// Auto-create a default holding for the new record with call number
			if (inserted && inserted[0]) {
				const defaultHolding = {
					marc_record_id: inserted[0].id,
					location: 'Main Library',
					status: 'available',
					copy_number: 1,
					call_number: results.dewey_call_number || results.lcc_call_number || ''
				};

				await supabase.from('holdings').insert([defaultHolding]);
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
	<p class="subtitle">Search for books by ISBN. Queries OpenLibrary, Library of Congress, OCLC WorldCat, HathiTrust (digital access), Harvard LibraryCloud (academic metadata), and Google Books (previews) to provide the most comprehensive bibliographic data.</p>

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

						{#if results.dewey_call_number || results.lcc_call_number}
							<div class="call-numbers">
								<p class="call-numbers-title"><strong>📚 Call Numbers (from OCLC):</strong></p>
								{#if results.dewey_call_number}
									<p><strong>Dewey Decimal:</strong> <span class="call-number">{results.dewey_call_number}</span></p>
								{/if}
								{#if results.lcc_call_number}
									<p><strong>LC Classification:</strong> <span class="call-number">{results.lcc_call_number}</span></p>
								{/if}
							</div>
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

						{#if results.table_of_contents}
							<div class="toc-section">
								<p><strong>📖 Table of Contents:</strong></p>
								<div class="toc-content">{results.table_of_contents}</div>
							</div>
						{/if}

						{#if results.digital_links && results.digital_links.length > 0}
							<div class="digital-links">
								<p class="digital-links-title"><strong>🌐 Digital Access:</strong></p>
								{#each results.digital_links as link}
									<div class="digital-link">
										<a href={link.url} target="_blank" rel="noopener noreferrer">
											<span class="provider">{link.provider}</span>
											<span class="access-badge" class:public={link.access === 'public'} class:preview={link.access === 'preview'}>
												{link.access === 'public' ? '🔓 Full Access' : 
												 link.access === 'preview' ? '👁️ Preview' : 
												 '🔒 Restricted'}
											</span>
										</a>
										{#if link.type && link.type !== link.access}
											<span class="view-type">{link.type}</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<p class="source-info">
						Source: {results.source}
						{#if results.oclc_number}
							<span class="oclc-number">(OCLC: {results.oclc_number})</span>
						{/if}
					</p>
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

	.call-numbers {
		background: #e8f5e9;
		border-left: 4px solid #4caf50;
		padding: 1rem;
		margin: 1rem 0;
		border-radius: 4px;
	}

	.call-numbers-title {
		margin-top: 0 !important;
		font-weight: 600;
		color: #2e7d32;
	}

	.call-numbers p {
		margin: 0.5rem 0;
	}

	.call-number {
		font-family: 'Courier New', monospace;
		font-weight: bold;
		color: #1b5e20;
		background: white;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 1.1em;
		border: 1px solid #a5d6a7;
	}

	.oclc-number {
		font-size: 0.875rem;
		color: #999;
		margin-left: 0.5rem;
		font-style: italic;
	}

	.subjects {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.subjects li {
		margin: 0.25rem 0;
	}

	.toc-section {
		background: #f0f4ff;
		border-left: 4px solid #667eea;
		padding: 1rem;
		margin: 1rem 0;
		border-radius: 4px;
	}

	.toc-content {
		margin-top: 0.5rem;
		white-space: pre-wrap;
		font-size: 0.9rem;
		line-height: 1.6;
		color: #444;
		max-height: 300px;
		overflow-y: auto;
	}

	.digital-links {
		background: #e3f2fd;
		border-left: 4px solid #2196f3;
		padding: 1rem;
		margin: 1rem 0;
		border-radius: 4px;
	}

	.digital-links-title {
		margin-top: 0 !important;
		font-weight: 600;
		color: #1565c0;
	}

	.digital-link {
		background: white;
		border-radius: 4px;
		padding: 0.75rem;
		margin: 0.5rem 0;
		border: 1px solid #bbdefb;
		transition: all 0.2s;
	}

	.digital-link:hover {
		box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
		border-color: #2196f3;
	}

	.digital-link a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: #1565c0;
		font-weight: 500;
	}

	.digital-link a:hover {
		text-decoration: underline;
	}

	.digital-link .provider {
		font-weight: 600;
		color: #0d47a1;
	}

	.access-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.access-badge.public {
		background: #4caf50;
		color: white;
	}

	.access-badge.preview {
		background: #ff9800;
		color: white;
	}

	.access-badge:not(.public):not(.preview) {
		background: #9e9e9e;
		color: white;
	}

	.view-type {
		font-size: 0.8rem;
		color: #666;
		font-style: italic;
		margin-left: 0.5rem;
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
