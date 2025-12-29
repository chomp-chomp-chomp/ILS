<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import FacetSidebar from './FacetSidebar.svelte';
	import BookCover from '$lib/components/BookCover.svelte';

	let { data }: { data: PageData } = $props();

	let showFilters = $state(true);
	let mobileFiltersOpen = $state(false);

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

	// Calculate pagination
	const totalPages = $derived(Math.ceil(data.total / data.per_page));
	const startResult = $derived((data.page - 1) * data.per_page + 1);
	const endResult = $derived(Math.min(data.page * data.per_page, data.total));
</script>

<div class="search-results-page">
	<!-- Header -->
	<header class="search-header">
		<div class="header-top">
			<h1>Search Results</h1>
			<button class="mobile-filter-toggle" onclick={toggleMobileFilters}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
					<path
						d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
					/>
				</svg>
				Filters
				{#if hasActiveFilters}
					<span class="filter-badge">{(data.query.material_types?.length || 0) + (data.query.languages?.length || 0) + (data.query.availability?.length || 0) + (data.query.locations?.length || 0)}</span>
				{/if}
			</button>
		</div>

		<div class="query-display">
			<p class="query-text">{queryDescription}</p>
			{#if data.total > 0}
				<p class="results-count">
					{data.total.toLocaleString()} result{data.total === 1 ? '' : 's'}
					{#if totalPages > 1}
						· Page {data.page} of {totalPages}
					{/if}
				</p>
			{/if}
		</div>

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
					</div>
				</div>

				<!-- Results List -->
				<div class="results-list">
					{#each data.results as record}
						<article class="result-card">
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
									<p class="author">by {record.main_entry_personal_name.a}</p>
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
										{@const availableItems = record.items.filter((item) => item.status === 'available')}
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
							disabled={data.page === 1}
							onclick={() => changePage(data.page - 1)}
						>
							← Previous
						</button>

						<div class="page-numbers">
							{#each Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
								if (totalPages <= 7) return i + 1;
								if (data.page <= 4) return i + 1;
								if (data.page >= totalPages - 3) return totalPages - 6 + i;
								return data.page - 3 + i;
							}) as pageNum}
								<button
									class="page-btn"
									class:active={pageNum === data.page}
									onclick={() => changePage(pageNum)}
								>
									{pageNum}
								</button>
							{/each}
						</div>

						<button
							class="page-btn"
							disabled={data.page === totalPages}
							onclick={() => changePage(data.page + 1)}
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

	.results-range {
		font-size: 0.875rem;
		color: #666;
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.result-card {
		display: grid;
		grid-template-columns: 120px 1fr;
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

	.publication {
		margin: 0 0 0.75rem 0;
		color: #666;
		font-size: 0.875rem;
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
			grid-template-columns: 80px 1fr;
			gap: 1rem;
			padding: 1rem;
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

		.page-numbers {
			flex-wrap: wrap;
		}
	}
</style>
