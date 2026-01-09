<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let browseMode = $state<'subjects' | 'authors' | 'call_numbers'>('subjects');
	let selectedLetter = $state<string | null>(null);
	let searchFilter = $state('');
	let headings = $state<Array<{ heading: string; count: number }>>([]);
	let loading = $state(true);
	let expandedHeading = $state<string | null>(null);
	let headingTitles = $state<any[]>([]);
	let loadingTitles = $state(false);

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

	onMount(async () => {
		await loadHeadings();
	});

	async function loadHeadings() {
		loading = true;
		headings = [];

		try {
			if (browseMode === 'subjects') {
				// Get all subject headings from marc_records
				const { data: records } = await data.supabase
					.from('marc_records')
					.select('subject_topical');

				// Extract and count subject headings
				const subjectCounts = new Map<string, number>();
				records?.forEach(record => {
					if (record.subject_topical && Array.isArray(record.subject_topical)) {
						record.subject_topical.forEach((subject: any) => {
							if (subject.a) {
								const heading = subject.a;
								subjectCounts.set(heading, (subjectCounts.get(heading) || 0) + 1);
							}
						});
					}
				});

				// Convert to array and sort
				headings = Array.from(subjectCounts.entries())
					.map(([heading, count]) => ({ heading, count }))
					.sort((a, b) => a.heading.localeCompare(b.heading));
			} else if (browseMode === 'authors') {
				// Get all author names from marc_records
				const { data: records } = await data.supabase
					.from('marc_records')
					.select('main_entry_personal_name');

				// Extract and count authors
				const authorCounts = new Map<string, number>();
				records?.forEach(record => {
					if (record.main_entry_personal_name?.a) {
						const heading = record.main_entry_personal_name.a;
						authorCounts.set(heading, (authorCounts.get(heading) || 0) + 1);
					}
				});

				// Convert to array and sort
				headings = Array.from(authorCounts.entries())
					.map(([heading, count]) => ({ heading, count }))
					.sort((a, b) => a.heading.localeCompare(b.heading));
			}
		} catch (error) {
			console.error('Error loading headings:', error);
		} finally {
			loading = false;
		}
	}

	async function expandHeading(heading: string) {
		if (expandedHeading === heading) {
			expandedHeading = null;
			headingTitles = [];
			return;
		}

		expandedHeading = heading;
		loadingTitles = true;

		try {
			if (browseMode === 'subjects') {
				// Find all records with this subject
				const { data: records } = await data.supabase
					.from('marc_records')
					.select('id, title_statement, main_entry_personal_name, publication_info, material_type, isbn')
					.contains('subject_topical', [{ a: heading }]);

				headingTitles = records || [];
			} else if (browseMode === 'authors') {
				// Find all records by this author
				const { data: records } = await data.supabase
					.from('marc_records')
					.select('id, title_statement, main_entry_personal_name, publication_info, material_type, isbn')
					.eq('main_entry_personal_name->>a', heading);

				headingTitles = records || [];
			}
		} catch (error) {
			console.error('Error loading titles:', error);
		} finally {
			loadingTitles = false;
		}
	}

	function changeBrowseMode(mode: 'subjects' | 'authors' | 'call_numbers') {
		browseMode = mode;
		selectedLetter = null;
		searchFilter = '';
		expandedHeading = null;
		headingTitles = [];
		loadHeadings();
	}

	function filterByLetter(letter: string | null) {
		selectedLetter = letter;
	}

	const filteredHeadings = $derived(() => {
		let result = headings;

		// Filter by selected letter
		if (selectedLetter) {
			result = result.filter(h => h.heading.toUpperCase().startsWith(selectedLetter!));
		}

		// Filter by search term
		if (searchFilter) {
			result = result.filter(h =>
				h.heading.toLowerCase().includes(searchFilter.toLowerCase())
			);
		}

		return result;
	});
</script>

