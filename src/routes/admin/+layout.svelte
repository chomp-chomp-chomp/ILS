<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

{#if data.session}
	<div class="admin-layout">
		<nav class="sidebar">
			<div class="logo">
				<h2>Library Admin</h2>
			</div>
			<ul class="nav-links">
				<li><a href="/admin">Dashboard</a></li>
				<li><a href="/admin/cataloging">Cataloging</a></li>
				<li><a href="/admin/cataloging/new">New MARC Record</a></li>
				<li><a href="/admin/cataloging/isbn-lookup">ISBN Lookup</a></li>
				<li><a href="/admin/cataloging/upload">MARC File Upload</a></li>
				<li><a href="/admin/serials">Serials Management</a></li>
				<li><a href="/admin/holdings">Holdings</a></li>
				<li><a href="/admin/acquisitions">Acquisitions</a></li>
				<li><a href="/catalog">View Public Catalog</a></li>
			</ul>
			<div class="user-info">
				<p>{data.session.user.email}</p>
				<form method="post" action="/admin/logout">
					<button type="submit">Logout</button>
				</form>
			</div>
		</nav>
		<main class="content">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.admin-layout {
		display: grid;
		grid-template-columns: 250px 1fr;
		min-height: 100vh;
	}

	.sidebar {
		background: #2c3e50;
		color: white;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
	}

	.logo h2 {
		margin: 0 0 2rem 0;
		font-size: 1.5rem;
	}

	.nav-links {
		list-style: none;
		padding: 0;
		margin: 0;
		flex: 1;
	}

	.nav-links li {
		margin-bottom: 0.5rem;
	}

	.nav-links a {
		color: white;
		text-decoration: none;
		padding: 0.75rem 1rem;
		display: block;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.nav-links a:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.user-info {
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 1rem;
		margin-top: 1rem;
	}

	.user-info p {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.user-info button {
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		width: 100%;
	}

	.user-info button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.content {
		padding: 2rem;
		background: #f5f5f5;
	}
</style>
