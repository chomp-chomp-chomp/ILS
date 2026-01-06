<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let branding = $state({ ...data.branding });
	let message = $state('');
	let saving = $state(false);

	// State for new link forms
	let newHeaderLinkTitle = $state('');
	let newHeaderLinkUrl = $state('');
	let newInfoLinkTitle = $state('');
	let newInfoLinkUrl = $state('');

	async function saveBranding() {
		saving = true;
		message = '';

		try {
			const response = await fetch('/api/branding', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(branding)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save branding');
			}

			message = 'Branding settings saved successfully!';
			setTimeout(() => (message = ''), 3000);
		} catch (error) {
			message = error instanceof Error ? error.message : 'Error saving branding';
			console.error('Save error:', error);
		} finally {
			saving = false;
		}
	}

	function addHeaderLink() {
		if (newHeaderLinkTitle && newHeaderLinkUrl) {
			const maxOrder = branding.header_links?.reduce((max: number, link: any) => Math.max(max, link.order || 0), 0) || 0;
			branding.header_links = [...(branding.header_links || []), {
				title: newHeaderLinkTitle,
				url: newHeaderLinkUrl,
				order: maxOrder + 1
			}];
			newHeaderLinkTitle = '';
			newHeaderLinkUrl = '';
		}
	}

	function removeHeaderLink(index: number) {
		branding.header_links = branding.header_links.filter((_: any, i: number) => i !== index);
	}

	function addInfoLink() {
		if (newInfoLinkTitle && newInfoLinkUrl) {
			const maxOrder = branding.homepage_info_links?.reduce((max: number, link: any) => Math.max(max, link.order || 0), 0) || 0;
			branding.homepage_info_links = [...(branding.homepage_info_links || []), {
				title: newInfoLinkTitle,
				url: newInfoLinkUrl,
				order: maxOrder + 1
			}];
			newInfoLinkTitle = '';
			newInfoLinkUrl = '';
		}
	}

	function removeInfoLink(index: number) {
		branding.homepage_info_links = branding.homepage_info_links.filter((_: any, i: number) => i !== index);
	}
</script>

