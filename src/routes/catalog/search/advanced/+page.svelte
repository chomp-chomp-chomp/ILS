<script lang="ts">
	import { goto } from '$app/navigation';

	let title = $state('');
	let author = $state('');
	let subject = $state('');
	let isbn = $state('');
	let publisher = $state('');
	let yearFrom = $state('');
	let yearTo = $state('');
	let materialType = $state('');
	let operator = $state<'AND' | 'OR'>('AND');

	function performSearch() {
		const params = new URLSearchParams();

		if (title) params.set('title', title);
		if (author) params.set('author', author);
		if (subject) params.set('subject', subject);
		if (isbn) params.set('isbn', isbn);
		if (publisher) params.set('publisher', publisher);
		if (yearFrom) params.set('year_from', yearFrom);
		if (yearTo) params.set('year_to', yearTo);
		if (materialType) params.set('type', materialType);
		params.set('op', operator);

		goto(`/catalog/search/results?${params.toString()}`);
	}

	function resetForm() {
		title = '';
		author = '';
		subject = '';
		isbn = '';
		publisher = '';
		yearFrom = '';
		yearTo = '';
		materialType = '';
		operator = 'AND';
	}
</script>

<div class="advanced-search">
	<header class="page-header">
		<h1>Advanced Search</h1>
		<p>Combine multiple search criteria for precise results</p>
	</header>

	<form onsubmit={(e) => { e.preventDefault(); performSearch(); }}>
		<div class="search-form">
			<section class="form-section">
				<h2>Search Criteria</h2>

				<div class="form-group">
					<label for="title">Title</label>
					<input id="title" type="text" bind:value={title} placeholder="Enter title keywords" />
				</div>

				<div class="form-group">
					<label for="author">Author</label>
					<input id="author" type="text" bind:value={author} placeholder="Last name, First name" />
				</div>

				<div class="form-group">
					<label for="subject">Subject</label>
					<input id="subject" type="text" bind:value={subject} placeholder="Subject headings" />
				</div>

				<div class="form-group">
					<label for="isbn">ISBN</label>
					<input id="isbn" type="text" bind:value={isbn} placeholder="978-..." />
				</div>

				<div class="form-group">
					<label for="publisher">Publisher</label>
					<input id="publisher" type="text" bind:value={publisher} placeholder="Publisher name" />
				</div>
			</section>

			<section class="form-section">
				<h2>Filters</h2>

				<div class="form-row">
					<div class="form-group">
						<label for="yearFrom">Publication Year From</label>
						<input id="yearFrom" type="number" bind:value={yearFrom} placeholder="YYYY" min="1000" max="2100" />
					</div>

					<div class="form-group">
						<label for="yearTo">Publication Year To</label>
						<input id="yearTo" type="number" bind:value={yearTo} placeholder="YYYY" min="1000" max="2100" />
					</div>
				</div>

				<div class="form-group">
					<label for="materialType">Material Type</label>
					<select id="materialType" bind:value={materialType}>
						<option value="">All Types</option>
						<option value="book">Book</option>
						<option value="ebook">E-book</option>
						<option value="serial">Serial/Journal</option>
						<option value="audiobook">Audiobook</option>
						<option value="dvd">DVD</option>
						<option value="cdrom">CD-ROM</option>
					</select>
				</div>
			</section>

			<section class="form-section">
				<h2>Search Options</h2>

				<div class="form-group">
					<label>Boolean Operator</label>
					<div class="radio-group">
						<label class="radio-label">
							<input type="radio" bind:group={operator} value="AND" />
							<span>AND - All criteria must match</span>
						</label>
						<label class="radio-label">
							<input type="radio" bind:group={operator} value="OR" />
							<span>OR - Any criteria can match</span>
						</label>
					</div>
				</div>
			</section>
		</div>

		<div class="form-actions">
			<button type="submit" class="btn-primary">
				Search
			</button>
			<button type="button" class="btn-secondary" onclick={resetForm}>
				Clear All
			</button>
			<a href="/catalog" class="btn-link">Cancel</a>
		</div>
	</form>

	<div class="help-section">
		<h3>Search Tips</h3>
		<ul>
			<li><strong>AND operator:</strong> Returns results that match ALL filled fields</li>
			<li><strong>OR operator:</strong> Returns results that match ANY filled field</li>
			<li><strong>Partial matching:</strong> Most fields support partial word matching</li>
			<li><strong>Year range:</strong> Leave one year field blank to search from/to present</li>
		</ul>
	</div>
</div>

<style>
	.advanced-search {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
	}

	.page-header p {
		color: #666;
		margin: 0;
	}

	.search-form {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.form-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.form-section:last-child {
		border-bottom: none;
	}

	.form-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		color: #2c3e50;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	input,
	select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: #667eea;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
	}

	.radio-label input[type='radio'] {
		width: auto;
		margin: 0;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		align-items: center;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 2rem;
		border-radius: 4px;
		border: none;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}

	.btn-link {
		color: #667eea;
		text-decoration: none;
		padding: 0.75rem 1rem;
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.help-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #f8f9fa;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.help-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
	}

	.help-section ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	.help-section li {
		margin-bottom: 0.5rem;
		line-height: 1.6;
	}

	@media (max-width: 640px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
