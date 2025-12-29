<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect to new results page
	onMount(() => {
		const query = $page.url.searchParams.get('q');
		if (query) {
			goto(`/catalog/search/results?q=${encodeURIComponent(query)}`, { replaceState: true });
		} else {
			goto('/catalog', { replaceState: true });
		}
	});
</script>

<div class="redirect-page">
	<p>Redirecting to search results...</p>
</div>

<style>
	.redirect-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		font-size: 1.125rem;
		color: #666;
	}
</style>
