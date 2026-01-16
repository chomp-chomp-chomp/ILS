/**
 * Bibliographic Data API Service
 * 
 * Centralized service for querying multiple bibliographic data sources:
 * - HathiTrust Bibliographic API
 * - Harvard LibraryCloud API
 * - OpenLibrary (already integrated)
 * - Library of Congress SRU (already integrated)
 * - OCLC Classify (already integrated)
 * 
 * Provides unified interfaces for ISBN/LCCN lookups with:
 * - MARC data
 * - Call numbers (LC, Dewey)
 * - Digital links (HathiTrust, Google Books)
 * - Cover images
 * - Tables of contents
 * - Enhanced metadata
 */

// ========================================
// Type Definitions
// ========================================

export interface BibliographicRecord {
	title?: string;
	subtitle?: string;
	authors?: string[];
	publishers?: string[];
	publish_date?: string;
	publish_places?: string[];
	edition?: string;
	
	// Identifiers
	isbn?: string;
	issn?: string;
	lccn?: string;
	oclc_number?: string;
	viaf_id?: string;
	
	// Call numbers
	dewey_call_number?: string;
	lcc_call_number?: string;
	
	// Physical details
	number_of_pages?: string;
	physical_description?: string;
	language?: string;
	language_code?: string;
	
	// Content
	subjects?: string[];
	genres?: string[];
	summary?: string;
	table_of_contents?: string;
	notes?: string[];
	
	// Digital access
	digital_links?: DigitalLink[];
	cover_url?: string;
	
	// Metadata
	source: string;
	source_record_id?: string;
	metadata_quality?: 'high' | 'medium' | 'low';
}

export interface DigitalLink {
	url: string;
	provider: string; // 'hathitrust', 'google', 'archive.org', etc.
	type: 'full_view' | 'limited_preview' | 'snippet_view' | 'metadata_only';
	access: 'public' | 'restricted' | 'subscription';
	format?: string; // 'pdf', 'epub', 'online_reader'
}

export interface LookupOptions {
	includeDigitalLinks?: boolean;
	includeTOC?: boolean;
	timeout?: number; // milliseconds
	sources?: string[]; // specific sources to query
}

export interface LookupResult {
	success: boolean;
	record?: BibliographicRecord;
	error?: string;
	sources_tried: string[];
	response_time_ms: number;
}

// ========================================
// HathiTrust Bibliographic API
// ========================================

/**
 * HathiTrust is a digital library with millions of volumes
 * API: https://www.hathitrust.org/hathitrust-apis
 * Bibliographic API: https://www.hathitrust.org/bib_api
 */
