<script lang="ts">
	import { onMount } from 'svelte';
	import BookCover from './BookCover.svelte';

	interface CoverFlowItem {
		id: string;
		title: string;
		author?: string;
		isbn?: string;
		coverUrl?: string;
	}

	interface Props {
		items: CoverFlowItem[];
		title?: string;
		showControls?: boolean;
		autoRotate?: boolean;
		rotateInterval?: number; // milliseconds
		itemsPerView?: number;
		enableZoom?: boolean;
		onItemClick?: (item: CoverFlowItem) => void;
	}

	let {
		items = [],
		title,
		showControls = true,
		autoRotate = false,
		rotateInterval = 3000,
		itemsPerView = 7,
		enableZoom = true,
		onItemClick
	}: Props = $props();

	let currentIndex = $state(Math.floor(items.length / 2));
	let isHovering = $state(false);
	let autoRotateTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		if (autoRotate) {
			startAutoRotate();
		}

		return () => {
			if (autoRotateTimer) {
				clearInterval(autoRotateTimer);
			}
		};
	});

	function startAutoRotate() {
		if (autoRotateTimer) {
			clearInterval(autoRotateTimer);
		}
		autoRotateTimer = setInterval(() => {
			if (!isHovering) {
				next();
			}
		}, rotateInterval);
	}

	function stopAutoRotate() {
		if (autoRotateTimer) {
			clearInterval(autoRotateTimer);
			autoRotateTimer = null;
		}
	}

	function next() {
		currentIndex = (currentIndex + 1) % items.length;
	}

	function prev() {
		currentIndex = (currentIndex - 1 + items.length) % items.length;
	}

	function goTo(index: number) {
		currentIndex = index;
	}

	function handleItemClick(item: CoverFlowItem, index: number) {
		if (index === currentIndex && onItemClick) {
			onItemClick(item);
		} else {
			goTo(index);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			prev();
		} else if (e.key === 'ArrowRight') {
			next();
		}
	}

	// Calculate visible items around current index
	function getVisibleItems() {
		const halfView = Math.floor(itemsPerView / 2);
		const visibleItems = [];

		for (let i = -halfView; i <= halfView; i++) {
			const index = (currentIndex + i + items.length) % items.length;
			visibleItems.push({
				item: items[index],
				index,
				offset: i
			});
		}

		return visibleItems;
	}

	// Calculate transform for each item based on offset from center
	function getItemTransform(offset: number) {
		const angle = offset * 15; // degrees
		const translateX = offset * 120; // pixels
		const translateZ = Math.abs(offset) * -100; // depth
		const scale = 1 - Math.abs(offset) * 0.15;
		const opacity = 1 - Math.abs(offset) * 0.15;

		return {
			transform: `
        translateX(${translateX}px)
        translateZ(${translateZ}px)
        rotateY(${-angle}deg)
        scale(${scale})
      `,
			opacity: Math.max(opacity, 0.3),
			zIndex: 100 - Math.abs(offset)
		};
	}

	$effect(() => {
		// Restart auto-rotate when it changes
		if (autoRotate) {
			startAutoRotate();
		} else {
			stopAutoRotate();
		}
	});
</script>

<div
	class="cover-flow-container"
	onmouseenter={() => (isHovering = true)}
	onmouseleave={() => (isHovering = false)}
	onkeydown={handleKeyDown}
	role="region"
	aria-label={title || 'Book cover carousel'}
	tabindex="0"
