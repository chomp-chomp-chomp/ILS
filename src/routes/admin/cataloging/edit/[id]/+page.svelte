<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import SubjectHeadingInput from '$lib/components/SubjectHeadingInput.svelte';
	import BookCover from '$lib/components/BookCover.svelte';

	let { data }: { data: PageData } = $props();

	const record = data.record;

	// Pre-populate fields from existing record
	let isbn = $state(record.isbn || '');
	let title = $state(record.title_statement?.a || '');
	let subtitle = $state(record.title_statement?.b || '');
	let author = $state(record.main_entry_personal_name?.a || '');
	let publisher = $state(record.publication_info?.b || '');
	let publicationPlace = $state(record.publication_info?.a || '');
	let publicationYear = $state(record.publication_info?.c || '');
	let pages = $state(record.physical_description?.a?.replace(' pages', '') || '');
	let summary = $state(record.summary || '');
	let subjects = $state<string[]>(
		record.subject_topical?.map((s: any) => s.a) || ['']
	);
	let materialType = $state(record.material_type || 'book');
	let customCoverUrl = $state<string | null>(record.cover_image_url || null);

	let saving = $state(false);
	let message = $state('');
	let uploadingCover = $state(false);
	let coverMessage = $state('');
	let manualCoverUrl = $state('');

	function addSubject() {
		subjects = [...subjects, ''];
	}

	function removeSubject(index: number) {
		subjects = subjects.filter((_, i) => i !== index);
	}

	async function updateRecord() {
		saving = true;
		message = '';

		try {
			const updatedRecord = {
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
				updated_at: new Date().toISOString()
			};

			const { error: updateError } = await data.supabase
				.from('marc_records')
				.update(updatedRecord)
				.eq('id', record.id);

			if (updateError) throw updateError;

			message = 'Record updated successfully!';
			setTimeout(() => {
				goto('/admin/cataloging');
			}, 1500);
		} catch (error) {
			message = `Error: ${error.message}`;
		} finally {
			saving = false;
		}
	}

	async function duplicateRecord() {
		if (!confirm('Create a copy of this record? You will be taken to edit the new copy.')) {
			return;
		}

		saving = true;
		message = '';

		try {
			// Create a copy of the record, excluding unique fields
			const duplicateData = {
				// Copy all MARC fields
				isbn: record.isbn,
				issn: record.issn,
				material_type: record.material_type,
				leader: record.leader,
				date_entered: record.date_entered,

				// MARC content fields
				main_entry_personal_name: record.main_entry_personal_name,
				main_entry_corporate_name: record.main_entry_corporate_name,
				title_statement: record.title_statement,
				publication_info: record.publication_info,
				physical_description: record.physical_description,
				series_statement: record.series_statement,
				general_note: record.general_note,
				bibliography_note: record.bibliography_note,
				summary: record.summary,
				subject_topical: record.subject_topical,
				subject_geographic: record.subject_geographic,
				added_entry_personal_name: record.added_entry_personal_name,
				added_entry_corporate_name: record.added_entry_corporate_name,
				marc_json: record.marc_json,

				// Timestamps will be auto-generated
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
				// Note: control_number is NOT copied (should be unique)
			};

			const { data: newRecord, error: insertError } = await data.supabase
				.from('marc_records')
				.insert([duplicateData])
				.select()
				.single();

			if (insertError) throw insertError;

			// Redirect to edit the new record
			goto(`/admin/cataloging/edit/${newRecord.id}`);
		} catch (error) {
			message = `Error duplicating record: ${error.message}`;
			saving = false;
		}
	}

	async function deleteRecord() {
		if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
			return;
		}

		saving = true;
		try {
			const { error: deleteError} = await data.supabase
				.from('marc_records')
				.delete()
				.eq('id', record.id);

			if (deleteError) throw deleteError;

			goto('/admin/cataloging');
		} catch (error) {
			message = `Error deleting: ${error.message}`;
			saving = false;
		}
	}

	async function handleCoverUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		uploadingCover = true;
		coverMessage = '';

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('recordId', record.id);

			const response = await fetch('/api/cover-upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Upload failed');
			}

			customCoverUrl = result.coverUrl;
			coverMessage = 'Cover uploaded successfully!';

			// Clear the file input
			input.value = '';
		} catch (error: any) {
			coverMessage = `Error: ${error.message}`;
		} finally {
			uploadingCover = false;
		}
	}

	async function deleteCover() {
		if (!confirm('Are you sure you want to remove the custom cover?')) return;

		uploadingCover = true;
		coverMessage = '';

		try {
			const response = await fetch('/api/cover-upload', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ recordId: record.id })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Delete failed');
			}

			customCoverUrl = null;
			coverMessage = 'Cover removed successfully!';
		} catch (error: any) {
			coverMessage = `Error: ${error.message}`;
		} finally {
			uploadingCover = false;
		}
	}

	async function saveManualUrl() {
		if (!manualCoverUrl || !manualCoverUrl.trim()) {
			coverMessage = 'Please enter a valid URL';
			return;
		}

		uploadingCover = true;
		coverMessage = '';

		try {
			// Validate URL format
			new URL(manualCoverUrl);

			// Update the database directly with the URL
			const { error: updateError } = await data.supabase
				.from('marc_records')
				.update({ cover_image_url: manualCoverUrl })
				.eq('id', record.id);

			if (updateError) {
				throw new Error(updateError.message);
			}

			customCoverUrl = manualCoverUrl;
			coverMessage = 'Cover URL saved successfully!';
			manualCoverUrl = '';
		} catch (error: any) {
			if (error.name === 'TypeError') {
				coverMessage = 'Error: Invalid URL format';
			} else {
				coverMessage = `Error: ${error.message}`;
			}
		} finally {
			uploadingCover = false;
		}
	}
