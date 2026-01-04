<script lang="ts">
	/**
	 * Inline Authority Creation Modal
	 *
	 * Allows creating authorities directly from cataloging interface
	 * - Searches LC first to avoid duplicates
	 * - Falls back to local authority creation
	 * - Automatically links to current record
	 */

	interface Props {
		heading: string;
		type: 'personal_name' | 'corporate_name' | 'topical_subject' | 'geographic_name';
		marcRecordId?: string;
		marcField?: string;
		fieldIndex?: number;
		onAuthorityCreated?: (authority: any) => void;
		onCancel?: () => void;
	}

	let { heading, type, marcRecordId, marcField, fieldIndex = 0, onAuthorityCreated, onCancel }: Props =
		$props();

	// State
	let step = $state<'search-lc' | 'create-local'>('search-lc');
	let lcResults = $state<any[]>([]);
	let loadingLc = $state(false);
	let creating = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');

	// Form fields for local authority
	let localHeading = $state(heading);
	let note = $state('');
	let variantForms = $state<string[]>([]);
	let newVariant = $state('');

	// Search LC on mount only
	let hasSearched = $state(false);
	$effect(() => {
		if (!hasSearched) {
			hasSearched = true;
			searchLc();
		}
	});

	async function searchLc() {
		loadingLc = true;
		message = '';

		try {
			const lcType = type.includes('subject') ? 'subjects' : 'names';
			const response = await fetch(
				`/api/authorities/loc?q=${encodeURIComponent(heading)}&type=${lcType}`
			);

			if (!response.ok) throw new Error('LC search failed');

			const data = await response.json();
			lcResults = data.authorities || [];

			if (lcResults.length === 0) {
				message = 'No Library of Congress matches found. You can create a local authority below.';
				messageType = 'info';
				step = 'create-local';
			}
		} catch (error: any) {
			console.error('Error searching LC:', error);
			message = 'LC search unavailable. You can create a local authority below.';
			messageType = 'info';
			step = 'create-local';
		} finally {
			loadingLc = false;
		}
	}

	async function importLcAuthority(authority: any) {
		creating = true;
		message = '';

		try {
			// Import from LC
			const importResponse = await fetch('/api/authorities/loc', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					uri: authority.uri,
					lccn: authority.lccn
				})
			});

			if (!importResponse.ok) {
				throw new Error('Failed to import authority');
			}

			const importData = await importResponse.json();

			if (!importData.authority) {
				throw new Error('Import failed - no authority returned');
			}

			// Link to current record if we have MARC info
			if (marcRecordId && marcField) {
				await linkAuthority(importData.authority.id, importData.authority.heading);
			}

			// Set success message based on whether it was imported or already existed
			if (importData.imported === false) {
				message = 'Authority already exists - linked to record';
			} else {
				message = 'Authority imported from Library of Congress';
			}
			messageType = 'success';

			// Notify parent
			if (onAuthorityCreated) {
				onAuthorityCreated(importData.authority);
			}
		} catch (error: any) {
			console.error('Error importing LC authority:', error);
			message = error.message || 'Failed to import authority';
			messageType = 'error';
		} finally {
			creating = false;
		}
	}

	async function createLocalAuthority() {
		if (!localHeading.trim()) {
			message = 'Heading is required';
			messageType = 'error';
			return;
		}

		creating = true;
		message = '';

		try {
			const response = await fetch('/api/authorities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					heading: localHeading.trim(),
					type,
					source: 'local',
					note: note.trim() || undefined,
					variant_forms: variantForms.filter((v) => v.trim()).length > 0 ? variantForms : undefined
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create authority');
			}

			const data = await response.json();

			if (!data.authority) {
				throw new Error('Creation failed - no authority returned');
			}

			// Link to current record if we have MARC info
			if (marcRecordId && marcField) {
				await linkAuthority(data.authority.id, data.authority.heading);
			}

			message = 'Local authority created';
			messageType = 'success';

			// Notify parent
			if (onAuthorityCreated) {
				onAuthorityCreated(data.authority);
			}
		} catch (error: any) {
			console.error('Error creating local authority:', error);
			message = error.message || 'Failed to create authority';
			messageType = 'error';
		} finally {
			creating = false;
		}
	}

	async function linkAuthority(authorityId: string, authorityHeading: string) {
		try {
			const response = await fetch('/api/authorities/suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					marc_record_id: marcRecordId,
					heading: authorityHeading,
					marc_field: marcField,
					field_index: fieldIndex,
					authority_id: authorityId,
					type
				})
			});

			if (!response.ok) throw new Error('Failed to link authority');
		} catch (error) {
			console.error('Error linking authority:', error);
			// Don't fail the whole operation if linking fails
		}
	}

	function addVariant() {
		if (newVariant.trim() && !variantForms.includes(newVariant.trim())) {
			variantForms = [...variantForms, newVariant.trim()];
			newVariant = '';
		}
	}

	function removeVariant(index: number) {
		variantForms = variantForms.filter((_, i) => i !== index);
	}

	function skipToLocal() {
		step = 'create-local';
	}
</script>

