<script lang="ts">
	interface Props {
		show?: boolean;
	}

	let { show = true }: Props = $props();
</script>

{#if show}
	<a href="/admin" class="floating-admin-button" aria-label="Go to admin panel">
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
			<circle cx="12" cy="12" r="3"/>
		</svg>
		<span class="tooltip">Admin</span>
	</a>
{/if}

<style>
	.floating-admin-button {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		width: 56px;
		height: 56px;
		background: var(--primary-color, #e73b42);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		color: white;
		text-decoration: none;
		transition: all 0.3s ease;
		z-index: 900;
		opacity: 0.85;
	}

	.floating-admin-button:hover {
		opacity: 1;
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
	}

	.floating-admin-button svg {
		width: 24px;
		height: 24px;
	}

	.tooltip {
		position: absolute;
		right: 100%;
		margin-right: 12px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}

	.floating-admin-button:hover .tooltip {
		opacity: 1;
	}

	/* Hide on very small screens to avoid overlap */
	@media (max-width: 480px) {
		.floating-admin-button {
			bottom: 1rem;
			right: 1rem;
			width: 48px;
			height: 48px;
		}

		.floating-admin-button svg {
			width: 20px;
			height: 20px;
		}

		.tooltip {
			display: none;
		}
	}
</style>
