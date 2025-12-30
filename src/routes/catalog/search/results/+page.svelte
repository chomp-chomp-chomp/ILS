<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import FacetSidebar from './FacetSidebar.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import QRCode from 'qrcode';
	import { generateShortUrls, formatRecordsEmail, openMailto, canFitInEmail } from '$lib/utils/emailFormatter';

	let { data }: { data: PageData } = $props();

	// Pagination defaults
	const currentPage = $derived(data.page || 1);
	const currentPerPage = $derived(data.per_page || 20);

	let showFilters = $state(true);
	let mobileFiltersOpen = $state(false);
	let shareMenuOpen = $state(false);
	let shareModalOpen = $state(false);
	let showCopiedToast = $state(false);
	let exportModalOpen = $state(false);
	let qrCodeDataUrl = $state('');
	let searchShortUrl = $state('');
	let generatingShortUrl = $state(false);
	let selectedRecords = $state<string[]>([]);
	let emailingRecords = $state(false);
	let exportFields = $state({
		title: true,
		author: true,
		isbn: true,
		publisher: true,
		year: true,
		material_type: true,
		call_number: false,
		location: false,
		status: false
	});

	// Computed values
	let hasActiveFilters = $derived(
		(data.query.material_types?.length || 0) > 0 ||
			(data.query.languages?.length || 0) > 0 ||
			(data.query.availability?.length || 0) > 0 ||
			(data.query.locations?.length || 0) > 0
	);

	let queryDescription = $derived(getQueryDescription());

	function getQueryDescription(): string {
		const parts: string[] = [];

		if (data.query.q) {
			parts.push(`"${data.query.q}"`);
		}
		if (data.query.title) {
			parts.push(`Title: ${data.query.title}`);
		}
		if (data.query.author) {
			parts.push(`Author: ${data.query.author}`);
		}
		if (data.query.subject) {
			parts.push(`Subject: ${data.query.subject}`);
		}
		if (data.query.isbn) {
			parts.push(`ISBN: ${data.query.isbn}`);
		}
		if (data.query.publisher) {
			parts.push(`Publisher: ${data.query.publisher}`);
		}
		if (data.query.year_from || data.query.year_to) {
			const from = data.query.year_from || '...';
			const to = data.query.year_to || '...';
			parts.push(`Year: ${from}-${to}`);
		}

		return parts.join(' · ') || 'All items';
	}

	function updateUrl(updates: Record<string, any>) {
		const params = new URLSearchParams($page.url.search);

		Object.entries(updates).forEach(([key, value]) => {
			if (value === null || value === undefined || value === '' || value.length === 0) {
				params.delete(key);
			} else if (Array.isArray(value)) {
				params.delete(key);
				value.forEach((v) => params.append(key, v));
			} else {
				params.set(key, String(value));
			}
		});

		// Reset to page 1 when filters change
		if (!updates.page) {
			params.set('page', '1');
		}

		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	function changePage(newPage: number) {
		updateUrl({ page: newPage });
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function changeSort(newSort: string) {
		updateUrl({ sort: newSort });
	}

	function searchWithSuggestion(suggestion: string) {
		updateUrl({ q: suggestion, page: 1 });
	}

	function clearAllFilters() {
		updateUrl({
			material_types: null,
			languages: null,
			availability: null,
			locations: null,
			page: 1
		});
	}

	function toggleMobileFilters() {
		mobileFiltersOpen = !mobileFiltersOpen;
	}

	function toggleShareMenu() {
		shareMenuOpen = !shareMenuOpen;
	}

	async function generateSearchShortUrl(): Promise<string> {
		const fullUrl = window.location.href;

		try {
			const response = await fetch('/api/shorten', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullUrl,
					resourceType: 'search',
					resourceId: null
				})
			});

			if (response.ok) {
				const data = await response.json();
				return data.shortUrl;
			}
		} catch (error) {
			console.error('Failed to create short URL:', error);
		}

		// Fallback to full URL
		return fullUrl;
	}

	async function openShareModal() {
		shareModalOpen = true;
		shareMenuOpen = false;
		generatingShortUrl = true;

		try {
			// Generate short URL for the search
			const shortUrl = await generateSearchShortUrl();
			searchShortUrl = shortUrl;

			// Generate QR code with short URL
			const qrDataUrl = await QRCode.toDataURL(shortUrl, {
				width: 300,
				margin: 2,
				color: {
					dark: '#1a1a1a',
					light: '#ffffff'
				}
			});
			qrCodeDataUrl = qrDataUrl;
		} catch (err) {
			console.error('Failed to generate share content:', err);
			// Fallback to full URL
			searchShortUrl = window.location.href;
		} finally {
			generatingShortUrl = false;
		}
	}

	function closeShareModal() {
		shareModalOpen = false;
		qrCodeDataUrl = '';
		searchShortUrl = '';
	}

	async function copySearchLink() {
		try {
			// Generate short URL
			const shortUrl = await generateSearchShortUrl();
			await navigator.clipboard.writeText(shortUrl);
			showCopiedToast = true;
			shareMenuOpen = false;
			setTimeout(() => {
				showCopiedToast = false;
			}, 3000);
		} catch (err) {
			console.error('Failed to copy:', err);
			// Fallback for older browsers
			fallbackCopyTextToClipboard(window.location.href);
		}
	}

	async function downloadQRCode() {
		if (!qrCodeDataUrl) return;

		const link = document.createElement('a');
		link.download = `search-qr-${new Date().toISOString().split('T')[0]}.png`;
		link.href = qrCodeDataUrl;
		link.click();

		showCopiedToast = true;
		setTimeout(() => {
			showCopiedToast = false;
		}, 3000);
	}

	function fallbackCopyTextToClipboard(text: string) {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		try {
			document.execCommand('copy');
			showCopiedToast = true;
			shareMenuOpen = false;
			setTimeout(() => {
				showCopiedToast = false;
			}, 3000);
		} catch (err) {
			console.error('Fallback: Could not copy text');
		}
		document.body.removeChild(textArea);
	}

	async function shareViaEmail() {
		const shortUrl = await generateSearchShortUrl();
		const subject = encodeURIComponent(`Library Search: ${queryDescription}`);
		const body = encodeURIComponent(
			`I found this search in the library catalog:\n\n${queryDescription}\n\n${shortUrl}`
		);
		window.location.href = `mailto:?subject=${subject}&body=${body}`;
		shareMenuOpen = false;
	}

	function toggleExportModal() {
		exportModalOpen = !exportModalOpen;
	}

	async function emailSelectedRecords() {
		if (selectedRecords.length === 0) {
			alert('Please select at least one record to email.');
			return;
		}

		// Check if selection fits in email
		const { fits, maxRecords } = canFitInEmail(selectedRecords.length);
		if (!fits) {
			alert(`Too many records selected. Maximum ${maxRecords} records can fit in an email. Please select fewer records.`);
			return;
		}

		emailingRecords = true;

		try {
			// Get origin for URLs
			const origin = window.location.origin;

			// Generate short URLs for selected records
			const shortUrls = await generateShortUrls(selectedRecords, origin);

			// Format records for email
			const recordsForEmail = selectedRecords.map(id => {
				const record = data.results.find(r => r.id === id);
				return {
					id,
					title: record?.title_statement?.a || 'Untitled',
					author: record?.main_entry_personal_name?.a,
					shortUrl: shortUrls.get(id)
				};
			});

			// Generate short URL for search
			const searchUrl = await generateSearchShortUrl();

			// Format and open mailto
			const { subject, body } = formatRecordsEmail(recordsForEmail, searchUrl);
			openMailto(subject, body);

			// Clear selection after sending
			setTimeout(() => {
				selectedRecords = [];
			}, 1000);
		} catch (error) {
			console.error('Error emailing records:', error);
			alert('Failed to prepare email. Please try again.');
		} finally {
			emailingRecords = false;
		}
	}

	function toggleRecordSelection(recordId: string) {
		if (selectedRecords.includes(recordId)) {
			selectedRecords = selectedRecords.filter(id => id !== recordId);
		} else {
			selectedRecords = [...selectedRecords, recordId];
		}
	}

	function selectAllRecords() {
		selectedRecords = data.results.map(r => r.id);
	}

	function clearSelection() {
		selectedRecords = [];
	}

	function exportToCSV() {
		// Generate CSV from current results
		const headers: string[] = [];
		const fieldKeys: string[] = [];

		if (exportFields.title) {
			headers.push('Title');
			fieldKeys.push('title');
		}
		if (exportFields.author) {
			headers.push('Author');
			fieldKeys.push('author');
		}
		if (exportFields.isbn) {
			headers.push('ISBN');
			fieldKeys.push('isbn');
		}
		if (exportFields.publisher) {
			headers.push('Publisher');
			fieldKeys.push('publisher');
		}
		if (exportFields.year) {
			headers.push('Publication Year');
			fieldKeys.push('year');
		}
		if (exportFields.material_type) {
			headers.push('Material Type');
			fieldKeys.push('material_type');
		}
		if (exportFields.call_number) {
			headers.push('Call Number');
			fieldKeys.push('call_number');
		}
		if (exportFields.location) {
			headers.push('Location');
			fieldKeys.push('location');
		}
		if (exportFields.status) {
			headers.push('Status');
			fieldKeys.push('status');
		}

		// Build CSV content
		let csvContent = headers.map((h) => `"${h}"`).join(',') + '\n';

		data.results.forEach((record) => {
			const row: string[] = [];

			fieldKeys.forEach((key) => {
				let value = '';
				switch (key) {
					case 'title':
						value = record.title_statement?.a || '';
						break;
					case 'author':
						value = record.main_entry_personal_name?.a || '';
						break;
					case 'isbn':
						value = record.isbn || '';
						break;
					case 'publisher':
						value = record.publication_info?.b || '';
						break;
					case 'year':
						value = record.publication_info?.c || '';
						break;
					case 'material_type':
						value = record.material_type || '';
						break;
					case 'call_number':
						value = record.items?.[0]?.call_number || '';
						break;
					case 'location':
						value =
							record.items?.map((item: any) => item.location).filter(Boolean).join('; ') || '';
						break;
					case 'status':
						value =
							record.items?.map((item: any) => item.status).filter(Boolean).join('; ') || '';
						break;
				}
				// Escape quotes and wrap in quotes
				value = value.replace(/"/g, '""');
				row.push(`"${value}"`);
			});

			csvContent += row.join(',') + '\n';
		});

		// Trigger download
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		const filename = `search-results-${new Date().toISOString().split('T')[0]}.csv`;

		link.setAttribute('href', url);
		link.setAttribute('download', filename);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		exportModalOpen = false;
	}

	// Calculate pagination
	const totalPages = $derived(Math.ceil(data.total / currentPerPage));
	const startResult = $derived((currentPage - 1) * currentPerPage + 1);
	const endResult = $derived(Math.min(currentPage * currentPerPage, data.total));
</script>

<div class="search-results-page">
	<!-- Header -->
	<header class="search-header" role="banner">
		<div class="header-top">
			<h1 id="results-heading">Search Results</h1>
			<button
				class="mobile-filter-toggle"
				onclick={toggleMobileFilters}
				aria-label="Toggle filters"
				aria-expanded={mobileFiltersOpen}
				aria-controls="filter-sidebar"
			>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
					/>
				</svg>
				Filters
				{#if hasActiveFilters}
					<span class="filter-badge" aria-label="{(data.query.material_types?.length || 0) + (data.query.languages?.length || 0) + (data.query.availability?.length || 0) + (data.query.locations?.length || 0)} active filters">{(data.query.material_types?.length || 0) + (data.query.languages?.length || 0) + (data.query.availability?.length || 0) + (data.query.locations?.length || 0)}</span>
				{/if}
			</button>
		</div>

		<div class="query-display">
			<div class="query-display-top">
				<div>
					<p class="query-text">{queryDescription}</p>
					{#if data.total > 0}
						<p class="results-count">
							{data.total.toLocaleString()} result{data.total === 1 ? '' : 's'}
							{#if totalPages > 1}
								· Page {currentPage} of {totalPages}
							{/if}
						</p>
					{/if}
				</div>
				<div class="share-button-container">
					<button
						class="share-button"
						onclick={toggleShareMenu}
						aria-label="Share search results"
						aria-expanded={shareMenuOpen}
						aria-haspopup="menu"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
							<circle cx="18" cy="5" r="3" stroke-width="2" />
							<circle cx="6" cy="12" r="3" stroke-width="2" />
							<circle cx="18" cy="19" r="3" stroke-width="2" />
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke-width="2" />
							<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke-width="2" />
						</svg>
						Share Search
					</button>
					{#if shareMenuOpen}
						<div class="share-menu">
							<button class="share-menu-item" onclick={copySearchLink}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
									<path
										d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								Copy Link
							</button>
							<button class="share-menu-item" onclick={openShareModal}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
									<rect
										x="3"
										y="3"
										width="18"
										height="18"
										rx="2"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<rect x="7" y="7" width="3" height="3" fill="currentColor" />
									<rect x="14" y="7" width="3" height="3" fill="currentColor" />
									<rect x="7" y="14" width="3" height="3" fill="currentColor" />
									<rect x="14" y="14" width="3" height="3" fill="currentColor" />
								</svg>
								QR Code
							</button>
							<button class="share-menu-item" onclick={shareViaEmail}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
									<path
										d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<polyline
										points="22,6 12,13 2,6"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								Share via Email
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Spell Suggestion -->
		{#if data.spellSuggestion}
			<div class="spell-suggestion">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<circle cx="12" cy="12" r="10" stroke-width="2" />
					<path d="M12 16h.01M12 8v4" stroke-width="2" stroke-linecap="round" />
				</svg>
				<span class="suggestion-text">Did you mean:</span>
				<button
					class="suggestion-link"
					onclick={() => searchWithSuggestion(data.spellSuggestion!.suggested_query)}
				>
					{data.spellSuggestion.suggested_query}
				</button>
				<span class="suggestion-confidence"
					>({Math.round(data.spellSuggestion.confidence * 100)}% match)</span
				>
			</div>
		{/if}

		{#if hasActiveFilters}
			<div class="active-filters-bar">
				<span class="active-filters-label">Active filters:</span>
				{#if data.query.material_types && data.query.material_types.length > 0}
					{#each data.query.material_types as type}
						<button
							class="filter-tag"
							onclick={() =>
								updateUrl({
									material_types: data.query.material_types?.filter((t) => t !== type)
								})}
						>
							{type}
							<span class="remove-icon">×</span>
						</button>
					{/each}
				{/if}
				{#if data.query.languages && data.query.languages.length > 0}
					{#each data.query.languages as lang}
						<button
							class="filter-tag"
							onclick={() =>
								updateUrl({ languages: data.query.languages?.filter((l) => l !== lang) })}
						>
							{lang}
							<span class="remove-icon">×</span>
						</button>
					{/each}
				{/if}
				{#if data.query.availability && data.query.availability.length > 0}
					{#each data.query.availability as avail}
						<button
							class="filter-tag"
							onclick={() =>
								updateUrl({
									availability: data.query.availability?.filter((a) => a !== avail)
								})}
						>
							{avail}
							<span class="remove-icon">×</span>
						</button>
					{/each}
				{/if}
				{#if data.query.locations && data.query.locations.length > 0}
					{#each data.query.locations as loc}
						<button
							class="filter-tag"
							onclick={() =>
								updateUrl({ locations: data.query.locations?.filter((l) => l !== loc) })}
						>
							{loc}
							<span class="remove-icon">×</span>
						</button>
					{/each}
				{/if}
				<button class="clear-all-btn" onclick={clearAllFilters}>Clear all</button>
			</div>
		{/if}
	</header>

	<!-- Main Content Area -->
	<div class="content-wrapper">
		<!-- Sidebar with Facets -->
		<aside class="sidebar" class:mobile-open={mobileFiltersOpen}>
			<div class="sidebar-header">
				<h2>Refine Results</h2>
				<button class="mobile-close" onclick={toggleMobileFilters}>×</button>
			</div>
			<FacetSidebar facets={data.facets} currentFilters={data.query} onFilterChange={updateUrl} />
		</aside>

		<!-- Results Area -->
		<main class="results-area">
			{#if data.results.length === 0}
				<div class="no-results">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="11" cy="11" r="8" stroke-width="2" />
						<path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round" />
						<path d="M11 8v6M8 11h6" stroke-width="2" stroke-linecap="round" />
					</svg>
					<h3>No results found</h3>
					<p>Try adjusting your filters or search terms</p>
					{#if hasActiveFilters}
						<button class="btn-primary" onclick={clearAllFilters}>Clear all filters</button>
					{/if}
					<a href="/catalog/search/advanced" class="btn-secondary">Try Advanced Search</a>
				</div>
			{:else}
				<!-- Sort Controls -->
				<div class="controls-bar">
					<div class="sort-controls">
						<label for="sort">Sort by:</label>
						<select
							id="sort"
							value={data.query.sort || 'relevance'}
							onchange={(e) => changeSort(e.currentTarget.value)}
						>
							<option value="relevance">Relevance</option>
							<option value="title">Title (A-Z)</option>
							<option value="author">Author (A-Z)</option>
							<option value="date_new">Newest First</option>
							<option value="date_old">Oldest First</option>
						</select>
					</div>
					<div class="view-controls">
						<span class="results-range"
							>Showing {startResult}-{endResult} of {data.total.toLocaleString()}</span
						>
						{#if selectedRecords.length > 0}
							<button class="email-btn" onclick={emailSelectedRecords} disabled={emailingRecords} aria-label="Email {selectedRecords.length} selected records">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
									<path
										d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<polyline
										points="22,6 12,13 2,6"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								{#if emailingRecords}
									Preparing...
								{:else}
									Email ({selectedRecords.length})
								{/if}
							</button>
						{/if}
						<button class="export-btn" onclick={toggleExportModal} aria-label="Export search results to CSV">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
								<path
									d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<polyline
									points="7 10 12 15 17 10"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<line
									x1="12"
									y1="15"
									x2="12"
									y2="3"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							Export
						</button>
					</div>
				</div>

				<!-- Results List -->
				<div class="results-list">
					{#each data.results as record}
						<article class="result-card" class:selected={selectedRecords.includes(record.id)}>
							<div class="result-checkbox">
								<input
									type="checkbox"
									id="select-{record.id}"
									checked={selectedRecords.includes(record.id)}
									onchange={() => toggleRecordSelection(record.id)}
									aria-label="Select {record.title_statement?.a || 'Untitled'}"
								/>
							</div>
							<div class="result-cover">
								<BookCover isbn={record.isbn} size="medium" />
							</div>
							<div class="result-content">
								<h3>
									<a href="/catalog/record/{record.id}">
										{record.title_statement?.a || 'Untitled'}
									</a>
								</h3>
								{#if record.title_statement?.b}
									<p class="subtitle">{record.title_statement.b}</p>
								{/if}
								{#if record.main_entry_personal_name?.a}
									<p class="author">
										by <a
											href="/catalog/search/results?author={encodeURIComponent(
												record.main_entry_personal_name.a
											)}"
											class="author-link">{record.main_entry_personal_name.a}</a
										>
									</p>
								{/if}
								{#if record.publication_info}
									<p class="publication">
										{#if record.publication_info.b}
											{record.publication_info.b}
										{/if}
										{#if record.publication_info.c}
											{#if record.publication_info.b}, {/if}{record.publication_info.c}
										{/if}
									</p>
								{/if}
								{#if record.series_statement?.a}
									<p class="series">
										Series: <a
											href="/catalog/search/results?q={encodeURIComponent(record.series_statement.a)}"
											class="series-link">{record.series_statement.a}</a
										>
										{#if record.series_statement?.v}
											; {record.series_statement.v}
										{/if}
									</p>
								{/if}
								{#if record.items && record.items.some((item: any) => item.is_electronic && item.url)}
									{@const electronicItem = record.items.find((item: any) => item.is_electronic && item.url)}
									<p class="electronic-access">
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											style="display: inline; vertical-align: middle; margin-right: 4px;"
										>
											<circle cx="12" cy="12" r="10" stroke-width="2" />
											<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" />
											<path
												d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
												stroke-width="2"
											/>
										</svg>
										<a
											href={electronicItem.url}
											target="_blank"
											rel="noopener noreferrer"
											class="url-link">Electronic Resource</a
										>
									</p>
								{/if}
								{#if record.summary}
									<p class="summary">
										{record.summary.length > 250
											? record.summary.substring(0, 250) + '...'
											: record.summary}
									</p>
								{/if}
								<div class="result-badges">
									{#if record.material_type}
										<span class="badge type">{record.material_type}</span>
									{/if}
									{#if record.language_code}
										<span class="badge lang">{record.language_code}</span>
									{/if}
									{#if record.items && record.items.length > 0}
										{@const availableItems = record.items.filter((item: any) => item.status === 'available')}
										{#if availableItems.length > 0}
											<span class="badge available"
												>{availableItems.length} available</span
											>
										{:else}
											<span class="badge unavailable">Checked out</span>
										{/if}
									{/if}
								</div>
							</div>
						</article>
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<nav class="pagination" aria-label="Search results pagination">
						<button
							class="page-btn"
							disabled={currentPage === 1}
							onclick={() => changePage(currentPage - 1)}
						>
							← Previous
						</button>

						<div class="page-numbers">
							{#each Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
								if (totalPages <= 7) return i + 1;
								if (currentPage <= 4) return i + 1;
								if (currentPage >= totalPages - 3) return totalPages - 6 + i;
								return currentPage - 3 + i;
							}) as pageNum}
								<button
									class="page-btn"
									class:active={pageNum === currentPage}
									onclick={() => changePage(pageNum)}
								>
									{pageNum}
								</button>
							{/each}
						</div>

						<button
							class="page-btn"
							disabled={currentPage === totalPages}
							onclick={() => changePage(currentPage + 1)}
						>
							Next →
						</button>
					</nav>
				{/if}
			{/if}
		</main>
	</div>
</div>

<!-- Mobile filter overlay -->
{#if mobileFiltersOpen}
	<div class="mobile-overlay" onclick={toggleMobileFilters}></div>
{/if}

<!-- Share menu overlay -->
{#if shareMenuOpen}
	<div class="share-overlay" onclick={toggleShareMenu}></div>
{/if}

<!-- Export Modal -->
{#if exportModalOpen}
	<div class="modal-overlay" onclick={toggleExportModal}></div>
	<div class="modal">
		<div class="modal-header">
			<h2>Export Search Results</h2>
			<button class="modal-close" onclick={toggleExportModal}>×</button>
		</div>
		<div class="modal-body">
			<p class="modal-description">
				Select which fields to include in your CSV export. Exporting {data.results.length} result{data.results
					.length === 1
					? ''
					: 's'} from this page.
			</p>
			<div class="export-fields">
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.title} />
					<span>Title</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.author} />
					<span>Author</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.isbn} />
					<span>ISBN</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.publisher} />
					<span>Publisher</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.year} />
					<span>Publication Year</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.material_type} />
					<span>Material Type</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.call_number} />
					<span>Call Number</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.location} />
					<span>Location</span>
				</label>
				<label class="export-field-item">
					<input type="checkbox" bind:checked={exportFields.status} />
					<span>Availability Status</span>
				</label>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-secondary" onclick={toggleExportModal}>Cancel</button>
			<button class="btn-primary" onclick={exportToCSV}>Download CSV</button>
		</div>
	</div>
{/if}

<!-- Share Modal with QR Code -->
{#if shareModalOpen}
	<div class="modal-overlay" onclick={closeShareModal}></div>
	<div class="modal share-modal">
		<div class="modal-header">
			<h2>Share This Search</h2>
			<button class="modal-close" onclick={closeShareModal}>×</button>
		</div>
		<div class="modal-body">
			<p class="modal-description">
				Share this search with others using the link below or scan the QR code with a mobile device.
			</p>

			<div class="share-url-section">
				<label for="share-url">Search URL {#if generatingShortUrl}<span class="generating-label">(generating...)</span>{/if}</label>
				<div class="url-input-group">
					<input
						id="share-url"
						type="text"
						readonly
						value={searchShortUrl || 'Generating short URL...'}
						onclick={(e) => e.currentTarget.select()}
					/>
					<button class="copy-url-btn" onclick={copySearchLink} disabled={generatingShortUrl}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<rect
								x="9"
								y="9"
								width="13"
								height="13"
								rx="2"
								ry="2"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Copy
					</button>
				</div>
			</div>

			{#if qrCodeDataUrl}
				<div class="qr-code-section">
					<label>QR Code</label>
					<div class="qr-code-container">
						<img src={qrCodeDataUrl} alt="QR Code for this search" class="qr-code-image" />
						<p class="qr-code-hint">Scan with your phone to open this search</p>
					</div>
					<button class="download-qr-btn" onclick={downloadQRCode}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<polyline
								points="7 10 12 15 17 10"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<line
								x1="12"
								y1="15"
								x2="12"
								y2="3"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Download QR Code
					</button>
				</div>
			{/if}

			<div class="share-search-info">
				<h3>Search Parameters</h3>
				<div class="search-params">
					{#if data.query.q}
						<div class="param-item">
							<span class="param-label">Keywords:</span>
							<span class="param-value">{data.query.q}</span>
						</div>
					{/if}
					{#if data.query.title}
						<div class="param-item">
							<span class="param-label">Title:</span>
							<span class="param-value">{data.query.title}</span>
						</div>
					{/if}
					{#if data.query.author}
						<div class="param-item">
							<span class="param-label">Author:</span>
							<span class="param-value">{data.query.author}</span>
						</div>
					{/if}
					{#if data.query.material_types && data.query.material_types.length > 0}
						<div class="param-item">
							<span class="param-label">Material Types:</span>
							<span class="param-value">{data.query.material_types.join(', ')}</span>
						</div>
					{/if}
					{#if data.total}
						<div class="param-item">
							<span class="param-label">Results:</span>
							<span class="param-value">{data.total.toLocaleString()} items</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-secondary" onclick={closeShareModal}>Close</button>
			<button class="btn-primary" onclick={shareViaEmail}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path
						d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<polyline
						points="22,6 12,13 2,6"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				Email Link
			</button>
		</div>
	</div>
{/if}

<!-- Copy confirmation toast -->
{#if showCopiedToast}
	<div class="toast">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Link copied to clipboard!
	</div>
{/if}

<style>
	.search-results-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1rem;
		min-height: 100vh;
	}

	.search-header {
		margin-bottom: 2rem;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
	}

	.mobile-filter-toggle {
		display: none;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		position: relative;
	}

	.mobile-filter-toggle:hover {
		background: #5568d3;
	}

	.filter-badge {
		position: absolute;
		top: -6px;
		right: -6px;
		background: #f44336;
		color: white;
		border-radius: 10px;
		padding: 2px 6px;
		font-size: 0.75rem;
		font-weight: bold;
		min-width: 20px;
		text-align: center;
	}

	.query-display {
		margin-bottom: 1rem;
	}

	.query-display-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.query-text {
		font-size: 1.125rem;
		color: #333;
		margin: 0 0 0.5rem 0;
	}

	.results-count {
		color: #666;
		margin: 0;
		font-size: 0.875rem;
	}

	.share-button-container {
		position: relative;
	}

	.share-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		color: #333;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.share-button:hover {
		border-color: #667eea;
		color: #667eea;
	}

	.share-button svg {
		flex-shrink: 0;
	}

	.share-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 200px;
		z-index: 1001;
		overflow: hidden;
	}

	.share-menu-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: white;
		border: none;
		color: #333;
		cursor: pointer;
		font-size: 0.875rem;
		text-align: left;
		transition: background 0.2s;
	}

	.share-menu-item:hover {
		background: #f8f9fa;
	}

	.share-menu-item svg {
		flex-shrink: 0;
		color: #667eea;
	}

	.share-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: transparent;
		z-index: 1000;
	}

	.toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: #2e7d32;
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		z-index: 2000;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			transform: translateX(-50%) translateY(100px);
			opacity: 0;
		}
		to {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
		}
	}

	.toast svg {
		flex-shrink: 0;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		overflow: hidden;
		z-index: 2001;
		animation: modalSlideIn 0.3s ease-out;
	}

	@keyframes modalSlideIn {
		from {
			transform: translate(-50%, -60%);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%);
			opacity: 1;
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.modal-close:hover {
		background: #f0f0f0;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		max-height: calc(80vh - 180px);
	}

	.modal-description {
		margin: 0 0 1.5rem 0;
		color: #666;
		font-size: 0.875rem;
	}

	.export-fields {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.export-field-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.export-field-item:hover {
		background: #f8f9fa;
	}

	.export-field-item input[type='checkbox'] {
		cursor: pointer;
	}

	.export-field-item span {
		font-size: 0.875rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	.spell-suggestion {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
		border: 1px solid #ffb74d;
		border-radius: 8px;
		margin-bottom: 1rem;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.spell-suggestion svg {
		color: #f57c00;
		flex-shrink: 0;
	}

	.suggestion-text {
		font-size: 0.875rem;
		color: #e65100;
		font-weight: 500;
	}

	.suggestion-link {
		background: none;
		border: none;
		color: #1565c0;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		transition: color 0.2s;
	}

	.suggestion-link:hover {
		color: #0d47a1;
	}

	.suggestion-confidence {
		font-size: 0.75rem;
		color: #f57c00;
		font-style: italic;
	}

	.active-filters-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
	}

	.active-filters-label {
		font-weight: 600;
		font-size: 0.875rem;
		color: #666;
	}

	.filter-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 16px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.filter-tag:hover {
		background: #5568d3;
	}

	.remove-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.clear-all-btn {
		padding: 0.375rem 0.75rem;
		background: transparent;
		color: #667eea;
		border: 1px solid #667eea;
		border-radius: 16px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-all-btn:hover {
		background: #667eea;
		color: white;
	}

	.content-wrapper {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 2rem;
	}

	.sidebar {
		position: sticky;
		top: 1rem;
		height: fit-content;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.mobile-close {
		display: none;
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		line-height: 1;
	}

	.results-area {
		min-width: 0;
	}

	.controls-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.sort-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-controls label {
		font-size: 0.875rem;
		color: #666;
	}

	.sort-controls select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.view-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.results-range {
		font-size: 0.875rem;
		color: #666;
	}

	.export-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.export-btn:hover {
		background: #5568d3;
	}

	.export-btn svg {
		flex-shrink: 0;
	}

	.email-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.email-btn:hover {
		background: #c62828;
	}

	.email-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.email-btn svg {
		flex-shrink: 0;
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.result-card {
		display: grid;
		grid-template-columns: 40px 120px 1fr;
		gap: 1.5rem;
		padding: 1.5rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		transition: all 0.2s;
	}

	.result-card:hover {
		border-color: #667eea;
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
	}

	.result-card.selected {
		border-color: #e73b42;
		background: #fff5f5;
		box-shadow: 0 2px 8px rgba(231, 59, 66, 0.15);
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
		accent-color: #e73b42;
	}

	.result-checkbox input[type="checkbox"]:focus {
		outline: 2px solid #667eea;
		outline-offset: 2px;
	}

	.result-cover {
		width: 120px;
	}

	.result-content {
		min-width: 0;
	}

	.result-content h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.result-content h3 a {
		color: #2c3e50;
		text-decoration: none;
	}

	.result-content h3 a:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.subtitle {
		margin: 0 0 0.5rem 0;
		color: #666;
		font-style: italic;
		font-size: 1rem;
	}

	.author {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 0.875rem;
	}

	.author-link {
		color: #667eea;
		text-decoration: none;
		transition: color 0.2s;
	}

	.author-link:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.publication {
		margin: 0 0 0.75rem 0;
		color: #666;
		font-size: 0.875rem;
	}

	.series {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 0.875rem;
	}

	.series-link {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.series-link:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.electronic-access {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #2e7d32;
	}

	.url-link {
		color: #2e7d32;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.url-link:hover {
		color: #1b5e20;
		text-decoration: underline;
	}

	.summary {
		margin: 0 0 1rem 0;
		color: #666;
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.result-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge.type {
		background: #e3f2fd;
		color: #1976d2;
	}

	.badge.lang {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.badge.available {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.badge.unavailable {
		background: #ffebee;
		color: #c62828;
	}

	.no-results {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.no-results svg {
		color: #ccc;
		margin-bottom: 1rem;
	}

	.no-results h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.no-results p {
		margin: 0 0 1.5rem 0;
		color: #666;
	}

	.btn-primary,
	.btn-secondary {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		margin: 0.5rem;
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

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-top: 3rem;
		padding: 1.5rem;
	}

	.page-numbers {
		display: flex;
		gap: 0.25rem;
	}

	.page-btn {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		background: white;
		color: #333;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.page-btn:hover:not(:disabled) {
		border-color: #667eea;
		color: #667eea;
	}

	.page-btn.active {
		background: #667eea;
		color: white;
		border-color: #667eea;
	}

	.page-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Share Modal Styles */
	.share-modal {
		max-width: 600px;
	}

	.share-url-section {
		margin-bottom: 2rem;
	}

	.share-url-section label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #333;
		font-size: 0.875rem;
	}

	.generating-label {
		font-weight: 400;
		color: #666;
		font-style: italic;
		font-size: 0.75rem;
	}

	.url-input-group {
		display: flex;
		gap: 0.5rem;
	}

	.url-input-group input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.875rem;
		font-family: 'Courier New', monospace;
		background: #f8f9fa;
		color: #333;
	}

	.url-input-group input:focus {
		outline: none;
		border-color: #667eea;
		background: white;
	}

	.copy-url-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.2s;
		white-space: nowrap;
	}

	.copy-url-btn:hover {
		background: #5568d3;
	}

	.copy-url-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.qr-code-section {
		margin-bottom: 2rem;
	}

	.qr-code-section label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: #333;
		font-size: 0.875rem;
	}

	.qr-code-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.qr-code-image {
		width: 300px;
		height: 300px;
		border: 8px solid white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.qr-code-hint {
		margin: 1rem 0 0 0;
		font-size: 0.875rem;
		color: #666;
		text-align: center;
	}

	.download-qr-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: white;
		color: #667eea;
		border: 2px solid #667eea;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.download-qr-btn:hover {
		background: #667eea;
		color: white;
	}

	.share-search-info {
		padding: 1.5rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.share-search-info h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #333;
	}

	.search-params {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.param-item {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.param-label {
		font-weight: 600;
		color: #666;
		min-width: 120px;
	}

	.param-value {
		color: #333;
		flex: 1;
	}

	.mobile-overlay {
		display: none;
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.search-results-page {
			padding: 0.5rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.mobile-filter-toggle {
			display: flex;
		}

		.content-wrapper {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: fixed;
			top: 0;
			left: -100%;
			width: 80%;
			max-width: 320px;
			height: 100vh;
			background: white;
			z-index: 1000;
			padding: 1rem;
			transition: left 0.3s ease;
			overflow-y: auto;
		}

		.sidebar.mobile-open {
			left: 0;
		}

		.mobile-close {
			display: block;
		}

		.mobile-overlay {
			display: block;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 999;
		}

		.result-card {
			grid-template-columns: 30px 80px 1fr;
			gap: 1rem;
			padding: 1rem;
		}

		.result-checkbox input[type="checkbox"] {
			width: 18px;
			height: 18px;
		}

		.result-cover {
			width: 80px;
		}

		.result-content h3 {
			font-size: 1.125rem;
		}

		.controls-bar {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.sort-controls {
			width: 100%;
		}

		.sort-controls select {
			flex: 1;
		}

		.view-controls {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.export-btn,
		.email-btn {
			width: 100%;
			justify-content: center;
		}

		.export-fields {
			grid-template-columns: 1fr;
		}

		.modal {
			width: 95%;
			max-height: 90vh;
		}

		.page-numbers {
			flex-wrap: wrap;
		}

		.query-display-top {
			flex-direction: column;
			gap: 0.75rem;
		}

		.share-button-container {
			width: 100%;
		}

		.share-button {
			width: 100%;
			justify-content: center;
		}

		.share-menu {
			left: 0;
			right: 0;
		}

		.toast {
			left: 1rem;
			right: 1rem;
			transform: none;
		}

		@keyframes slideUp {
			from {
				transform: translateY(100px);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}
	}
</style>
