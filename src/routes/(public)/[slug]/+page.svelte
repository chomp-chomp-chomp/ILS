<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const page = $derived(data.page);
</script>

<svelte:head>
	{#if page}
		<title>{page.title}</title>
		{#if page.meta_description}
			<meta name="description" content={page.meta_description} />
		{/if}
		{#if page.meta_keywords}
			<meta name="keywords" content={page.meta_keywords} />
		{/if}
	{/if}
</svelte:head>

{#if page}
	<div class="page-container layout-{page.layout || 'default'}">
		<article class="page-content">
			<h1 class="page-title">{page?.title || ''}</h1>

			{#if page.excerpt}
				<p class="page-excerpt">{page.excerpt}</p>
			{/if}

			<div class="page-body">
				{@html page.content}
			</div>
		</article>
	</div>
{:else}
	<div class="error-page">
		<h1>Page Not Found</h1>
		<p>The requested page could not be found.</p>
		<a href="/">← Back to Home</a>
	</div>
{/if}

<style>
	.page-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 3rem 2rem;
		min-height: 60vh;
	}

	.page-container.layout-full-width {
		max-width: 100%;
		padding: 3rem 4rem;
	}

	.page-container.layout-sidebar {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 3rem;
		max-width: 1400px;
	}

	.page-content {
		background: white;
		padding: 3rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.page-title {
		margin: 0 0 1rem 0;
		font-size: 2.5rem;
		color: #2c3e50;
		line-height: 1.2;
	}

	.page-excerpt {
		margin: 0 0 2rem 0;
		font-size: 1.25rem;
		color: #666;
		font-style: italic;
		border-left: 4px solid #667eea;
		padding-left: 1.5rem;
	}

	.page-body {
		line-height: 1.8;
		color: #333;
	}

	/* Content styling */
	.page-body :global(h1) {
		font-size: 2em;
		font-weight: bold;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
		color: #2c3e50;
	}

	.page-body :global(h2) {
		font-size: 1.5em;
		font-weight: bold;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
		color: #2c3e50;
		border-bottom: 2px solid #e0e0e0;
		padding-bottom: 0.5em;
	}

	.page-body :global(h3) {
		font-size: 1.25em;
		font-weight: bold;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
		color: #2c3e50;
	}

	.page-body :global(p) {
		margin: 1em 0;
	}

	.page-body :global(a) {
		color: #667eea;
		text-decoration: underline;
		transition: color 0.2s;
	}

	.page-body :global(a:hover) {
		color: #5568d3;
	}

	.page-body :global(ul),
	.page-body :global(ol) {
		padding-left: 2em;
		margin: 1em 0;
	}

	.page-body :global(li) {
		margin: 0.5em 0;
	}

	.page-body :global(blockquote) {
		border-left: 4px solid #ddd;
		padding-left: 1.5em;
		margin: 1.5em 0;
		font-style: italic;
		color: #666;
	}

	.page-body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 8px;
		margin: 2em 0;
	}

	.page-body :global(code) {
		background: #f5f5f5;
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	.page-body :global(pre) {
		background: #f5f5f5;
		padding: 1.5em;
		border-radius: 8px;
		overflow-x: auto;
		margin: 1.5em 0;
	}

	.page-body :global(pre code) {
		background: none;
		padding: 0;
	}

	.page-body :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5em 0;
	}

	.page-body :global(table th),
	.page-body :global(table td) {
		padding: 0.75em;
		border: 1px solid #e0e0e0;
		text-align: left;
	}

	.page-body :global(table th) {
		background: #f8f9fa;
		font-weight: 600;
	}

	.page-body :global(hr) {
		border: none;
		border-top: 2px solid #e0e0e0;
		margin: 2em 0;
	}

	.error-page {
		max-width: 800px;
		margin: 4rem auto;
		text-align: center;
		padding: 3rem 2rem;
	}

	.error-page h1 {
		margin: 0 0 1rem 0;
		font-size: 2rem;
		color: #2c3e50;
	}

	.error-page p {
		margin: 0 0 1.5rem 0;
		color: #666;
	}

	.error-page a {
		color: #667eea;
		text-decoration: none;
		font-size: 1.125rem;
	}

	.error-page a:hover {
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 2rem 1rem;
		}

		.page-content {
			padding: 2rem 1.5rem;
		}

		.page-title {
			font-size: 2rem;
		}

		.page-container.layout-sidebar {
			grid-template-columns: 1fr;
		}
	}
</style>