export async function lookupHathiTrust(
	isbn?: string,
	lccn?: string,
	oclc?: string,
	options: LookupOptions = {}
): Promise<LookupResult> {
	const startTime = Date.now();
	const sources_tried = ['hathitrust'];
	
	try {
		// Build query - HathiTrust supports ISBN, LCCN, OCLC
		const identifiers: string[] = [];
		if (isbn) identifiers.push(`isbn:${isbn.replace(/[-\s]/g, '')}`);
		if (lccn) identifiers.push(`lccn:${lccn}`);
		if (oclc) identifiers.push(`oclc:${oclc}`);
		
		if (identifiers.length === 0) {
			return {
				success: false,
				error: 'At least one identifier (ISBN, LCCN, or OCLC) required',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		// HathiTrust Bibliographic API endpoint
		// Format: https://catalog.hathitrust.org/api/volumes/brief/isbn/0030110408.json
		// or: https://catalog.hathitrust.org/api/volumes/brief/lccn/2005926331.json
		
		let apiUrl = '';
		if (isbn) {
			apiUrl = `https://catalog.hathitrust.org/api/volumes/brief/isbn/${isbn.replace(/[-\s]/g, '')}.json`;
		} else if (oclc) {
			apiUrl = `https://catalog.hathitrust.org/api/volumes/brief/oclc/${oclc}.json`;
		} else if (lccn) {
			apiUrl = `https://catalog.hathitrust.org/api/volumes/brief/lccn/${lccn}.json`;
		}
		
		const timeout = options.timeout || 10000;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		const response = await fetch(apiUrl, {
			signal: controller.signal,
			headers: {
				'Accept': 'application/json'
			}
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			return {
				success: false,
				error: `HathiTrust API returned ${response.status}`,
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		const data = await response.json();
		
		// HathiTrust response format:
		// {
		//   "items": [{
		//     "htid": "unique_id",
		//     "itemURL": "https://...",
		//     "orig": "University",
		//     "rights": "pd" or "ic" or "und",
		//     "usRightsString": "Full view"
		//   }],
		//   "records": {
		//     "record_id": {
		//       "recordURL": "...",
		//       "titles": ["Title"],
		//       "isbns": ["isbn"],
		//       "issns": [],
		//       "oclcs": ["oclc"],
		//       "lccns": ["lccn"],
		//       "publishDates": ["2005"]
		//     }
		//   }
		// }
		
		if (!data.items || data.items.length === 0) {
			return {
				success: false,
				error: 'No results found in HathiTrust',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		// Extract record data (take first record)
		const recordKey = Object.keys(data.records || {})[0];
		const record = data.records?.[recordKey];
		
		if (!record) {
			return {
				success: false,
				error: 'No record data in HathiTrust response',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		// Build digital links from items
		const digitalLinks: DigitalLink[] = data.items.map((item: any) => {
			// Rights codes: pd = public domain, ic = in copyright, und = undetermined
			const rights = item.rights || 'und';
			const usRights = item.usRightsString || '';
			
			let access: 'public' | 'restricted' | 'subscription' = 'restricted';
			let type: 'full_view' | 'limited_preview' | 'snippet_view' | 'metadata_only' = 'metadata_only';
			
			if (rights === 'pd' || usRights.includes('Full view')) {
				access = 'public';
				type = 'full_view';
			} else if (usRights.includes('Limited')) {
				type = 'limited_preview';
			}
			
			return {
				url: item.itemURL,
				provider: 'hathitrust',
				type,
				access,
				format: 'online_reader'
			};
		});
		
		// Build bibliographic record
		const bibRecord: BibliographicRecord = {
			title: record.titles?.[0] || '',
			authors: [], // HathiTrust brief API doesn't include authors
			publishers: [], // Not in brief API
			publish_date: record.publishDates?.[0] || '',
			isbn: record.isbns?.[0],
			issn: record.issns?.[0],
			lccn: record.lccns?.[0],
			oclc_number: record.oclcs?.[0],
			digital_links: digitalLinks,
			source: 'HathiTrust',
			source_record_id: recordKey,
			metadata_quality: 'medium' // Brief API has limited metadata
		};
		
		return {
			success: true,
			record: bibRecord,
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
		
	} catch (error) {
		console.error('HathiTrust API error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
	}
}

// ========================================
// Harvard LibraryCloud API
// ========================================

/**
 * Harvard LibraryCloud provides access to Harvard Library collections
 * API: https://library.harvard.edu/services-tools/librarycloud
 * Documentation: https://wiki.harvard.edu/confluence/display/LibraryStaffDoc/LibraryCloud+APIs
 */
export async function lookupHarvard(
	isbn?: string,
	title?: string,
	author?: string,
	options: LookupOptions = {}
): Promise<LookupResult> {
	const startTime = Date.now();
	const sources_tried = ['harvard'];
	
	try {
		// Harvard LibraryCloud API endpoint
		const baseUrl = 'https://api.lib.harvard.edu/v2/items.json';
		
		// Build query parameters
		const params = new URLSearchParams();
		
		if (isbn) {
			params.append('identifier', isbn.replace(/[-\s]/g, ''));
		} else if (title) {
			params.append('title', title);
			if (author) {
				params.append('name', author);
			}
		} else {
			return {
				success: false,
				error: 'ISBN or title required for Harvard lookup',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		params.append('limit', '1'); // Just get first result
		
		const apiUrl = `${baseUrl}?${params.toString()}`;
		
		const timeout = options.timeout || 10000;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		const response = await fetch(apiUrl, {
			signal: controller.signal,
			headers: {
				'Accept': 'application/json'
			}
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			return {
				success: false,
				error: `Harvard API returned ${response.status}`,
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		const data = await response.json();
		
		// Harvard response format (MODS-based):
		// {
		//   "items": {
		//     "mods": [{
		//       "titleInfo": [{"title": "..."}],
		//       "name": [{"namePart": "..."}],
		//       "originInfo": [{"publisher": "...", "dateIssued": "..."}],
		//       "subject": [{"topic": "..."}],
		//       "classification": [{"#text": "call_number"}],
		//       "abstract": "...",
		//       "tableOfContents": "...",
		//       "physicalDescription": {...},
		//       "identifier": [{"#text": "isbn", "@type": "isbn"}]
		//     }],
		//     "pagination": {...}
		//   }
		// }
		
		const mods = Array.isArray(data.items?.mods) ? data.items.mods[0] : data.items?.mods;
		if (!mods) {
			return {
				success: false,
				error: 'No results found in Harvard LibraryCloud',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		// Extract data from MODS format
		const titleInfo = Array.isArray(mods.titleInfo) ? mods.titleInfo[0] : mods.titleInfo;
		const title_text = titleInfo?.title || '';
		const subtitle_text = titleInfo?.subTitle || '';
		
		// Extract authors
		const names = Array.isArray(mods.name) ? mods.name : (mods.name ? [mods.name] : []);
		const authors = names
			.map((n: any) => n.namePart)
			.filter((n: string) => n);
		
		// Extract origin info (publisher, date, place)
		const originInfo = Array.isArray(mods.originInfo) ? mods.originInfo[0] : mods.originInfo;
		const publishers = originInfo?.publisher ? [originInfo.publisher] : [];
		const publish_date = originInfo?.dateIssued || '';
		const publish_places = originInfo?.place?.placeTerm ? [originInfo.place.placeTerm] : [];
		
		// Extract subjects
		const subjectArray = Array.isArray(mods.subject) ? mods.subject : (mods.subject ? [mods.subject] : []);
		const subjects = subjectArray
			.map((s: any) => s.topic)
			.filter((t: string) => t);
		
		// Extract call numbers (classification)
		const classArray = Array.isArray(mods.classification) ? mods.classification : (mods.classification ? [mods.classification] : []);
		let dewey_call_number = '';
		let lcc_call_number = '';
		
		classArray.forEach((cls: any) => {
			const text = cls['#text'] || cls;
			const authority = cls['@authority'];
			
			if (authority === 'ddc' || /^\d{3}/.test(text)) {
				dewey_call_number = text;
			} else if (authority === 'lcc' || /^[A-Z]/.test(text)) {
				lcc_call_number = text;
			}
		});
		
		// Extract identifiers
		const identifiers = Array.isArray(mods.identifier) ? mods.identifier : (mods.identifier ? [mods.identifier] : []);
		let recordISBN = '';
		let recordISSN = '';
		let recordLCCN = '';
		
		identifiers.forEach((id: any) => {
			const text = id['#text'] || id;
			const type = id['@type'];
			
			if (type === 'isbn') recordISBN = text;
			else if (type === 'issn') recordISSN = text;
			else if (type === 'lccn') recordLCCN = text;
		});
		
		// Extract physical description
		const physDesc = mods.physicalDescription;
		const extent = physDesc?.extent || '';
		
		// Extract TOC and abstract
		const toc = mods.tableOfContents || '';
		const abstract = mods.abstract || '';
		
		// Build bibliographic record
		const bibRecord: BibliographicRecord = {
			title: title_text,
			subtitle: subtitle_text,
			authors,
			publishers,
			publish_date,
			publish_places,
			isbn: recordISBN || isbn,
			issn: recordISSN,
			lccn: recordLCCN,
			dewey_call_number,
			lcc_call_number,
			subjects,
			summary: abstract,
			table_of_contents: toc,
			physical_description: extent,
			source: 'Harvard LibraryCloud',
			metadata_quality: 'high' // Academic library, high quality metadata
		};
		
		return {
			success: true,
			record: bibRecord,
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
		
	} catch (error) {
		console.error('Harvard LibraryCloud API error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
	}
}

// ========================================
// Google Books API (Enhanced)
// ========================================

/**
 * Enhanced Google Books lookup with digital links
 */
export async function lookupGoogleBooks(
	isbn?: string,
	title?: string,
	author?: string,
	options: LookupOptions = {}
): Promise<LookupResult> {
	const startTime = Date.now();
	const sources_tried = ['google'];
	
	try {
		if (!isbn && !title) {
			return {
				success: false,
				error: 'ISBN or title required',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		// Build query
		let query = '';
		if (isbn) {
			query = `isbn:${isbn.replace(/[-\s]/g, '')}`;
		} else if (title) {
			query = `intitle:${title}`;
			if (author) query += `+inauthor:${author}`;
		}
		
		const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`;
		
		const timeout = options.timeout || 10000;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		const response = await fetch(apiUrl, { signal: controller.signal });
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			return {
				success: false,
				error: `Google Books API returned ${response.status}`,
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		const data = await response.json();
		
		if (!data.items || data.items.length === 0) {
			return {
				success: false,
				error: 'No results found in Google Books',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		const book = data.items[0];
		const volumeInfo = book.volumeInfo;
		const accessInfo = book.accessInfo;
		
		// Build digital links
		const digitalLinks: DigitalLink[] = [];
		
		if (accessInfo?.viewability && accessInfo.viewability !== 'NO_PAGES') {
			let type: DigitalLink['type'] = 'metadata_only';
			let access: DigitalLink['access'] = 'restricted';
			
			if (accessInfo.viewability === 'ALL_PAGES') {
				type = 'full_view';
				access = 'public';
			} else if (accessInfo.viewability === 'PARTIAL') {
				type = 'limited_preview';
			} else if (accessInfo.viewability === 'SNIPPET') {
				type = 'snippet_view';
			}
			
			digitalLinks.push({
				url: volumeInfo.previewLink || volumeInfo.infoLink,
				provider: 'google',
				type,
				access
			});
		}
		
		// Extract subjects/categories
		const subjects = volumeInfo.categories || [];
		
		// Build record
		const bibRecord: BibliographicRecord = {
			title: volumeInfo.title,
			subtitle: volumeInfo.subtitle,
			authors: volumeInfo.authors || [],
			publishers: volumeInfo.publisher ? [volumeInfo.publisher] : [],
			publish_date: volumeInfo.publishedDate,
			isbn: volumeInfo.industryIdentifiers?.find((id: any) => id.type.includes('ISBN'))?.identifier,
			number_of_pages: volumeInfo.pageCount?.toString(),
			subjects,
			summary: volumeInfo.description,
			language: volumeInfo.language,
			cover_url: volumeInfo.imageLinks?.thumbnail,
			digital_links: digitalLinks.length > 0 ? digitalLinks : undefined,
			source: 'Google Books',
			metadata_quality: 'medium'
		};
		
		return {
			success: true,
			record: bibRecord,
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
		
	} catch (error) {
		console.error('Google Books API error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
	}
}

// ========================================
// Combined Lookup Strategy
// ========================================

/**
 * Lookup bibliographic data from multiple sources in parallel
 * Merges results to provide most complete record possible
 */
export async function lookupISBN(
	isbn: string,
	options: LookupOptions = {}
): Promise<LookupResult> {
	const startTime = Date.now();
	const sources_tried: string[] = [];
	
	try {
		const cleanISBN = isbn.replace(/[-\s]/g, '');
		
		// Query multiple sources in parallel for speed
		const results = await Promise.allSettled([
			lookupHathiTrust(cleanISBN, undefined, undefined, options),
			lookupGoogleBooks(cleanISBN, undefined, undefined, options)
		]);
		
		// Collect successful results
		const successfulResults: BibliographicRecord[] = [];
		
		results.forEach((result) => {
			if (result.status === 'fulfilled' && result.value.success && result.value.record) {
				successfulResults.push(result.value.record);
				sources_tried.push(...result.value.sources_tried);
			} else if (result.status === 'fulfilled') {
				sources_tried.push(...result.value.sources_tried);
			}
		});
		
		if (successfulResults.length === 0) {
			return {
				success: false,
				error: 'No results found from any source',
				sources_tried,
				response_time_ms: Date.now() - startTime
			};
		}
		
		// Merge results - prioritize higher quality metadata
		const mergedRecord = mergeRecords(successfulResults);
		
		return {
			success: true,
			record: mergedRecord,
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
		
	} catch (error) {
		console.error('Combined lookup error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			sources_tried,
			response_time_ms: Date.now() - startTime
		};
	}
}

/**
 * Merge multiple bibliographic records, preferring higher quality data
 */
function mergeRecords(records: BibliographicRecord[]): BibliographicRecord {
	if (records.length === 0) {
		throw new Error('No records to merge');
	}
	
	if (records.length === 1) {
		return records[0];
	}
	
	// Sort by metadata quality
	const sorted = records.sort((a, b) => {
		const qualityOrder = { high: 3, medium: 2, low: 1 };
		return (qualityOrder[b.metadata_quality || 'low'] || 0) - 
		       (qualityOrder[a.metadata_quality || 'low'] || 0);
	});
	
	// Start with highest quality record
	const merged: BibliographicRecord = { ...sorted[0] };
	
	// Merge in additional data from other records
	for (let i = 1; i < sorted.length; i++) {
		const record = sorted[i];
		
		// Use first available for each field
		merged.title = merged.title || record.title;
		merged.subtitle = merged.subtitle || record.subtitle;
		merged.publish_date = merged.publish_date || record.publish_date;
		merged.summary = merged.summary || record.summary;
		merged.table_of_contents = merged.table_of_contents || record.table_of_contents;
		merged.dewey_call_number = merged.dewey_call_number || record.dewey_call_number;
		merged.lcc_call_number = merged.lcc_call_number || record.lcc_call_number;
		merged.cover_url = merged.cover_url || record.cover_url;
		
		// Merge arrays (deduplicate)
		if (record.authors) {
			merged.authors = [...new Set([...(merged.authors || []), ...record.authors])];
		}
		if (record.subjects) {
			merged.subjects = [...new Set([...(merged.subjects || []), ...record.subjects])];
		}
		if (record.publishers) {
			merged.publishers = [...new Set([...(merged.publishers || []), ...record.publishers])];
		}
		
		// Merge digital links
		if (record.digital_links) {
			merged.digital_links = [...(merged.digital_links || []), ...record.digital_links];
		}
	}
	
	// Update source to indicate merged data
	merged.source = `Merged (${sorted.map(r => r.source).join(', ')})`;
	
	return merged;
}
