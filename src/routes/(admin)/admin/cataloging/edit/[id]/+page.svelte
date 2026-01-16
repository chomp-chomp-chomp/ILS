<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import SubjectHeadingInput from '$lib/components/SubjectHeadingInput.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import AuthoritySuggestion from '$lib/components/AuthoritySuggestion.svelte';
	import { supabase } from '$lib/supabase';

	let { data }: { data: PageData } = $props();

	const record = data.record;
	let authorityLinks = $state<any[]>(data.authorityLinks || []);

	// Pre-populate fields from existing record
	let isbn = $state(record.isbn || '');
	let issn = $state(record.issn || '');
	let title = $state(record.title_statement?.a || '');
	let subtitle = $state(record.title_statement?.b || '');
	let variantTitle = $state(record.varying_form_title?.[0]?.a || '');
	let edition = $state(record.edition_statement?.a || '');
	let author = $state(record.main_entry_personal_name?.a || '');
	let publisher = $state(record.publication_info?.b || '');
	let publicationPlace = $state(record.publication_info?.a || '');
	let publicationYear = $state(record.publication_info?.c || '');
	let pages = $state(record.physical_description?.a?.replace(' pages', '') || '');
	let lcCallNumber = $state(record.lc_call_number?.a || '');
	let deweyCallNumber = $state(record.dewey_call_number?.a || '');
	let languageNote = $state(record.language_note || '');
	let contentsNote = $state(record.formatted_contents_note?.[0] || '');
	let summary = $state(record.summary || '');
	let digitalLinks = $state<any[]>(record.marc_json?.digital_links || []);
	let showHathiTrust = $state(record.marc_json?.digital_links_visibility?.hathiTrust ?? true);
	let showGoogleBooks = $state(record.marc_json?.digital_links_visibility?.googleBooks ?? true);
	let subjects = $state<string[]>(
		record.subject_topical?.map((s: any) => s.a) || ['']
	);
	let genreTerms = $state<string[]>(
		record.genre_form_term?.map((g: any) => g.a) || []
	);
let materialType = $state(record.material_type || 'book');
let customCoverUrl = $state<string | null>(record.cover_image_url || null);
let authorityMessage = $state('');
let visibility = $state(record.visibility || 'public');
let status = $state(record.status || 'active');

	let saving = $state(false);
	let message = $state('');
let uploadingCover = $state(false);
let coverMessage = $state('');
let manualCoverUrl = $state('');
	let attachments = $state<any[]>([]);
	let loadingAttachments = $state(true);
	let attachmentMessage = $state('');
	let attachmentForm = $state({
		title: '',
		description: '',
		file_type: '',
		file_size: '',
		access_level: 'public',
		external_url: '',
		external_expires_at: '',
		filename_original: ''
	});

function isNameLinked() {
	return authorityLinks.some((link) => link.marc_field === '100');
}

function isProviderMatch(provider: string | undefined, match: string) {
	return provider?.toLowerCase().includes(match.toLowerCase()) || false;
}

const hasHathiTrustLinks = $derived(() => digitalLinks.some((link) => isProviderMatch(link.provider, 'hathi')));
const hasGoogleBooksLinks = $derived(() => digitalLinks.some((link) => isProviderMatch(link.provider, 'google')));

function isSubjectLinked(index: number) {
	return authorityLinks.some(
		(link) => link.marc_field === '650' && (link.field_index ?? 0) === index
	);
}

