<script lang="ts">
	import type { PageData } from './$types';
	import BookCover from '$lib/components/BookCover.svelte';

	let { data }: { data: PageData } = $props();

	const record = $derived(data.record);
	const holdings = $derived(data.holdings || []);
	const relatedRecords = $derived(data.relatedRecords || []);
	const attachments = $derived(data.attachments || []);

	let copyingLink = $state(false);
	let showCopiedToast = $state(false);
	let showMarcRecord = $state(false);

	// Format record as readable MARC text
	let formattedMarc = $derived(() => {
		if (!record) return '';

		let text = 'MARC RECORD\n';
		text += '='.repeat(80) + '\n\n';

		// Leader
		if (record.leader) {
			text += `LEADER: ${record.leader}\n`;
		}

		// Control fields
		if (record.control_number) {
			text += `001: ${record.control_number}\n`;
		}
		if (record.control_number_identifier) {
			text += `003: ${record.control_number_identifier}\n`;
		}
		if (record.date_entered) {
			text += `008: ${record.date_entered}\n`;
		}

		// ISBN
		if (record.isbn) {
			text += `020: $a ${record.isbn}\n`;
		}

		// ISSN
		if (record.issn) {
			text += `022: $a ${record.issn}\n`;
		}

		// Main entry - personal name (100)
		if (record.main_entry_personal_name) {
			const field = record.main_entry_personal_name;
			text += '100: ';
			if (field.a) text += `$a ${field.a} `;
			if (field.d) text += `$d ${field.d} `;
			text += '\n';
		}

		// Title statement (245)
		if (record.title_statement) {
			const field = record.title_statement;
			text += '245: ';
			if (field.a) text += `$a ${field.a} `;
			if (field.b) text += `$b ${field.b} `;
			if (field.c) text += `$c ${field.c} `;
			text += '\n';
		}

		// Edition (250)
		if (record.edition_statement?.a) {
			text += `250: $a ${record.edition_statement.a}\n`;
		}

		// Publication info (260/264)
		if (record.publication_info) {
			const field = record.publication_info;
			text += '260: ';
			if (field.a) text += `$a ${field.a} `;
			if (field.b) text += `$b ${field.b} `;
			if (field.c) text += `$c ${field.c} `;
			text += '\n';
		}

		// Physical description (300)
		if (record.physical_description) {
			const field = record.physical_description;
			text += '300: ';
			if (field.a) text += `$a ${field.a} `;
			if (field.b) text += `$b ${field.b} `;
			if (field.c) text += `$c ${field.c} `;
			text += '\n';
		}

		// Series statement (490)
		if (record.series_statement?.a) {
			text += `490: $a ${record.series_statement.a}\n`;
		}

		// Summary/abstract (520)
		if (record.summary) {
			text += `520: $a ${record.summary}\n`;
		}

		// Subject headings (650)
		if (record.subject_topical && Array.isArray(record.subject_topical)) {
			record.subject_topical.forEach((subject: any) => {
				text += '650: ';
				if (subject.a) text += `$a ${subject.a} `;
				if (subject.x) text += `$x ${subject.x} `;
				if (subject.y) text += `$y ${subject.y} `;
				if (subject.z) text += `$z ${subject.z} `;
				text += '\n';
			});
		}

		// Added entry - personal name (700)
		if (record.added_entry_personal_name && Array.isArray(record.added_entry_personal_name)) {
			record.added_entry_personal_name.forEach((name: any) => {
				text += '700: ';
				if (name.a) text += `$a ${name.a} `;
				if (name.e) text += `$e ${name.e} `;
				text += '\n';
			});
		}

		// Material type
		if (record.material_type) {
			text += `Material Type: ${record.material_type}\n`;
		}

		// Language
		if (record.language_code) {
			text += `Language: ${record.language_code}\n`;
		}

		return text;
	});

	// Helper function to get relationship label
	function getRelationshipLabel(type: string): string {
		const labels: Record<string, string> = {
			related_work: 'Related Work',
			translation: 'Translation',
			original: 'Original Work',
			earlier_edition: 'Earlier Edition',
			later_edition: 'Later Edition',
			adaptation: 'Adaptation',
			adapted_from: 'Adapted From',
			companion: 'Companion Volume',
			part_of: 'Part Of',
			has_part: 'Contains',
			supplement: 'Supplement',
			supplement_to: 'Supplement To',
			continues: 'Continues',
			continued_by: 'Continued By'
		};
		return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	async function copyPermalink() {
		if (!record?.id || copyingLink) return;

		copyingLink = true;

		try {
			const origin = window.location.origin;
			const fullUrl = `${origin}/catalog/record/${record.id}`;

			// Generate short URL
			const response = await fetch('/api/shorten', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullUrl,
					resourceType: 'record',
					resourceId: record.id
				})
			});

			if (response.ok) {
				const data = await response.json();
				await navigator.clipboard.writeText(data.shortUrl);
			} else {
				// Fallback to full URL if short URL creation fails
				await navigator.clipboard.writeText(fullUrl);
			}

			// Show toast
			showCopiedToast = true;
			setTimeout(() => {
				showCopiedToast = false;
			}, 3000);
		} catch (error) {
			console.error('Failed to copy link:', error);
			// Try fallback copy
			try {
				const fullUrl = `${window.location.origin}/catalog/record/${record.id}`;
				await navigator.clipboard.writeText(fullUrl);
				showCopiedToast = true;
				setTimeout(() => {
					showCopiedToast = false;
				}, 3000);
			} catch (fallbackError) {
				alert('Failed to copy link. Please try again.');
			}
		} finally {
			copyingLink = false;
		}
	}

	function formatFileSize(bytes?: number | null) {
		if (!bytes || bytes <= 0) return 'Size unknown';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
	}

	function isImage(type?: string | null) {
		return type?.startsWith('image/');
	}

	function isExpired(expiresAt?: string | null) {
		return expiresAt ? new Date(expiresAt) < new Date() : false;
	}

	function isExpiringSoon(expiresAt?: string | null) {
		if (!expiresAt) return false;
		const expiry = new Date(expiresAt).getTime();
		const soon = Date.now() + 72 * 60 * 60 * 1000;
		return expiry >= Date.now() && expiry <= soon;
	}
