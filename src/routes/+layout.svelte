<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children }: { data: LayoutData; children: any } = $props();

	onMount(() => {
		const { data: authData } = data.supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			authData.subscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Library Catalog System</title>
</svelte:head>

{@render children()}