function handleAuthorityLinked(field: string, index: number, authority: any) {
	authorityLinks = authorityLinks.filter(
		(link) => !(link.marc_field === field && (link.field_index ?? 0) === index)
	);

	authorityLinks = [
		...authorityLinks,
		{
			marc_field: field,
			field_index: index,
			authority,
			confidence: 1
		}
	];

	authorityMessage = `Linked to ${authority.heading}`;
}

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
			const updatedMarcJson = {
				...(record.marc_json || {}),
				digital_links: digitalLinks,
				digital_links_visibility: {
					hathiTrust: showHathiTrust,
					googleBooks: showGoogleBooks
				}
			};

			const updatedRecord = {
				isbn,
				issn,
				material_type: materialType,
				visibility,
				status,
				title_statement: {
					a: title,
					b: subtitle
				},
				varying_form_title: variantTitle ? [{ a: variantTitle }] : [],
				edition_statement: edition ? { a: edition } : null,
				main_entry_personal_name: author ? { a: author } : null,
				publication_info: {
					a: publicationPlace,
					b: publisher,
					c: publicationYear
				},
				physical_description: {
					a: pages ? `${pages} pages` : null
				},
				lc_call_number: lcCallNumber ? { a: lcCallNumber } : null,
				dewey_call_number: deweyCallNumber ? { a: deweyCallNumber } : null,
				language_note: languageNote || null,
				formatted_contents_note: contentsNote ? [contentsNote] : [],
				summary,
				marc_json: updatedMarcJson,
				subject_topical: subjects
					.filter((s) => s.trim())
					.map((s) => ({ a: s.trim() })),
				genre_form_term: genreTerms
					.filter((g) => g.trim())
					.map((g) => ({ a: g.trim() })),
				updated_at: new Date().toISOString()
			};

			const { error: updateError } = await supabase
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

			const { data: newRecord, error: insertError } = await supabase
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

	async function archiveRecord() {
		if (!confirm('Archive this record? It will be hidden from the public catalog but can be restored later.')) {
			return;
		}

		saving = true;
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const userId = sessionData?.session?.user?.id;

			const { error: archiveError } = await supabase.rpc('archive_marc_record', {
				record_id: record.id,
				user_id: userId
			});

			if (archiveError) throw archiveError;

			message = 'Record archived successfully';
			setTimeout(() => {
				goto('/admin/cataloging/archives');
			}, 1500);
		} catch (error) {
			message = `Error archiving: ${error.message}`;
			saving = false;
		}
	}

	async function deleteRecord() {
		if (!confirm('Move this record to trash? It will be permanently deleted after 30 days.')) {
			return;
		}

		saving = true;
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const userId = sessionData?.session?.user?.id;

			const { error: deleteError } = await supabase.rpc('soft_delete_marc_record', {
				record_id: record.id,
				user_id: userId
			});

			if (deleteError) throw deleteError;

			message = 'Record moved to trash';
			setTimeout(() => {
				goto('/admin/cataloging/trash');
			}, 1500);
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
			const { error: updateError } = await supabase
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

	onMount(loadAttachments);

	async function loadAttachments() {
		loadingAttachments = true;
		attachmentMessage = '';

		const { data, error } = await supabase
			.from('marc_attachments')
			.select('*')
			.eq('marc_record_id', record.id)
			.order('sort_order', { ascending: true })
			.order('upload_date', { ascending: false });

		if (error) {
			attachmentMessage = 'Failed to load attachments';
			console.error(error);
			loadingAttachments = false;
			return;
		}

		attachments = data || [];
		loadingAttachments = false;
	}

	function resetAttachmentForm() {
		attachmentForm = {
			title: '',
			description: '',
			file_type: '',
			file_size: '',
			access_level: 'public',
			external_url: '',
			external_expires_at: '',
			filename_original: ''
		};
	}

	async function createAttachment() {
		attachmentMessage = '';

		if (!attachmentForm.external_url) {
			attachmentMessage = 'External URL is required';
			return;
		}

		const body = {
			...attachmentForm,
			file_size: attachmentForm.file_size ? Number(attachmentForm.file_size) : null,
			marc_record_id: record.id
		};

		const response = await fetch('/api/attachments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const result = await response.json();

		if (!response.ok) {
			attachmentMessage = result.error || 'Failed to create attachment';
			return;
		}

		attachments = [...attachments, result.attachment].sort(
			(a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
		);
		resetAttachmentForm();
		attachmentMessage = 'Attachment added';
	}

	async function updateAttachment(id: string, updates: Record<string, any>) {
		const response = await fetch(`/api/attachments/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});

		const result = await response.json();

		if (!response.ok) {
			attachmentMessage = result.error || 'Failed to update attachment';
			return;
		}

		attachments = attachments.map((a) => (a.id === id ? { ...a, ...result.attachment } : a));
	}

	async function deleteAttachment(id: string) {
		if (!confirm('Delete this attachment?')) return;

		const response = await fetch(`/api/attachments/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			const result = await response.json();
			attachmentMessage = result.error || 'Failed to delete attachment';
			return;
		}

		attachments = attachments.filter((a) => a.id !== id);
	}

	async function moveAttachment(id: string, direction: 'up' | 'down') {
		const index = attachments.findIndex((a) => a.id === id);
		if (index === -1) return;

		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= attachments.length) return;

		const reordered = [...attachments];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(targetIndex, 0, moved);

		// Reassign sort orders
		const updates = reordered.map((attachment, idx) => ({ ...attachment, sort_order: idx }));
		attachments = updates;

		// Persist sort orders
		await Promise.all(
			updates.map((attachment) =>
				fetch(`/api/attachments/${attachment.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sort_order: attachment.sort_order })
				})
			)
		);
	}

	function attachmentStatus(expiresAt?: string | null) {
		if (!expiresAt) return 'Valid';
		const expiry = new Date(expiresAt);
		if (expiry < new Date()) return 'Expired';
		const soon = Date.now() + 72 * 60 * 60 * 1000;
		return expiry.getTime() <= soon ? 'Expiring soon' : 'Valid';
	}

function statusClass(status: string) {
	if (status === 'Expired') return 'badge danger';
	if (status === 'Expiring soon') return 'badge warning';
	return 'badge success';
}

	function formatAttachmentSize(bytes?: number | null) {
		if (!bytes || bytes <= 0) return 'Unknown size';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
	}

	async function copyDownloadUrl(id: string) {
		if (typeof window === 'undefined') return;
		const url = `${window.location.origin}/api/attachments/${id}/download`;
		await navigator.clipboard.writeText(url);
		attachmentMessage = 'Download URL copied';
	}
</script>

<div class="cataloging-form">
	<div class="header">
		<h1>Edit MARC Record</h1>
		<div class="header-actions">
			<button class="btn-secondary" onclick={duplicateRecord} disabled={saving}>
				📋 Duplicate Record
			</button>
			<button class="btn-archive" onclick={archiveRecord} disabled={saving}>
				📦 Archive Record
			</button>
			<button class="btn-delete" onclick={deleteRecord} disabled={saving}>
				🗑️ Move to Trash
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
					<label for="isbn">ISBN (MARC 020)</label>
					<input id="isbn" type="text" bind:value={isbn} placeholder="978-0-..." />
				</div>

				<div class="form-group">
					<label for="issn">ISSN (MARC 022)</label>
					<input id="issn" type="text" bind:value={issn} placeholder="1234-5678" />
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

			<div class="form-row">
				<div class="form-group">
					<label for="lcCallNumber">LC Call Number (MARC 050)</label>
					<input id="lcCallNumber" type="text" bind:value={lcCallNumber} placeholder="PS3545.I345 C5" />
				</div>

				<div class="form-group">
					<label for="deweyCallNumber">Dewey Decimal (MARC 082)</label>
					<input id="deweyCallNumber" type="text" bind:value={deweyCallNumber} placeholder="813.54" />
				</div>
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="status">Status</label>
					<select id="status" bind:value={status}>
						<option value="active">Active (Live in catalog)</option>
						<option value="archived">Archived (Hidden from public)</option>
						<option value="deleted">Deleted (In trash)</option>
					</select>
					<small class="help-text">
						{#if status === 'active'}
							Record is live and searchable in the public catalog
						{:else if status === 'archived'}
							Record is hidden from public but accessible in Archives
						{:else if status === 'deleted'}
							Record is in trash and will be permanently deleted after 30 days
						{/if}
					</small>
				</div>

				<div class="form-group">
					<label for="visibility">Visibility</label>
					<select id="visibility" bind:value={visibility}>
						<option value="public">Public (OPAC + Staff)</option>
						<option value="staff_only">Staff Only (Admin access only)</option>
						<option value="hidden">Hidden (Completely hidden)</option>
					</select>
					<small class="help-text">
						{#if visibility === 'public'}
							Visible to everyone when status is active
						{:else if visibility === 'staff_only'}
							Only visible to logged-in staff, hidden from public OPAC
						{:else if visibility === 'hidden'}
							Completely hidden from all views (use for testing)
						{/if}
					</small>
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
			<h2>Attachments</h2>
			<p class="section-note">
				Attach external files (PDF, images, audio, video, documents). Links should be expiring share
				URLs from your storage provider. Downloads route through the ILS for access control.
			</p>

			{#if attachmentMessage}
				<div class={attachmentMessage.includes('Failed') ? 'message error' : 'message success'}>
					{attachmentMessage}
				</div>
			{/if}

			<div class="attachment-form-grid">
				<div class="form-group">
					<label for="attachment-title">Title</label>
					<input
						id="attachment-title"
						type="text"
						bind:value={attachmentForm.title}
						placeholder="Table of contents, Author photo, Sample chapter..."
					/>
				</div>

				<div class="form-group">
					<label for="attachment-file-type">File Type (MIME)</label>
					<input
						id="attachment-file-type"
						type="text"
						bind:value={attachmentForm.file_type}
						placeholder="application/pdf, image/jpeg..."
					/>
				</div>

				<div class="form-group">
					<label for="attachment-file-size">File Size (bytes)</label>
					<input
						id="attachment-file-size"
						type="number"
						min="0"
						bind:value={attachmentForm.file_size}
						placeholder="Optional"
					/>
				</div>

				<div class="form-group">
					<label for="attachment-access-level">Access Level</label>
					<select id="attachment-access-level" bind:value={attachmentForm.access_level}>
						<option value="public">Public</option>
						<option value="authenticated">Authenticated</option>
						<option value="staff-only">Staff only</option>
					</select>
				</div>

				<div class="form-group" style="grid-column: span 2;">
					<label for="attachment-description">Description</label>
					<textarea
						id="attachment-description"
						bind:value={attachmentForm.description}
						rows="2"
						placeholder="Short description or notes"
					></textarea>
				</div>

				<div class="form-group">
					<label for="attachment-url">External URL (share link)</label>
					<input
						id="attachment-url"
						type="url"
						bind:value={attachmentForm.external_url}
						placeholder="https://provider.com/share/..."
					/>
				</div>

				<div class="form-group">
					<label for="attachment-expires">Expires At (optional)</label>
					<input
						id="attachment-expires"
						type="datetime-local"
						bind:value={attachmentForm.external_expires_at}
					/>
				</div>

				<div class="form-group">
					<label for="attachment-filename">Original Filename (optional)</label>
					<input
						id="attachment-filename"
						type="text"
						bind:value={attachmentForm.filename_original}
						placeholder="example.pdf"
					/>
				</div>
			</div>

			<div class="form-actions">
				<button type="button" class="btn-primary" onclick={createAttachment}>Add Attachment</button>
				<button type="button" class="btn-secondary" onclick={resetAttachmentForm}>Reset</button>
			</div>

			<div class="attachment-list">
				<div class="attachment-list-header">
					<h3>Existing Attachments</h3>
					{#if loadingAttachments}
						<span class="badge muted">Loading…</span>
					{:else}
						<span class="badge muted">{attachments.length} attached</span>
					{/if}
				</div>

				{#if !loadingAttachments && attachments.length === 0}
					<p class="muted">No attachments yet.</p>
				{/if}

				{#each attachments as attachment, index}
					<div class="attachment-row">
						<div class="attachment-row-main">
							<p class="attachment-title-row">
								{attachment.title || attachment.filename_original || 'Untitled attachment'}
							</p>
							<p class="attachment-meta">
								{attachment.file_type || 'Unknown type'} • {formatAttachmentSize(attachment.file_size)} •
								<span class={statusClass(attachmentStatus(attachment.external_expires_at))}>
									{attachmentStatus(attachment.external_expires_at)}
								</span>
								<span class="badge muted">Access: {attachment.access_level}</span>
								{#if attachment.view_count !== undefined}
									<span class="badge muted">Views: {attachment.view_count}</span>
								{/if}
								{#if attachment.download_count !== undefined}
									<span class="badge muted">Downloads: {attachment.download_count}</span>
								{/if}
							</p>

							{#if attachment.description}
								<p class="attachment-description-row">{attachment.description}</p>
							{/if}
						</div>

						<div class="attachment-actions-row">
							<button
								type="button"
								class="btn-secondary"
								aria-label="Move up"
								disabled={index === 0}
								onclick={() => moveAttachment(attachment.id, 'up')}
							>
								↑
							</button>
							<button
								type="button"
								class="btn-secondary"
								aria-label="Move down"
								disabled={index === attachments.length - 1}
								onclick={() => moveAttachment(attachment.id, 'down')}
							>
								↓
							</button>
							<button
								type="button"
								class="btn-secondary"
								onclick={() => copyDownloadUrl(attachment.id)}
							>
								Copy Download URL
							</button>
							<button
								type="button"
								class="btn-secondary"
								onclick={() => updateAttachment(attachment.id, {
									external_url: prompt('New external URL', attachment.external_url) || attachment.external_url
								})}
							>
								Refresh Link
							</button>
							<button type="button" class="btn-delete" onclick={() => deleteAttachment(attachment.id)}>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="form-section">
			<h2>Title & Author (MARC 245, 100)</h2>
			{#if authorityMessage}
				<p class="authority-message">{authorityMessage}</p>
			{/if}

			<div class="form-group">
				<label for="title">Title *</label>
				<input id="title" type="text" bind:value={title} required placeholder="Main title" />
			</div>

			<div class="form-group">
				<label for="subtitle">Subtitle</label>
				<input id="subtitle" type="text" bind:value={subtitle} placeholder="Subtitle or parallel title" />
			</div>

			<div class="form-group">
				<label for="variantTitle">Variant Title (MARC 246)</label>
				<input id="variantTitle" type="text" bind:value={variantTitle} placeholder="Alternate title" />
				<small class="help-text">Portion of title, parallel title, or other form</small>
			</div>

			<div class="form-group">
				<label for="edition">Edition Statement (MARC 250)</label>
				<input id="edition" type="text" bind:value={edition} placeholder="e.g., 2nd ed., Revised edition" />
			</div>

			<div class="form-group {(!isNameLinked() && author) ? 'unauthorized' : ''}">
				<label for="author">Main Author</label>
				<input id="author" type="text" bind:value={author} placeholder="Last, First" />
				{#if author && !isNameLinked()}
					<p class="unauthorized-note">Not yet linked to an authority record</p>
				{/if}
				<AuthoritySuggestion
					heading={author}
					type="personal_name"
					marcRecordId={record.id}
					marcField="100"
					onAuthoritySelected={(auth) => handleAuthorityLinked('100', 0, auth)}
				/>
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
					<div class="form-group {(!isSubjectLinked(index) && subject) ? 'unauthorized' : ''}" style="flex: 1;">
						<label for="subject-{index}">Subject {index + 1}</label>
						<SubjectHeadingInput
							bind:value={subjects[index]}
							{index}
							onchange={(val) => (subjects[index] = val)}
							onremove={subjects.length > 1 ? () => removeSubject(index) : undefined}
							showRemove={subjects.length > 1}
						/>
						{#if subject && !isSubjectLinked(index)}
							<p class="unauthorized-note">Unauthorized heading – link to an authority</p>
						{/if}
						<AuthoritySuggestion
							heading={subject}
							type="topical_subject"
							marcRecordId={record.id}
							marcField="650"
							fieldIndex={index}
							onAuthoritySelected={(auth) => handleAuthorityLinked('650', index, auth)}
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

		<section class="form-section">
			<h2>Digital Access Links</h2>
			{#if digitalLinks.length > 0}
				<p class="section-note">
					Control whether digital access links display in the public catalog.
				</p>
				<div class="form-row">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={showHathiTrust}
							disabled={!hasHathiTrustLinks}
						/>
						<span>Show HathiTrust links in OPAC</span>
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={showGoogleBooks}
							disabled={!hasGoogleBooksLinks}
						/>
						<span>Show Google Books previews in OPAC</span>
					</label>
				</div>
				<div class="digital-links-list">
					{#each digitalLinks as link}
						<div class="digital-link-item">
							<span class="digital-provider">{link.provider}</span>
							<a href={link.url} target="_blank" rel="noopener noreferrer">
								{link.url}
							</a>
							{#if link.access}
								<span class="digital-access">{link.access}</span>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state">No digital links stored for this record.</p>
			{/if}
		</section>

		<section class="form-section">
			<h2>Additional Notes</h2>

			<div class="form-group">
				<label for="contentsNote">Table of Contents (MARC 505)</label>
				<textarea id="contentsNote" bind:value={contentsNote} rows="3" placeholder="Chapter 1. Introduction -- Chapter 2. Methods..."></textarea>
				<small class="help-text">Formatted contents note</small>
			</div>

			<div class="form-group">
				<label for="languageNote">Language Note (MARC 546)</label>
				<input id="languageNote" type="text" bind:value={languageNote} placeholder="e.g., Text in English; translated from French" />
			</div>
		</section>

		<section class="form-section">
			<h2>Genre/Form Terms (MARC 655)</h2>
			<p class="section-note">Genre or form terms for classification (e.g., Biographies, Handbooks, Fiction)</p>

			{#each genreTerms as term, index}
				<div class="form-row">
					<div class="form-group" style="flex: 1;">
						<label for="genre-{index}">Genre/Form {index + 1}</label>
						<input
							id="genre-{index}"
							type="text"
							bind:value={genreTerms[index]}
							placeholder="e.g., Biographies, Handbooks"
						/>
					</div>
					{#if genreTerms.length > 1}
						<button
							type="button"
							class="btn-danger"
							onclick={() => genreTerms = genreTerms.filter((_, i) => i !== index)}
							style="align-self: flex-end;"
						>
							Remove
						</button>
					{/if}
				</div>
			{/each}

			<button type="button" class="btn-secondary" onclick={() => genreTerms = [...genreTerms, '']}>
				Add Genre/Form Term
			</button>
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

	.muted {
		color: #666;
	}

.section-note strong {
	color: #e73b42;
}

.authority-message {
	background: #e8f5e9;
	border-left: 3px solid #28a745;
	padding: 8px 12px;
	border-radius: 4px;
	color: #155724;
	margin-bottom: 10px;
}

.form-row {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 1rem;
	margin-bottom: 1rem;
	}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-weight: 500;
	color: #333;
}

.checkbox-label input[type="checkbox"] {
	width: auto;
}

.digital-links-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-top: 1rem;
}

.digital-link-item {
	background: #f8fafc;
	border: 1px solid #e2e8f0;
	border-radius: 6px;
	padding: 0.5rem 0.75rem;
	font-size: 0.875rem;
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	align-items: center;
}

.digital-link-item a {
	color: #2563eb;
	word-break: break-all;
}

.digital-provider {
	font-weight: 600;
	color: #1f2937;
}

.digital-access {
	background: #e0f2fe;
	color: #0369a1;
	padding: 0.1rem 0.4rem;
	border-radius: 999px;
	font-size: 0.75rem;
}

.empty-state {
	color: #6b7280;
	font-size: 0.9rem;
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

.form-group.unauthorized input {
	border-color: #e73b42;
	box-shadow: 0 0 0 2px rgba(231, 59, 66, 0.12);
}

.unauthorized-note {
	color: #e73b42;
	font-size: 0.9rem;
	margin: 0.25rem 0 0 0;
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

	.btn-archive {
		background: #ff9800;
		color: white;
	}

	.btn-archive:hover:not(:disabled) {
		background: #f57c00;
	}

	.btn-archive:disabled {
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

	/* Attachments */
	.attachment-form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.attachment-list {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.attachment-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.attachment-row {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 1rem;
		background: #f8f9fa;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.attachment-row-main {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.attachment-title-row {
		margin: 0;
		font-weight: 600;
		color: #2c3e50;
	}

	.attachment-description-row {
		margin: 0.25rem 0 0 0;
		color: #555;
	}

	.attachment-actions-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
	}

	.badge.success {
		background: #e8f5e9;
		color: #1b5e20;
	}

	.badge.warning {
		background: #fff3cd;
		color: #856404;
	}

	.badge.danger {
		background: #f8d7da;
		color: #721c24;
	}

	.badge.muted {
		background: #eef2ff;
		color: #4f46e5;
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
