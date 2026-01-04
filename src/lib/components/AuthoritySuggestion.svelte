<script lang="ts">
	/**
	 * Authority Suggestion Component
	 *
	 * Shows authority suggestions while cataloging
	 * Displays see/see also references
	 * Allows linking heading to authority
	 */

	import InlineAuthorityCreate from './InlineAuthorityCreate.svelte';

	interface Props {
		heading: string;
		type: 'personal_name' | 'corporate_name' | 'topical_subject' | 'geographic_name';
		marcRecordId?: string;
		marcField: string;
		fieldIndex?: number;
		onAuthoritySelected?: (authority: any) => void;
	}

	let { heading, type, marcRecordId, marcField, fieldIndex = 0, onAuthoritySelected }: Props =
		$props();

	let suggestions = $state<any[]>([]);
	let loading = $state(false);
	let showSuggestions = $state(false);
	let selectedAuthority = $state<any>(null);
	let message = $state('');
	let showCreateModal = $state(false);

	// Debounce timer
	let debounceTimer: number;

	// Watch heading changes and fetch suggestions
	$effect(() => {
		if (heading && heading.length > 2) {
			clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(() => {
				fetchSuggestions();
			}, 500);
		} else {
			suggestions = [];
			showSuggestions = false;
		}
	});

	async function fetchSuggestions() {
		if (!heading || heading.length < 3) return;

		loading = true;

		try {
			const params = new URLSearchParams({
				heading,
				type,
				limit: '5'
			});

			const response = await fetch(`/api/authorities/suggest?${params.toString()}`);

			if (!response.ok) throw new Error('Failed to fetch suggestions');

			const data = await response.json();
			suggestions = data.suggestions || [];
			showSuggestions = suggestions.length > 0;
		} catch (error) {
			console.error('Error fetching authority suggestions:', error);
		} finally {
			loading = false;
		}
	}

	async function selectAuthority(authority: any) {
		selectedAuthority = authority;

		// If we have a MARC record ID, create the link
		if (marcRecordId) {
			try {
				const response = await fetch('/api/authorities/suggest', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						marc_record_id: marcRecordId,
						heading: authority.heading,
						marc_field: marcField,
						field_index: fieldIndex,
						authority_id: authority.id,
						type
					})
				});

				if (!response.ok) throw new Error('Failed to link authority');

				message = '✓ Linked to authority';
			} catch (error: any) {
				message = '✗ Failed to link';
				console.error('Error linking authority:', error);
			}
		}

		// Notify parent component
		if (onAuthoritySelected) {
			onAuthoritySelected(authority);
		}

		showSuggestions = false;
	}

	function getConfidenceClass(score: number): string {
		if (score >= 0.9) return 'high';
		if (score >= 0.7) return 'medium';
		return 'low';
	}

	function formatConfidence(score: number): string {
		return `${Math.round(score * 100)}%`;
	}

	function handleAuthorityCreated(authority: any) {
		selectedAuthority = authority;
		showCreateModal = false;
		message = '✓ Authority created and linked';

		// Notify parent component
		if (onAuthoritySelected) {
			onAuthoritySelected(authority);
		}
	}

	function openCreateModal() {
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
	}
</script>

