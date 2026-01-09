<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form state
	let headerLinks = $state(data.settings?.header_links || [
		{ title: 'Home', url: 'https://library.chompchomp.cc/' },
		{ title: 'Advanced Search', url: 'https://library.chompchomp.cc/catalog/search/advanced' },
		{ title: 'Chomp Chomp Tools', url: 'https://chompchomp.cc/tools/' },
		{ title: 'Chomp Chomp Recipes', url: 'https://chompchomp.cc/' }
	]);
	let footerText = $state(data.settings?.footer_text || 'Powered by Chomp Chomp');
	let footerLinkUrl = $state(data.settings?.footer_link_url || 'https://chompchomp.cc');
	let heroTitle = $state(data.settings?.hero_title || 'Welcome to the Chomp Chomp Library');
	let heroSubhead = $state(data.settings?.hero_subhead || 'Explore our collection');
	let heroImageUrl = $state(data.settings?.hero_image_url || 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516');
	let metadataFavicon = $state(data.settings?.metadata_favicon || '/favicon.ico');
	let metadataFavicon16 = $state(data.settings?.metadata_favicon_16 || '/favicon-16x16.png');
	let metadataFavicon32 = $state(data.settings?.metadata_favicon_32 || '/favicon-32x32.png');
	let metadataAppleTouchIcon = $state(data.settings?.metadata_apple_touch_icon || '/apple-touch-icon.png');
	let metadataAndroidChrome192 = $state(data.settings?.metadata_android_chrome_192 || '/android-chrome-192x192.png');
	let metadataAndroidChrome512 = $state(data.settings?.metadata_android_chrome_512 || '/android-chrome-512x512.png');

	let saving = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error'>('success');

	function addHeaderLink() {
		headerLinks = [...headerLinks, { title: '', url: '' }];
	}

	function removeHeaderLink(index: number) {
		headerLinks = headerLinks.filter((_, i) => i !== index);
	}

	async function handleSave() {
		saving = true;
		message = '';

		try {
			const response = await fetch('/api/site-settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					header_links: headerLinks,
					footer_text: footerText,
					footer_link_url: footerLinkUrl,
					hero_title: heroTitle,
					hero_subhead: heroSubhead,
					hero_image_url: heroImageUrl,
					metadata_favicon: metadataFavicon,
					metadata_favicon_16: metadataFavicon16,
					metadata_favicon_32: metadataFavicon32,
					metadata_apple_touch_icon: metadataAppleTouchIcon,
					metadata_android_chrome_192: metadataAndroidChrome192,
					metadata_android_chrome_512: metadataAndroidChrome512
				})
			});

			if (response.ok) {
				message = 'Settings saved successfully!';
				messageType = 'success';
			} else {
				const error = await response.text();
				message = `Error saving settings: ${error}`;
				messageType = 'error';
			}
		} catch (error) {
			message = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			messageType = 'error';
		} finally {
			saving = false;
		}
	}
</script>

