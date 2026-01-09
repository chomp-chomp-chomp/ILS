<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Initialize form state with current settings
	let headerLinks = $state([...data.siteSettings.header.links]);
	let footerText = $state(data.siteSettings.footer.text);
	let footerLink = $state(data.siteSettings.footer.link);
	let heroTitle = $state(data.siteSettings.hero.title);
	let heroSubhead = $state(data.siteSettings.hero.subhead);
	let heroImageUrl = $state(data.siteSettings.hero.imageUrl);
	
	let submitting = $state(false);

	function addHeaderLink() {
		headerLinks = [...headerLinks, { title: '', url: '' }];
	}

	function removeHeaderLink(index: number) {
		headerLinks = headerLinks.filter((_, i) => i !== index);
	}

	function resetToDefaults() {
		if (confirm('Reset all settings to defaults? This will overwrite your current settings.')) {
			headerLinks = [
				{ title: 'Home', url: 'https://library.chompchomp.cc/' },
				{ title: 'Advanced Search', url: 'https://library.chompchomp.cc/catalog/search/advanced' },
				{ title: 'Chomp Chomp Tools', url: 'https://chompchomp.cc/tools/' },
				{ title: 'Chomp Chomp Recipes', url: 'https://chompchomp.cc/' }
			];
			footerText = 'Powered by Chomp Chomp';
			footerLink = 'https://chompchomp.cc';
			heroTitle = 'Welcome to the Chomp Chomp Library';
			heroSubhead = 'Explore our collection';
			heroImageUrl = 'https://ik.imagekit.io/chompchomp/Chomp%20Chomp%20Library?updatedAt=1767613169516';
		}
	}
</script>

<div class="admin-page">
	<div class="page-header">
		<h1>Site Settings</h1>
		<p class="page-description">
			Configure the public-facing header navigation, footer, and homepage hero section.
			These settings control what visitors see on your library's website.
		</p>
	</div>

	{#if form?.success}
		<div class="message success">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<polyline points="20 6 9 17 4 12" stroke-width="2" />
			</svg>
			{form.message}
		</div>
	{/if}

	{#if form?.error}
		<div class="message error">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="10" stroke-width="2" />
				<line x1="15" y1="9" x2="9" y2="15" stroke-width="2" />
				<line x1="9" y1="9" x2="15" y2="15" stroke-width="2" />
			</svg>
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}>
		<!-- Header Navigation Section -->
		<section class="form-section">
			<h2>Header Navigation</h2>
			<p class="section-description">
				Configure the links that appear in the top navigation bar on all public pages.
			</p>

			<div class="link-list">
				{#each headerLinks as link, index}
					<div class="link-item">
						<div class="link-fields">
							<div class="form-group">
								<label for="header_link_{index}_title">Link Title</label>
								<input
									type="text"
									id="header_link_{index}_title"
									name="header_link_{index}_title"
									bind:value={link.title}
									placeholder="e.g., Home"
									required
								/>
							</div>
							<div class="form-group">
								<label for="header_link_{index}_url">Link URL</label>
								<input
									type="url"
									id="header_link_{index}_url"
									name="header_link_{index}_url"
									bind:value={link.url}
									placeholder="https://..."
									required
								/>
							</div>
						</div>
						<button
							type="button"
							class="btn-remove"
							onclick={() => removeHeaderLink(index)}
							aria-label="Remove link"
						>
							×
						</button>
					</div>
				{/each}
			</div>

			<button type="button" class="btn-secondary" onclick={addHeaderLink}>
				+ Add Header Link
			</button>
		</section>

		<!-- Footer Section -->
		<section class="form-section">
			<h2>Footer</h2>
			<p class="section-description">
				Configure the footer text and link that appears at the bottom of all public pages.
			</p>

			<div class="form-group">
				<label for="footer_text">Footer Text</label>
				<input
					type="text"
					id="footer_text"
					name="footer_text"
					bind:value={footerText}
					placeholder="e.g., Powered by Chomp Chomp"
				/>
			</div>

			<div class="form-group">
				<label for="footer_link">Footer Link URL</label>
				<input
					type="url"
					id="footer_link"
					name="footer_link"
					bind:value={footerLink}
					placeholder="https://..."
				/>
				<small>The footer text will link to this URL</small>
			</div>
		</section>

		<!-- Hero Section -->
		<section class="form-section">
			<h2>Homepage Hero</h2>
			<p class="section-description">
				Configure the large banner section at the top of the homepage.
			</p>

			<div class="form-group">
				<label for="hero_title">Hero Title *</label>
				<input
					type="text"
					id="hero_title"
					name="hero_title"
					bind:value={heroTitle}
					placeholder="e.g., Welcome to the Chomp Chomp Library"
					required
				/>
			</div>

			<div class="form-group">
				<label for="hero_subhead">Hero Subheading</label>
				<input
					type="text"
					id="hero_subhead"
					name="hero_subhead"
					bind:value={heroSubhead}
					placeholder="e.g., Explore our collection"
				/>
			</div>

			<div class="form-group">
				<label for="hero_image_url">Background Image URL</label>
				<input
					type="url"
					id="hero_image_url"
					name="hero_image_url"
					bind:value={heroImageUrl}
					placeholder="https://..."
				/>
				<small>URL of the background image for the hero section</small>
			</div>
		</section>

		<!-- Form Actions -->
		<div class="form-actions">
			<button type="button" class="btn-secondary" onclick={resetToDefaults}>
				Reset to Defaults
			</button>
			<button type="submit" class="btn-primary" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save Settings'}
			</button>
		</div>
	</form>
</div>

<style>
	.admin-page {
		max-width: 900px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #1a1a1a;
	}

	.page-description {
		color: #666;
		margin: 0;
		line-height: 1.6;
	}

	.message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
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

	.message svg {
		flex-shrink: 0;
	}

	.form-section {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 2rem;
		border: 1px solid #e0e0e0;
	}

	.form-section h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #1a1a1a;
	}

	.section-description {
		color: #666;
		margin: 0 0 1.5rem 0;
		line-height: 1.6;
		font-size: 0.9rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #333;
		font-size: 0.9rem;
	}

	.form-group input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
	}

	.form-group input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.form-group small {
		display: block;
		margin-top: 0.25rem;
		color: #666;
		font-size: 0.85rem;
	}

	.link-list {
		margin-bottom: 1rem;
	}

	.link-item {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
		border: 1px solid #e0e0e0;
	}

	.link-fields {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 1rem;
	}

	.btn-remove {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1.5rem;
		cursor: pointer;
		transition: background 0.2s;
		align-self: start;
		margin-top: 1.8rem;
	}

	.btn-remove:hover {
		background: #c82333;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding-top: 1rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
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
		background: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background: #5a6268;
	}

	@media (max-width: 768px) {
		.link-fields {
			grid-template-columns: 1fr;
		}

		.btn-remove {
			margin-top: 0;
		}

		.form-actions {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