<div class="branding-page">
	<header class="page-header">
		<h1>Branding & Appearance</h1>
		<p class="subtitle">Customize your library's visual identity and appearance</p>
	</header>

	{#if message}
		<div class="message" class:success={message.includes('success')} class:error={!message.includes('success')}>
			{message}
		</div>
	{/if}

	<div class="branding-layout">
		<div class="settings-panel">
			<form onsubmit={(e) => { e.preventDefault(); saveBranding(); }}>
				<!-- Library Identity -->
				<section class="settings-section">
					<h2>Library Identity</h2>

					<div class="form-group">
						<label for="library_name">Library Name</label>
						<input
							id="library_name"
							type="text"
							bind:value={branding.library_name}
							placeholder="Library Catalog"
							required
						/>
					</div>

					<div class="form-group">
						<label for="library_tagline">Tagline (optional)</label>
						<input
							id="library_tagline"
							type="text"
							bind:value={branding.library_tagline}
							placeholder="Explore our collection"
						/>
					</div>
				</section>

				<!-- Logos -->
				<section class="settings-section">
					<h2>Logos & Icons</h2>

					<div class="form-group">
						<label for="logo_url">Navigation Logo URL (optional)</label>
						<input
							id="logo_url"
							type="url"
							bind:value={branding.logo_url}
							placeholder="https://example.com/logo.png"
						/>
						<small>Logo for site navigation/header (not currently displayed)</small>
					</div>

					<div class="form-group">
						<label for="homepage_logo_url">Homepage Hero Logo URL</label>
						<input
							id="homepage_logo_url"
							type="url"
							bind:value={branding.homepage_logo_url}
							placeholder="https://example.com/homepage-logo.png"
						/>
						<small>Large logo displayed on homepage (currently shown)</small>
					</div>

					<div class="form-group">
						<label for="favicon_url">Favicon URL</label>
						<input
							id="favicon_url"
							type="url"
							bind:value={branding.favicon_url}
							placeholder="https://example.com/favicon.ico"
						/>
						<small>Small icon shown in browser tabs</small>
					</div>
				</section>

				<!-- Color Scheme -->
				<section class="settings-section">
					<h2>Color Scheme</h2>

					<div class="color-grid">
						<div class="form-group">
							<label for="primary_color">
								Primary Color
								<span class="color-preview" style="background: {branding.primary_color}"></span>
							</label>
							<input
								id="primary_color"
								type="color"
								bind:value={branding.primary_color}
							/>
						</div>

						<div class="form-group">
							<label for="secondary_color">
								Secondary Color
								<span class="color-preview" style="background: {branding.secondary_color}"></span>
							</label>
							<input
								id="secondary_color"
								type="color"
								bind:value={branding.secondary_color}
							/>
						</div>

						<div class="form-group">
							<label for="accent_color">
								Accent Color
								<span class="color-preview" style="background: {branding.accent_color}"></span>
							</label>
							<input
								id="accent_color"
								type="color"
								bind:value={branding.accent_color}
							/>
						</div>

						<div class="form-group">
							<label for="background_color">
								Background Color
								<span class="color-preview" style="background: {branding.background_color}"></span>
							</label>
							<input
								id="background_color"
								type="color"
								bind:value={branding.background_color}
							/>
						</div>

						<div class="form-group">
							<label for="text_color">
								Text Color
								<span class="color-preview" style="background: {branding.text_color}"></span>
							</label>
							<input
								id="text_color"
								type="color"
								bind:value={branding.text_color}
							/>
						</div>
					</div>
				</section>

				<!-- Typography -->
				<section class="settings-section">
					<h2>Typography</h2>

					<div class="form-group">
						<label for="font_family">Body Font</label>
						<input
							id="font_family"
							type="text"
							bind:value={branding.font_family}
							placeholder="system-ui, -apple-system, sans-serif"
						/>
						<small>CSS font-family value</small>
					</div>

					<div class="form-group">
						<label for="heading_font">Heading Font (optional)</label>
						<input
							id="heading_font"
							type="text"
							bind:value={branding.heading_font}
							placeholder="Leave empty to use body font"
						/>
					</div>
				</section>

				<!-- Contact Information -->
				<section class="settings-section">
					<h2>Contact Information</h2>

					<div class="form-group">
						<label for="contact_email">Email</label>
						<input
							id="contact_email"
							type="email"
							bind:value={branding.contact_email}
							placeholder="library@example.com"
						/>
					</div>

					<div class="form-group">
						<label for="contact_phone">Phone</label>
						<input
							id="contact_phone"
							type="tel"
							bind:value={branding.contact_phone}
							placeholder="(555) 123-4567"
						/>
					</div>

					<div class="form-group">
						<label for="contact_address">Address</label>
						<textarea
							id="contact_address"
							bind:value={branding.contact_address}
							placeholder="123 Library St, City, State 12345"
							rows="3"
						></textarea>
					</div>
				</section>

				<!-- Social Media -->
				<section class="settings-section">
					<h2>Social Media</h2>

					<div class="form-group">
						<label for="facebook_url">Facebook URL</label>
						<input
							id="facebook_url"
							type="url"
							bind:value={branding.facebook_url}
							placeholder="https://facebook.com/yourlibrary"
						/>
					</div>

					<div class="form-group">
						<label for="twitter_url">Twitter/X URL</label>
						<input
							id="twitter_url"
							type="url"
							bind:value={branding.twitter_url}
							placeholder="https://twitter.com/yourlibrary"
						/>
					</div>

					<div class="form-group">
						<label for="instagram_url">Instagram URL</label>
						<input
							id="instagram_url"
							type="url"
							bind:value={branding.instagram_url}
							placeholder="https://instagram.com/yourlibrary"
						/>
					</div>
				</section>

				<!-- Footer -->
				<section class="settings-section">
					<h2>Footer</h2>

					<div class="form-group">
						<label for="footer_text">Footer Text</label>
						<input
							id="footer_text"
							type="text"
							bind:value={branding.footer_text}
							placeholder="Powered by Open Library System"
						/>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={branding.show_powered_by} />
							Show "Powered by" footer
						</label>
					</div>
				</section>

				<!-- Feature Toggles -->
				<section class="settings-section">
					<h2>Display Features</h2>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={branding.show_covers} />
							Show book covers in search results
						</label>
					</div>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={branding.show_facets} />
							Show faceted search filters
						</label>
					</div>

					<div class="form-group">
						<label for="items_per_page">Items per page</label>
						<input
							id="items_per_page"
							type="number"
							bind:value={branding.items_per_page}
							min="5"
							max="100"
						/>
					</div>
				</section>

				<!-- Advanced -->
				<section class="settings-section">
					<h2>Advanced</h2>

					<div class="form-group">
						<label for="custom_css">Custom CSS</label>
						<textarea
							id="custom_css"
							bind:value={branding.custom_css}
							placeholder="Enter custom CSS styles here"
							rows="6"
							style="font-family: monospace;"
						></textarea>
						<small>Advanced: Add custom CSS to override default styles</small>
					</div>

					<div class="form-group">
						<label for="custom_head_html">Custom HTML (Head)</label>
						<textarea
							id="custom_head_html"
							bind:value={branding.custom_head_html}
							placeholder="<script>...</script>"
							rows="4"
							style="font-family: monospace;"
						></textarea>
						<small>Advanced: Add analytics, fonts, or other head elements</small>
					</div>
				</section>

				<!-- Header Navigation -->
				<section class="settings-section">
					<h2>Header Navigation</h2>
					<p class="section-description">Configure a site-wide header with custom navigation links</p>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={branding.show_header} />
							Show header navigation on all pages
						</label>
					</div>

					{#if branding.show_header}
						<div class="links-manager">
							<h3>Header Links</h3>
							{#if !branding.header_links || branding.header_links.length === 0}
								<p class="empty-state">No header links yet. Add your first link below.</p>
							{:else}
								<div class="links-list">
									{#each [...branding.header_links].sort((a, b) => a.order - b.order) as link, index}
										<div class="link-item">
											<span class="link-order">{link.order}</span>
											<div class="link-details">
												<strong>{link.title}</strong>
												<small>{link.url}</small>
											</div>
											<div class="link-actions">
												<button
													type="button"
													class="btn-icon"
													onclick={() => removeHeaderLink(index)}
													title="Remove link"
												>
													🗑️
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<div class="add-link-form">
								<input
									type="text"
									placeholder="Link title"
									bind:value={newHeaderLinkTitle}
								/>
								<input
									type="url"
									placeholder="URL (e.g., /page or https://...)"
									bind:value={newHeaderLinkUrl}
								/>
								<button
									type="button"
									class="btn-small"
									onclick={addHeaderLink}
								>
									Add Link
								</button>
							</div>
						</div>
					{/if}
				</section>

				<!-- Homepage Info Section -->
				<section class="settings-section">
					<h2>Homepage Info Section</h2>
					<p class="section-description">Add a customizable info section below the search box on the homepage</p>

					<div class="form-group checkbox">
						<label>
							<input type="checkbox" bind:checked={branding.show_homepage_info} />
							Show info section on homepage
						</label>
					</div>

					{#if branding.show_homepage_info}
						<div class="form-group">
							<label for="homepage_info_title">Section Title</label>
							<input
								id="homepage_info_title"
								type="text"
								bind:value={branding.homepage_info_title}
								placeholder="Quick Links"
							/>
						</div>

						<div class="form-group">
							<label for="homepage_info_content">Content (HTML supported)</label>
							<textarea
								id="homepage_info_content"
								bind:value={branding.homepage_info_content}
								placeholder="<p>Welcome message or instructions...</p>"
								rows="4"
							></textarea>
							<small>You can use HTML tags for formatting</small>
						</div>

						<div class="links-manager">
							<h3>Quick Links</h3>
							{#if !branding.homepage_info_links || branding.homepage_info_links.length === 0}
								<p class="empty-state">No links yet. Add helpful links for your users.</p>
							{:else}
								<div class="links-list">
									{#each [...branding.homepage_info_links].sort((a, b) => a.order - b.order) as link, index}
										<div class="link-item">
											<span class="link-order">{link.order}</span>
											<div class="link-details">
												<strong>{link.title}</strong>
												<small>{link.url}</small>
											</div>
											<div class="link-actions">
												<button
													type="button"
													class="btn-icon"
													onclick={() => removeInfoLink(index)}
													title="Remove link"
												>
													🗑️
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<div class="add-link-form">
								<input
									type="text"
									placeholder="Link title"
									bind:value={newInfoLinkTitle}
								/>
								<input
									type="url"
									placeholder="URL"
									bind:value={newInfoLinkUrl}
								/>
								<button
									type="button"
									class="btn-small"
									onclick={addInfoLink}
								>
									Add Link
								</button>
							</div>
						</div>
					{/if}
				</section>

				<!-- Actions -->
				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={saving}>
						{saving ? 'Saving...' : 'Save Changes'}
					</button>
					<button type="button" class="btn-secondary" onclick={() => (branding = { ...data.branding })}>
						Reset
					</button>
				</div>
			</form>
		</div>

		<!-- Live Preview -->
		<div class="preview-panel">
			<h2>Preview</h2>
			<div class="preview-container">
				<div class="preview-sample" style="
					--primary: {branding.primary_color};
					--secondary: {branding.secondary_color};
					--accent: {branding.accent_color};
					--bg: {branding.background_color};
					--text: {branding.text_color};
					font-family: {branding.font_family};
				">
					{#if branding.logo_url}
						<img src={branding.logo_url} alt="Logo" class="preview-logo" />
					{/if}

					<h1 style="font-family: {branding.heading_font || branding.font_family}">
						{branding.library_name || 'Library Catalog'}
					</h1>

					{#if branding.library_tagline}
						<p class="preview-tagline">{branding.library_tagline}</p>
					{/if}

					<button class="preview-btn-primary">Primary Button</button>
					<button class="preview-btn-secondary">Secondary Button</button>

					<p class="preview-text">Sample body text in your chosen font and color.</p>

					<a href="#" class="preview-link">Sample link with accent color</a>

					{#if branding.footer_text}
						<footer class="preview-footer">{branding.footer_text}</footer>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.branding-page {
		max-width: 1600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 1.125rem;
	}

	.message {
		padding: 1rem 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		font-weight: 500;
	}

	.message.success {
		background: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
	}

	.branding-layout {
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: 2rem;
	}

	.settings-panel {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 2rem;
	}

	.settings-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.settings-section:last-of-type {
		border-bottom: none;
	}

	.settings-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.form-group input[type='text'],
	.form-group input[type='url'],
	.form-group input[type='email'],
	.form-group input[type='tel'],
	.form-group input[type='number'],
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group input[type='color'] {
		width: 80px;
		height: 40px;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
	}

	.form-group.checkbox label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.form-group.checkbox input[type='checkbox'] {
		width: auto;
		cursor: pointer;
	}

	.form-group small {
		display: block;
		margin-top: 0.25rem;
		color: #666;
		font-size: 0.875rem;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.color-preview {
		display: inline-block;
		width: 20px;
		height: 20px;
		border-radius: 3px;
		border: 1px solid #ddd;
		margin-left: 0.5rem;
		vertical-align: middle;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 2px solid #e0e0e0;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
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
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
	}

	.preview-panel {
		position: sticky;
		top: 2rem;
		height: fit-content;
	}

	.preview-panel h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.preview-container {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 2rem;
	}

	.preview-sample {
		text-align: center;
		padding: 2rem;
		background: var(--bg);
		color: var(--text);
		border-radius: 8px;
		border: 2px solid #e0e0e0;
	}

	.preview-logo {
		max-width: 200px;
		max-height: 100px;
		margin-bottom: 1rem;
	}

	.preview-sample h1 {
		margin: 0 0 0.5rem 0;
		color: var(--primary);
	}

	.preview-tagline {
		margin: 0 0 2rem 0;
		color: var(--text);
		opacity: 0.8;
	}

	.preview-btn-primary,
	.preview-btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-weight: 500;
		margin: 0.5rem;
		cursor: pointer;
	}

	.preview-btn-primary {
		background: var(--primary);
		color: white;
	}

	.preview-btn-secondary {
		background: var(--secondary);
		color: white;
	}

	.preview-text {
		margin: 2rem 0;
		color: var(--text);
	}

	.preview-link {
		display: block;
		color: var(--accent);
		text-decoration: underline;
		margin: 1rem 0;
	}

	.preview-footer {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid currentColor;
		opacity: 0.7;
		font-size: 0.875rem;
	}

	@media (max-width: 1200px) {
		.branding-layout {
			grid-template-columns: 1fr;
		}

		.preview-panel {
			position: static;
		}
	}

	/* Links Manager Styles */
	.links-manager {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: #f9f9f9;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.links-manager h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #333;
	}

	.links-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.link-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
	}

	.link-order {
		display: inline-block;
		width: 24px;
		height: 24px;
		background: #e73b42;
		color: white;
		border-radius: 50%;
		text-align: center;
		line-height: 24px;
		font-size: 0.75rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.link-details {
		flex: 1;
		min-width: 0;
	}

	.link-details strong {
		display: block;
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
		color: #333;
	}

	.link-details small {
		display: block;
		font-size: 0.8rem;
		color: #666;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.link-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		font-size: 1.2rem;
		transition: transform 0.2s;
	}

	.btn-icon:hover {
		transform: scale(1.2);
	}

	.add-link-form {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.add-link-form input {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.btn-small {
		padding: 0.5rem 1rem;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: background 0.2s;
	}

	.btn-small:hover {
		background: #d32f35;
	}

	.empty-state {
		color: #999;
		font-style: italic;
		padding: 1rem;
		text-align: center;
		background: white;
		border: 2px dashed #ddd;
		border-radius: 6px;
	}

	.section-description {
		color: #666;
		font-size: 0.9rem;
		margin: -0.5rem 0 1rem 0;
	}
</style>
