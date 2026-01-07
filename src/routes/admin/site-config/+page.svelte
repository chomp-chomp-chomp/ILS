<script lang="ts">
	import type { PageData } from './$types';
	import { supabase } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';
	import type { 
		SiteConfiguration, 
		HeaderLink, 
		FooterLink, 
		HomepageInfoLink,
		ThemeTokens 
	} from '$lib/types/site-config';

	let { data }: { data: PageData } = $props();

	let config = $state<SiteConfiguration>({ ...data.siteConfig });
	let message = $state('');
	let messageType = $state<'success' | 'error'>('success');
	let saving = $state(false);
	let activeTab = $state<'header' | 'footer' | 'homepage' | 'theme'>('header');

	// New link states
	let newHeaderLink = $state({ title: '', url: '', order: 0 });
	let newFooterLink = $state({ title: '', url: '', order: 0 });
	let newHomepageLink = $state({ title: '', url: '', order: 0 });

	// Theme editing states
	let editingLightTheme = $state('');
	let editingDarkTheme = $state('');
	let selectedPageType = $state<string>('home');

	$effect(() => {
		// Sync JSON strings when config changes
		editingLightTheme = JSON.stringify(config.theme_light, null, 2);
		editingDarkTheme = JSON.stringify(config.theme_dark, null, 2);
	});

	// Header link management
	function addHeaderLink() {
		if (!newHeaderLink.title || !newHeaderLink.url) {
			showMessage('Title and URL are required', 'error');
			return;
		}
		
		const maxOrder = config.header_links.reduce((max, link) => Math.max(max, link.order), 0);
		config.header_links = [
			...config.header_links,
			{ ...newHeaderLink, order: maxOrder + 1 }
		];
		newHeaderLink = { title: '', url: '', order: 0 };
		showMessage('Header link added', 'success');
	}

	function removeHeaderLink(index: number) {
		config.header_links = config.header_links.filter((_, i) => i !== index);
		showMessage('Header link removed', 'success');
	}

	function moveHeaderLink(index: number, direction: 'up' | 'down') {
		const links = [...config.header_links];
		if (direction === 'up' && index > 0) {
			[links[index - 1], links[index]] = [links[index], links[index - 1]];
		} else if (direction === 'down' && index < links.length - 1) {
			[links[index], links[index + 1]] = [links[index + 1], links[index]];
		}
		// Update order values
		links.forEach((link, i) => link.order = i);
		config.header_links = links;
	}

	// Footer link management
	function addFooterLink() {
		if (!newFooterLink.title || !newFooterLink.url) {
			showMessage('Title and URL are required', 'error');
			return;
		}
		
		const maxOrder = config.footer_links.reduce((max, link) => Math.max(max, link.order), 0);
		config.footer_links = [
			...config.footer_links,
			{ ...newFooterLink, order: maxOrder + 1 }
		];
		newFooterLink = { title: '', url: '', order: 0 };
		showMessage('Footer link added', 'success');
	}

	function removeFooterLink(index: number) {
		config.footer_links = config.footer_links.filter((_, i) => i !== index);
		showMessage('Footer link removed', 'success');
	}

	function moveFooterLink(index: number, direction: 'up' | 'down') {
		const links = [...config.footer_links];
		if (direction === 'up' && index > 0) {
			[links[index - 1], links[index]] = [links[index], links[index - 1]];
		} else if (direction === 'down' && index < links.length - 1) {
			[links[index], links[index + 1]] = [links[index + 1], links[index]];
		}
		links.forEach((link, i) => link.order = i);
		config.footer_links = links;
	}

	// Homepage link management
	function addHomepageLink() {
		if (!newHomepageLink.title || !newHomepageLink.url) {
			showMessage('Title and URL are required', 'error');
			return;
		}
		
		const maxOrder = config.homepage_info_links.reduce((max, link) => Math.max(max, link.order), 0);
		config.homepage_info_links = [
			...config.homepage_info_links,
			{ ...newHomepageLink, order: maxOrder + 1 }
		];
		newHomepageLink = { title: '', url: '', order: 0 };
		showMessage('Homepage link added', 'success');
	}

	function removeHomepageLink(index: number) {
		config.homepage_info_links = config.homepage_info_links.filter((_, i) => i !== index);
		showMessage('Homepage link removed', 'success');
	}

	function moveHomepageLink(index: number, direction: 'up' | 'down') {
		const links = [...config.homepage_info_links];
		if (direction === 'up' && index > 0) {
			[links[index - 1], links[index]] = [links[index], links[index - 1]];
		} else if (direction === 'down' && index < links.length - 1) {
			[links[index], links[index + 1]] = [links[index + 1], links[index]];
		}
		links.forEach((link, i) => link.order = i);
		config.homepage_info_links = links;
	}

	// Theme management
	function updateThemeFromJSON() {
		try {
			config.theme_light = JSON.parse(editingLightTheme);
			config.theme_dark = JSON.parse(editingDarkTheme);
			showMessage('Theme JSON updated', 'success');
		} catch (error) {
			showMessage('Invalid JSON format', 'error');
		}
	}

	function showMessage(msg: string, type: 'success' | 'error' = 'success') {
		message = msg;
		messageType = type;
		setTimeout(() => { message = ''; }, 3000);
	}

	async function saveConfiguration() {
		saving = true;
		message = '';

		try {
			// Update theme from JSON editors
			updateThemeFromJSON();

			const { data: sessionData } = await supabase.auth.getSession();
			const accessToken = sessionData?.session?.access_token;

			if (!accessToken) {
				throw new Error('Not authenticated. Please log in again.');
			}

			const response = await fetch('/api/site-config', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`
				},
				body: JSON.stringify(config)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to save configuration');
			}

			if (result.success) {
				showMessage('Configuration saved successfully!', 'success');
				// Update local config with returned data
				config = result.config;
				// Invalidate all data to refresh the page
				await invalidateAll();
			} else {
				throw new Error(result.message || 'Failed to save configuration');
			}
		} catch (error) {
			console.error('Error saving configuration:', error);
			showMessage(error instanceof Error ? error.message : 'Failed to save configuration', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="admin-container">
	<div class="admin-header">
		<h1>Site Configuration</h1>
		<p class="subtitle">Configure public site content, header, footer, and theming</p>
	</div>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<!-- Tab Navigation -->
	<div class="tabs">
		<button 
			class="tab" 
			class:active={activeTab === 'header'}
			onclick={() => activeTab = 'header'}
		>
			Header
		</button>
		<button 
			class="tab" 
			class:active={activeTab === 'footer'}
			onclick={() => activeTab = 'footer'}
		>
			Footer
		</button>
		<button 
			class="tab" 
			class:active={activeTab === 'homepage'}
			onclick={() => activeTab = 'homepage'}
		>
			Homepage Info
		</button>
		<button 
			class="tab" 
			class:active={activeTab === 'theme'}
			onclick={() => activeTab = 'theme'}
		>
			Theme
		</button>
	</div>

	<!-- Tab Content -->
	<div class="tab-content">
		{#if activeTab === 'header'}
			<div class="config-section">
				<h2>Header Configuration</h2>
				
				<div class="form-group">
					<label>
						<input type="checkbox" bind:checked={config.header_enabled} />
						Enable Custom Header
					</label>
					<p class="help-text">Show custom header on all non-admin pages</p>
				</div>

				<div class="form-group">
					<label for="header-logo">Header Logo URL</label>
					<input 
						id="header-logo"
						type="url" 
						bind:value={config.header_logo_url}
						placeholder="https://example.com/logo.png"
					/>
					<p class="help-text">URL of the logo image to display in the header</p>
				</div>

				<div class="form-group">
					<h3>Header Links</h3>
					<p class="help-text">Add navigation links to the header</p>

					{#if config.header_links.length > 0}
						<div class="links-list">
							{#each config.header_links as link, index}
								<div class="link-item">
									<div class="link-info">
										<strong>{link.title}</strong>
										<span class="link-url">{link.url}</span>
									</div>
									<div class="link-actions">
										<button 
											type="button"
											class="btn-icon"
											onclick={() => moveHeaderLink(index, 'up')}
											disabled={index === 0}
											title="Move up"
										>↑</button>
										<button 
											type="button"
											class="btn-icon"
											onclick={() => moveHeaderLink(index, 'down')}
											disabled={index === config.header_links.length - 1}
											title="Move down"
										>↓</button>
										<button 
											type="button"
											class="btn-danger btn-icon"
											onclick={() => removeHeaderLink(index)}
											title="Remove"
										>🗑</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="add-link-form">
						<input 
							type="text" 
							bind:value={newHeaderLink.title}
							placeholder="Link Title"
						/>
						<input 
							type="url" 
							bind:value={newHeaderLink.url}
							placeholder="https://example.com"
						/>
						<button type="button" class="btn-secondary" onclick={addHeaderLink}>
							Add Link
						</button>
					</div>
				</div>
			</div>

		{:else if activeTab === 'footer'}
			<div class="config-section">
				<h2>Footer Configuration</h2>
				
				<div class="form-group">
					<label>
						<input type="checkbox" bind:checked={config.footer_enabled} />
						Enable Footer
					</label>
					<p class="help-text">Show footer on all non-admin pages</p>
				</div>

				<div class="form-group">
					<label for="footer-text">Footer Text</label>
					<textarea 
						id="footer-text"
						bind:value={config.footer_text}
						placeholder="Copyright © 2024 Your Library"
						rows="3"
					></textarea>
					<p class="help-text">Main footer text (plain text)</p>
				</div>

				<div class="form-group">
					<h3>Footer Links</h3>
					<p class="help-text">Add links to the footer</p>

					{#if config.footer_links.length > 0}
						<div class="links-list">
							{#each config.footer_links as link, index}
								<div class="link-item">
									<div class="link-info">
										<strong>{link.title}</strong>
										<span class="link-url">{link.url}</span>
									</div>
									<div class="link-actions">
										<button 
											type="button"
											class="btn-icon"
											onclick={() => moveFooterLink(index, 'up')}
											disabled={index === 0}
											title="Move up"
										>↑</button>
										<button 
											type="button"
											class="btn-icon"
											onclick={() => moveFooterLink(index, 'down')}
											disabled={index === config.footer_links.length - 1}
											title="Move down"
										>↓</button>
										<button 
											type="button"
											class="btn-danger btn-icon"
											onclick={() => removeFooterLink(index)}
											title="Remove"
										>🗑</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="add-link-form">
						<input 
							type="text" 
							bind:value={newFooterLink.title}
							placeholder="Link Title"
						/>
						<input 
							type="url" 
							bind:value={newFooterLink.url}
							placeholder="https://example.com"
						/>
						<button type="button" class="btn-secondary" onclick={addFooterLink}>
							Add Link
						</button>
					</div>
				</div>
			</div>

		{:else if activeTab === 'homepage'}
			<div class="config-section">
				<h2>Homepage Info Section</h2>
				
				<div class="form-group">
					<label>
						<input type="checkbox" bind:checked={config.homepage_info_enabled} />
						Enable Homepage Info Section
					</label>
					<p class="help-text">Show info section on homepage below search box</p>
				</div>

				<div class="form-group">
					<label for="homepage-title">Section Title</label>
					<input 
						id="homepage-title"
						type="text" 
						bind:value={config.homepage_info_title}
						placeholder="Quick Links"
					/>
				</div>

				<div class="form-group">
					<label for="homepage-content">Section Content</label>
					<textarea 
						id="homepage-content"
						bind:value={config.homepage_info_content}
						placeholder="Add plain text content here..."
						rows="5"
					></textarea>
					<p class="help-text">Plain text content for the info section</p>
				</div>

				<div class="form-group">
					<h3>Homepage Links</h3>
					<p class="help-text">Add quick links to the homepage info section</p>

					{#if config.homepage_info_links.length > 0}
						<div class="links-list">
							{#each config.homepage_info_links as link, index}
								<div class="link-item">
									<div class="link-info">
										<strong>{link.title}</strong>
										<span class="link-url">{link.url}</span>
									</div>
									<div class="link-actions">
										<button 
											type="button"
											class="btn-icon"
											onclick={() => moveHomepageLink(index, 'up')}
											disabled={index === 0}
											title="Move up"
										>↑</button>
										<button 
											type="button"
											class="btn-icon"
											onclick={() => moveHomepageLink(index, 'down')}
											disabled={index === config.homepage_info_links.length - 1}
											title="Move down"
										>↓</button>
										<button 
											type="button"
											class="btn-danger btn-icon"
											onclick={() => removeHomepageLink(index)}
											title="Remove"
										>🗑</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="add-link-form">
						<input 
							type="text" 
							bind:value={newHomepageLink.title}
							placeholder="Link Title"
						/>
						<input 
							type="url" 
							bind:value={newHomepageLink.url}
							placeholder="https://example.com"
						/>
						<button type="button" class="btn-secondary" onclick={addHomepageLink}>
							Add Link
						</button>
					</div>
				</div>
			</div>

		{:else if activeTab === 'theme'}
			<div class="config-section">
				<h2>Theme Configuration</h2>
				
				<div class="form-group">
					<label for="theme-mode">Default Theme Mode</label>
					<select id="theme-mode" bind:value={config.theme_mode}>
						<option value="system">System (Auto)</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
					<p class="help-text">Default theme before user selects preference</p>
				</div>

				<div class="theme-editors">
					<div class="theme-editor">
						<h3>Light Theme Tokens</h3>
						<p class="help-text">CSS variable values for light theme (JSON format)</p>
						<textarea 
							bind:value={editingLightTheme}
							rows="12"
							class="code-editor"
							placeholder="Light theme JSON tokens"
						></textarea>
					</div>

					<div class="theme-editor">
						<h3>Dark Theme Tokens</h3>
						<p class="help-text">CSS variable values for dark theme (JSON format)</p>
						<textarea 
							bind:value={editingDarkTheme}
							rows="12"
							class="code-editor"
							placeholder="Dark theme JSON tokens"
						></textarea>
					</div>
				</div>

				<div class="form-group">
					<h3>Per-Page Theme Overrides</h3>
					<p class="help-text">Configure theme variations for specific page types</p>
					<p class="info-message">
						Advanced: Configure specific color overrides for different page types. 
						Edit in database directly or future enhancement.
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Save Button -->
	<div class="actions">
		<button 
			class="btn-primary" 
			onclick={saveConfiguration}
			disabled={saving}
		>
			{saving ? 'Saving...' : 'Save Configuration'}
		</button>
		<a href="/admin" class="btn-secondary">Cancel</a>
	</div>
</div>

<style>
	.admin-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.admin-header {
		margin-bottom: 2rem;
	}

	.admin-header h1 {
		font-size: 2rem;
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.subtitle {
		color: #666;
		margin: 0;
	}

	.message {
		padding: 1rem;
		border-radius: 6px;
		margin-bottom: 1.5rem;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 2px solid #e0e0e0;
		margin-bottom: 2rem;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: #666;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
		position: relative;
		bottom: -2px;
	}

	.tab:hover {
		color: #e73b42;
	}

	.tab.active {
		color: #e73b42;
		border-bottom-color: #e73b42;
		font-weight: 600;
	}

	.tab-content {
		min-height: 400px;
	}

	.config-section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.config-section h2 {
		margin: 0 0 1.5rem 0;
		color: #333;
	}

	.config-section h3 {
		margin: 1.5rem 0 0.75rem 0;
		color: #444;
		font-size: 1.1rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		color: #333;
		font-weight: 500;
	}

	.form-group input[type="text"],
	.form-group input[type="url"],
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group input[type="checkbox"] {
		margin-right: 0.5rem;
	}

	.help-text {
		font-size: 0.875rem;
		color: #666;
		margin: 0.5rem 0 0 0;
	}

	.info-message {
		background: #e3f2fd;
		padding: 1rem;
		border-radius: 6px;
		color: #1565c0;
		font-size: 0.875rem;
		margin: 0;
	}

	.links-list {
		margin: 1rem 0;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		overflow: hidden;
	}

	.link-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
		background: white;
	}

	.link-item:last-child {
		border-bottom: none;
	}

	.link-item:hover {
		background: #f5f5f5;
	}

	.link-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.link-url {
		font-size: 0.875rem;
		color: #666;
	}

	.link-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		padding: 0.5rem;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 1rem;
	}

	.btn-icon:hover:not(:disabled) {
		background: #e0e0e0;
	}

	.btn-icon:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-danger {
		background: #f8d7da;
		border-color: #f5c6cb;
	}

	.btn-danger:hover:not(:disabled) {
		background: #f5c6cb;
	}

	.add-link-form {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.add-link-form input {
		flex: 1;
	}

	.theme-editors {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin: 1.5rem 0;
	}

	.theme-editor h3 {
		margin-top: 0;
	}

	.code-editor {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.9rem;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 1rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid #e0e0e0;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 2rem;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
		display: inline-block;
		text-align: center;
		border: none;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #f5f5f5;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #e0e0e0;
	}

	@media (max-width: 768px) {
		.admin-container {
			padding: 1rem;
		}

		.tabs {
			overflow-x: auto;
		}

		.tab {
			white-space: nowrap;
			padding: 0.5rem 1rem;
			font-size: 0.9rem;
		}

		.theme-editors {
			grid-template-columns: 1fr;
		}

		.add-link-form {
			flex-direction: column;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
