<script lang="ts">
	import type { PageData } from './$types';
	import SubjectHeadingInput from '$lib/components/SubjectHeadingInput.svelte';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	// Templates state
	let templates = $state<any[]>([]);
	let selectedTemplateId = $state('');
	let loadingTemplates = $state(true);

	// MARC record fields
	let isbn = $state('');
	let title = $state('');
	let subtitle = $state('');
	let author = $state('');
	let publisher = $state('');
	let publicationPlace = $state('');
	let publicationYear = $state('');
	let pages = $state('');
	let summary = $state('');
	let subjects = $state(['']);
	let callNumber = $state('');
	let materialType = $state('book');

	let saving = $state(false);
	let message = $state('');

	onMount(async () => {
		await loadTemplates();
	});

	async function loadTemplates() {
		try {
			const { data: templatesData, error } = await data.supabase
				.from('cataloging_templates')
				.select('*')
				.eq('is_active', true)
				.order('name');

			if (error) throw error;

			templates = templatesData || [];
		} catch (err: any) {
			console.error('Error loading templates:', err.message);
		} finally {
			loadingTemplates = false;
		}
	}

	function applyTemplate() {
		if (!selectedTemplateId) return;

		const template = templates.find(t => t.id === selectedTemplateId);
		if (!template) return;

		// Pre-fill fields from template
		materialType = template.material_type || 'book';
		publisher = template.publication_info?.b || '';
		publicationPlace = template.publication_info?.a || '';

		// Apply subjects
		if (template.subject_topical && template.subject_topical.length > 0) {
			subjects = template.subject_topical.map((s: any) => s.a);
		}

		// Apply note to summary if exists
		if (template.general_note && template.general_note.length > 0) {
			summary = template.general_note[0];
		}

		message = `Template "${template.name}" applied! Fields pre-filled.`;
		setTimeout(() => { message = ''; }, 3000);
	}

	function addSubject() {
		subjects = [...subjects, ''];
	}

	function removeSubject(index: number) {
		subjects = subjects.filter((_, i) => i !== index);
	}

	async function saveRecord() {
		saving = true;
		message = '';

		try {
			const marcRecord = {
				isbn,
				material_type: materialType,
				title_statement: {
					a: title,
					b: subtitle
				},
				main_entry_personal_name: author ? { a: author } : null,
				publication_info: {
					a: publicationPlace,
					b: publisher,
					c: publicationYear
				},
				physical_description: {
					a: pages ? `${pages} pages` : null
				},
				summary,
				subject_topical: subjects
					.filter((s) => s.trim())
					.map((s) => ({ a: s.trim() })),
				marc_json: {
					// Store full MARC data
					leader: '00000nam a2200000 a 4500',
					fields: []
				}
			};

			const { data: inserted, error } = await data.supabase
				.from('marc_records')
				.insert([marcRecord])
				.select();

			if (error) throw error;

			// Auto-create a default holding for the new record
			if (inserted && inserted[0]) {
				const defaultHolding = {
					marc_record_id: inserted[0].id,
					call_number: callNumber || null,
					location: 'Main Library',
					status: 'available',
					copy_number: 1
				};

				await data.supabase.from('holdings').insert([defaultHolding]);
			}

			message = 'Record created successfully!';
			// Reset form
			isbn = '';
			title = '';
			subtitle = '';
			author = '';
			publisher = '';
			publicationPlace = '';
			publicationYear = '';
			pages = '';
			summary = '';
			subjects = [''];
			callNumber = '';
		} catch (error) {
			message = `Error: ${error.message}`;
		} finally {
			saving = false;
		}
	}
</script>

