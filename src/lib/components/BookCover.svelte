<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		recordId?: string;
		isbn?: string;
		title?: string;
		author?: string;
		customCoverUrl?: string | null;
		size?: 'small' | 'medium' | 'large';
		showPlaceholder?: boolean;
		lazyLoad?: boolean;
		enableZoom?: boolean;
	}

	let {
		recordId,
		isbn,
		title,
		author,
		customCoverUrl,
		size = 'medium',
		showPlaceholder = true,
		lazyLoad = true,
		enableZoom = false
	}: Props = $props();

	let coverUrl = $state<string | null>(null);
	let thumbnailUrl = $state<string | null>(null);
	let loading = $state(false);
	let error = $state(false);
	let showCovers = $state(true);
	let imageLoaded = $state(false);
	let showZoom = $state(false);
	let isInViewport = $state(false);

	let containerRef: HTMLDivElement;
	let observer: IntersectionObserver;

	// Check session storage for cover display preference
	$effect(() => {
		if (typeof window !== 'undefined') {
			const preference = sessionStorage.getItem('showBookCovers');
			showCovers = preference !== 'false'; // Default to true
		}
	});

	onMount(() => {
		// Set up lazy loading with Intersection Observer
		if (lazyLoad && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
			observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							isInViewport = true;
							if (observer) {
								observer.disconnect();
							}
						}
					});
				},
				{
					rootMargin: '100px' // Start loading 100px before entering viewport
				}
			);

			if (containerRef) {
				observer.observe(containerRef);
			}
		} else {
			// If no lazy loading or no IntersectionObserver support, load immediately
			isInViewport = true;
		}

		return () => {
			if (observer) {
				observer.disconnect();
			}
		};
	});

	// Fetch cover when in viewport and conditions are met
	$effect(() => {
		if (!isInViewport) return;

		if (customCoverUrl) {
			// Use custom cover if provided
			coverUrl = customCoverUrl;
			thumbnailUrl = customCoverUrl;
			loading = false;
			error = false;
		} else if (showCovers && (recordId || isbn || title)) {
			// Fetch cover from database/API
			fetchCover();
		}
	});

	async function fetchCover() {
		loading = true;
		error = false;

		try {
			// First, try to get cover from database if we have recordId
			if (recordId) {
				const { supabase } = await import('$lib/supabase');

				const { data: coverData, error: coverError } = await supabase
					.from('covers')
					.select('original_url, thumbnail_medium_url, thumbnail_large_url, source')
					.eq('marc_record_id', recordId)
					.eq('is_active', true)
					.single();

				if (coverData && !coverError) {
					coverUrl = coverData.original_url;
					thumbnailUrl = coverData.thumbnail_medium_url || coverData.original_url;
					loading = false;
					return;
				}
			}

			// Fallback to API fetch (tries OpenLibrary, Google, etc.)
			const params = new URLSearchParams();
			if (isbn) params.set('isbn', isbn);
			if (title) params.set('title', title);
			if (author) params.set('author', author);

			const response = await fetch(`/api/covers/fetch?${params}`);
			if (!response.ok) throw new Error('Failed to fetch cover');

			const data = await response.json();

			if (data.success && data.url) {
				coverUrl = data.url;
				thumbnailUrl = data.url;
			} else {
				error = true;
			}
		} catch (err) {
			console.error('Error fetching book cover:', err);
			error = true;
		} finally {
			loading = false;
		}
	}

	function handleImageLoad() {
		imageLoaded = true;
	}

	function handleImageError() {
		error = true;
		imageLoaded = false;
	}

	function toggleZoom() {
		if (enableZoom && coverUrl) {
			showZoom = !showZoom;
		}
	}

	function closeZoom(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('zoom-overlay')) {
			showZoom = false;
		}
	}

	// Generate a placeholder with title/author text
	function generatePlaceholderStyle() {
		if (!title) return '';
		// Generate a color based on title hash
		const hash = Array.from(title).reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const hue = hash % 360;
		return `background: linear-gradient(135deg, hsl(${hue}, 40%, 70%) 0%, hsl(${hue}, 40%, 50%) 100%);`;
	}

	const sizeClasses = {
		small: 'w-16 h-24',
		medium: 'w-32 h-48',
		large: 'w-48 h-72'
	};
</script>

