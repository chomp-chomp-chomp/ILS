<script lang="ts">
	import type { PageData } from './$types';
	import { supabase } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let config = $state({ ...data.siteConfig });
	let message = $state('');
	let saving = $state(false);

	// New link forms
	let newHeaderLinkTitle = $state('');
	let newHeaderLinkUrl = $state('');
	let newFooterLinkTitle = $state('');
	let newFooterLinkUrl = $state('');
	let newHomepageLinkTitle = $state('');
	let newHomepageLinkUrl = $state('');
	let newHeroLinkTitle = $state('');
	let newHeroLinkUrl = $state('');

	// Active tab
	let activeTab = $state<'header' | 'footer' | 'homepage' | 'hero' | 'metadata' | 'theme'>('header');

	// Active theme editor
	let themeType = $state<'light' | 'dark'>('light');

	// Active page theme editor
	let pageThemeType = $state<'home' | 'search_results' | 'search_advanced' | 'catalog_browse' | 'record_details' | 'public_default'>('home');

	// Header link management
	function addHeaderLink() {
		if (!newHeaderLinkTitle || !newHeaderLinkUrl) {
			message = 'Please fill in both title and URL';
			return;
		}

		const links = Array.isArray(config.header_links) ? config.header_links : [];
		const maxOrder = links.length > 0 ? Math.max(...links.map((l: any) => l.order || 0)) : 0;

		config.header_links = [
			...links,
			{
				title: newHeaderLinkTitle,
				url: newHeaderLinkUrl,
				order: maxOrder + 1
			}
		];

		newHeaderLinkTitle = '';
		newHeaderLinkUrl = '';
		message = 'Link added (remember to save)';
	}

	function removeHeaderLink(index: number) {
		config.header_links = config.header_links.filter((_: any, i: number) => i !== index);
	}

	function moveHeaderLinkUp(index: number) {
		if (index === 0) return;
		const links = [...config.header_links];
		[links[index], links[index - 1]] = [links[index - 1], links[index]];
		links.forEach((link, i) => (link.order = i + 1));
		config.header_links = links;
	}

	function moveHeaderLinkDown(index: number) {
		if (index === config.header_links.length - 1) return;
		const links = [...config.header_links];
		[links[index], links[index + 1]] = [links[index + 1], links[index]];
		links.forEach((link, i) => (link.order = i + 1));
		config.header_links = links;
	}

	// Footer link management
	function addFooterLink() {
		if (!newFooterLinkTitle || !newFooterLinkUrl) {
			message = 'Please fill in both title and URL';
			return;
		}

		const links = Array.isArray(config.footer_links) ? config.footer_links : [];
		const maxOrder = links.length > 0 ? Math.max(...links.map((l: any) => l.order || 0)) : 0;

		config.footer_links = [
			...links,
			{
				title: newFooterLinkTitle,
				url: newFooterLinkUrl,
				order: maxOrder + 1
			}
		];

		newFooterLinkTitle = '';
		newFooterLinkUrl = '';
		message = 'Link added (remember to save)';
	}

	function removeFooterLink(index: number) {
		config.footer_links = config.footer_links.filter((_: any, i: number) => i !== index);
	}

	// Homepage link management
	function addHomepageLink() {
		if (!newHomepageLinkTitle || !newHomepageLinkUrl) {
			message = 'Please fill in both title and URL';
			return;
		}

		const links = Array.isArray(config.homepage_info_links) ? config.homepage_info_links : [];
		const maxOrder = links.length > 0 ? Math.max(...links.map((l: any) => l.order || 0)) : 0;

		config.homepage_info_links = [
			...links,
			{
				title: newHomepageLinkTitle,
				url: newHomepageLinkUrl,
				order: maxOrder + 1
			}
		];

		newHomepageLinkTitle = '';
		newHomepageLinkUrl = '';
		message = 'Link added (remember to save)';
	}

	function removeHomepageLink(index: number) {
		config.homepage_info_links = config.homepage_info_links.filter(
			(_: any, i: number) => i !== index
		);
	}

	// Hero link management
	function addHeroLink() {
		if (!newHeroLinkTitle || !newHeroLinkUrl) {
			message = 'Please fill in both title and URL';
			return;
		}

		const links = Array.isArray(config.homepage_hero_links) ? config.homepage_hero_links : [];
		const maxOrder = links.length > 0 ? Math.max(...links.map((l: any) => l.order || 0)) : 0;

		config.homepage_hero_links = [
			...links,
			{
				title: newHeroLinkTitle,
				url: newHeroLinkUrl,
				order: maxOrder + 1
			}
		];

		newHeroLinkTitle = '';
		newHeroLinkUrl = '';
		message = 'Link added (remember to save)';
	}

	function removeHeroLink(index: number) {
		config.homepage_hero_links = config.homepage_hero_links.filter(
			(_: any, i: number) => i !== index
		);
	}

	// Theme management
	function updateThemeToken(theme: 'light' | 'dark', token: string, value: string) {
		if (theme === 'light') {
			config.theme_light = { ...config.theme_light, [token]: value };
		} else {
			config.theme_dark = { ...config.theme_dark, [token]: value };
		}
	}

	function updatePageTheme(pageType: string, token: string, value: string) {
		const pageThemes = config.page_themes || {};
		const currentPageTheme = pageThemes[pageType] || {};
		config.page_themes = {
			...pageThemes,
			[pageType]: { ...currentPageTheme, [token]: value }
		};
	}

	function clearPageTheme(pageType: string) {
		const pageThemes = config.page_themes || {};
		delete pageThemes[pageType];
		config.page_themes = { ...pageThemes };
		message = `Cleared overrides for ${pageType}`;
	}

	async function saveConfig() {
		saving = true;
		message = '';

		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const accessToken = sessionData?.session?.access_token;

			if (!accessToken) {
				throw new Error('Not authenticated. Please log in again.');
			}

			const response = await fetch('/api/site-config', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(config)
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(error || 'Failed to save configuration');
			}

			const result = await response.json();
			config = result.config;
			message = 'Configuration saved successfully!';

			// Invalidate all data to refresh the site
			await invalidateAll();

			// Scroll to top to show success message
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (error) {
			console.error('Error saving config:', error);
			message = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			saving = false;
		}
	}

	function resetConfig() {
		config = { ...data.siteConfig };
		message = 'Configuration reset to last saved state';
	}
