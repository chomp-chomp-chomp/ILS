<script lang="ts">
	import { browser } from '$app/environment';
	import type { HeaderLink } from '$lib/siteDefaults';

	interface Props {
		links: HeaderLink[];
	}

	let { links = [] }: Props = $props();
	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
		// Prevent body scroll when menu is open
		if (browser) {
			document.body.style.overflow = isOpen ? 'hidden' : '';
		}
	}

	function close() {
		isOpen = false;
		if (browser) {
			document.body.style.overflow = '';
		}
	}

	// Close menu when clicking a link
	function handleLinkClick() {
		close();
	}
</script>

<!-- Hamburger Button -->
<button 
	class="hamburger-button" 
	onclick={toggle}
	aria-label="Toggle navigation menu"
	aria-expanded={isOpen}
>
	<span class="hamburger-line"></span>
	<span class="hamburger-line"></span>
	<span class="hamburger-line"></span>
</button>

<!-- Overlay -->
{#if isOpen}
	<div 
		class="menu-overlay" 
		onclick={close}
		role="presentation"
	></div>
{/if}

<!-- Sidebar Drawer -->
<nav 
	class="menu-drawer" 
	class:open={isOpen}
	aria-hidden={!isOpen}
>
	<div class="menu-header">
		<h2>Navigation</h2>
		<button 
			class="close-button" 
			onclick={close}
			aria-label="Close menu"
		>
			×
		</button>
	</div>
	
	<ul class="menu-links">
		{#each links as link}
			<li>
				<a href={link.url} onclick={handleLinkClick}>
					{link.title}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	/* Hamburger Button */
	.hamburger-button {
		display: none; /* Show only on mobile */
		position: relative;
		width: 40px;
		height: 40px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 8px;
		z-index: 1001;
	}

	.hamburger-line {
		display: block;
		width: 24px;
		height: 2px;
		background: white;
		margin: 5px auto;
		transition: all 0.3s ease;
		border-radius: 2px;
	}

	/* Show hamburger on mobile */
	@media (max-width: 768px) {
		.hamburger-button {
			display: block;
		}
	}

	/* Overlay */
	.menu-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 999;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Drawer */
	.menu-drawer {
		position: fixed;
		top: 0;
		left: -300px;
		width: 280px;
		height: 100vh;
		background: var(--accent-color, #2c3e50);
		color: white;
		z-index: 1000;
		transition: left 0.3s ease;
		overflow-y: auto;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
	}

	.menu-drawer.open {
		left: 0;
	}

	.menu-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.menu-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.close-button {
		background: transparent;
		border: none;
		color: white;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		transition: transform 0.2s ease;
	}

	.close-button:hover {
		transform: scale(1.1);
	}

	.menu-links {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.menu-links li {
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.menu-links a {
		display: block;
		padding: 1rem 1.5rem;
		color: white;
		text-decoration: none;
		font-size: 1rem;
		transition: background-color 0.2s ease;
	}

	.menu-links a:hover {
		background: rgba(255, 255, 255, 0.1);
	}
</style>
