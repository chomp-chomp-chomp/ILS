<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';
	import AccessibilitySettings from '$lib/components/AccessibilitySettings.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Get branding configuration with defaults
	const branding = $derived(
		data.branding || {
			library_name: 'Library Catalog System',
			primary_color: '#e73b42',
			secondary_color: '#667eea',
			accent_color: '#2c3e50',
			background_color: '#ffffff',
			text_color: '#333333',
			font_family: 'system-ui, -apple-system, sans-serif',
			heading_font: null,
			favicon_url: null,
			custom_css: null,
			custom_head_html: null
		}
	);

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
	<link rel="icon" href={branding.favicon_url || favicon} />
	<title>{branding.library_name}</title>

	{#if branding.custom_head_html}
		{@html branding.custom_head_html}
	{/if}

	{#if branding.custom_css}
		<style>
			{branding.custom_css}
		</style>
	{/if}
</svelte:head>

<AccessibilitySettings />

<main
	id="main-content"
	style="
		--primary-color: {branding.primary_color};
		--secondary-color: {branding.secondary_color};
		--accent-color: {branding.accent_color};
		--background-color: {branding.background_color};
		--text-color: {branding.text_color};
		--font-family: {branding.font_family};
		--heading-font: {branding.heading_font || branding.font_family};
	"
>
	{@render children()}
</main>