<div class="modal-backdrop" onclick={onCancel}>
	<div class="modal" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<h2>Add Authority: {heading}</h2>
			<button class="close-btn" onclick={onCancel}>×</button>
		</div>

		<div class="modal-body">
			{#if message}
				<div class="message {messageType}">
					{message}
				</div>
			{/if}

			{#if step === 'search-lc'}
				<div class="step-section">
					<h3>Library of Congress Matches</h3>
					<p class="help-text">
						Found {lcResults.length} matching authorit{lcResults.length === 1 ? 'y' : 'ies'} from LC.
						Select one to import, or create a local authority.
					</p>

					{#if loadingLc}
						<div class="loading">Searching Library of Congress...</div>
					{:else if lcResults.length > 0}
						<div class="lc-results">
							{#each lcResults as authority}
								<div class="lc-result-item">
									<div class="lc-result-header">
										<div>
											<strong>{authority.label || authority.heading}</strong>
											{#if authority.lccn}
												<span class="badge">{authority.lccn}</span>
											{/if}
										</div>
										<button
											class="btn-primary btn-small"
											onclick={() => importLcAuthority(authority)}
											disabled={creating}
										>
											{creating ? 'Importing...' : 'Import'}
										</button>
									</div>

									{#if authority.variants && authority.variants.length > 0}
										<div class="variants">
											<strong>Variants:</strong>
											{authority.variants.slice(0, 3).join(', ')}
											{#if authority.variants.length > 3}
												+{authority.variants.length - 3} more
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>

						<div class="divider">
							<span>OR</span>
						</div>

						<button class="btn-secondary" onclick={skipToLocal}>
							Create Local Authority Instead
						</button>
					{/if}
				</div>
			{/if}

			{#if step === 'create-local'}
				<div class="step-section">
					<h3>Create Local Authority</h3>
					<p class="help-text">
						No Library of Congress match found. Create a local authority record.
					</p>

					<form onsubmit={(e) => { e.preventDefault(); createLocalAuthority(); }}>
						<div class="form-group">
							<label for="heading">
								Authorized Heading <span class="required">*</span>
							</label>
							<input
								id="heading"
								type="text"
								bind:value={localHeading}
								placeholder="Enter the authorized form"
								required
							/>
							<div class="help-text">The standardized form of this name/subject</div>
						</div>

						<div class="form-group">
							<label for="note">Note</label>
							<textarea
								id="note"
								bind:value={note}
								placeholder="Scope note, biographical info, etc. (optional)"
								rows="3"
							></textarea>
						</div>

						<div class="form-group">
							<label for="variant">Variant Forms</label>
							<div class="variant-input">
								<input
									id="variant"
									type="text"
									bind:value={newVariant}
									placeholder="Add alternate form"
									onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addVariant())}
								/>
								<button type="button" class="btn-small" onclick={addVariant}>Add</button>
							</div>

							{#if variantForms.length > 0}
								<ul class="variant-list">
									{#each variantForms as variant, i}
										<li>
											{variant}
											<button type="button" class="remove-btn" onclick={() => removeVariant(i)}>
												×
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>

						<div class="form-actions">
							<button type="button" class="btn-cancel" onclick={onCancel} disabled={creating}>
								Cancel
							</button>
							{#if lcResults.length > 0}
								<button type="button" class="btn-secondary" onclick={() => (step = 'search-lc')} disabled={creating}>
									Back to LC Results
								</button>
							{/if}
							<button type="submit" class="btn-primary" disabled={creating || !localHeading.trim()}>
								{creating ? 'Creating...' : 'Create Authority'}
							</button>
						</div>
					</form>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal {
		background: white;
		border-radius: 8px;
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #eee;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 20px;
		color: #333;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 28px;
		color: #999;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		line-height: 1;
		transition: color 0.2s;
	}

	.close-btn:hover {
		color: #333;
	}

	.modal-body {
		padding: 20px;
	}

	.message {
		padding: 12px;
		border-radius: 4px;
		margin-bottom: 20px;
		border: 1px solid;
	}

	.message.success {
		background: #d4edda;
		border-color: #c3e6cb;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		border-color: #f5c6cb;
		color: #721c24;
	}

	.message.info {
		background: #d1ecf1;
		border-color: #bee5eb;
		color: #0c5460;
	}

	.step-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.step-section h3 {
		margin: 0;
		font-size: 18px;
		color: #333;
	}

	.help-text {
		color: #666;
		font-size: 14px;
		margin: 0;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.lc-results {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.lc-result-item {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
	}

	.lc-result-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	.badge {
		display: inline-block;
		padding: 2px 6px;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 600;
		margin-left: 8px;
	}

	.variants {
		font-size: 13px;
		color: #666;
	}

	.variants strong {
		color: #333;
	}

	.divider {
		text-align: center;
		position: relative;
		margin: 24px 0;
	}

	.divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: #ddd;
	}

	.divider span {
		position: relative;
		background: white;
		padding: 0 12px;
		color: #999;
		font-size: 13px;
		font-weight: 600;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 6px;
		color: #333;
		font-size: 14px;
	}

	.required {
		color: #e73b42;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.variant-input {
		display: flex;
		gap: 8px;
	}

	.variant-input input {
		flex: 1;
	}

	.variant-list {
		list-style: none;
		padding: 0;
		margin: 8px 0 0 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.variant-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: #f8f9fa;
		border-radius: 4px;
		font-size: 14px;
	}

	.remove-btn {
		background: none;
		border: none;
		color: #dc3545;
		font-size: 20px;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		line-height: 1;
		transition: opacity 0.2s;
	}

	.remove-btn:hover {
		opacity: 0.7;
	}

	.form-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.btn-primary,
	.btn-secondary,
	.btn-cancel,
	.btn-small {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d32f2f;
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f8f9fa;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: #666;
		color: white;
	}

	.btn-cancel:hover:not(:disabled) {
		background: #555;
	}

	.btn-cancel:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-small {
		padding: 6px 12px;
		font-size: 13px;
	}
</style>