</script>

{#if record}
	<div class="record-page">
		<div class="record-header">
			<div class="header-top">
				<a href="/catalog" class="back-link">← Back to Catalog</a>
				<button
					class="copy-link-btn"
					onclick={copyPermalink}
					disabled={copyingLink}
					aria-label="Copy permalink to this record"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					{#if copyingLink}
						Copying...
					{:else}
						Copy Link
					{/if}
				</button>
			</div>
			<h1>{record.title_statement?.a || 'Untitled'}</h1>
			{#if record.title_statement?.b}
				<h2 class="subtitle">{record.title_statement.b}</h2>
			{/if}
		</div>

		<div class="record-body">
			<div class="main-info">
				<!-- Book Cover -->
				<div class="cover-container">
					<BookCover
						recordId={record.id}
						isbn={record.isbn}
						title={record.title_statement?.a}
						author={record.main_entry_personal_name?.a}
						size="large"
						showPlaceholder={false}
					/>
				</div>

				<section class="info-section">
					<h3>Bibliographic Information</h3>

					{#if record.main_entry_personal_name?.a}
						<div class="field">
							<span class="label">Author:</span>
							<span class="value">
								<a
									href="/catalog/search/results?author={encodeURIComponent(
										record.main_entry_personal_name.a
									)}"
									class="link-value">{record.main_entry_personal_name.a}</a
								>
							</span>
						</div>
					{/if}

					{#if record.publication_info}
						<div class="field">
							<span class="label">Publisher:</span>
							<span class="value">
								{#if record.publication_info.b}{record.publication_info.b}{#if record.publication_info.c},{/if}{/if}
								{#if record.publication_info.a} ({record.publication_info.a}){/if}
								{#if record.publication_info.c} {record.publication_info.c}{/if}
							</span>
						</div>
					{/if}

					{#if record.physical_description?.a}
						<div class="field">
							<span class="label">Physical Description:</span>
							<span class="value">{record.physical_description.a}</span>
						</div>
					{/if}

					{#if record.isbn}
						<div class="field">
							<span class="label">ISBN:</span>
							<span class="value">{record.isbn}</span>
						</div>
					{/if}

					{#if record.material_type}
						<div class="field">
							<span class="label">Material Type:</span>
							<span class="value">{record.material_type}</span>
						</div>
					{/if}

					{#if record.series_statement?.a}
						<div class="field">
							<span class="label">Series:</span>
							<span class="value">
								<a
									href="/catalog/search/results?q={encodeURIComponent(record.series_statement.a)}"
									class="link-value">{record.series_statement.a}</a
								>
								{#if record.series_statement?.v} ; {record.series_statement.v}{/if}
							</span>
						</div>
					{/if}
				</section>

				{#if record.summary}
					<section class="info-section">
						<h3>Summary</h3>
						<p>{record.summary}</p>
					</section>
				{/if}

				{#if record.subject_topical && record.subject_topical.length > 0}
					<section class="info-section">
						<h3>Subjects</h3>
						<ul class="subjects-list">
							{#each record.subject_topical as subject}
								<li>
									<a
										href="/catalog/search/results?subject={encodeURIComponent(subject.a)}"
										class="subject-link"
									>
										{subject.a}
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if attachments.length > 0}
					<section class="info-section">
						<h3>Attachments</h3>
						<div class="attachments">
							{#each attachments as attachment}
								<div class="attachment-card">
									<div class="attachment-header">
										<div>
											<p class="attachment-title">
												{attachment.title || attachment.filename_original || 'Attachment'}
											</p>
											<p class="attachment-meta">
												{attachment.file_type || 'File'} • {formatFileSize(attachment.file_size)}
												{#if isExpiringSoon(attachment.external_expires_at)}
													<span class="badge warning">Expiring soon</span>
												{:else if isExpired(attachment.external_expires_at)}
													<span class="badge danger">Expired</span>
												{/if}
											</p>
										</div>
										{#if attachment.access_level === 'staff-only'}
											<span class="badge muted">Staff only</span>
										{:else if attachment.access_level === 'authenticated'}
											<span class="badge muted">Login required</span>
										{/if}
									</div>

									{#if attachment.description}
										<p class="attachment-description">{attachment.description}</p>
									{/if}

									{#if isImage(attachment.file_type)}
										<div class="attachment-preview">
											<img
												src={`/api/attachments/${attachment.id}/download`}
												alt={attachment.title || attachment.filename_original || 'Attachment preview'}
											/>
										</div>
									{/if}

									<div class="attachment-actions">
										{#if isExpired(attachment.external_expires_at)}
											<span class="expired-note">This link has expired.</span>
										{:else}
											<a
												class="btn-secondary"
												href={`/api/attachments/${attachment.id}/download`}
												aria-label={`Download ${attachment.title || 'attachment'}`}
											>
												Download
											</a>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if relatedRecords.length > 0}
					<section class="info-section">
						<h3>Related Records</h3>
						<div class="related-records">
							{#each relatedRecords as related}
								<div class="related-item">
									<span class="relationship-label">{getRelationshipLabel(related.relationship_type)}:</span>
									<div class="related-record-info">
										<a href="/catalog/record/{related.target_record.id}" class="related-title">
											{related.target_record.title_statement?.a || 'Untitled'}
										</a>
										{#if related.target_record.main_entry_personal_name?.a}
											<span class="related-author">
												by {related.target_record.main_entry_personal_name.a}
											</span>
										{/if}
										{#if related.target_record.publication_info?.c}
											<span class="related-year">({related.target_record.publication_info.c})</span>
										{/if}
										{#if related.relationship_note}
											<p class="relationship-note">{related.relationship_note}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<section class="info-section marc-section">
					<button class="marc-toggle" onclick={() => showMarcRecord = !showMarcRecord}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="transform: rotate({showMarcRecord ? '90deg' : '0deg'}); transition: transform 0.2s;">
							<polyline points="9 18 15 12 9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						View MARC Record
					</button>
					{#if showMarcRecord}
						<div class="marc-display">
							<pre>{formattedMarc()}</pre>
						</div>
					{/if}
				</section>
			</div>

			<aside class="sidebar">
				<div class="holdings-card">
					<h3>Holdings & Availability</h3>

					{#if holdings.length > 0}
						<ul class="holdings-list">
							{#each holdings as holding}
								<li class="holding-item">
									<div class="holding-info">
										{#if holding.is_electronic && holding.url}
											<p class="electronic-access">
												<svg
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													style="display: inline; vertical-align: middle; margin-right: 4px;"
												>
													<circle cx="12" cy="12" r="10" stroke-width="2" />
													<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" />
													<path
														d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
														stroke-width="2"
													/>
												</svg>
												<a
													href={holding.url}
													target="_blank"
													rel="noopener noreferrer"
													class="electronic-link">Access Online</a
												>
											</p>
											{#if holding.access_restrictions}
												<p class="access-note">{holding.access_restrictions}</p>
											{/if}
										{:else}
											{#if holding.call_number}
												<p class="call-number">{holding.call_number}</p>
											{/if}
											<p class="location">{holding.location || 'Main Library'}</p>
											{#if holding.copy_number}
												<p class="copy">Copy {holding.copy_number}</p>
											{/if}
										{/if}
									</div>
									<span class="status" class:available={holding.status === 'available'}>
										{holding.status || 'Available'}
									</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="no-holdings">No holdings information available</p>
					{/if}
				</div>
			</aside>
		</div>
	</div>
{:else}
	<div class="error-page">
		<h1>Record Not Found</h1>
		<p>The requested catalog record could not be found.</p>
		<a href="/catalog">← Back to Catalog</a>
	</div>
{/if}

<!-- Copy confirmation toast -->
{#if showCopiedToast}
	<div class="toast">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Link copied to clipboard!
	</div>
{/if}

<style>
	.record-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.record-header {
		margin-bottom: 2rem;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.back-link {
		display: inline-block;
		color: #667eea;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.copy-link-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.copy-link-btn:hover {
		background: #5568d3;
	}

	.copy-link-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.copy-link-btn svg {
		flex-shrink: 0;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2.5rem;
		color: #2c3e50;
	}

	.subtitle {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
		color: #666;
		font-weight: normal;
	}

	.record-body {
		display: grid;
		grid-template-columns: 1fr 350px;
		gap: 2rem;
	}

	.main-info {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.cover-container {
		display: flex;
		justify-content: center;
		padding: 1rem 0;
	}

	.info-section {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.info-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
		border-bottom: 2px solid #667eea;
		padding-bottom: 0.5rem;
	}

	.field {
		margin-bottom: 0.75rem;
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 1rem;
	}

	.label {
		font-weight: 500;
		color: #666;
	}

	.value {
		color: #333;
	}

	.link-value {
		color: #667eea;
		text-decoration: none;
		transition: color 0.2s;
	}

	.link-value:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.subjects-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.subjects-list li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.subjects-list li:last-child {
		border-bottom: none;
	}

	.subject-link {
		color: #667eea;
		text-decoration: none;
		font-size: 0.95rem;
		transition: color 0.2s;
	}

	.subject-link:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.related-records {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.related-item {
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
		border-left: 4px solid #667eea;
	}

	.relationship-label {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: #667eea;
		font-weight: 600;
		letter-spacing: 0.5px;
		margin-bottom: 0.5rem;
	}

	.related-record-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.related-title {
		color: #2c3e50;
		text-decoration: none;
		font-weight: 500;
		font-size: 1rem;
		transition: color 0.2s;
	}

	.related-title:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.related-author {
		color: #666;
		font-size: 0.875rem;
		font-style: italic;
	}

	.related-year {
		color: #999;
		font-size: 0.875rem;
	}

	.relationship-note {
		margin: 0.5rem 0 0 0;
		padding: 0.5rem;
		background: white;
		border-radius: 4px;
		font-size: 0.875rem;
		color: #666;
		font-style: italic;
	}

	.marc-section {
		border: 1px solid #e0e0e0;
		padding: 0;
		overflow: hidden;
	}

	.marc-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		background: #f8f9fa;
		border: none;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 500;
		color: #666;
		transition: all 0.2s;
		text-align: left;
	}

	.marc-toggle:hover {
		background: #eef0f2;
		color: #667eea;
	}

	.marc-toggle svg {
		flex-shrink: 0;
	}

	.marc-display {
		padding: 1.5rem;
		background: #fafafa;
		border-top: 1px solid #e0e0e0;
		max-height: 500px;
		overflow-y: auto;
	}

	.marc-display pre {
		margin: 0;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.85rem;
		line-height: 1.5;
		color: #333;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.sidebar {
		position: sticky;
		top: 2rem;
		align-self: start;
	}

	.holdings-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.holdings-card h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.holdings-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.holding-item {
		padding: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		margin-bottom: 0.75rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.holding-info p {
		margin: 0.25rem 0;
	}

	.call-number {
		font-weight: 500;
		font-size: 1.125rem;
	}

	.location {
		color: #666;
		font-size: 0.875rem;
	}

	.copy {
		color: #999;
		font-size: 0.875rem;
	}

	.electronic-access {
		font-size: 0.875rem;
		color: #2e7d32;
		font-weight: 500;
		margin: 0 0 0.25rem 0;
	}

	.electronic-link {
		color: #2e7d32;
		text-decoration: none;
		transition: color 0.2s;
	}

	.electronic-link:hover {
		color: #1b5e20;
		text-decoration: underline;
	}

	.access-note {
		font-size: 0.75rem;
		color: #666;
		margin: 0.25rem 0 0 0;
		font-style: italic;
	}

	.status {
		padding: 0.5rem 1rem;
		background: #ffc107;
		color: white;
		border-radius: 16px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.status.available {
		background: #4caf50;
	}

	.no-holdings {
		color: #999;
		text-align: center;
		padding: 1rem;
	}

	.error-page {
		max-width: 800px;
		margin: 4rem auto;
		text-align: center;
		padding: 2rem;
	}

	.error-page a {
		color: #667eea;
		text-decoration: none;
		font-size: 1.125rem;
	}

	.error-page a:hover {
		text-decoration: underline;
	}

	.toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: #2e7d32;
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		z-index: 2000;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			transform: translateX(-50%) translateY(100px);
			opacity: 0;
		}
		to {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
		}
	}

	.toast svg {
		flex-shrink: 0;
	}

	/* Attachments */
	.attachments {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.attachment-card {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1rem;
		background: #fafafa;
	}

	.attachment-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.attachment-title {
		margin: 0;
		font-weight: 600;
		color: #2c3e50;
	}

	.attachment-meta {
		margin: 0.25rem 0 0 0;
		color: #666;
		font-size: 0.95rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.attachment-description {
		margin: 0.75rem 0;
		color: #444;
	}

	.attachment-preview {
		border: 1px solid #eee;
		border-radius: 6px;
		padding: 0.5rem;
		background: white;
		max-width: 320px;
	}

	.attachment-preview img {
		max-width: 100%;
		border-radius: 4px;
		display: block;
	}

	.attachment-actions {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
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

	.expired-note {
		color: #e73b42;
		font-weight: 600;
	}

	@media (max-width: 768px) {
		.record-body {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
		}

		.field {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		.header-top {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.copy-link-btn {
			width: 100%;
			justify-content: center;
		}

		.toast {
			left: 1rem;
			right: 1rem;
			transform: none;
		}

		@keyframes slideUp {
			from {
				transform: translateY(100px);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}
	}
</style>
