<script lang="ts">
	import { onMount } from 'svelte';

	let settingsOpen = $state(false);
	let fontSize = $state('medium');
	let highContrast = $state(false);
	let keyboardHelpOpen = $state(false);

	onMount(() => {
		// Load saved preferences
		if (typeof window !== 'undefined') {
			fontSize = localStorage.getItem('fontSize') || 'medium';
			highContrast = localStorage.getItem('highContrast') === 'true';

			applySettings();

			// Listen for keyboard shortcut (Alt + A)
			const handleKeyboard = (e: KeyboardEvent) => {
				if (e.altKey && e.key === 'a') {
					e.preventDefault();
					settingsOpen = !settingsOpen;
				}
				if (e.altKey && e.key === '?') {
					e.preventDefault();
					keyboardHelpOpen = !keyboardHelpOpen;
				}
			};

			window.addEventListener('keydown', handleKeyboard);
			return () => window.removeEventListener('keydown', handleKeyboard);
		}
	});

	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	function setFontSize(size: string) {
		fontSize = size;
		localStorage.setItem('fontSize', size);
		applySettings();
	}

	function toggleHighContrast() {
		highContrast = !highContrast;
		localStorage.setItem('highContrast', String(highContrast));
		applySettings();
	}

	function applySettings() {
		const root = document.documentElement;

		// Apply font size
		switch (fontSize) {
			case 'small':
				root.style.fontSize = '14px';
				break;
			case 'medium':
				root.style.fontSize = '16px';
				break;
			case 'large':
				root.style.fontSize = '18px';
				break;
			case 'x-large':
				root.style.fontSize = '20px';
				break;
		}

		// Apply high contrast
		if (highContrast) {
			root.classList.add('high-contrast');
		} else {
			root.classList.remove('high-contrast');
		}
	}

	function toggleKeyboardHelp() {
		keyboardHelpOpen = !keyboardHelpOpen;
	}

	function closeKeyboardHelp() {
		keyboardHelpOpen = false;
	}
</script>

<!-- Skip to main content link -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Accessibility Settings Button -->
<button
	class="accessibility-button"
	onclick={toggleSettings}
	aria-label="Open accessibility settings"
	aria-expanded={settingsOpen}
	title="Accessibility Settings (Alt+A)"
>
	<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path
			d="M12 2c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zm-1 19v-6H8v6H6V9.5h3V8h6v1.5h3V21h-2v-6h-3v6h-2z"
		/>
	</svg>
	<span class="visually-hidden">Accessibility</span>
</button>

