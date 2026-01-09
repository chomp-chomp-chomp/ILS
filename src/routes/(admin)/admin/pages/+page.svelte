<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	const pages = $derived(data.pages || []);

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="page">
	<div class="header">
		<div>
			<h1>Pages</h1>
			<p class="subtitle">Manage content pages with the WYSIWYG editor</p>
		</div>
		<a href="/admin/pages/new" class="btn-primary">+ New Page</a>
	</div>

	{#if pages.length > 0}
		<div class="pages-table-container">
			<table class="pages-table">
				<thead>
					<tr>
						<th>Title</th>
						<th>Slug</th>
						<th>Status</th>
						<th>In Menu</th>
						<th>Views</th>
						<th>Last Updated</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each pages as page}
						<tr>
							<td>
								<strong>{page.title}</strong>
								{#if page.meta_description}
									<p class="excerpt">{page.meta_description.substring(0, 100)}</p>
								{/if}
							</td>
							<td>
								<code class="slug">/{page.slug}</code>
							</td>
							<td>
								{#if page.is_published}
									<span class="badge published">Published</span>
								{:else}
									<span class="badge draft">Draft</span>
								{/if}
							</td>
							<td>
								{#if page.show_in_menu}
									<span class="badge menu">In Menu ({page.menu_order})</span>
								{:else}
									<span class="badge">No</span>
								{/if}
							</td>
							<td>{page.view_count || 0}</td>
							<td>{formatDate(page.updated_at)}</td>
							<td>
								<div class="action-buttons">
									<a href="/admin/pages/{page.slug}/edit" class="btn-edit">Edit</a>
									<a href="/{page.slug}" target="_blank" class="btn-view">View</a>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="empty-state">
			<svg
				width="64"
				height="64"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
				<polyline points="10 9 9 9 8 9" />
			</svg>
			<h2>No pages yet</h2>
			<p>Create your first content page to get started.</p>
			<a href="/admin/pages/new" class="btn-primary">+ Create Page</a>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1400px;
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

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 1rem;
	}

	.pages-table-container {
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		overflow: hidden;
	}

	.pages-table {
		width: 100%;
		border-collapse: collapse;
	}

	.pages-table th {
		text-align: left;
		padding: 1rem;
		background: #f8f9fa;
		border-bottom: 2px solid #e0e0e0;
		font-weight: 600;
		color: #666;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.pages-table td {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
		vertical-align: top;
	}

	.pages-table tr:last-child td {
		border-bottom: none;
	}

	.pages-table tr:hover {
		background: #f8f9fa;
	}

	.excerpt {
		margin: 0.25rem 0 0 0;
		font-size: 0.875rem;
		color: #999;
	}

	.slug {
		background: #f5f5f5;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.875rem;
		color: #667eea;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge.published {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.badge.draft {
		background: #fff3e0;
		color: #f57c00;
	}

	.badge.menu {
		background: #e3f2fd;
		color: #1976d2;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.btn-primary,
	.btn-edit,
	.btn-view {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		display: inline-block;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #c62828;
	}

	.btn-edit {
		background: #667eea;
		color: white;
	}

	.btn-edit:hover {
		background: #5568d3;
	}

	.btn-view {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-view:hover {
		background: #f8f9fa;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.empty-state svg {
		color: #ccc;
		margin-bottom: 1rem;
	}

	.empty-state h2 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.empty-state p {
		margin: 0 0 1.5rem 0;
		color: #666;
	}

	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 1rem;
		}

		.pages-table-container {
			overflow-x: auto;
		}

		.action-buttons {
			flex-direction: column;
		}
	}
</style>
