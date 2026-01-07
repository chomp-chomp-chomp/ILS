<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { SiteConfiguration, ThemeTokens } from '$lib/types/site-config';
	import { getPageType, getMergedThemeTokens } from '$lib/types/site-config';

	let { 
		siteConfig, 
		children 
	}: { 
		siteConfig: SiteConfiguration; 
		children: any;
	} = $props();

	// Theme state
	let userTheme = $state<'light' | 'dark' | 'system'>('system');
	let resolvedTheme = $state<'light' | 'dark'>('light');
	let currentTokens = $state<ThemeTokens>({});

	// Detect system theme preference
	function getSystemTheme(): 'light' | 'dark' {
		if (typeof window === 'undefined') return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	// Resolve actual theme mode (handle 'system' setting)
	function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
		if (theme === 'system') {
			return getSystemTheme();
		}
		return theme;
	}

	// Load theme from localStorage or site config
	function loadTheme() {
		if (typeof window === 'undefined') return;
		
		const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (stored && (stored === 'light' || stored === 'dark')) {
			userTheme = stored;
		} else {
			userTheme = siteConfig.theme_mode;
		}
		
		resolvedTheme = resolveTheme(userTheme);
	}

	// Update theme tokens based on current page and theme
	function updateThemeTokens() {
		const pageType = getPageType($page.url.pathname);
		currentTokens = getMergedThemeTokens(siteConfig, pageType, resolvedTheme);
	}

	// Apply theme to document
	function applyTheme() {
		if (typeof window === 'undefined') return;
		
		// Update data attribute for CSS rules
		document.documentElement.setAttribute('data-theme', resolvedTheme);
		
		// Update CSS variables
		Object.entries(currentTokens).forEach(([key, value]) => {
			if (value) {
				document.documentElement.style.setProperty(`--theme-${key}`, value);
			}
		});
	}

	// Toggle theme
	export function toggleTheme() {
		if (userTheme === 'light') {
			userTheme = 'dark';
		} else if (userTheme === 'dark') {
			userTheme = 'system';
		} else {
			userTheme = 'light';
		}
		
		localStorage.setItem('theme', userTheme === 'system' ? '' : userTheme);
		resolvedTheme = resolveTheme(userTheme);
		updateThemeTokens();
		applyTheme();
	}

	// Get current theme icon
	export function getThemeIcon(): string {
		if (userTheme === 'light') return '☀️';
		if (userTheme === 'dark') return '🌙';
		return '🌓'; // system
	}

	// Get current theme label
	export function getThemeLabel(): string {
		if (userTheme === 'light') return 'Light';
		if (userTheme === 'dark') return 'Dark';
		return 'System';
	}

	// Watch for system theme changes
	onMount(() => {
		loadTheme();
		updateThemeTokens();
		applyTheme();

		// Listen for system theme changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (userTheme === 'system') {
				resolvedTheme = resolveTheme('system');
				updateThemeTokens();
				applyTheme();
			}
		};
		
		mediaQuery.addEventListener('change', handleChange);
		
		return () => {
			mediaQuery.removeEventListener('change', handleChange);
		};
	});

	// Watch for page changes
	$effect(() => {
		// Update tokens when page or theme changes
		$page.url.pathname;
		resolvedTheme;
		updateThemeTokens();
		applyTheme();
	});
</script>

{@render children()}