</script>

<div class="cataloging-form">
	<div class="header">
		<h1>Edit MARC Record</h1>
		<div class="header-actions">
			<button class="btn-secondary" onclick={duplicateRecord} disabled={saving}>
				📋 Duplicate Record
			</button>
			<button class="btn-delete" onclick={deleteRecord} disabled={saving}>
				Delete Record
			</button>
		</div>
	</div>

	{#if message}
		<div class={message.startsWith('Error') ? 'message error' : 'message success'}>
			{message}
		</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); updateRecord(); }}>
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

		<!-- Cover Image Section -->
		<section class="form-section">
			<h2>Cover Image</h2>

			{#if coverMessage}
				<div class={coverMessage.startsWith('Error') ? 'message error' : 'message success'}>
					{coverMessage}
				</div>
			{/if}

			<div class="cover-upload-container">
				<div class="cover-preview">
					<BookCover
						isbn={isbn}
						title={title}
						author={author}
						customCoverUrl={customCoverUrl}
						size="large"
					/>
				</div>

				<div class="cover-controls">
					<p class="helper-text">
						{#if customCoverUrl}
							Custom cover uploaded. Overriding auto-fetched covers.
						{:else}
							No custom cover. Using auto-fetched cover from ISBN/title if available.
						{/if}
					</p>

					<div class="upload-section">
						<label for="cover-upload" class="upload-label">
							<span class="upload-icon">📷</span>
							{uploadingCover ? 'Uploading...' : 'Upload Custom Cover'}
						</label>
						<input
							id="cover-upload"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							onchange={handleCoverUpload}
							disabled={uploadingCover}
							style="display: none;"
						/>

						{#if customCoverUrl}
							<button
								type="button"
								class="btn-delete-cover"
								onclick={deleteCover}
								disabled={uploadingCover}
							>
								Remove Custom Cover
							</button>
						{/if}
					</div>

					<div class="divider">
						<span>OR</span>
					</div>

					<div class="manual-url-section">
						<label for="manual-cover-url">Enter Cover Image URL</label>
						<div class="url-input-group">
							<input
								id="manual-cover-url"
								type="url"
								bind:value={manualCoverUrl}
								placeholder="https://example.com/cover.jpg"
								disabled={uploadingCover}
							/>
							<button
								type="button"
								class="btn-save-url"
								onclick={saveManualUrl}
								disabled={uploadingCover || !manualCoverUrl}
							>
								Save URL
							</button>
						</div>
					</div>

					<div class="file-requirements">
						<small>
							<strong>Upload:</strong> JPEG, PNG, WebP, or GIF • Max 5MB<br />
							<strong>URL:</strong> Direct link to any publicly accessible image
						</small>
					</div>
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
				{saving ? 'Saving...' : 'Update Record'}
			</button>
			<a href="/admin/cataloging" class="btn-cancel">Cancel</a>
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

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
	}

	h1 {
		margin: 0;
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
	.btn-cancel,
	.btn-remove,
	.btn-delete {
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

	.btn-cancel {
		background: #e0e0e0;
		color: #333;
	}

	.btn-cancel:hover {
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

	.btn-delete {
		background: #f44336;
		color: white;
	}

	.btn-delete:hover:not(:disabled) {
		background: #d32f2f;
	}

	.btn-delete:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Cover Upload Styles */
	.cover-upload-container {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.cover-preview {
		flex-shrink: 0;
	}

	.cover-controls {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.helper-text {
		color: #666;
		font-size: 0.875rem;
		margin: 0;
	}

	.upload-section {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.upload-label {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: #667eea;
		color: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: background 0.2s;
	}

	.upload-label:hover {
		background: #5568d3;
	}

	.upload-label:has(+ input:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-icon {
		font-size: 1.25rem;
	}

	.btn-delete-cover {
		padding: 0.75rem 1.5rem;
		background: #f44336;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: background 0.2s;
	}

	.btn-delete-cover:hover:not(:disabled) {
		background: #d32f2f;
	}

	.btn-delete-cover:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.file-requirements {
		color: #666;
		font-size: 0.875rem;
	}

	.file-requirements strong {
		color: #333;
	}

	.divider {
		display: flex;
		align-items: center;
		text-align: center;
		margin: 1.5rem 0;
		color: #999;
		font-size: 0.875rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid #ddd;
	}

	.divider span {
		padding: 0 1rem;
	}

	.manual-url-section {
		margin-bottom: 1rem;
	}

	.manual-url-section label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
		font-size: 0.875rem;
	}

	.url-input-group {
		display: flex;
		gap: 0.5rem;
	}

	.url-input-group input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.url-input-group input:focus {
		outline: none;
		border-color: #667eea;
	}

	.btn-save-url {
		padding: 0.5rem 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		white-space: nowrap;
		transition: background 0.2s;
	}

	.btn-save-url:hover:not(:disabled) {
		background: #5568d3;
	}

	.btn-save-url:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.cover-upload-container {
			flex-direction: column;
		}

		.url-input-group {
			flex-direction: column;
		}

		.btn-save-url {
			width: 100%;
		}
	}
</style>
