<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Auth state management
	onMount(() => {
		const { data: authData } = data.supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			authData.subscription.unsubscribe();
		};
	});
</script>

<AccessibilitySettings />

{@render children()}

<style>
	/* Root layout has no styles - all chrome is in route group layouts */
</style>