>
	{#if title}
		<h2 class="cover-flow-title">{title}</h2>
	{/if}

	<div class="cover-flow-wrapper">
		{#if showControls}
			<button
				class="nav-button prev"
				onclick={prev}
				aria-label="Previous"
				disabled={items.length === 0}
			>
				‹
			</button>
		{/if}

		<div class="cover-flow-stage">
			<div class="cover-flow-items">
				{#each getVisibleItems() as { item, index, offset } (item.id)}
					{@const style = getItemTransform(offset)}
					<div
						class="cover-flow-item"
						class:active={offset === 0}
						style="
              transform: {style.transform};
              opacity: {style.opacity};
              z-index: {style.zIndex};
            "
						onclick={() => handleItemClick(item, index)}
						onkeydown={(e) => e.key === 'Enter' && handleItemClick(item, index)}
						role="button"
						tabindex={offset === 0 ? 0 : -1}
						aria-label={item.title}
					>
						<div class="cover-flow-cover">
							<BookCover
								recordId={item.id}
								isbn={item.isbn}
								title={item.title}
								author={item.author}
								customCoverUrl={item.coverUrl}
								size="large"
								lazyLoad={true}
								enableZoom={enableZoom && offset === 0}
							/>
						</div>
						{#if offset === 0}
							<div class="cover-flow-info">
								<div class="cover-flow-info-title">{item.title}</div>
								{#if item.author}
									<div class="cover-flow-info-author">{item.author}</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if showControls}
			<button class="nav-button next" onclick={next} aria-label="Next" disabled={items.length === 0}>
				›
			</button>
		{/if}
	</div>

	<!-- Indicators -->
	{#if items.length > 0}
		<div class="cover-flow-indicators">
			{#each items as item, index}
				<button
					class="indicator"
					class:active={index === currentIndex}
					onclick={() => goTo(index)}
					aria-label="Go to {item.title}"
				></button>
			{/each}
		</div>
	{/if}

	{#if items.length === 0}
		<div class="empty-state">No items to display</div>
	{/if}
</div>

<style>
	.cover-flow-container {
		width: 100%;
		padding: 2rem 0;
		outline: none;
	}

	.cover-flow-title {
		text-align: center;
		margin-bottom: 2rem;
		font-size: 2rem;
		color: #333;
	}

	.cover-flow-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.cover-flow-stage {
		flex: 1;
		height: 450px;
		perspective: 1200px;
		overflow: hidden;
	}

	.cover-flow-items {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		transform-style: preserve-3d;
	}

	.cover-flow-item {
		position: absolute;
		transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		transform-style: preserve-3d;
		backface-visibility: hidden;
	}

	.cover-flow-item:focus {
		outline: 3px solid #e73b42;
		outline-offset: 4px;
		border-radius: 8px;
	}

	.cover-flow-item.active {
		cursor: default;
	}

	.cover-flow-item:not(.active):hover {
		transform: scale(1.1) !important;
	}

	.cover-flow-cover {
		filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3));
	}

	.cover-flow-item:not(.active) .cover-flow-cover {
		filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.2)) grayscale(30%);
	}

	.cover-flow-info {
		position: absolute;
		bottom: -80px;
		left: 50%;
		transform: translateX(-50%);
		text-align: center;
		width: 200px;
		animation: fadeInUp 0.3s;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.cover-flow-info-title {
		font-size: 1.125rem;
		font-weight: bold;
		color: #333;
		margin-bottom: 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cover-flow-info-author {
		font-size: 0.875rem;
		color: #666;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Navigation buttons */
	.nav-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: white;
		border: 2px solid #e0e0e0;
		color: #333;
		font-size: 2rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		flex-shrink: 0;
	}

	.nav-button:hover:not(:disabled) {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
		transform: scale(1.1);
	}

	.nav-button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Indicators */
	.cover-flow-indicators {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 2rem;
	}

	.indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #e0e0e0;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0;
	}

	.indicator:hover {
		background: #bbb;
		transform: scale(1.2);
	}

	.indicator.active {
		background: #e73b42;
		width: 30px;
		border-radius: 6px;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #999;
		font-size: 1.125rem;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.cover-flow-stage {
			height: 350px;
		}

		.nav-button {
			width: 45px;
			height: 45px;
			font-size: 1.5rem;
		}

		.cover-flow-title {
			font-size: 1.5rem;
		}

		.cover-flow-info {
			bottom: -60px;
			width: 150px;
		}

		.cover-flow-info-title {
			font-size: 1rem;
		}

		.cover-flow-info-author {
			font-size: 0.75rem;
		}
	}
</style>