</script>

<div class="admin-page">
	<header class="page-header">
		<h1>Site Configuration</h1>
		<p class="subtitle">
			Configure header, footer, homepage info, and theming for your public catalog pages
		</p>
	</header>

	{#if message}
		<div class="message" class:success={message.includes('success')} class:error={message.includes('Error')}>
			{message}
		</div>
	{/if}

	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'header'}
			onclick={() => (activeTab = 'header')}
		>
			Header
		</button>
		<button
			class="tab"
			class:active={activeTab === 'footer'}
			onclick={() => (activeTab = 'footer')}
		>
			Footer
		</button>
		<button
			class="tab"
			class:active={activeTab === 'homepage'}
			onclick={() => (activeTab = 'homepage')}
		>
			Homepage Info
		</button>
		<button
			class="tab"
			class:active={activeTab === 'hero'}
			onclick={() => (activeTab = 'hero')}
		>
			Homepage Hero
		</button>
		<button
			class="tab"
			class:active={activeTab === 'metadata'}
			onclick={() => (activeTab = 'metadata')}
		>
			Metadata
		</button>
		<button
			class="tab"
			class:active={activeTab === 'theme'}
			onclick={() => (activeTab = 'theme')}
		>
			Theme
		</button>
	</div>

	<div class="config-container">
		<!-- Header Configuration -->
		{#if activeTab === 'header'}
			<div class="config-section">
				<h2>Header Configuration</h2>

				<label class="toggle-label">
					<input type="checkbox" bind:checked={config.header_enabled} />
					<span>Enable Custom Header</span>
				</label>

				<div class="form-group">
					<label for="header_logo_url">Logo URL</label>
					<input
						id="header_logo_url"
						type="text"
						bind:value={config.header_logo_url}
						placeholder="https://example.com/logo.png"
					/>
					<p class="help-text">URL to your header logo image</p>
				</div>

				<h3>Header Links</h3>
				<div class="link-list">
					{#each config.header_links || [] as link, index}
						<div class="link-item">
							<div class="link-info">
								<strong>{link.title}</strong>
								<span class="link-url">{link.url}</span>
							</div>
							<div class="link-actions">
								<button onclick={() => moveHeaderLinkUp(index)} disabled={index === 0}>
									↑
								</button>
								<button
									onclick={() => moveHeaderLinkDown(index)}
									disabled={index === config.header_links.length - 1}
								>
									↓
								</button>
								<button class="btn-danger" onclick={() => removeHeaderLink(index)}>
									Remove
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="add-link-form">
					<h4>Add Header Link</h4>
					<div class="form-row">
						<input
							type="text"
							bind:value={newHeaderLinkTitle}
							placeholder="Link title"
						/>
						<input
							type="text"
							bind:value={newHeaderLinkUrl}
							placeholder="https://..."
						/>
						<button onclick={addHeaderLink}>Add</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer Configuration -->
		{#if activeTab === 'footer'}
			<div class="config-section">
				<h2>Footer Configuration</h2>

				<label class="toggle-label">
					<input type="checkbox" bind:checked={config.footer_enabled} />
					<span>Enable Custom Footer</span>
				</label>

				<div class="form-group">
					<label for="footer_text">Footer Text</label>
					<textarea
						id="footer_text"
						bind:value={config.footer_text}
						rows="3"
						placeholder="Powered by Open Library System"
					></textarea>
					<p class="help-text">Main footer text (plain text)</p>
				</div>

				<h3>Footer Links</h3>
				<div class="link-list">
					{#each config.footer_links || [] as link, index}
						<div class="link-item">
							<div class="link-info">
								<strong>{link.title}</strong>
								<span class="link-url">{link.url}</span>
							</div>
							<div class="link-actions">
								<button class="btn-danger" onclick={() => removeFooterLink(index)}>
									Remove
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="add-link-form">
					<h4>Add Footer Link</h4>
					<div class="form-row">
						<input
							type="text"
							bind:value={newFooterLinkTitle}
							placeholder="Link title"
						/>
						<input
							type="text"
							bind:value={newFooterLinkUrl}
							placeholder="https://..."
						/>
						<button onclick={addFooterLink}>Add</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Homepage Info Configuration -->
		{#if activeTab === 'homepage'}
			<div class="config-section">
				<h2>Homepage Info Section</h2>

				<label class="toggle-label">
					<input type="checkbox" bind:checked={config.homepage_info_enabled} />
					<span>Enable Homepage Info Section</span>
				</label>

				<div class="form-group">
					<label for="homepage_info_title">Title</label>
					<input
						id="homepage_info_title"
						type="text"
						bind:value={config.homepage_info_title}
						placeholder="Quick Links"
					/>
				</div>

				<div class="form-group">
					<label for="homepage_info_content">Content (Plain Text)</label>
					<textarea
						id="homepage_info_content"
						bind:value={config.homepage_info_content}
						rows="5"
						placeholder="Welcome message or description..."
					></textarea>
				</div>

				<h3>Homepage Links</h3>
				<div class="link-list">
					{#each config.homepage_info_links || [] as link, index}
						<div class="link-item">
							<div class="link-info">
								<strong>{link.title}</strong>
								<span class="link-url">{link.url}</span>
							</div>
							<div class="link-actions">
								<button class="btn-danger" onclick={() => removeHomepageLink(index)}>
									Remove
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="add-link-form">
					<h4>Add Homepage Link</h4>
					<div class="form-row">
						<input
							type="text"
							bind:value={newHomepageLinkTitle}
							placeholder="Link title"
						/>
						<input
							type="text"
							bind:value={newHomepageLinkUrl}
							placeholder="https://..."
						/>
						<button onclick={addHomepageLink}>Add</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Homepage Hero Configuration -->
		{#if activeTab === 'hero'}
			<div class="config-section">
				<h2>Homepage Hero Configuration</h2>

				<label class="toggle-label">
					<input type="checkbox" bind:checked={config.homepage_hero_enabled} />
					<span>Enable Homepage Hero Section</span>
				</label>

				<div class="form-group">
					<label for="homepage_hero_title">Hero Title</label>
					<input
						id="homepage_hero_title"
						type="text"
						bind:value={config.homepage_hero_title}
						placeholder="Welcome to Our Library"
					/>
				</div>

				<div class="form-group">
					<label for="homepage_hero_tagline">Hero Tagline</label>
					<input
						id="homepage_hero_tagline"
						type="text"
						bind:value={config.homepage_hero_tagline}
						placeholder="Discover, Learn, Grow"
					/>
				</div>

				<div class="form-group">
					<label for="homepage_hero_image_url">Hero Background Image URL</label>
					<input
						id="homepage_hero_image_url"
						type="text"
						bind:value={config.homepage_hero_image_url}
						placeholder="https://example.com/hero-image.jpg"
					/>
					<p class="help-text">URL to the hero section background image</p>
				</div>

				<h3>Hero Links</h3>
				<div class="link-list">
					{#each config.homepage_hero_links || [] as link, index}
						<div class="link-item">
							<div class="link-info">
								<strong>{link.title}</strong>
								<span class="link-url">{link.url}</span>
							</div>
							<div class="link-actions">
								<button class="btn-danger" onclick={() => removeHeroLink(index)}>
									Remove
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="add-link-form">
					<h4>Add Hero Link</h4>
					<div class="form-row">
						<input
							type="text"
							bind:value={newHeroLinkTitle}
							placeholder="Link title"
						/>
						<input
							type="text"
							bind:value={newHeroLinkUrl}
							placeholder="https://..."
						/>
						<button onclick={addHeroLink}>Add</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Site Metadata Configuration -->
		{#if activeTab === 'metadata'}
			<div class="config-section">
				<h2>Site Metadata &amp; Assets</h2>
				<p class="help-text">
					Configure favicon, Open Graph images, and other metadata assets. These URLs override branding settings if provided.
				</p>

				<h3>Favicons</h3>
				<div class="form-group">
					<label for="favicon_url">Favicon URL</label>
					<input
						id="favicon_url"
						type="text"
						bind:value={config.favicon_url}
						placeholder="https://example.com/favicon.ico"
					/>
					<p class="help-text">Main favicon (fallback to branding if empty)</p>
				</div>

				<div class="form-group">
					<label for="apple_touch_icon_url">Apple Touch Icon URL</label>
					<input
						id="apple_touch_icon_url"
						type="text"
						bind:value={config.apple_touch_icon_url}
						placeholder="https://example.com/apple-touch-icon.png"
					/>
					<p class="help-text">180x180 PNG for iOS home screen</p>
				</div>

				<h3>Android Chrome Icons</h3>
				<div class="form-group">
					<label for="android_chrome_192_url">Android Chrome 192x192 URL</label>
					<input
						id="android_chrome_192_url"
						type="text"
						bind:value={config.android_chrome_192_url}
						placeholder="https://example.com/android-chrome-192x192.png"
					/>
					<p class="help-text">192x192 PNG for Android</p>
				</div>

				<div class="form-group">
					<label for="android_chrome_512_url">Android Chrome 512x512 URL</label>
					<input
						id="android_chrome_512_url"
						type="text"
						bind:value={config.android_chrome_512_url}
						placeholder="https://example.com/android-chrome-512x512.png"
					/>
					<p class="help-text">512x512 PNG for Android</p>
				</div>

				<h3>Social Media</h3>
				<div class="form-group">
					<label for="og_image_url">Open Graph Image URL</label>
					<input
						id="og_image_url"
						type="text"
						bind:value={config.og_image_url}
						placeholder="https://example.com/og-image.jpg"
					/>
					<p class="help-text">Used when sharing on Facebook, LinkedIn, etc. (recommended: 1200x630)</p>
				</div>

				<div class="form-group">
					<label for="twitter_card_image_url">Twitter Card Image URL</label>
					<input
						id="twitter_card_image_url"
						type="text"
						bind:value={config.twitter_card_image_url}
						placeholder="https://example.com/twitter-card.jpg"
					/>
					<p class="help-text">Used when sharing on Twitter/X (fallback to OG image if empty)</p>
				</div>
			</div>
		{/if}

		<!-- Theme Configuration -->
		{#if activeTab === 'theme'}
			<div class="config-section">
				<h2>Theme Configuration</h2>

				<div class="form-group">
					<label for="theme_mode">Theme Mode</label>
					<select id="theme_mode" bind:value={config.theme_mode}>
						<option value="system">System (Auto)</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
					<p class="help-text">
						Users can override this with the theme toggle button
					</p>
				</div>

				<div class="theme-editors">
					<div class="theme-tabs">
						<button
							class="theme-tab"
							class:active={themeType === 'light'}
							onclick={() => (themeType = 'light')}
						>
							☀️ Light Theme
						</button>
						<button
							class="theme-tab"
							class:active={themeType === 'dark'}
							onclick={() => (themeType = 'dark')}
						>
							🌙 Dark Theme
						</button>
					</div>

					<div class="theme-editor">
						<h3>{themeType === 'light' ? 'Light' : 'Dark'} Theme Tokens</h3>

						<div class="color-grid">
							<div class="form-group">
								<label>Primary Color</label>
								<input
									type="color"
									value={themeType === 'light'
										? config.theme_light.primary
										: config.theme_dark.primary}
									onchange={(e) =>
										updateThemeToken(themeType, 'primary', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={themeType === 'light'
										? config.theme_light.primary
										: config.theme_dark.primary}
									oninput={(e) =>
										updateThemeToken(themeType, 'primary', e.currentTarget.value)}
								/>
							</div>

							<div class="form-group">
								<label>Secondary Color</label>
								<input
									type="color"
									value={themeType === 'light'
										? config.theme_light.secondary
										: config.theme_dark.secondary}
									onchange={(e) =>
										updateThemeToken(themeType, 'secondary', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={themeType === 'light'
										? config.theme_light.secondary
										: config.theme_dark.secondary}
									oninput={(e) =>
										updateThemeToken(themeType, 'secondary', e.currentTarget.value)}
								/>
							</div>

							<div class="form-group">
								<label>Accent Color</label>
								<input
									type="color"
									value={themeType === 'light'
										? config.theme_light.accent
										: config.theme_dark.accent}
									onchange={(e) =>
										updateThemeToken(themeType, 'accent', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={themeType === 'light'
										? config.theme_light.accent
										: config.theme_dark.accent}
									oninput={(e) =>
										updateThemeToken(themeType, 'accent', e.currentTarget.value)}
								/>
							</div>

							<div class="form-group">
								<label>Background Color</label>
								<input
									type="color"
									value={themeType === 'light'
										? config.theme_light.background
										: config.theme_dark.background}
									onchange={(e) =>
										updateThemeToken(themeType, 'background', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={themeType === 'light'
										? config.theme_light.background
										: config.theme_dark.background}
									oninput={(e) =>
										updateThemeToken(themeType, 'background', e.currentTarget.value)}
								/>
							</div>

							<div class="form-group">
								<label>Text Color</label>
								<input
									type="color"
									value={themeType === 'light'
										? config.theme_light.text
										: config.theme_dark.text}
									onchange={(e) =>
										updateThemeToken(themeType, 'text', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={themeType === 'light'
										? config.theme_light.text
										: config.theme_dark.text}
									oninput={(e) =>
										updateThemeToken(themeType, 'text', e.currentTarget.value)}
								/>
							</div>

							<div class="form-group full-width">
								<label>Font Family</label>
								<input
									type="text"
									value={themeType === 'light'
										? config.theme_light.font
										: config.theme_dark.font}
									oninput={(e) =>
										updateThemeToken(themeType, 'font', e.currentTarget.value)}
									placeholder="system-ui, -apple-system, sans-serif"
								/>
							</div>
						</div>

						<h3>Per-Page-Type Overrides</h3>
						<p class="help-text">
							Override theme tokens for specific page types. Leave blank to use base theme.
						</p>

						<div class="form-group">
							<label>Page Type</label>
							<select bind:value={pageThemeType}>
								<option value="home">Home (/)</option>
								<option value="search_results">Search Results</option>
								<option value="search_advanced">Advanced Search</option>
								<option value="catalog_browse">Catalog Browse</option>
								<option value="record_details">Record Details</option>
								<option value="public_default">Public Default (Fallback)</option>
							</select>
						</div>

						<div class="color-grid">
							<div class="form-group">
								<label>Primary (Override)</label>
								<input
									type="color"
									value={config.page_themes?.[pageThemeType]?.primary || ''}
									onchange={(e) =>
										updatePageTheme(pageThemeType, 'primary', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={config.page_themes?.[pageThemeType]?.primary || ''}
									oninput={(e) =>
										updatePageTheme(pageThemeType, 'primary', e.currentTarget.value)}
									placeholder="Leave blank for base theme"
								/>
							</div>

							<div class="form-group">
								<label>Secondary (Override)</label>
								<input
									type="color"
									value={config.page_themes?.[pageThemeType]?.secondary || ''}
									onchange={(e) =>
										updatePageTheme(pageThemeType, 'secondary', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={config.page_themes?.[pageThemeType]?.secondary || ''}
									oninput={(e) =>
										updatePageTheme(pageThemeType, 'secondary', e.currentTarget.value)}
									placeholder="Leave blank for base theme"
								/>
							</div>

							<div class="form-group">
								<label>Accent (Override)</label>
								<input
									type="color"
									value={config.page_themes?.[pageThemeType]?.accent || ''}
									onchange={(e) =>
										updatePageTheme(pageThemeType, 'accent', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={config.page_themes?.[pageThemeType]?.accent || ''}
									oninput={(e) =>
										updatePageTheme(pageThemeType, 'accent', e.currentTarget.value)}
									placeholder="Leave blank for base theme"
								/>
							</div>

							<div class="form-group">
								<label>Background (Override)</label>
								<input
									type="color"
									value={config.page_themes?.[pageThemeType]?.background || ''}
									onchange={(e) =>
										updatePageTheme(pageThemeType, 'background', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={config.page_themes?.[pageThemeType]?.background || ''}
									oninput={(e) =>
										updatePageTheme(pageThemeType, 'background', e.currentTarget.value)}
									placeholder="Leave blank for base theme"
								/>
							</div>

							<div class="form-group">
								<label>Text (Override)</label>
								<input
									type="color"
									value={config.page_themes?.[pageThemeType]?.text || ''}
									onchange={(e) =>
										updatePageTheme(pageThemeType, 'text', e.currentTarget.value)}
								/>
								<input
									type="text"
									value={config.page_themes?.[pageThemeType]?.text || ''}
									oninput={(e) =>
										updatePageTheme(pageThemeType, 'text', e.currentTarget.value)}
									placeholder="Leave blank for base theme"
								/>
							</div>
						</div>

						<button class="btn-secondary" onclick={() => clearPageTheme(pageThemeType)}>
							Clear {pageThemeType} Overrides
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="actions">
		<button class="btn-primary" onclick={saveConfig} disabled={saving}>
			{saving ? 'Saving...' : 'Save Configuration'}
		</button>
		<button class="btn-secondary" onclick={resetConfig} disabled={saving}>
			Reset Changes
		</button>
	</div>
</div>

<style>
	.admin-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.subtitle {
		color: #666;
		font-size: 0.95rem;
		margin: 0;
	}

	.message {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 2rem;
		background: #e0e0e0;
		border: 1px solid #ccc;
	}

	.message.success {
		background: #d4edda;
		border-color: #c3e6cb;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border-color: #f5c6cb;
		color: #721c24;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 2px solid #ddd;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 1rem;
		color: #666;
		transition: all 0.2s;
	}

	.tab:hover {
		color: #333;
		background: #f5f5f5;
	}

	.tab.active {
		color: #e73b42;
		border-bottom-color: #e73b42;
		font-weight: 600;
	}

	.config-container {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.config-section h2 {
		margin: 0 0 1.5rem 0;
		color: #333;
	}

	.config-section h3 {
		margin: 2rem 0 1rem 0;
		color: #555;
		font-size: 1.1rem;
	}

	.config-section h4 {
		margin: 1rem 0 0.5rem 0;
		color: #666;
		font-size: 0.95rem;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		cursor: pointer;
	}

	.toggle-label input[type='checkbox'] {
		width: 1.2rem;
		height: 1.2rem;
		cursor: pointer;
	}

	.toggle-label span {
		font-weight: 500;
		color: #333;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.form-group input[type='text'],
	.form-group input[type='url'],
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.form-group textarea {
		resize: vertical;
	}

	.help-text {
		margin: 0.5rem 0 0 0;
		font-size: 0.85rem;
		color: #666;
	}

	.link-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.link-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #f9f9f9;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
	}

	.link-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.link-info strong {
		color: #333;
	}

	.link-url {
		font-size: 0.85rem;
		color: #666;
	}

	.link-actions {
		display: flex;
		gap: 0.5rem;
	}

	.link-actions button {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.link-actions button:hover {
		background: #f5f5f5;
	}

	.link-actions button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-link-form {
		padding: 1rem;
		background: #f0f8ff;
		border: 1px solid #d0e8ff;
		border-radius: 4px;
	}

	.form-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.form-row input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.form-row button {
		padding: 0.75rem 1.5rem;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.form-row button:hover {
		background: #d12d34;
	}

	.theme-editors {
		margin-top: 1.5rem;
	}

	.theme-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.theme-tab {
		padding: 0.75rem 1.5rem;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.theme-tab:hover {
		background: #e8e8e8;
	}

	.theme-tab.active {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
	}

	.theme-editor {
		padding: 1.5rem;
		background: #fafafa;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.color-grid .form-group {
		margin-bottom: 0;
	}

	.color-grid .form-group.full-width {
		grid-column: 1 / -1;
	}

	.color-grid .form-group input[type='color'] {
		width: 60px;
		height: 40px;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		margin-bottom: 0.5rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.btn-primary,
	.btn-secondary,
	.btn-danger {
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #f5f5f5;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #e8e8e8;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	@media (max-width: 768px) {
		.admin-page {
			padding: 1rem;
		}

		.tabs {
			overflow-x: auto;
		}

		.config-container {
			padding: 1rem;
		}

		.color-grid {
			grid-template-columns: 1fr;
		}

		.form-row {
			flex-direction: column;
		}

		.form-row input,
		.form-row button {
			width: 100%;
		}

		.actions {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