{#if loading}
	<div class="authority-widget loading">
		<span class="spinner">🔍</span> Searching authorities...
	</div>
{:else if selectedAuthority}
	<div class="authority-widget selected">
		<div class="selected-authority">
			<strong>✓ {selectedAuthority.heading}</strong>
			<span class="source-badge">{selectedAuthority.source.toUpperCase()}</span>
			{#if selectedAuthority.lccn}
				<a
					href="https://id.loc.gov/authorities/{type.includes('subject')
						? 'subjects'
						: 'names'}/{selectedAuthority.lccn}"
					target="_blank"
					rel="noopener noreferrer"
					class="lccn-link"
				>
					{selectedAuthority.lccn}
				</a>
			{/if}
		</div>
		{#if message}
			<div class="link-message {message.startsWith('✓') ? 'success' : 'error'}">
				{message}
			</div>
		{/if}
		<button class="btn-small" onclick={() => (selectedAuthority = null)}>Change</button>
	</div>
{:else if showSuggestions && suggestions.length > 0}
	<div class="authority-widget suggestions">
		<div class="suggestions-header">
			<strong>Authority Suggestions:</strong>
			<button class="close-btn" onclick={() => (showSuggestions = false)}>×</button>
		</div>

		<div class="suggestions-list">
			{#each suggestions as suggestion}
				{@const crossRefs = suggestion.authority_cross_refs || []}
				{@const seeAlso = crossRefs.filter((ref: any) => ref.ref_type === 'see_also')}

				<div class="suggestion-item">
					<button class="suggestion-btn" onclick={() => selectAuthority(suggestion)}>
						<div class="suggestion-header">
							<span class="heading">{suggestion.heading}</span>
							<span class="confidence confidence-{getConfidenceClass(suggestion.similarity_score)}">
								{formatConfidence(suggestion.similarity_score)}
							</span>
						</div>

						<div class="suggestion-meta">
							<span class="source">{suggestion.source.toUpperCase()}</span>
							{#if suggestion.lccn}
								<span class="lccn">{suggestion.lccn}</span>
							{/if}
							{#if suggestion.usage_count > 0}
								<span class="usage">Used {suggestion.usage_count}×</span>
							{/if}
						</div>

						{#if suggestion.note}
							<div class="note">{suggestion.note}</div>
						{/if}

						{#if suggestion.variant_forms && suggestion.variant_forms.length > 0}
							<div class="variants">
								<strong>Variants:</strong>
								{suggestion.variant_forms.slice(0, 3).join(', ')}
								{#if suggestion.variant_forms.length > 3}
									<span class="more">+{suggestion.variant_forms.length - 3} more</span>
								{/if}
							</div>
						{/if}

						{#if seeAlso.length > 0}
							<div class="see-also">
								<strong>See also:</strong>
								{seeAlso
									.slice(0, 2)
									.map((ref: any) => ref.reference_text)
									.join(', ')}
							</div>
						{/if}
					</button>
				</div>
			{/each}
		</div>

		<div class="suggestions-footer">
			<a href="/admin/cataloging/authorities?q={encodeURIComponent(heading)}" target="_blank">
				Search all authorities
			</a>
		</div>
	</div>
{:else if heading && heading.length > 2 && !loading}
	<div class="authority-widget no-match">
		<span class="warning-icon">⚠️</span>
		<strong>No authority match found</strong>
		<p>This heading is not in the authority file.</p>
		<div class="actions">
			<button class="btn-primary btn-small" onclick={openCreateModal}>
				Add New Authority
			</button>
			<a
				href="/admin/cataloging/authorities?q={encodeURIComponent(heading)}"
				target="_blank"
				class="btn-small"
			>
				Search All Authorities
			</a>
		</div>
	</div>
{/if}

{#if showCreateModal}
	<InlineAuthorityCreate
		{heading}
		{type}
		{marcRecordId}
		{marcField}
		{fieldIndex}
		onAuthorityCreated={handleAuthorityCreated}
		onCancel={closeCreateModal}
	/>
{/if}

<style>
	.authority-widget {
		margin-top: 8px;
		padding: 12px;
		border-radius: 4px;
		font-size: 14px;
		border: 1px solid #ddd;
	}

	.authority-widget.loading {
		background: #f8f9fa;
		color: #666;
		text-align: center;
	}

	.spinner {
		animation: spin 1s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.authority-widget.selected {
		background: #d4edda;
		border-color: #28a745;
	}

	.selected-authority {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.source-badge {
		padding: 2px 6px;
		background: #28a745;
		color: white;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 600;
	}

	.lccn-link {
		font-size: 12px;
		color: #155724;
	}

	.link-message {
		font-size: 12px;
		margin-bottom: 8px;
	}

	.link-message.success {
		color: #155724;
	}

	.link-message.error {
		color: #721c24;
	}

	.authority-widget.suggestions {
		background: #fff;
		border-color: #667eea;
		max-height: 400px;
		overflow-y: auto;
	}

	.suggestions-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #eee;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		color: #999;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		line-height: 1;
	}

	.close-btn:hover {
		color: #333;
	}

	.suggestions-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.suggestion-item {
		border: 1px solid #eee;
		border-radius: 4px;
		overflow: hidden;
	}

	.suggestion-btn {
		width: 100%;
		text-align: left;
		background: white;
		border: none;
		padding: 12px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.suggestion-btn:hover {
		background: #f8f9fa;
	}

	.suggestion-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.heading {
		font-weight: 600;
		color: #333;
	}

	.confidence {
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 600;
	}

	.confidence-high {
		background: #d4edda;
		color: #155724;
	}

	.confidence-medium {
		background: #fff3cd;
		color: #856404;
	}

	.confidence-low {
		background: #f8d7da;
		color: #721c24;
	}

	.suggestion-meta {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: #666;
		margin-bottom: 6px;
	}

	.source {
		font-weight: 600;
		color: #667eea;
	}

	.note {
		font-size: 12px;
		color: #666;
		font-style: italic;
		margin-bottom: 6px;
	}

	.variants,
	.see-also {
		font-size: 12px;
		color: #666;
		margin-top: 6px;
	}

	.variants strong,
	.see-also strong {
		color: #333;
	}

	.more {
		color: #999;
	}

	.suggestions-footer {
		margin-top: 12px;
		padding-top: 8px;
		border-top: 1px solid #eee;
		text-align: center;
	}

	.suggestions-footer a {
		font-size: 13px;
		color: #667eea;
	}

	.authority-widget.no-match {
		background: #fff3cd;
		border-color: #ffc107;
		text-align: center;
	}

	.warning-icon {
		font-size: 24px;
		margin-bottom: 8px;
		display: block;
	}

	.no-match p {
		margin: 8px 0;
		color: #856404;
	}

	.actions {
		display: flex;
		gap: 8px;
		justify-content: center;
		margin-top: 12px;
	}

	.btn-small {
		padding: 6px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 13px;
		background: white;
		color: #333;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
		transition: background 0.2s;
	}

	.btn-small:hover {
		background: #f8f9fa;
	}
</style>
