<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';

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

<!-- Minimal root layout - route groups handle the UI -->
{@render children()}

