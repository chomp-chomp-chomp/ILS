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

	type SourceStatus = 'success' | 'not_found' | 'error';

	const sourceOrder = [
		'OpenLibrary',
		'Library of Congress',
		'OCLC WorldCat',
		'HathiTrust',
		'Harvard LibraryCloud',
		'Google Books'
	];

	function summarizeSourceFields(data: any) {
		const fields: string[] = [];

		if (!data) return fields;

		if (data.title) fields.push('Title');
		if (data.subtitle) fields.push('Subtitle');
		if (data.authors?.length) fields.push(`Author(s) (${data.authors.length})`);
		if (data.publishers?.length) fields.push(`Publisher${data.publishers.length > 1 ? 's' : ''}`);
		if (data.publish_date) fields.push('Publish date');
		if (data.number_of_pages) fields.push('Page count');
		if (data.subjects?.length) fields.push(`Subjects (${data.subjects.length})`);
		if (data.cover) fields.push('Cover image');
		if (data.table_of_contents || data.contents_note) fields.push('Table of contents');
		if (data.summary) fields.push('Summary');
		if (data.dewey_call_number || data.dewey_call_number?.a) fields.push('Dewey call number');
		if (data.lcc_call_number || data.lc_call_number || data.lc_call_number?.a) fields.push('LC call number');
		if (data.oclc_number) fields.push('OCLC number');
		if (data.lccn) fields.push('LCCN');
		if (data.digital_links?.length) fields.push(`Digital links (${data.digital_links.length})`);

		return fields;
	}

	function isProviderMatch(provider: string | undefined, match: string) {
		return provider?.toLowerCase().includes(match.toLowerCase()) || false;
	}

	function buildDigitalVisibility(links: any[]) {
		return {
			hathiTrust: links.some((link) => isProviderMatch(link.provider, 'hathi')),
			googleBooks: links.some((link) => isProviderMatch(link.provider, 'google'))
		};
	}

	async function runSource(name: string, fetcher: () => Promise<any>) {
		try {
			const data = await fetcher();
			if (data) {
				return {
					data,
					detail: { status: 'success' as SourceStatus, fields: summarizeSourceFields(data) }
				};
			}
			return { data: null, detail: { status: 'not_found' as SourceStatus } };
		} catch (err: any) {
			return {
				data: null,
				detail: { status: 'error' as SourceStatus, error: err?.message || 'Unknown error' }
			};
		}
	}

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

		const getFullDatafield = (tag: string) => {
			const field = xmlDoc.querySelector(`datafield[tag="${tag}"]`);
			if (!field) return null;

			const subfields: any = {};
			field.querySelectorAll('subfield').forEach(sf => {
				const code = sf.getAttribute('code');
				const value = sf.textContent?.trim();
				if (code && value) {
					subfields[code] = value;
				}
			});
			return Object.keys(subfields).length > 0 ? subfields : null;
		};

		return {
			title: getDatafield('245', 'a').replace(/\s*\/\s*$/, '').replace(/\s*:\s*$/, ''),
			subtitle: getDatafield('245', 'b').replace(/\s*\/\s*$/, ''),
			variant_title: getDatafield('246', 'a'),
			edition: getDatafield('250', 'a'),
			authors: [getDatafield('100', 'a') || getDatafield('110', 'a')].filter(a => a),
			publishers: [getDatafield('260', 'b') || getDatafield('264', 'b')].filter(p => p).map(p => p.replace(/,\s*$/, '')),
			publish_date: getDatafield('260', 'c') || getDatafield('264', 'c'),
			number_of_pages: null, // Not typically in LoC MARC, but added for consistency
			subjects: getAllDatafields('650', 'a'),
			genre_forms: getAllDatafields('655', 'a'),
			lc_call_number: getFullDatafield('050'),
			dewey_call_number: getFullDatafield('082'),
			language_note: getDatafield('546', 'a'),
			contents_note: getDatafield('505', 'a'),
			isbn: getDatafield('020', 'a').replace(/[^0-9X]/gi, ''),
			issn: getDatafield('022', 'a'),
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
				const book = bookData[key];
				return {
					title: book.title || '',
					subtitle: book.subtitle || '',
					variant_title: '', // OpenLibrary doesn't provide this
					edition: book.edition_name || '',
					authors: book.authors?.map((a: any) => a.name) || [],
					publishers: book.publishers?.map((p: any) => p.name) || [],
					publish_date: book.publish_date || '',
					number_of_pages: book.number_of_pages || null,
					subjects: book.subjects?.map((s: any) => s.name) || [],
					genre_forms: [] as string[], // OpenLibrary doesn't provide genre/form terms
					lc_call_number: null as any,
					dewey_call_number: null as any,
					language_note: '',
					contents_note: book.table_of_contents ? book.table_of_contents.map((c: any) => c.title || c).join(' -- ') : '',
					isbn: cleanISBN,
					issn: '',
					source: 'OpenLibrary'
				};
			}
			return null;
		} catch (err) {
			console.warn(`OpenLibrary error for ${cleanISBN}:`, err);
			return null;
		}
	}

	async function tryLibraryOfCongress(cleanISBN: string) {
		const url = `/api/isbn/loc?isbn=${cleanISBN}`;
		const response = await fetchWithTimeout(url, 5000);
		if (!response.ok) {
			throw new Error(`LoC proxy failed with status ${response.status}`);
		}
		const xmlText = await response.text();

		if (xmlText.includes('<numberOfRecords>0</numberOfRecords>')) {
			return null;
		}

		return await parseLocMarc(xmlText);
	}

	/**
	 * Query OCLC Classify API for bibliographic data and call numbers
	 * Returns Dewey Decimal and LC classification numbers for shelving
	 * Free API - no authentication required
	 */
	async function tryOCLCClassify(cleanISBN: string) {
		const url = `/api/isbn/oclc?isbn=${cleanISBN}`;
		const response = await fetchWithTimeout(url, 8000);
		if (!response.ok) {
			throw new Error(`OCLC proxy failed with status ${response.status}`);
		}
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
		const url = `https://catalog.hathitrust.org/api/volumes/brief/isbn/${cleanISBN}.json`;
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
		
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			throw new Error(`HathiTrust API returned ${response.status}`);
		}
		
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
	}

	/**
	 * Try Harvard LibraryCloud for academic metadata
	 */
	async function tryHarvard(cleanISBN: string) {
		const url = `https://api.lib.harvard.edu/v2/items.json?identifier=${cleanISBN}&limit=1`;
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 8000);
		
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			throw new Error(`Harvard API returned ${response.status}`);
		}
		
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
	}

	/**
	 * Try Google Books for digital links and previews
	 */
	async function tryGoogleBooksEnhanced(cleanISBN: string) {
		const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`;
		
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Google Books API returned ${response.status}`);
		}
		
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
				data: null,
				sourceDetails: {}
			}];

			try {
				// Strategy: Try OpenLibrary first for speed, then supplement with all other sources
				let sourceDetails: Record<string, { status: SourceStatus; fields?: string[]; error?: string }> = {};
				let bookData: any = null;
				let sources = [];
				const openLibraryResult = await runSource('OpenLibrary', () => tryOpenLibrary(isbn));
				sourceDetails = { ...sourceDetails, OpenLibrary: openLibraryResult.detail };
				bookData = openLibraryResult.data;
				
				if (bookData) {
					sources.push('OpenLibrary');
					
					// Supplement with LoC data
					const locData = await runSource('Library of Congress', () => tryLibraryOfCongress(isbn));
					sourceDetails = { ...sourceDetails, 'Library of Congress': locData.detail };
					if (locData.data) {
						sources.push('Library of Congress');
						bookData = {
							...bookData,
							lc_call_number: locData.data.lc_call_number || bookData.lc_call_number,
							dewey_call_number: locData.data.dewey_call_number || bookData.dewey_call_number,
							subjects: locData.data.subjects.length > 0 ? locData.data.subjects : bookData.subjects,
							genre_forms: locData.data.genre_forms.length > 0 ? locData.data.genre_forms : bookData.genre_forms,
							variant_title: locData.data.variant_title || bookData.variant_title,
							edition: locData.data.edition || bookData.edition,
							language_note: locData.data.language_note || bookData.language_note,
							contents_note: locData.data.contents_note || bookData.contents_note,
							issn: locData.data.issn || bookData.issn
						};
					}

					// Add OCLC call numbers
					const oclcData = await runSource('OCLC WorldCat', () => tryOCLCClassify(isbn));
					sourceDetails = { ...sourceDetails, 'OCLC WorldCat': oclcData.detail };
					if (oclcData.data?.dewey_call_number || oclcData.data?.lcc_call_number) {
						sources.push('OCLC WorldCat');
						bookData = {
							...bookData,
							dewey_call_number: bookData.dewey_call_number || oclcData.data.dewey_call_number,
							lc_call_number: bookData.lc_call_number || oclcData.data.lcc_call_number,
							viaf_id: oclcData.data.viaf_id,
							oclc_number: oclcData.data.oclc_number
						};
					}
					
					// Add HathiTrust digital links
					const hathiData = await runSource('HathiTrust', () => tryHathiTrust(isbn));
					sourceDetails = { ...sourceDetails, HathiTrust: hathiData.detail };
					if (hathiData.data?.digital_links && hathiData.data.digital_links.length > 0) {
						sources.push('HathiTrust');
						bookData = {
							...bookData,
							digital_links: hathiData.data.digital_links,
							oclc_number: bookData.oclc_number || hathiData.data.oclc_number,
							lccn: bookData.lccn || hathiData.data.lccn
						};
					}
					
					// Add Harvard academic metadata
					const harvardData = await runSource('Harvard LibraryCloud', () => tryHarvard(isbn));
					sourceDetails = { ...sourceDetails, 'Harvard LibraryCloud': harvardData.detail };
					if (harvardData.data) {
						sources.push('Harvard');
						bookData = {
							...bookData,
							dewey_call_number: bookData.dewey_call_number || harvardData.data.dewey_call_number,
							lc_call_number: bookData.lc_call_number || harvardData.data.lc_call_number,
							table_of_contents: harvardData.data.table_of_contents || bookData.table_of_contents,
							summary: bookData.summary || harvardData.data.summary,
							subjects: [...new Set([...(bookData.subjects || []), ...(harvardData.data.subjects || [])])].slice(0, 10)
						};
					}
					
					// Add Google Books preview links
					const googleData = await runSource('Google Books', () => tryGoogleBooksEnhanced(isbn));
					sourceDetails = { ...sourceDetails, 'Google Books': googleData.detail };
					if (googleData.data?.digital_links && googleData.data.digital_links.length > 0) {
						sources.push('Google Books');
						bookData = {
							...bookData,
							digital_links: [...(bookData.digital_links || []), ...googleData.data.digital_links]
						};
					}
				} else {
					// OpenLibrary didn't find it - try other sources
					const locData = await runSource('Library of Congress', () => tryLibraryOfCongress(isbn));
					sourceDetails = { ...sourceDetails, 'Library of Congress': locData.detail };
					bookData = locData.data;
					if (bookData) {
						sources.push('Library of Congress');

						const oclcData = await runSource('OCLC WorldCat', () => tryOCLCClassify(isbn));
						sourceDetails = { ...sourceDetails, 'OCLC WorldCat': oclcData.detail };
						if (oclcData.data?.dewey_call_number || oclcData.data?.lcc_call_number) {
							sources.push('OCLC WorldCat');
							bookData = {
								...bookData,
								dewey_call_number: bookData.dewey_call_number || oclcData.data.dewey_call_number,
								lc_call_number: bookData.lc_call_number || oclcData.data.lcc_call_number,
								viaf_id: oclcData.data.viaf_id,
								oclc_number: oclcData.data.oclc_number
							};
						}
						
						// Still try to add digital links
						const hathiData = await runSource('HathiTrust', () => tryHathiTrust(isbn));
						sourceDetails = { ...sourceDetails, HathiTrust: hathiData.detail };
						if (hathiData.data?.digital_links) {
							sources.push('HathiTrust');
							bookData.digital_links = hathiData.data.digital_links;
						}
						
						const harvardData = await runSource('Harvard LibraryCloud', () => tryHarvard(isbn));
						sourceDetails = { ...sourceDetails, 'Harvard LibraryCloud': harvardData.detail };
						if (harvardData.data) {
							sources.push('Harvard');
							bookData = {
								...bookData,
								dewey_call_number: bookData.dewey_call_number || harvardData.data.dewey_call_number,
								lc_call_number: bookData.lc_call_number || harvardData.data.lc_call_number,
								table_of_contents: harvardData.data.table_of_contents
							};
						}

						const googleData = await runSource('Google Books', () => tryGoogleBooksEnhanced(isbn));
						sourceDetails = { ...sourceDetails, 'Google Books': googleData.detail };
						if (googleData.data?.digital_links && googleData.data.digital_links.length > 0) {
							sources.push('Google Books');
							bookData = {
								...bookData,
								digital_links: [...(bookData.digital_links || []), ...googleData.data.digital_links]
							};
						}
					} else {
						// Try OCLC as next fallback
						const oclcData = await runSource('OCLC WorldCat', () => tryOCLCClassify(isbn));
						sourceDetails = { ...sourceDetails, 'OCLC WorldCat': oclcData.detail };

						if (oclcData.data?.title) {
							sources.push('OCLC WorldCat');
							bookData = oclcData.data;

							const hathiData = await runSource('HathiTrust', () => tryHathiTrust(isbn));
							sourceDetails = { ...sourceDetails, HathiTrust: hathiData.detail };
							if (hathiData.data?.digital_links) {
								sources.push('HathiTrust');
								bookData.digital_links = hathiData.data.digital_links;
							}

							const googleData = await runSource('Google Books', () => tryGoogleBooksEnhanced(isbn));
							sourceDetails = { ...sourceDetails, 'Google Books': googleData.detail };
							if (googleData.data?.digital_links && googleData.data.digital_links.length > 0) {
								sources.push('Google Books');
								bookData.digital_links = [
									...(bookData.digital_links || []),
									...googleData.data.digital_links
								];
							}
						} else {
							// Try HathiTrust or Harvard as last resort
							const hathiData = await runSource('HathiTrust', () => tryHathiTrust(isbn));
							const harvardData = await runSource('Harvard LibraryCloud', () => tryHarvard(isbn));
							sourceDetails = {
								...sourceDetails,
								HathiTrust: hathiData.detail,
								'Harvard LibraryCloud': harvardData.detail
							};
							
							if (harvardData.data) {
								sources.push('Harvard');
								bookData = harvardData.data;
							}
							if (hathiData.data?.digital_links) {
								sources.push('HathiTrust');
								if (!bookData) bookData = {} as any;
								bookData.digital_links = hathiData.data.digital_links;
							}
						}
					}
				}

				// Update the result
				if (bookData) {
					results[i] = {
						isbn,
						status: 'found',
						source: sources.join(' + '),
						data: bookData,
						sourceDetails
					};
				} else {
					results[i] = {
						isbn,
						status: 'not_found',
						source: null,
						data: null,
						sourceDetails
					};
				}
			} catch (err: any) {
				results[i] = {
					isbn,
					status: 'error',
					error: err.message || 'Unknown error',
					source: null,
					data: null,
					sourceDetails: {}
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
		let inserted = 0;
		let updated = 0;
		let errors = 0;

		try {
			for (const result of selectedResults) {
				try {
					const formattedContentsNotes = [
						result.data.contents_note,
						result.data.table_of_contents
					].filter((note: string | undefined) => note && note.trim());
					const marcRecord = {
						isbn: result.data.isbn || result.isbn,
						issn: result.data.issn || null,
						material_type: 'book',
						title_statement: {
							a: result.data.title,
							b: result.data.subtitle
						},
						varying_form_title: result.data.variant_title ? [{ a: result.data.variant_title }] : [],
						edition_statement: result.data.edition ? { a: result.data.edition } : null,
						main_entry_personal_name: result.data.authors[0] ? { a: result.data.authors[0] } : null,
						publication_info: {
							a: '',
							b: result.data.publishers[0] || '',
							c: result.data.publish_date
						},
						physical_description: {
							a: result.data.number_of_pages ? `${result.data.number_of_pages} pages` : null
						},
						lc_call_number: result.data.lc_call_number || null,
						dewey_call_number: result.data.dewey_call_number || null,
						language_note: result.data.language_note || null,
						formatted_contents_note: formattedContentsNotes,
						subject_topical: result.data.subjects?.slice(0, 10).map((s: string) => ({ a: s })) || [],
						genre_form_term: result.data.genre_forms?.map((g: string) => ({ a: g })) || [],
						summary: result.data.summary || null,
						marc_json: {
							source: result.source,
							imported_data: result.data,
							digital_links: result.data.digital_links || [],
							digital_links_visibility: buildDigitalVisibility(result.data.digital_links || [])
						}
					};

					// Check if record with this ISBN already exists
					const { data: existing, error: searchError } = await supabase
						.from('marc_records')
						.select('id')
						.eq('isbn', result.isbn)
						.maybeSingle();

					if (searchError) throw searchError;

					if (existing) {
						// UPDATE existing record (overlay)
						const { error: updateError } = await supabase
							.from('marc_records')
							.update({
								...marcRecord,
								updated_at: new Date().toISOString()
							})
							.eq('id', existing.id);

						if (updateError) throw updateError;
						updated++;

						// Update result status
						const index = results.findIndex(r => r.isbn === result.isbn);
						if (index >= 0) {
							results[index].importStatus = 'updated';
							results = [...results];
						}
					} else {
						// INSERT new record
						const { data: insertedRecord, error: insertError } = await supabase
							.from('marc_records')
							.insert([marcRecord])
							.select();

						if (insertError) throw insertError;
						inserted++;

						// Auto-create default holding for new records only
						if (insertedRecord && insertedRecord[0]) {
							await supabase.from('holdings').insert([{
								marc_record_id: insertedRecord[0].id,
								location: 'Main Library',
								status: 'available',
								copy_number: 1
							}]);
						}

						// Update result status
						const index = results.findIndex(r => r.isbn === result.isbn);
						if (index >= 0) {
							results[index].importStatus = 'inserted';
							results = [...results];
						}
					}
				} catch (err: any) {
					console.error(`Error importing ISBN ${result.isbn}:`, err);
					errors++;

					// Update result status
					const index = results.findIndex(r => r.isbn === result.isbn);
					if (index >= 0) {
						results[index].importStatus = 'error';
						results[index].importError = err.message;
						results = [...results];
					}
				}
			}

			// Show summary
			alert(`Import complete!\n\nInserted: ${inserted}\nUpdated: ${updated}\nErrors: ${errors}`);

			if (errors === 0) {
				goto('/admin/cataloging');
			}
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
	<h1>Bulk ISBN Import/Update</h1>
	<p class="subtitle">Paste multiple ISBNs (one per line) to import or update records. Searches OpenLibrary first (fast), then supplements with Library of Congress data for complete MARC fields (call numbers, subject headings). Existing records will be updated automatically.</p>

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
									disabled={result.importStatus}
								/>
							</div>
							<div class="result-content">
								<h3>
									{result.data.title}
									{#if result.importStatus === 'updated'}
										<span class="status-badge updated">UPDATED</span>
									{:else if result.importStatus === 'inserted'}
										<span class="status-badge inserted">NEW</span>
									{:else if result.importStatus === 'error'}
										<span class="status-badge error">ERROR</span>
									{/if}
								</h3>
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
								{#if result.sourceDetails && Object.keys(result.sourceDetails).length > 0}
									<div class="source-breakdown">
										<ul>
											{#each sourceOrder as source}
												{#if result.sourceDetails[source]}
													<li class="source-line {result.sourceDetails[source].status}">
														<span class="source-name">{source}:</span>
														{#if result.sourceDetails[source].status === 'success'}
															<span class="source-fields">
																{result.sourceDetails[source].fields?.length
																	? result.sourceDetails[source].fields?.join(', ')
																	: 'Data available'}
															</span>
														{:else if result.sourceDetails[source].status === 'error'}
															<span class="source-error">Error: {result.sourceDetails[source].error}</span>
														{:else}
															<span class="source-missing">No data returned</span>
														{/if}
													</li>
												{/if}
											{/each}
										</ul>
									</div>
								{/if}
								{#if result.importError}
									<p class="import-error">Error: {result.importError}</p>
								{/if}
							</div>
						{:else if result.status === 'not_found'}
							<div class="result-content">
								<p class="error-text">ISBN {result.isbn}: Not found</p>
								{#if result.sourceDetails && Object.keys(result.sourceDetails).length > 0}
									<div class="source-breakdown">
										<ul>
											{#each sourceOrder as source}
												{#if result.sourceDetails[source]}
													<li class="source-line {result.sourceDetails[source].status}">
														<span class="source-name">{source}:</span>
														{#if result.sourceDetails[source].status === 'success'}
															<span class="source-fields">
																{result.sourceDetails[source].fields?.length
																	? result.sourceDetails[source].fields?.join(', ')
																	: 'Data available'}
															</span>
														{:else if result.sourceDetails[source].status === 'error'}
															<span class="source-error">Error: {result.sourceDetails[source].error}</span>
														{:else}
															<span class="source-missing">No data returned</span>
														{/if}
													</li>
												{/if}
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{:else if result.status === 'processing'}
							<div class="result-content">
								<p class="processing-text">ISBN {result.isbn}: Searching...</p>
							</div>
						{:else}
							<div class="result-content">
								<p class="error-text">ISBN {result.isbn}: Error - {result.error}</p>
								{#if result.sourceDetails && Object.keys(result.sourceDetails).length > 0}
									<div class="source-breakdown">
										<ul>
											{#each sourceOrder as source}
												{#if result.sourceDetails[source]}
													<li class="source-line {result.sourceDetails[source].status}">
														<span class="source-name">{source}:</span>
														{#if result.sourceDetails[source].status === 'success'}
															<span class="source-fields">
																{result.sourceDetails[source].fields?.length
																	? result.sourceDetails[source].fields?.join(', ')
																	: 'Data available'}
															</span>
														{:else if result.sourceDetails[source].status === 'error'}
															<span class="source-error">Error: {result.sourceDetails[source].error}</span>
														{:else}
															<span class="source-missing">No data returned</span>
														{/if}
													</li>
												{/if}
											{/each}
										</ul>
									</div>
								{/if}
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

	.source-breakdown {
		margin-top: 0.5rem;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
	}

	.source-breakdown ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.source-line {
		display: flex;
		gap: 0.5rem;
		font-size: 0.7rem;
		padding: 0.2rem 0;
	}

	.source-name {
		font-weight: 600;
		color: #374151;
	}

	.source-fields {
		color: #047857;
	}

	.source-line.error .source-name,
	.source-error {
		color: #b91c1c;
	}

	.source-missing {
		color: #6b7280;
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

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		margin-left: 1rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		vertical-align: middle;
	}

	.status-badge.updated {
		background: #dbeafe;
		color: #1e40af;
	}

	.status-badge.inserted {
		background: #d1fae5;
		color: #065f46;
	}

	.status-badge.error {
		background: #fee2e2;
		color: #991b1b;
	}

	.import-error {
		margin: 0.5rem 0 0 0;
		padding: 0.5rem;
		background: #fef2f2;
		border-left: 3px solid #dc2626;
		font-size: 0.875rem;
		color: #991b1b;
	}
</style>
