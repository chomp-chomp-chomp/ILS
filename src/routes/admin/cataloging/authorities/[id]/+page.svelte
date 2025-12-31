<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let authority = $state<any>(data.authority);
	let heading = $state(authority.heading || '');
	let type = $state(authority.type || 'personal_name');
	let source = $state(authority.source || 'local');
	let lccn = $state(authority.lccn || '');
	let note = $state(authority.note || '');
	let variantForms = $state<string[]>(authority.variant_forms || []);
	let crossReferences = $state<any[]>(authority.authority_cross_refs || []);
	let mergeTarget = $state<string>(data.mergeCandidates?.[0]?.id || '');
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');
	let saving = $state(false);

	const authorityTypes = [
		{ value: 'personal_name', label: 'Personal Name' },
		{ value: 'corporate_name', label: 'Corporate Name' },
		{ value: 'geographic_name', label: 'Geographic Name' },
		{ value: 'topical_subject', label: 'Topical Subject' }
	];

	const sources = [
		{ value: 'lcnaf', label: 'LC Names (LCNAF)' },
		{ value: 'lcsh', label: 'LC Subjects (LCSH)' },
		{ value: 'local', label: 'Local' }
	];

	function addVariant() {
		variantForms = [...variantForms, ''];
	}

	function removeVariant(index: number) {
		variantForms = variantForms.filter((_, i) => i !== index);
	}

	function addCrossRef() {
		crossReferences = [
			...crossReferences,
			{ ref_type: 'see', reference_text: '', note: '' }
		];
	}

	function removeCrossRef(index: number) {
		crossReferences = crossReferences.filter((_, i) => i !== index);
	}

	async function saveAuthority() {
		saving = true;
		message = '';

		try {
			const response = await fetch('/api/authorities', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: data.authorityId,
					heading,
					type,
					source,
					lccn: lccn || null,
					note,
					variant_forms: variantForms.filter((v) => v.trim()),
					cross_references: crossReferences
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save authority');
			}

			const result = await response.json();
			authority = result.authority;
			message = 'Authority updated successfully';
			messageType = 'success';
		} catch (err: any) {
			message = err.message || 'Failed to save authority';
			messageType = 'error';
		} finally {
			saving = false;
		}
	}

	async function mergeAuthority() {
		if (!mergeTarget) {
			message = 'Select a target authority to merge into';
			messageType = 'error';
			return;
		}

		if (
			!confirm(
				'Merge this authority into the selected one? Links and cross-references will be moved.'
			)
		) {
			return;
		}

		saving = true;
		message = '';

		try {
			const response = await fetch('/api/authorities/merge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source_id: data.authorityId,
					target_id: mergeTarget
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to merge authorities');
			}

			const result = await response.json();
			message = 'Merged successfully. Redirecting to target authority...';
			messageType = 'success';

			setTimeout(() => goto(`/admin/cataloging/authorities/${result.target.id}`), 1200);
		} catch (err: any) {
			message = err.message || 'Failed to merge authorities';
			messageType = 'error';
		} finally {
			saving = false;
		}
	}

	function formatUsageLabel(link: any) {
		const fieldLabel = link.marc_field === '100' ? 'Personal name' : 'Subject';
		return `${fieldLabel} • Field ${link.marc_field}${link.field_index ? ` [${link.field_index + 1}]` : ''}`;
	}
</script>