<div class="browse-page">
	<header class="page-header">
		<div class="header-top">
			<a href="/catalog" class="back-link">← Back to Catalog</a>
		</div>
		<h1>Browse</h1>
		<p class="subtitle">Explore by subject headings, authors, and other catalog structures.</p>
	</header>

	<div class="browse-modes">
		<button
			class="mode-btn"
			class:active={browseMode === 'subjects'}
			onclick={() => changeBrowseMode('subjects')}
		>
			Subject Headings
		</button>
		<button
			class="mode-btn"
			class:active={browseMode === 'authors'}
			onclick={() => changeBrowseMode('authors')}
		>
			Authors
		</button>
		<button
			class="mode-btn disabled"
			class:active={browseMode === 'call_numbers'}
			disabled
		>
			Call Numbers
		</button>
	</div>

	<div class="browse-content">
		<div class="alphabet-nav">
			<button
				class="letter-btn"
				class:active={selectedLetter === null}
				onclick={() => filterByLetter(null)}
			>
				All
			</button>
			{#each alphabet as letter}
				<button
					class="letter-btn"
					class:active={selectedLetter === letter}
					onclick={() => filterByLetter(letter)}
				>
					{letter}
				</button>
			{/each}
		</div>

		<div class="search-filter">
			<input
				type="search"
				bind:value={searchFilter}
				placeholder="Filter {browseMode === 'subjects' ? 'subjects' : 'authors'}..."
			/>
		</div>

		{#if loading}
			<div class="loading-state">
				<p>Loading headings...</p>
			</div>
		{:else if filteredHeadings().length === 0}
			<div class="empty-state">
				<p>No headings found.</p>
			</div>
		{:else}
			<div class="headings-list">
				<p class="headings-count">
					{filteredHeadings().length} heading{filteredHeadings().length === 1 ? '' : 's'}
					{selectedLetter ? `starting with ${selectedLetter}` : ''}
				</p>

				{#each filteredHeadings() as { heading, count }}
					<div class="heading-item">
						<a
							class="heading-link"
							href="/catalog/search/results?{browseMode === 'subjects' ? 'subject' : 'author'}={encodeURIComponent(heading)}"
						>
							<div class="heading-content">
								<span class="heading-text">{heading}</span>
								<span class="heading-count">{count} title{count === 1 ? '' : 's'}</span>
							</div>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
							>
								<polyline points="9 18 15 12 9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.browse-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.header-top {
		margin-bottom: 1rem;
	}

	.back-link {
		color: #667eea;
		text-decoration: none;
		font-size: 0.95rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 1rem;
	}

	.browse-modes {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 2px solid #e0e0e0;
		padding-bottom: 0;
	}

	.mode-btn {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 500;
		color: #666;
		transition: all 0.2s;
		margin-bottom: -2px;
	}

	.mode-btn:hover:not(.disabled) {
		color: #667eea;
		border-bottom-color: #c5cae9;
	}

	.mode-btn.active {
		color: #667eea;
		border-bottom-color: #667eea;
	}

	.mode-btn.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.alphabet-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.letter-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: #666;
		transition: all 0.2s;
	}

	.letter-btn:hover {
		border-color: #667eea;
		color: #667eea;
	}

	.letter-btn.active {
		background: #667eea;
		color: white;
		border-color: #667eea;
	}

	.search-filter {
		margin-bottom: 1.5rem;
	}

	.search-filter input {
		width: 100%;
		padding: 0.875rem 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.search-filter input:focus {
		outline: none;
		border-color: #667eea;
	}

	.loading-state,
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #999;
	}

	.headings-count {
		margin: 0 0 1rem 0;
		color: #666;
		font-size: 0.875rem;
		padding: 0 0.5rem;
	}

	.headings-list {
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		overflow: hidden;
	}

	.heading-item {
		border-bottom: 1px solid #f0f0f0;
	}

	.heading-item:last-child {
		border-bottom: none;
	}

	.heading-link {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: white;
		text-decoration: none;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
	}

	.heading-link:hover {
		background: #f8f9fa;
	}

	.heading-link:hover .heading-text {
		color: #667eea;
	}

	.heading-link:hover svg {
		color: #667eea;
	}

	.heading-content {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.heading-text {
		font-size: 1rem;
		font-weight: 500;
		color: #2c3e50;
	}

	.heading-count {
		font-size: 0.875rem;
		color: #999;
		white-space: nowrap;
	}

	.heading-button svg {
		flex-shrink: 0;
		color: #999;
	}

	.titles-list {
		padding: 1rem 1.5rem 1.5rem;
		background: #fafafa;
		border-top: 1px solid #e8e8e8;
	}

	.loading-titles,
	.no-titles {
		margin: 0;
		padding: 1rem;
		text-align: center;
		color: #999;
		font-size: 0.875rem;
	}

	.title-item {
		padding: 0.875rem;
		background: white;
		border: 1px solid #e8e8e8;
		border-radius: 4px;
		margin-bottom: 0.75rem;
	}

	.title-item:last-child {
		margin-bottom: 0;
	}

	.title-link {
		display: block;
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}

	.title-link:hover {
		text-decoration: underline;
		color: #5568d3;
	}

	.title-author {
		margin: 0.25rem 0 0 0;
		color: #666;
		font-size: 0.875rem;
		font-style: italic;
	}

	.title-year {
		display: inline;
		margin: 0 0 0 0.5rem;
		color: #999;
		font-size: 0.875rem;
	}

	.material-badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		margin-top: 0.5rem;
	}

	@media (max-width: 768px) {
		.browse-page {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.alphabet-nav {
			gap: 0.25rem;
		}

		.letter-btn {
			width: 32px;
			height: 32px;
			font-size: 0.8125rem;
		}

		.heading-link {
			padding: 0.875rem 1rem;
		}

		.heading-text {
			font-size: 0.95rem;
		}

		.heading-count {
			font-size: 0.8125rem;
		}

		.titles-list {
			padding: 1rem;
		}
	}
</style>