<!-- Settings Panel -->
{#if settingsOpen}
	<div class="accessibility-overlay" onclick={closeSettings} role="presentation"></div>
	<div
		class="accessibility-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="accessibility-title"
	>
		<div class="panel-header">
			<h2 id="accessibility-title">Accessibility Settings</h2>
			<button
				class="close-button"
				onclick={closeSettings}
				aria-label="Close accessibility settings"
			>
				×
			</button>
		</div>

		<div class="panel-body">
			<!-- Font Size -->
			<div class="setting-group">
				<h3 id="font-size-label">Font Size</h3>
				<div class="button-group" role="radiogroup" aria-labelledby="font-size-label">
					<button
						class="size-button"
						class:active={fontSize === 'small'}
						onclick={() => setFontSize('small')}
						role="radio"
						aria-checked={fontSize === 'small'}
					>
						Small
					</button>
					<button
						class="size-button"
						class:active={fontSize === 'medium'}
						onclick={() => setFontSize('medium')}
						role="radio"
						aria-checked={fontSize === 'medium'}
					>
						Medium
					</button>
					<button
						class="size-button"
						class:active={fontSize === 'large'}
						onclick={() => setFontSize('large'}
						role="radio"
						aria-checked={fontSize === 'large'}
					>
						Large
					</button>
					<button
						class="size-button"
						class:active={fontSize === 'x-large'}
						onclick={() => setFontSize('x-large')}
						role="radio"
						aria-checked={fontSize === 'x-large'}
					>
						X-Large
					</button>
				</div>
			</div>

			<!-- High Contrast -->
			<div class="setting-group">
				<label class="toggle-label">
					<input
						type="checkbox"
						checked={highContrast}
						onchange={toggleHighContrast}
						aria-label="Enable high contrast mode"
					/>
					<span class="toggle-text">High Contrast Mode</span>
					<span class="toggle-description">Improves readability with stronger colors</span>
				</label>
			</div>

			<!-- Keyboard Shortcuts -->
			<div class="setting-group">
				<button class="help-button" onclick={toggleKeyboardHelp}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"
						/>
					</svg>
					Keyboard Shortcuts
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Keyboard Help Modal -->
{#if keyboardHelpOpen}
	<div class="keyboard-overlay" onclick={closeKeyboardHelp} role="presentation"></div>
	<div
		class="keyboard-modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="keyboard-help-title"
	>
		<div class="modal-header">
			<h2 id="keyboard-help-title">Keyboard Shortcuts</h2>
			<button
				class="close-button"
				onclick={closeKeyboardHelp}
				aria-label="Close keyboard shortcuts"
			>
				×
			</button>
		</div>
		<div class="modal-body">
			<dl class="shortcuts-list">
				<div class="shortcut-item">
					<dt><kbd>Alt</kbd> + <kbd>A</kbd></dt>
					<dd>Open accessibility settings</dd>
				</div>
				<div class="shortcut-item">
					<dt><kbd>Alt</kbd> + <kbd>?</kbd></dt>
					<dd>Show keyboard shortcuts</dd>
				</div>
				<div class="shortcut-item">
					<dt><kbd>/</kbd></dt>
					<dd>Focus search box</dd>
				</div>
				<div class="shortcut-item">
					<dt><kbd>Esc</kbd></dt>
					<dd>Close open dialogs</dd>
				</div>
				<div class="shortcut-item">
					<dt><kbd>Tab</kbd></dt>
					<dd>Navigate forward through elements</dd>
				</div>
				<div class="shortcut-item">
					<dt><kbd>Shift</kbd> + <kbd>Tab</kbd></dt>
					<dd>Navigate backward through elements</dd>
				</div>
				<div class="shortcut-item">
					<dt><kbd>Enter</kbd> or <kbd>Space</kbd></dt>
					<dd>Activate buttons and links</dd>
				</div>
			</dl>
		</div>
	</div>
{/if}

<style>
	/* Skip Link */
	.skip-link {
		position: absolute;
		top: -40px;
		left: 0;
		background: #e73b42;
		color: white;
		padding: 0.75rem 1.5rem;
		text-decoration: none;
		border-radius: 0 0 4px 0;
		z-index: 10000;
		font-weight: 600;
	}

	.skip-link:focus {
		top: 0;
	}

	/* Visually Hidden */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Accessibility Button */
	.accessibility-button {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: #667eea;
		color: white;
		border: none;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		transition: all 0.3s ease;
	}

	.accessibility-button:hover {
		background: #5568d3;
		transform: scale(1.1);
	}

	.accessibility-button:focus {
		outline: 3px solid #e73b42;
		outline-offset: 2px;
	}

	/* Accessibility Panel */
	.accessibility-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1999;
		animation: fadeIn 0.2s ease-out;
	}

	.accessibility-panel {
		position: fixed;
		bottom: 6rem;
		right: 2rem;
		width: 400px;
		max-width: calc(100vw - 4rem);
		background: white;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		z-index: 2000;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.panel-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #1a1a1a;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.close-button:hover {
		background: #f0f0f0;
	}

	.close-button:focus {
		outline: 2px solid #667eea;
	}

	.panel-body {
		padding: 1.5rem;
		max-height: 60vh;
		overflow-y: auto;
	}

	.setting-group {
		margin-bottom: 2rem;
	}

	.setting-group:last-child {
		margin-bottom: 0;
	}

	.setting-group h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1a1a1a;
	}

	.button-group {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.size-button {
		padding: 0.75rem;
		border: 2px solid #ddd;
		background: white;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
		color: #333;
	}

	.size-button:hover {
		border-color: #667eea;
		background: #f8f9fa;
	}

	.size-button:focus {
		outline: 2px solid #667eea;
		outline-offset: 2px;
	}

	.size-button.active {
		border-color: #667eea;
		background: #667eea;
		color: white;
	}

	.toggle-label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		cursor: pointer;
		padding: 1rem;
		border-radius: 8px;
		transition: background 0.2s;
	}

	.toggle-label:hover {
		background: #f8f9fa;
	}

	.toggle-label input[type='checkbox'] {
		width: 20px;
		height: 20px;
		cursor: pointer;
		margin-right: 0.5rem;
	}

	.toggle-text {
		font-weight: 600;
		color: #1a1a1a;
	}

	.toggle-description {
		font-size: 0.875rem;
		color: #666;
		margin-left: 1.75rem;
	}

	.help-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #f8f9fa;
		border: 2px solid #ddd;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		width: 100%;
		transition: all 0.2s;
		color: #333;
	}

	.help-button:hover {
		border-color: #667eea;
		background: white;
	}

	.help-button:focus {
		outline: 2px solid #667eea;
		outline-offset: 2px;
	}

	/* Keyboard Modal */
	.keyboard-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2999;
		animation: fadeIn 0.2s ease-out;
	}

	.keyboard-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 500px;
		max-width: calc(100vw - 4rem);
		max-height: calc(100vh - 4rem);
		background: white;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		z-index: 3000;
		animation: slideUp 0.3s ease-out;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #1a1a1a;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		max-height: calc(100vh - 12rem);
	}

	.shortcuts-list {
		margin: 0;
	}

	.shortcut-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.shortcut-item:last-child {
		border-bottom: none;
	}

	.shortcut-item dt {
		font-weight: 600;
		color: #1a1a1a;
	}

	.shortcut-item dd {
		margin: 0;
		color: #666;
		font-size: 0.875rem;
	}

	kbd {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.875rem;
		box-shadow: 0 2px 0 #ddd;
	}

	/* High Contrast Mode Styles */
	:global(.high-contrast) {
		--text-color: #000;
		--bg-color: #fff;
		--link-color: #0000ee;
		--link-visited: #551a8b;
		--border-color: #000;
	}

	:global(.high-contrast) body {
		background: var(--bg-color);
		color: var(--text-color);
	}

	:global(.high-contrast) a {
		color: var(--link-color);
		text-decoration: underline;
	}

	:global(.high-contrast) a:visited {
		color: var(--link-visited);
	}

	:global(.high-contrast) button {
		border: 2px solid var(--border-color) !important;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.accessibility-button {
			bottom: 1rem;
			right: 1rem;
			width: 48px;
			height: 48px;
		}

		.accessibility-panel {
			bottom: 4.5rem;
			right: 1rem;
			left: 1rem;
			width: auto;
			max-width: none;
		}

		.keyboard-modal {
			width: calc(100vw - 2rem);
		}

		.button-group {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