<svelte:head>
	<title>{heading} - Authority</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>{heading}</h1>
		<p>Edit authority record, variants, cross-references, and usage.</p>
	</header>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<div class="layout">
		<section class="card">
			<h2>Authorized Heading</h2>
			<div class="form-grid">
				<label>
					<span>Heading</span>
					<input type="text" bind:value={heading} />
				</label>

				<label>
					<span>Type</span>
					<select bind:value={type}>
						{#each authorityTypes as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<label>
					<span>Source</span>
					<select bind:value={source}>
						{#each sources as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<label>
					<span>LCCN (optional)</span>
					<input type="text" bind:value={lccn} placeholder="n#######" />
				</label>
			</div>

			<label>
				<span>Note</span>
				<textarea rows="3" bind:value={note} placeholder="Scope note or biographical note"></textarea>
			</label>

			<div class="variant-section">
				<div class="section-header">
					<h3>Variant Forms</h3>
					<button class="btn-secondary" type="button" onclick={addVariant}>Add Variant</button>
				</div>

				{#if variantForms.length === 0}
					<p class="muted">No variant forms recorded.</p>
				{:else}
					<div class="variant-list">
						{#each variantForms as variant, i}
							<div class="variant-row">
								<input type="text" bind:value={variantForms[i]} placeholder="Variant heading" />
								<button class="btn-small" type="button" onclick={() => removeVariant(i)}>
									Remove
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="crossref-section">
				<div class="section-header">
					<h3>Cross References</h3>
					<button class="btn-secondary" type="button" onclick={addCrossRef}>Add Reference</button>
				</div>

				{#if crossReferences.length === 0}
					<p class="muted">No cross-references configured.</p>
				{:else}
					<div class="crossref-list">
						{#each crossReferences as ref, i}
							<div class="crossref-row">
								<select bind:value={crossReferences[i].ref_type}>
									<option value="see">See (Use)</option>
									<option value="see_also">See also</option>
									<option value="see_from">See from</option>
								</select>
								<input
									type="text"
									bind:value={crossReferences[i].reference_text}
									placeholder="Reference heading"
								/>
								<input
									type="text"
									bind:value={crossReferences[i].note}
									placeholder="Note (optional)"
								/>
								<button class="btn-small" type="button" onclick={() => removeCrossRef(i)}>
									Remove
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="actions">
				<button class="btn-primary" type="button" onclick={saveAuthority} disabled={saving}>
					{saving ? 'Saving…' : 'Save Changes'}
				</button>
				{#if lccn}
					<a
						class="btn-secondary"
						href={`https://id.loc.gov/authorities/${type.includes('subject') ? 'subjects' : 'names'}/${lccn}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						View in LoC
					</a>
				{/if}
			</div>
		</section>

		<section class="card">
			<h2>Usage ({authority.usage_count || 0})</h2>
			{#if authority.marc_authority_links?.length}
				<ul class="usage-list">
					{#each authority.marc_authority_links as link}
						<li>
							<div>
								<div class="usage-heading">
									{link.marc_records?.title_statement?.a || 'Untitled record'}
								</div>
								<div class="usage-meta">
									<span class="badge">{formatUsageLabel(link)}</span>
									{#if link.marc_records?.material_type}
										<span class="badge badge-muted">{link.marc_records.material_type}</span>
									{/if}
									<span class="badge badge-muted">
										{Math.round((link.confidence || 1) * 100)}% match
									</span>
									{#if link.is_automatic}
										<span class="badge badge-warn">Automatic</span>
									{/if}
								</div>
							</div>
							<a
								class="record-link"
								href={`/admin/cataloging/edit/${link.marc_records?.id || link.marc_record_id}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								View record
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">No bibliographic records are currently linked to this authority.</p>
			{/if}
		</section>

		<section class="card">
			<h2>Merge Duplicates</h2>
			<p class="muted">Merge this authority into another to clean up duplicates.</p>
			<div class="merge-grid">
				<label>
					<span>Target authority</span>
					<select bind:value={mergeTarget}>
						<option value="">Select...</option>
						{#each data.mergeCandidates as candidate}
							<option value={candidate.id}>
								{candidate.heading} ({Math.round((candidate.similarity_score || 0) * 100)}%)
							</option>
						{/each}
					</select>
				</label>
				<button class="btn-primary" type="button" onclick={mergeAuthority} disabled={saving}>
					Merge into selected
				</button>
			</div>
		</section>
	</div>
</div>

<style>
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 20px;
	}

	.page-header {
		margin-bottom: 20px;
	}

	.page-header h1 {
		margin: 0 0 6px 0;
	}

	.page-header p {
		margin: 0;
		color: #555;
	}

	.layout {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.card {
		background: #fff;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
	}

	.card h2 {
		margin: 0 0 12px 0;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		margin-bottom: 12px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
		color: #333;
		font-size: 14px;
	}

	input,
	select,
	textarea {
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 14px;
	}

	textarea {
		width: 100%;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 16px 0 8px 0;
	}

	.variant-list,
	.crossref-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.variant-row,
	.crossref-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) auto;
		gap: 8px;
		align-items: center;
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}

	.btn-primary,
	.btn-secondary,
	.btn-small {
		padding: 10px 16px;
		border: none;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-small {
		background: #f5f5f5;
		color: #333;
		border: 1px solid #ddd;
		font-size: 13px;
	}

	.message {
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 16px;
		border: 1px solid transparent;
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
		background: #e7f1ff;
		border-color: #d0e2ff;
		color: #0b4f9c;
	}

	.muted {
		color: #666;
		font-size: 14px;
	}

	.usage-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.usage-list li {
		border: 1px solid #eee;
		border-radius: 6px;
		padding: 12px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.usage-heading {
		font-weight: 600;
		color: #333;
	}

	.usage-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 12px;
		background: #e3f2fd;
		color: #1976d2;
		font-size: 12px;
	}

	.badge-muted {
		background: #f1f1f1;
		color: #444;
	}

	.badge-warn {
		background: #fff3cd;
		color: #856404;
	}

	.record-link {
		font-size: 13px;
		color: #667eea;
		text-decoration: none;
		font-weight: 600;
	}

	.merge-grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 12px;
		align-items: end;
	}

	@media (max-width: 768px) {
		.variant-row,
		.crossref-row {
			grid-template-columns: 1fr;
		}

		.merge-grid {
			grid-template-columns: 1fr;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
