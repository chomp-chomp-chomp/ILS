<script lang="ts">
	interface Props {
		value: string;
		index: number;
		onchange: (value: string) => void;
		onremove?: () => void;
		showRemove?: boolean;
	}

	let { value = $bindable(), index, onchange, onremove, showRemove = true }: Props = $props();

	let suggestions = $state<string[]>([]);
	let loading = $state(false);
	let showSuggestions = $state(false);
	let selectedIndex = $state(-1);
	let inputElement: HTMLInputElement;
	let debounceTimer: ReturnType<typeof setTimeout>;

	async function searchSubjectHeadings(query: string) {
		if (!query || query.length < 3) {
			suggestions = [];
			showSuggestions = false;
			return;
		}

		loading = true;

		try {
			// Use our API endpoint to avoid CORS issues
			const response = await fetch(
				`/api/subject-headings?q=${encodeURIComponent(query)}`
			);

			if (!response.ok) {
				console.error('API error:', response.status, response.statusText);
				throw new Error('Failed to fetch suggestions');
			}

			const data = await response.json();
			console.log('Received subject headings:', data);

			// The response is now just an array of suggestions
			if (Array.isArray(data) && data.length > 0) {
				suggestions = data;
				showSuggestions = true;
			} else {
				suggestions = [];
				showSuggestions = false;
			}
		} catch (error) {
			console.error('Error fetching subject headings:', error);
			suggestions = [];
			showSuggestions = false;
		} finally {
			loading = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const newValue = target.value;
		value = newValue;
		onchange(newValue);

		// Debounce the search
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchSubjectHeadings(newValue);
		}, 300);

		selectedIndex = -1;
	}

	function selectSuggestion(suggestion: string) {
		value = suggestion;
		onchange(suggestion);
		suggestions = [];
		showSuggestions = false;
		selectedIndex = -1;
		inputElement?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!showSuggestions || suggestions.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				break;
			case 'Enter':
				e.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
					selectSuggestion(suggestions[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				showSuggestions = false;
				selectedIndex = -1;
				break;
		}
	}

	function handleBlur() {
		// Delay to allow click on suggestion
		setTimeout(() => {
			showSuggestions = false;
			selectedIndex = -1;
		}, 200);
	}

	function handleFocus() {
		if (suggestions.length > 0) {
			showSuggestions = true;
		}
	}
</script>

<div class="subject-input-container">
	<div class="input-wrapper">
		<input
			bind:this={inputElement}
			id="subject-{index}"
			type="text"
			value={value}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			onfocus={handleFocus}
			placeholder="Start typing for Library of Congress subject headings..."
			class="subject-input"
			autocomplete="off"
		/>
		{#if loading}
			<span class="loading-indicator">...</span>
		{/if}
	</div>

	{#if showRemove && onremove}
		<button type="button" class="btn-remove" onclick={onremove}> Remove </button>
	{/if}

	{#if showSuggestions && suggestions.length > 0}
		<div class="suggestions-dropdown">
			<div class="suggestions-header">
				<span class="suggestions-title">Library of Congress Subject Headings</span>
				<span class="suggestions-count">{suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}</span>
			</div>
			<ul class="suggestions-list">
				{#each suggestions as suggestion, i}
					<li
						class="suggestion-item"
						class:selected={i === selectedIndex}
						onmousedown={() => selectSuggestion(suggestion)}
					>
						{suggestion}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.subject-input-container {
		position: relative;
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.input-wrapper {
		position: relative;
		flex: 1;
	}

	.subject-input {
		width: 100%;
		padding: 0.75rem;
		padding-right: 2.5rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.subject-input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.loading-indicator {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: #e73b42;
		font-weight: bold;
	}

	.btn-remove {
		padding: 0.75rem 1rem;
		background: #f44336;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		align-self: stretch;
	}

	.btn-remove:hover {
		background: #d32f2f;
	}

	.suggestions-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background: white;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		max-height: 300px;
		overflow-y: auto;
	}

	.suggestions-header {
		padding: 0.75rem;
		background: #f5f5f5;
		border-bottom: 1px solid #e0e0e0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.suggestions-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.suggestions-count {
		font-size: 0.75rem;
		color: #e73b42;
		font-weight: 500;
	}

	.suggestions-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.suggestion-item {
		padding: 0.75rem;
		cursor: pointer;
		border-bottom: 1px solid #f0f0f0;
		transition: all 0.15s;
	}

	.suggestion-item:last-child {
		border-bottom: none;
	}

	.suggestion-item:hover,
	.suggestion-item.selected {
		background: rgba(231, 59, 66, 0.05);
		color: #e73b42;
	}

	.suggestion-item.selected {
		background: rgba(231, 59, 66, 0.1);
		font-weight: 500;
	}
</style>
