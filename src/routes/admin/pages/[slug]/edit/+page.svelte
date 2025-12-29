<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';

	let { data }: { data: PageData } = $props();

	const page = data.page;
	const isNew = !page;

	// Form fields
	let title = $state(page?.title || '');
	let slug = $state(page?.slug || '');
	let content = $state(page?.content || '');
	let excerpt = $state(page?.excerpt || '');
	let metaDescription = $state(page?.meta_description || '');
	let metaKeywords = $state(page?.meta_keywords || '');
	let isPublished = $state(page?.is_published || false);
	let showInMenu = $state(page?.show_in_menu || false);
	let menuOrder = $state(page?.menu_order || 0);
	let menuLabel = $state(page?.menu_label || '');
	let layout = $state(page?.layout || 'default');

	let saving = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error'>('success');

	// Auto-generate slug from title
	function generateSlug() {
		if (isNew && title) {
			slug = title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
		}
	}

	async function savePage() {
		if (!title || !slug) {
			message = 'Title and slug are required';
			messageType = 'error';
			return;
		}

		saving = true;
		message = '';

		try {
			const pageData = {
				title,
				slug,
				content,
				excerpt: excerpt || null,
				meta_description: metaDescription || null,
				meta_keywords: metaKeywords || null,
				is_published: isPublished,
				show_in_menu: showInMenu,
				menu_order: menuOrder,
				menu_label: menuLabel || null,
				layout
			};

			const url = isNew ? '/api/pages' : `/api/pages/${page.slug}`;
			const method = isNew ? 'POST' : 'PUT';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(pageData)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save page');
			}

			const result = await response.json();

			message = 'Page saved successfully!';
			messageType = 'success';

			// If new page, redirect to edit page
			if (isNew) {
				setTimeout(() => {
					goto(`/admin/pages/${result.slug}/edit`);
				}, 1000);
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'Failed to save page';
			messageType = 'error';
		} finally {
			saving = false;
		}
	}

	async function deletePage() {
		if (
			!confirm(
				'Are you sure you want to delete this page? This action cannot be undone.'
			)
		) {
			return;
		}

		try {
			const response = await fetch(`/api/pages/${page.slug}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete page');
			}

			goto('/admin/pages');
		} catch (error) {
			message = error instanceof Error ? error.message : 'Failed to delete page';
			messageType = 'error';
		}
	}
</script>

<div class="page">
	<div class="header">
		<div>
			<h1>{isNew ? 'New Page' : `Edit: ${page.title}`}</h1>
			<p class="breadcrumb">
				<a href="/admin/pages">← Back to Pages</a>
				{#if !isNew}
					| <a href="/{page.slug}" target="_blank">View Page</a>
				{/if}
			</p>
		</div>
		<div class="header-actions">
			{#if !isNew}
				<button class="btn-delete" onclick={deletePage}>Delete</button>
			{/if}
			<button class="btn-primary" onclick={savePage} disabled={saving}>
				{saving ? 'Saving...' : 'Save Page'}
			</button>
		</div>
	</div>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<div class="editor-layout">
		<div class="main-column">
			<div class="section">
				<label for="title">Page Title *</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					placeholder="Page Title"
					oninput={generateSlug}
					required
				/>
			</div>

			<div class="section">
				<label for="content">Content</label>
				<RichTextEditor bind:value={content} />
			</div>

			<div class="section">
				<label for="excerpt">Excerpt (Optional)</label>
				<textarea
					id="excerpt"
					bind:value={excerpt}
					rows="3"
					placeholder="Short description for previews..."
				></textarea>
			</div>
		</div>

		<aside class="sidebar">
			<div class="section">
				<h3>Publication</h3>

				<label class="checkbox-label">
					<input type="checkbox" bind:checked={isPublished} />
					<span>Published (visible to public)</span>
				</label>
			</div>

			<div class="section">
				<h3>URL Settings</h3>

				<label for="slug">Slug *</label>
				<div class="slug-input">
					<span class="slug-prefix">/</span>
					<input id="slug" type="text" bind:value={slug} required />
				</div>
				<p class="help-text">URL-friendly identifier for this page</p>
			</div>

			<div class="section">
				<h3>Navigation Menu</h3>

				<label class="checkbox-label">
					<input type="checkbox" bind:checked={showInMenu} />
					<span>Show in navigation menu</span>
				</label>

				{#if showInMenu}
					<label for="menu-label">Menu Label (optional)</label>
					<input
						id="menu-label"
						type="text"
						bind:value={menuLabel}
						placeholder="Leave blank to use title"
					/>

					<label for="menu-order">Menu Order</label>
					<input id="menu-order" type="number" bind:value={menuOrder} min="0" />
					<p class="help-text">Lower numbers appear first</p>
				{/if}
			</div>

			<div class="section">
				<h3>Layout</h3>

				<label for="layout">Template</label>
				<select id="layout" bind:value={layout}>
					<option value="default">Default</option>
					<option value="full-width">Full Width</option>
					<option value="sidebar">With Sidebar</option>
				</select>
			</div>

			<div class="section">
				<h3>SEO</h3>

				<label for="meta-description">Meta Description</label>
				<textarea
					id="meta-description"
					bind:value={metaDescription}
					rows="3"
					placeholder="Brief description for search engines..."
					maxlength="160"
				></textarea>
				<p class="help-text">{metaDescription.length}/160 characters</p>

				<label for="meta-keywords">Meta Keywords</label>
				<input
					id="meta-keywords"
					type="text"
					bind:value={metaKeywords}
					placeholder="keyword1, keyword2, keyword3"
				/>
			</div>
		</aside>
	</div>
</div>

<style>
	.page {
		max-width: 1600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.breadcrumb {
		margin: 0;
		font-size: 0.875rem;
		color: #666;
	}

	.breadcrumb a {
		color: #667eea;
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
	}

	.message {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
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

	.editor-layout {
		display: grid;
		grid-template-columns: 1fr 350px;
		gap: 2rem;
	}

	.main-column {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.section h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #2c3e50;
		font-weight: 600;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
		font-size: 0.875rem;
	}

	input[type='text'],
	input[type='number'],
	textarea,
	select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
	}

	input[type='text']:focus,
	input[type='number']:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.slug-input {
		display: flex;
		align-items: center;
		border: 1px solid #ddd;
		border-radius: 4px;
		overflow: hidden;
	}

	.slug-input:focus-within {
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.slug-prefix {
		padding: 0.75rem 0 0.75rem 0.75rem;
		background: #f8f9fa;
		color: #666;
		font-family: monospace;
	}

	.slug-input input {
		border: none;
		box-shadow: none;
		flex: 1;
	}

	.slug-input input:focus {
		box-shadow: none;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		margin-bottom: 1rem;
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		cursor: pointer;
		accent-color: #667eea;
	}

	.checkbox-label span {
		font-weight: normal;
	}

	.help-text {
		margin: 0.5rem 0 0 0;
		font-size: 0.75rem;
		color: #999;
	}

	.btn-primary,
	.btn-delete {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #c62828;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-delete {
		background: #f44336;
		color: white;
	}

	.btn-delete:hover {
		background: #d32f2f;
	}

	@media (max-width: 1024px) {
		.editor-layout {
			grid-template-columns: 1fr;
		}

		.sidebar {
			order: 2;
		}
	}

	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
		}

		.btn-primary,
		.btn-delete {
			flex: 1;
		}
	}
</style>