<div class="cataloging-form">
	<h1>Create New MARC Record</h1>

	{#if !loadingTemplates && templates.length > 0}
		<div class="template-selector">
			<div class="template-selector-header">
				<label for="templateSelect">Start from a template:</label>
				<a href="/admin/cataloging/templates" class="manage-templates-link">
					Manage Templates
				</a>
			</div>
			<div class="template-selector-row">
				<select id="templateSelect" bind:value={selectedTemplateId}>
					<option value="">-- No template (blank form) --</option>
					{#each templates as template}
						<option value={template.id}>
							{template.name} ({template.category})
						</option>
					{/each}
				</select>
				<button
					type="button"
					class="btn-apply-template"
					onclick={applyTemplate}
					disabled={!selectedTemplateId}
				>
					Apply Template
				</button>
			</div>
		</div>
	{/if}

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); saveRecord(); }}>
		<section class="form-section">
			<h2>Basic Information</h2>

			<div class="form-row">
				<div class="form-group">
					<label for="isbn">ISBN</label>
					<input id="isbn" type="text" bind:value={isbn} placeholder="978-0-..." />
				</div>

				<div class="form-group">
					<label for="materialType">Material Type</label>
					<select id="materialType" bind:value={materialType}>
						<option value="book">Book</option>
						<option value="ebook">E-book</option>
						<option value="audiobook">Audiobook</option>
						<option value="dvd">DVD</option>
						<option value="cdrom">CD-ROM</option>
						<option value="serial">Serial</option>
					</select>
				</div>
			</div>
		</section>

		<section class="form-section">
			<h2>Title & Author (MARC 245, 100)</h2>

			<div class="form-group">
				<label for="title">Title *</label>
				<input id="title" type="text" bind:value={title} required placeholder="Main title" />
			</div>

			<div class="form-group">
				<label for="subtitle">Subtitle</label>
				<input id="subtitle" type="text" bind:value={subtitle} placeholder="Subtitle or parallel title" />
			</div>

			<div class="form-group">
				<label for="author">Main Author</label>
				<input id="author" type="text" bind:value={author} placeholder="Last, First" />
			</div>
		</section>

		<section class="form-section">
			<h2>Publication Info (MARC 260/264)</h2>

			<div class="form-row">
				<div class="form-group">
					<label for="publicationPlace">Place of Publication</label>
					<input id="publicationPlace" type="text" bind:value={publicationPlace} placeholder="City" />
				</div>

				<div class="form-group">
					<label for="publisher">Publisher</label>
					<input id="publisher" type="text" bind:value={publisher} placeholder="Publisher name" />
				</div>

				<div class="form-group">
					<label for="publicationYear">Year</label>
					<input
						id="publicationYear"
						type="text"
						bind:value={publicationYear}
						placeholder="YYYY"
					/>
				</div>
			</div>
		</section>

		<section class="form-section">
			<h2>Physical Description (MARC 300)</h2>

			<div class="form-group">
				<label for="pages">Pages/Extent</label>
				<input id="pages" type="text" bind:value={pages} placeholder="e.g., 350" />
			</div>
		</section>

		<section class="form-section">
			<h2>Subject Headings (MARC 650)</h2>
			<p class="section-note">
				<strong>Note:</strong> Start typing to see validated Library of Congress Subject Headings.
				Use authorized headings for better discoverability.
			</p>

			{#each subjects as subject, index}
				<div class="form-row">
					<div class="form-group" style="flex: 1;">
						<label for="subject-{index}">Subject {index + 1}</label>
						<SubjectHeadingInput
							bind:value={subjects[index]}
							{index}
							onchange={(val) => (subjects[index] = val)}
							onremove={subjects.length > 1 ? () => removeSubject(index) : undefined}
							showRemove={subjects.length > 1}
						/>
					</div>
				</div>
			{/each}

			<button type="button" class="btn-secondary" onclick={addSubject}>Add Subject</button>
		</section>

		<section class="form-section">
			<h2>Summary (MARC 520)</h2>

			<div class="form-group">
				<label for="summary">Summary/Abstract</label>
				<textarea id="summary" bind:value={summary} rows="4" placeholder="Brief description or abstract"></textarea>
			</div>
		</section>

		<div class="form-actions">
			<button type="submit" class="btn-primary" disabled={saving || !title}>
				{saving ? 'Saving...' : 'Save Record'}
			</button>
			<a href="/admin/cataloging" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>

<style>
	.cataloging-form {
		max-width: 900px;
		background: white;
		padding: 2rem;
		border-radius: 8px;
	}

	h1 {
		margin: 0 0 1.5rem 0;
	}

	.template-selector {
		background: #f0f9ff;
		border: 1px solid #e73b42;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.template-selector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.template-selector-header label {
		font-weight: 600;
		color: #2c3e50;
		margin-bottom: 0;
	}

	.manage-templates-link {
		color: #e73b42;
		font-size: 0.875rem;
		text-decoration: none;
	}

	.manage-templates-link:hover {
		text-decoration: underline;
	}

	.template-selector-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.template-selector-row select {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		background: white;
	}

	.btn-apply-template {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		background: #e73b42;
		color: white;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.btn-apply-template:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-apply-template:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.form-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h2 {
		font-size: 1.25rem;
		margin: 0 0 1rem 0;
		color: #2c3e50;
	}

	.section-note {
		background: #f0f9ff;
		border-left: 3px solid #e73b42;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: #666;
	}

	.section-note strong {
		color: #e73b42;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
	}

	.btn-primary,
	.btn-secondary,
	.btn-remove {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		border: none;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #5568d3;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-remove {
		background: #f44336;
		color: white;
		padding: 0.5rem 1rem;
	}

	.btn-remove:hover {
		background: #d32f2f;
	}
</style>
