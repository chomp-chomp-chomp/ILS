<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const searchParams = $derived($page.url.searchParams);

	let heading = $state(searchParams.get('heading') || '');
	let type = $state(searchParams.get('type') || 'personal_name');
	let source = $state('local');
	let lccn = $state('');
	let note = $state('');
	let variantForms = $state<string[]>([]);
	let crossReferences = $state<any[]>([]);
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

	async function createAuthority() {
		saving = true;
		message = '';

		try {
			const response = await fetch('/api/authorities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
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
				throw new Error(error.message || 'Failed to create authority');
			}

			const result = await response.json();
			message = 'Authority created';
			messageType = 'success';
			setTimeout(() => goto(`/admin/cataloging/authorities/${result.authority.id}`), 900);
		} catch (err: any) {
			message = err.message || 'Failed to create authority';
			messageType = 'error';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>New Authority</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>Create Authority</h1>
		<p>Add a new authorized heading with cross-references and variants.</p>
	</header>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	<section class="card">
		<div class="form-grid">
			<label>
				<span>Heading</span>
				<input type="text" bind:value={heading} placeholder="Authorized heading" />
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

		<div class="section-header">
			<h3>Variant Forms</h3>
			<button class="btn-secondary" type="button" onclick={addVariant}>Add Variant</button>
		</div>
		{#if variantForms.length === 0}
			<p class="muted">No variants yet.</p>
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

		<div class="section-header">
			<h3>Cross References</h3>
			<button class="btn-secondary" type="button" onclick={addCrossRef}>Add Reference</button>
		</div>
		{#if crossReferences.length === 0}
			<p class="muted">Add "See" or "See also" references.</p>
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

		<div class="actions">
			<button class="btn-primary" type="button" onclick={createAuthority} disabled={saving}>
				{saving ? 'Saving…' : 'Create Authority'}
			</button>
			<a class="btn-secondary" href="/admin/cataloging/authorities">Cancel</a>
		</div>
	</section>
</div>

<style>
	.container {
		max-width: 960px;
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

	.card {
		background: #fff;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
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

	@media (max-width: 768px) {
		.variant-row,
		.crossref-row {
			grid-template-columns: 1fr;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
