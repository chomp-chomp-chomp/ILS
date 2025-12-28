<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

			{#each subjects as subject, index}
				<div class="form-row">
					<div class="form-group" style="flex: 1;">
						<label for="subject-{index}">Subject {index + 1}</label>
						<input
							id="subject-{index}"
							type="text"
							bind:value={subjects[index]}
							placeholder="Subject heading"
						/>
					</div>
					{#if subjects.length > 1}
						<button
							type="button"
							class="btn-remove"
							onclick={() => removeSubject(index)}
							style="align-self: flex-end;"
						>
							Remove
						</button>
					{/if}
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
