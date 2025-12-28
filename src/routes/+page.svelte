<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="container">
	<header>
		<h1>Library Catalog System</h1>
		<p>Welcome to your integrated library system</p>
	</header>

	<main>
		<div class="cards">
			<a href="/catalog" class="card">
				<h2>📚 Public Catalog (OPAC)</h2>
				<p>Search and browse the library collection</p>
			</a>

			<a href="/admin" class="card">
				<h2>🔧 Admin Panel</h2>
				<p>Manage catalog, serials, and acquisitions</p>
				{#if data.session}
					<span class="badge">Logged in</span>
				{:else}
					<span class="badge neutral">Login required</span>
				{/if}
			</a>
		</div>
	</main>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 4rem;
	}

	h1 {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	header p {
		font-size: 1.25rem;
		color: #666;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.card {
		padding: 2rem;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: all 0.3s ease;
		position: relative;
	}

	.card:hover {
		border-color: #4a90e2;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.card h2 {
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.card p {
		color: #666;
		margin-bottom: 1rem;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: #4caf50;
		color: white;
		border-radius: 12px;
		font-size: 0.875rem;
	}

	.badge.neutral {
		background: #999;
	}
</style>