<div class="admin-page">
	<div class="page-header">
		<h1>Site Settings</h1>
		<p>Configure site-wide header, footer, hero, and metadata assets</p>
	</div>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<!-- Header Links Section -->
		<section class="settings-section">
			<h2>Header Navigation Links</h2>
			<p class="section-description">These links appear in the header navigation bar on all public pages.</p>

			{#each headerLinks as link, i}
				<div class="link-row">
					<input
						type="text"
						bind:value={link.title}
						placeholder="Link Title (e.g., Home)"
						class="link-input"
						required
					/>
					<input
						type="url"
						bind:value={link.url}
						placeholder="URL (e.g., https://...)"
						class="link-input"
						required
					/>
					<button type="button" class="btn-remove" onclick={() => removeHeaderLink(i)}>Remove</button>
				</div>
			{/each}

			<button type="button" class="btn-secondary" onclick={addHeaderLink}>Add Link</button>
		</section>

		<!-- Footer Section -->
		<section class="settings-section">
			<h2>Footer</h2>
			<p class="section-description">Footer text and link displayed at the bottom of all public pages.</p>

			<label>
				<span>Footer Text</span>
				<input
					type="text"
					bind:value={footerText}
					placeholder="e.g., Powered by Chomp Chomp"
					required
				/>
			</label>

			<label>
				<span>Footer Link URL</span>
				<input
					type="url"
					bind:value={footerLinkUrl}
					placeholder="e.g., https://chompchomp.cc"
					required
				/>
			</label>
		</section>

		<!-- Hero Section -->
		<section class="settings-section">
			<h2>Homepage Hero</h2>
			<p class="section-description">Large banner section at the top of the homepage.</p>

			<label>
				<span>Hero Title</span>
				<input
					type="text"
					bind:value={heroTitle}
					placeholder="e.g., Welcome to the Chomp Chomp Library"
					required
				/>
			</label>

			<label>
				<span>Hero Subheading</span>
				<input
					type="text"
					bind:value={heroSubhead}
					placeholder="e.g., Explore our collection"
					required
				/>
			</label>

			<label>
				<span>Hero Background Image URL</span>
				<input
					type="url"
					bind:value={heroImageUrl}
					placeholder="e.g., https://ik.imagekit.io/..."
					required
				/>
			</label>
		</section>

		<!-- Metadata Section -->
		<section class="settings-section">
			<h2>Metadata Assets (Favicons &amp; Icons)</h2>
			<p class="section-description">
				Paths to favicon and icon files. Use repository paths (e.g., /favicon.ico) or external URLs.
			</p>

			<div class="metadata-grid">
				<label>
					<span>Favicon (ICO)</span>
					<input type="text" bind:value={metadataFavicon} placeholder="/favicon.ico" required />
				</label>

				<label>
					<span>Favicon 16x16 (PNG)</span>
					<input type="text" bind:value={metadataFavicon16} placeholder="/favicon-16x16.png" required />
				</label>

				<label>
					<span>Favicon 32x32 (PNG)</span>
					<input type="text" bind:value={metadataFavicon32} placeholder="/favicon-32x32.png" required />
				</label>

				<label>
					<span>Apple Touch Icon</span>
					<input type="text" bind:value={metadataAppleTouchIcon} placeholder="/apple-touch-icon.png" required />
				</label>

				<label>
					<span>Android Chrome 192x192</span>
					<input type="text" bind:value={metadataAndroidChrome192} placeholder="/android-chrome-192x192.png" required />
				</label>

				<label>
					<span>Android Chrome 512x512</span>
					<input type="text" bind:value={metadataAndroidChrome512} placeholder="/android-chrome-512x512.png" required />
				</label>
			</div>
		</section>

		<!-- Actions -->
		<div class="form-actions">
			<button type="submit" class="btn-primary" disabled={saving}>
				{saving ? 'Saving...' : 'Save Settings'}
			</button>
			<a href="/admin" class="btn-secondary">Cancel</a>
		</div>
	</form>

	<!-- Help Section -->
	<section class="help-section">
		<h3>Help</h3>
		<ul>
			<li>Changes take effect immediately for all users</li>
			<li>Header links are displayed in the order listed</li>
			<li>Footer link opens in the same tab</li>
			<li>Hero image should be at least 1920x600px for best results</li>
			<li>Favicon files can be uploaded to the repository's root or use external URLs</li>
			<li>To restore defaults, edit <code>src/lib/siteDefaults.ts</code></li>
		</ul>
	</section>
</div>

<style>
	.admin-page {
		max-width: 900px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.page-header p {
		color: var(--text-muted);
		font-size: 1rem;
	}

	.message {
		padding: 1rem;
		border-radius: var(--radius-md);
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

	.settings-section {
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.settings-section h2 {
		margin-bottom: 0.5rem;
		color: var(--accent);
	}

	.section-description {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 1.5rem;
	}

	label span {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	input[type="text"],
	input[type="url"] {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-family: inherit;
	}

	input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.link-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.link-input {
		width: 100%;
	}

	.btn-remove {
		background: var(--danger);
		color: white;
		border: none;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-weight: 500;
		white-space: nowrap;
	}

	.btn-remove:hover {
		background: var(--danger-hover);
	}

	.metadata-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 2rem;
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
		border: none;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--bg-secondary);
	}

	.help-section {
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: var(--radius-md);
		padding: 1.5rem;
		margin-top: 2rem;
	}

	.help-section h3 {
		margin-bottom: 1rem;
		color: var(--text-primary);
	}

	.help-section ul {
		list-style-position: inside;
		color: var(--text-muted);
		line-height: 1.8;
	}

	.help-section code {
		background: white;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-size: 0.9em;
		border: 1px solid #dee2e6;
	}

	@media (max-width: 768px) {
		.link-row {
			grid-template-columns: 1fr;
		}

		.metadata-grid {
			grid-template-columns: 1fr;
		}

		.form-actions {
			flex-direction: column;
		}
	}
</style>
