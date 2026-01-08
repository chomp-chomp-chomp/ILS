<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
	let mobileMenuOpen = $state(false);
</script>

{#if data.session}
	<div class="admin-layout">
		<button class="mobile-menu-toggle" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
			<span class="hamburger"></span>
		</button>

		<nav class="sidebar" class:mobile-open={mobileMenuOpen}>
			<div class="logo">
				<h2>Library Admin</h2>
			</div>
			<ul class="nav-links">
				<li><a href="/admin" onclick={() => mobileMenuOpen = false}>Dashboard</a></li>
				<li class="section-header">Circulation</li>
				<li><a href="/admin/circulation/checkout" onclick={() => mobileMenuOpen = false}>Checkout</a></li>
				<li><a href="/admin/circulation/checkin" onclick={() => mobileMenuOpen = false}>Checkin</a></li>
				<li><a href="/admin/circulation/patrons" onclick={() => mobileMenuOpen = false}>Patrons</a></li>
				<li><a href="/admin/circulation/holds" onclick={() => mobileMenuOpen = false}>Holds</a></li>
				<li class="section-header">Cataloging</li>
				<li><a href="/admin/cataloging" onclick={() => mobileMenuOpen = false}>Catalog Records</a></li>
				<li><a href="/admin/cataloging/new" onclick={() => mobileMenuOpen = false}>New MARC Record</a></li>
				<li><a href="/admin/cataloging/isbn-lookup" onclick={() => mobileMenuOpen = false}>ISBN Lookup</a></li>
				<li><a href="/admin/cataloging/bulk-isbn" onclick={() => mobileMenuOpen = false}>Bulk ISBN Upload</a></li>
				<li><a href="/admin/cataloging/upload" onclick={() => mobileMenuOpen = false}>MARC File Upload</a></li>
				<li><a href="/admin/cataloging/authorities" onclick={() => mobileMenuOpen = false}>Authorities</a></li>
				<li><a href="/admin/serials" onclick={() => mobileMenuOpen = false}>Serials Management</a></li>
				<li><a href="/admin/holdings" onclick={() => mobileMenuOpen = false}>Holdings</a></li>
				<li><a href="/admin/acquisitions" onclick={() => mobileMenuOpen = false}>Acquisitions</a></li>
				<li><a href="/admin/ill" onclick={() => mobileMenuOpen = false}>Interlibrary Loan</a></li>
				<li class="section-header">Configuration</li>
				<li><a href="/admin/site-config" onclick={() => mobileMenuOpen = false}>Site Configuration</a></li>
				<li><a href="/admin/branding" onclick={() => mobileMenuOpen = false}>Branding & Appearance</a></li>
				<li><a href="/admin/search-config" onclick={() => mobileMenuOpen = false}>Search Configuration</a></li>
				<li><a href="/admin/display-config" onclick={() => mobileMenuOpen = false}>Display Configuration</a></li>
				<li><a href="/admin/pages" onclick={() => mobileMenuOpen = false}>Content Pages</a></li>
				<li class="section-header">View Site</li>
				<li><a href="/catalog" onclick={() => mobileMenuOpen = false}>View Public Catalog</a></li>
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
		position: relative;
	}

	.mobile-menu-toggle {
		display: none;
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 1001;
		background: #e73b42;
		border: none;
		width: 50px;
		height: 50px;
		border-radius: 8px;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.hamburger {
		display: block;
		position: relative;
		width: 24px;
		height: 2px;
		background: white;
		margin: 0 auto;
	}

	.hamburger::before,
	.hamburger::after {
		content: '';
		position: absolute;
		width: 24px;
		height: 2px;
		background: white;
		left: 0;
	}

	.hamburger::before {
		top: -8px;
	}

	.hamburger::after {
		top: 8px;
	}

	.sidebar {
		background: linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%);
		color: white;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		border-right: 1px solid rgba(231, 59, 66, 0.2);
	}

	.logo h2 {
		margin: 0 0 2rem 0;
		font-size: 1.5rem;
		color: #e73b42;
		font-weight: 700;
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

	.nav-links .section-header {
		color: #666;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		padding: 0 1rem;
	}

	.nav-links .section-header:first-child {
		margin-top: 0;
	}

	.nav-links a {
		color: #b0b0b0;
		text-decoration: none;
		padding: 0.75rem 1rem;
		display: block;
		border-radius: 6px;
		transition: all 0.2s;
		font-size: 0.9rem;
	}

	.nav-links a:hover {
		background: rgba(231, 59, 66, 0.1);
		color: #e73b42;
		border-left: 3px solid #e73b42;
		padding-left: calc(1rem - 3px);
	}

	.user-info {
		border-top: 1px solid rgba(231, 59, 66, 0.2);
		padding-top: 1rem;
		margin-top: 1rem;
	}

	.user-info p {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #888;
	}

	.user-info button {
		background: rgba(231, 59, 66, 0.1);
		color: #e73b42;
		border: 1px solid rgba(231, 59, 66, 0.3);
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		width: 100%;
		font-weight: 500;
		transition: all 0.2s;
	}

	.user-info button:hover {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
	}

	.content {
		padding: 2rem;
		background: #f5f5f5;
		overflow-x: auto;
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.admin-layout {
			grid-template-columns: 1fr;
		}

		.mobile-menu-toggle {
			display: block;
		}

		.sidebar {
			position: fixed;
			top: 0;
			left: -280px;
			width: 280px;
			height: 100vh;
			z-index: 1000;
			transition: left 0.3s ease;
			overflow-y: auto;
			box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
		}

		.sidebar.mobile-open {
			left: 0;
		}

		.content {
			padding: 5rem 1rem 1rem;
		}
	}

	@media (max-width: 480px) {
		.content {
			padding: 5rem 0.5rem 0.5rem;
		}
	}
</style>
