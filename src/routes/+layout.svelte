<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import { supabase } from '$lib/supabase';

	let { data, children }: { data: LayoutData; children: any } = $props();

	onMount(() => {
		const { data: authData } = supabase.auth.onAuthStateChange(() => {
			invalidate('supabase:auth');
		});

		return () => {
			authData.subscription.unsubscribe();
		};
	});
</script>

<!-- Minimal root layout - route groups handle the UI -->
{@render children()}

