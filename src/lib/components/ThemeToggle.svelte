<script lang="ts">
	import { onMount } from 'svelte';
	import type { SiteConfiguration } from '$lib/types/site-config';

	let { siteConfig }: { siteConfig: SiteConfiguration } = $props();

	let userTheme = $state<'light' | 'dark' | 'system'>('system');

	function getSystemTheme(): 'light' | 'dark' {
		if (typeof window === 'undefined') return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	function loadTheme() {
		if (typeof window === 'undefined') return;
		
		const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (stored && (stored === 'light' || stored === 'dark')) {
			userTheme = stored;
		} else {
			userTheme = siteConfig.theme_mode;
		}
	}

	function toggleTheme() {
		if (userTheme === 'light') {
			userTheme = 'dark';
		} else if (userTheme === 'dark') {
			userTheme = 'system';
		} else {
			userTheme = 'light';
		}
		
		localStorage.setItem('theme', userTheme === 'system' ? '' : userTheme);
		
		// Trigger custom event for ThemeProvider
		window.dispatchEvent(new CustomEvent('themechange', { detail: userTheme }));
	}

	function getThemeIcon(): string {
		if (userTheme === 'light') return '☀️';
		if (userTheme === 'dark') return '🌙';
		return '🌓'; // system
	}

	function getThemeLabel(): string {
		if (userTheme === 'light') return 'Light';
		if (userTheme === 'dark') return 'Dark';
		return 'System';
	}

	onMount(() => {
		loadTheme();
	});
</script>

<button 
	class="theme-toggle" 
	onclick={toggleTheme}
	aria-label="Toggle theme"
	title={`Theme: ${getThemeLabel()}`}
>
	<span class="theme-icon">{getThemeIcon()}</span>
	<span class="theme-label">{getThemeLabel()}</span>
</button>

<style>
	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		color: white;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.theme-toggle:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		transform: translateY(-1px);
	}

	.theme-icon {
		font-size: 1.125rem;
		line-height: 1;
	}

	.theme-label {
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.theme-label {
			display: none;
		}

		.theme-toggle {
			padding: 0.5rem;
			border-radius: 50%;
			width: 40px;
			height: 40px;
			justify-content: center;
		}
	}
</style>