<div bind:this={containerRef} class="cover-container">
	{#if !showCovers}
		<!-- Don't show anything if covers are disabled -->
		{#if showPlaceholder}
			<div class="cover-placeholder {sizeClasses[size]}">
				<span class="placeholder-text">Cover Hidden</span>
			</div>
		{/if}
	{:else if loading}
		<div class="cover-loading {sizeClasses[size]}">
			<span class="loading-spinner"></span>
		</div>
	{:else if coverUrl}
		{#if enableZoom}
			<div
				class="cover-wrapper {sizeClasses[size]} zoomable"
				role="button"
				tabindex="0"
				onclick={toggleZoom}
				onkeydown={(e) => e.key === 'Enter' && toggleZoom()}
			>
				<!-- Show thumbnail first, then full image when loaded -->
				{#if !imageLoaded && thumbnailUrl && thumbnailUrl !== coverUrl}
					<img
						src={thumbnailUrl}
						alt="Book cover thumbnail for {title || 'book'}"
						class="book-cover thumbnail {sizeClasses[size]}"
					/>
				{/if}
				<img
					src={coverUrl}
					alt="Book cover for {title || 'book'}"
					class="book-cover {sizeClasses[size]}"
					class:loaded={imageLoaded}
					onload={handleImageLoad}
					onerror={handleImageError}
					loading={lazyLoad ? 'lazy' : 'eager'}
				/>
				<div class="zoom-hint">🔍 Click to enlarge</div>
			</div>
		{:else}
			<div class="cover-wrapper {sizeClasses[size]}">
				<!-- Show thumbnail first, then full image when loaded -->
				{#if !imageLoaded && thumbnailUrl && thumbnailUrl !== coverUrl}
					<img
						src={thumbnailUrl}
						alt="Book cover thumbnail for {title || 'book'}"
						class="book-cover thumbnail {sizeClasses[size]}"
					/>
				{/if}
				<img
					src={coverUrl}
					alt="Book cover for {title || 'book'}"
					class="book-cover {sizeClasses[size]}"
					class:loaded={imageLoaded}
					onload={handleImageLoad}
					onerror={handleImageError}
					loading={lazyLoad ? 'lazy' : 'eager'}
				/>
			</div>
		{/if}
	{:else if showPlaceholder}
		<!-- Generated placeholder with title/author -->
		<div
			class="cover-placeholder {sizeClasses[size]}"
			style={title ? generatePlaceholderStyle() : ''}
		>
			{#if title}
				<div class="placeholder-content">
					<div class="placeholder-title">{title.substring(0, 40)}</div>
					{#if author}
						<div class="placeholder-author">{author.substring(0, 30)}</div>
					{/if}
				</div>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
					/>
				</svg>
				<span class="placeholder-text">No Cover</span>
			{/if}
		</div>
	{/if}
</div>

<!-- Zoom overlay -->
{#if showZoom && coverUrl}
	<div
		class="zoom-overlay"
		onclick={closeZoom}
		onkeydown={(e) => e.key === 'Escape' && (showZoom = false)}
		role="dialog"
		aria-label="Enlarged book cover"
		aria-modal="true"
		tabindex="-1"
	>
		<button class="zoom-close" onclick={() => (showZoom = false)} aria-label="Close">×</button>
		<img src={coverUrl} alt="Book cover for {title || 'book'}" class="zoomed-image" />
	</div>
{/if}

<style>
	.cover-container {
		display: inline-block;
		position: relative;
	}

	.cover-wrapper {
		position: relative;
		display: inline-block;
		overflow: hidden;
		border-radius: 4px;
	}

	.cover-wrapper.zoomable {
		cursor: pointer;
	}

	.cover-wrapper.zoomable:hover .zoom-hint {
		opacity: 1;
	}

	.book-cover {
		object-fit: cover;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transition: transform 0.3s ease, opacity 0.3s ease;
		display: block;
	}

	.book-cover.thumbnail {
		position: absolute;
		top: 0;
		left: 0;
		filter: blur(5px);
		opacity: 0.7;
	}

	.book-cover.loaded {
		opacity: 1;
	}

	.book-cover:not(.loaded) {
		opacity: 0;
	}

	.cover-wrapper:hover .book-cover {
		transform: scale(1.05);
	}

	.zoom-hint {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		font-size: 0.75rem;
		padding: 0.5rem;
		text-align: center;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.cover-placeholder,
	.cover-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
		border: 2px dashed #ccc;
		border-radius: 4px;
		color: #fff;
		padding: 1rem;
		text-align: center;
	}

	.cover-placeholder svg {
		width: 40%;
		height: 40%;
		opacity: 0.5;
		stroke: #999;
	}

	.placeholder-content {
		width: 100%;
		padding: 0.5rem;
	}

	.placeholder-title {
		font-size: 0.875rem;
		font-weight: bold;
		margin-bottom: 0.5rem;
		line-height: 1.2;
		word-wrap: break-word;
		color: rgba(255, 255, 255, 0.95);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.placeholder-author {
		font-size: 0.75rem;
		opacity: 0.9;
		line-height: 1.2;
		color: rgba(255, 255, 255, 0.85);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.placeholder-text {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 0.25rem;
		color: #999;
	}

	.loading-spinner {
		display: inline-block;
		width: 24px;
		height: 24px;
		border: 3px solid #f3f3f3;
		border-top: 3px solid #e73b42;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Zoom overlay */
	.zoom-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		cursor: pointer;
		animation: fadeIn 0.2s;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.zoom-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: rgba(255, 255, 255, 0.9);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		font-size: 2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		z-index: 10000;
		transition: background 0.2s;
	}

	.zoom-close:hover {
		background: white;
	}

	.zoomed-image {
		max-width: 90vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: 8px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
	}

	/* Size classes */
	.w-16 {
		width: 4rem;
	}
	.h-24 {
		height: 6rem;
	}
	.w-32 {
		width: 8rem;
	}
	.h-48 {
		height: 12rem;
	}
	.w-48 {
		width: 12rem;
	}
	.h-72 {
		height: 18rem;
	}
</style>
