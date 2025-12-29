<script lang="ts">
	interface Props {
		isbn?: string;
		title?: string;
		author?: string;
		size?: 'small' | 'medium' | 'large';
		showPlaceholder?: boolean;
	}

	let {
		isbn,
		title,
		author,
		size = 'medium',
		showPlaceholder = true
	}: Props = $props();

	let coverUrl = $state<string | null>(null);
	let loading = $state(false);
	let error = $state(false);
	let showCovers = $state(true); // Will be controlled by session storage

	// Check session storage for cover display preference
	$effect(() => {
		if (typeof window !== 'undefined') {
			const preference = sessionStorage.getItem('showBookCovers');
			showCovers = preference !== 'false'; // Default to true
		}
	});

	// Fetch cover when component mounts or props change
	$effect(() => {
		if (showCovers && (isbn || title)) {
			fetchCover();
		}
	});

	async function fetchCover() {
		loading = true;
		error = false;

		try {
			const params = new URLSearchParams();
			if (isbn) params.set('isbn', isbn);
			if (title) params.set('title', title);
			if (author) params.set('author', author);

			const response = await fetch(`/api/book-cover?${params}`);
			if (!response.ok) throw new Error('Failed to fetch cover');

			const data = await response.json();

			if (data.coverUrl) {
				coverUrl = data.coverUrl;
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

	const sizeClasses = {
		small: 'w-16 h-24',
		medium: 'w-32 h-48',
		large: 'w-48 h-72'
	};
</script>

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
	<img src={coverUrl} alt="Book cover for {title || 'book'}" class="book-cover {sizeClasses[size]}" />
{:else if showPlaceholder}
	<div class="cover-placeholder {sizeClasses[size]}">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
			/>
		</svg>
		<span class="placeholder-text">No Cover</span>
	</div>
{/if}

<style>
	.book-cover {
		object-fit: cover;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s;
	}

	.book-cover:hover {
		transform: scale(1.05);
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
		color: #999;
	}

	.cover-placeholder svg {
		width: 40%;
		height: 40%;
		opacity: 0.5;
	}

	.placeholder-text {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 0.25rem;
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
