<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	let templates = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let message = $state('');

	// Modal state
	let showModal = $state(false);
	let editingTemplate = $state<any>(null);
	let saving = $state(false);

	// Form state
	let templateName = $state('');
	let templateDescription = $state('');
	let templateCategory = $state('book');
	let templateMaterialType = $state('book');
	let templateSubjects = $state<string[]>(['']);
	let templatePublisher = $state('');
	let templatePublicationPlace = $state('');
	let templateNote = $state('');

	onMount(async () => {
		await loadTemplates();
	});

	async function loadTemplates() {
		try {
			const { data: templatesData, error: fetchError } = await supabase
				.from('cataloging_templates')
				.select('*')
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;

			templates = templatesData || [];
		} catch (err: any) {
			error = `Error loading templates: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	function openNewTemplateModal() {
		editingTemplate = null;
		resetForm();
		showModal = true;
	}

	function openEditTemplateModal(template: any) {
		editingTemplate = template;
		templateName = template.name;
		templateDescription = template.description || '';
		templateCategory = template.category;
		templateMaterialType = template.material_type || 'book';
		templateSubjects = template.subject_topical?.map((s: any) => s.a) || [''];
		templatePublisher = template.publication_info?.b || '';
		templatePublicationPlace = template.publication_info?.a || '';
		templateNote = template.general_note?.[0] || '';
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		message = '';
		resetForm();
	}

	function resetForm() {
		templateName = '';
		templateDescription = '';
		templateCategory = 'book';
		templateMaterialType = 'book';
		templateSubjects = [''];
		templatePublisher = '';
		templatePublicationPlace = '';
		templateNote = '';
	}

	function addSubject() {
		templateSubjects = [...templateSubjects, ''];
	}

	function removeSubject(index: number) {
		templateSubjects = templateSubjects.filter((_, i) => i !== index);
	}

	async function saveTemplate() {
		if (!templateName.trim()) {
			message = 'Error: Template name is required';
			return;
		}

		saving = true;
		message = '';

		try {
			const templateData = {
				name: templateName.trim(),
				description: templateDescription.trim() || null,
				category: templateCategory,
				material_type: templateMaterialType,
				publication_info: {
					a: templatePublicationPlace.trim() || null,
					b: templatePublisher.trim() || null
				},
				subject_topical: templateSubjects
					.filter(s => s.trim())
					.map(s => ({ a: s.trim() })),
				general_note: templateNote.trim() ? [templateNote.trim()] : null,
				template_data: {
					// Store full template for future extensibility
					subjects: templateSubjects.filter(s => s.trim()),
					publisher: templatePublisher.trim(),
					publicationPlace: templatePublicationPlace.trim(),
					note: templateNote.trim()
				},
				updated_at: new Date().toISOString()
			};

			if (editingTemplate) {
				// Update existing template
				const { error: updateError } = await supabase
					.from('cataloging_templates')
					.update(templateData)
					.eq('id', editingTemplate.id);

				if (updateError) throw updateError;

				message = 'Template updated successfully!';
			} else {
				// Create new template
				const { error: insertError } = await supabase
					.from('cataloging_templates')
					.insert([{
						...templateData,
						created_at: new Date().toISOString()
					}]);

				if (insertError) throw insertError;

				message = 'Template created successfully!';
			}

			await loadTemplates();
			setTimeout(() => {
				closeModal();
			}, 1500);
		} catch (err: any) {
			message = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}

	async function deleteTemplate(id: string, name: string) {
		if (!confirm(`Are you sure you want to delete the template "${name}"?`)) {
			return;
		}

		try {
			const { error: deleteError } = await supabase
				.from('cataloging_templates')
				.delete()
				.eq('id', id);

			if (deleteError) throw deleteError;

			templates = templates.filter(t => t.id !== id);
		} catch (err: any) {
			alert(`Error deleting template: ${err.message}`);
		}
	}

	async function toggleActive(template: any) {
		try {
			const { error: updateError } = await supabase
				.from('cataloging_templates')
				.update({ is_active: !template.is_active })
				.eq('id', template.id);

			if (updateError) throw updateError;

			template.is_active = !template.is_active;
			templates = [...templates]; // Trigger reactivity
		} catch (err: any) {
			alert(`Error updating template: ${err.message}`);
		}
	}

	// Group templates by category
	let templatesByCategory = $derived(
		templates.reduce((acc, template) => {
			const category = template.category || 'other';
			if (!acc[category]) acc[category] = [];
			acc[category].push(template);
			return acc;
		}, {} as Record<string, any[]>)
	);
</script>

<div class="templates-page">
	<header class="page-header">
		<h1>Cataloging Templates</h1>
		<button class="btn-primary" onclick={openNewTemplateModal}>
			+ Create Template
		</button>
	</header>

	{#if loading}
		<div class="loading">Loading templates...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if templates.length === 0}
		<div class="empty-state">
			<h2>No Templates Yet</h2>
			<p>Create reusable templates to speed up cataloging for common material types.</p>
			<button class="btn-primary" onclick={openNewTemplateModal}>
				Create Your First Template
			</button>
		</div>
	{:else}
		<div class="templates-grid">
			{#each Object.entries(templatesByCategory) as [category, categoryTemplates]}
				<div class="category-section">
					<h2 class="category-title">
						{category.charAt(0).toUpperCase() + category.slice(1)}s
						<span class="count">({categoryTemplates.length})</span>
					</h2>

					<div class="template-cards">
						{#each categoryTemplates as template}
							<div class="template-card" class:inactive={!template.is_active}>
								<div class="template-header">
									<div>
										<h3>{template.name}</h3>
										{#if !template.is_active}
											<span class="inactive-badge">Inactive</span>
										{/if}
									</div>
									<div class="template-actions">
										<button
											class="btn-icon"
											onclick={() => toggleActive(template)}
											title={template.is_active ? 'Deactivate' : 'Activate'}
										>
											{template.is_active ? '👁️' : '👁️‍🗨️'}
										</button>
										<button
											class="btn-icon"
											onclick={() => openEditTemplateModal(template)}
											title="Edit"
										>
											✏️
										</button>
										<button
											class="btn-icon btn-delete"
											onclick={() => deleteTemplate(template.id, template.name)}
											title="Delete"
										>
											🗑️
										</button>
									</div>
								</div>

								{#if template.description}
									<p class="template-description">{template.description}</p>
								{/if}

								<div class="template-details">
									<div class="detail">
										<strong>Material:</strong> {template.material_type || 'Not set'}
									</div>
									{#if template.subject_topical?.length > 0}
										<div class="detail">
											<strong>Subjects:</strong>
											{template.subject_topical.map((s: any) => s.a).join(', ')}
										</div>
									{/if}
									{#if template.publication_info?.b}
										<div class="detail">
											<strong>Publisher:</strong> {template.publication_info.b}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showModal}
	<div class="modal-backdrop" onclick={closeModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{editingTemplate ? 'Edit Template' : 'Create Template'}</h2>
				<button class="modal-close" onclick={closeModal}>×</button>
			</div>

			{#if message}
				<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
					{message}
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); saveTemplate(); }}>
				<div class="form-content">
					<div class="form-group">
						<label for="templateName">Template Name *</label>
						<input
							id="templateName"
							type="text"
							bind:value={templateName}
							placeholder="e.g., Fiction Book, Children's DVD"
							required
						/>
					</div>

					<div class="form-group">
						<label for="templateDescription">Description</label>
						<textarea
							id="templateDescription"
							bind:value={templateDescription}
							rows="2"
							placeholder="Optional description of when to use this template"
						></textarea>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="templateCategory">Category *</label>
							<select id="templateCategory" bind:value={templateCategory}>
								<option value="book">Book</option>
								<option value="dvd">DVD</option>
								<option value="audiobook">Audiobook</option>
								<option value="serial">Serial</option>
								<option value="ebook">E-book</option>
								<option value="other">Other</option>
							</select>
						</div>

						<div class="form-group">
							<label for="templateMaterialType">Material Type</label>
							<select id="templateMaterialType" bind:value={templateMaterialType}>
								<option value="book">Book</option>
								<option value="ebook">E-book</option>
								<option value="audiobook">Audiobook</option>
								<option value="dvd">DVD</option>
								<option value="cdrom">CD-ROM</option>
								<option value="serial">Serial</option>
							</select>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="templatePublicationPlace">Publication Place</label>
							<input
								id="templatePublicationPlace"
								type="text"
								bind:value={templatePublicationPlace}
								placeholder="e.g., New York"
							/>
						</div>

						<div class="form-group">
							<label for="templatePublisher">Publisher</label>
							<input
								id="templatePublisher"
								type="text"
								bind:value={templatePublisher}
								placeholder="e.g., Penguin Books"
							/>
						</div>
					</div>

					<div class="form-group">
						<label>Default Subject Headings</label>
						{#each templateSubjects as subject, index}
							<div class="subject-row">
								<input
									type="text"
									bind:value={templateSubjects[index]}
									placeholder="Subject {index + 1}"
								/>
								{#if templateSubjects.length > 1}
									<button
										type="button"
										class="btn-remove-subject"
										onclick={() => removeSubject(index)}
									>
										×
									</button>
								{/if}
							</div>
						{/each}
						<button type="button" class="btn-secondary btn-sm" onclick={addSubject}>
							+ Add Subject
						</button>
					</div>

					<div class="form-group">
						<label for="templateNote">Default Note</label>
						<textarea
							id="templateNote"
							bind:value={templateNote}
							rows="3"
							placeholder="Optional note to add to records created from this template"
						></textarea>
					</div>
				</div>

				<div class="modal-actions">
					<button type="submit" class="btn-primary" disabled={saving || !templateName.trim()}>
						{saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
					</button>
					<button type="button" class="btn-cancel" onclick={closeModal}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.templates-page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		background: #e73b42;
		color: white;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12d34;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.loading,
	.error {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
	}

	.error {
		color: #c33;
		background: #fee;
		border: 1px solid #fcc;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
	}

	.empty-state h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.empty-state p {
		color: #666;
		margin-bottom: 2rem;
	}

	.category-section {
		margin-bottom: 2.5rem;
	}

	.category-title {
		font-size: 1.25rem;
		color: #2c3e50;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #e73b42;
	}

	.count {
		color: #999;
		font-size: 0.9rem;
		font-weight: normal;
	}

	.template-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1rem;
	}

	.template-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		transition: all 0.2s;
	}

	.template-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.template-card.inactive {
		opacity: 0.6;
		background: #f9f9f9;
	}

	.template-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.template-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: #2c3e50;
	}

	.inactive-badge {
		display: inline-block;
		background: #999;
		color: white;
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		margin-left: 0.5rem;
		font-weight: normal;
	}

	.template-actions {
		display: flex;
		gap: 0.25rem;
	}

	.btn-icon {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.btn-icon:hover {
		background: #f0f0f0;
	}

	.btn-icon.btn-delete:hover {
		background: #fee;
	}

	.template-description {
		color: #666;
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
		font-style: italic;
	}

	.template-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.detail {
		color: #555;
	}

	.detail strong {
		color: #333;
	}

	/* Modal styles */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		max-width: 700px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
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
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		color: #999;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.modal-close:hover {
		background: #f5f5f5;
		color: #333;
	}

	.message {
		margin: 1rem 1.5rem;
		padding: 1rem;
		border-radius: 4px;
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

	.form-content {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
		font-size: 0.875rem;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 0.875rem;
		box-sizing: border-box;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	.subject-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.subject-row input {
		flex: 1;
	}

	.btn-remove-subject {
		width: 36px;
		height: 36px;
		border: none;
		background: #f44336;
		color: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1.5rem;
		line-height: 1;
		transition: all 0.2s;
	}

	.btn-remove-subject:hover {
		background: #d32f2f;
	}

	.btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		background: #e0e0e0;
		color: #333;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-sm {
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
	}

	.modal-actions {
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.modal-actions .btn-primary,
	.modal-actions .btn-cancel {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		font-weight: 500;
	}

	.modal-actions .btn-cancel {
		background: #e0e0e0;
		color: #333;
	}

	.modal-actions .btn-cancel:hover {
		background: #d0d0d0;
	}
</style>
