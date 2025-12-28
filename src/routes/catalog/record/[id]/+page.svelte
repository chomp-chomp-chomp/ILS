<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const record = $derived(data.record);
	const holdings = $derived(data.holdings || []);
</script>

{#if record}
	<div class="record-page">
		<div class="record-header">
			<a href="/catalog" class="back-link">← Back to Catalog</a>
			<h1>{record.title_statement?.a || 'Untitled'}</h1>
			{#if record.title_statement?.b}
				<h2 class="subtitle">{record.title_statement.b}</h2>
			{/if}
		</div>

		<div class="record-body">
			<div class="main-info">
				<section class="info-section">
					<h3>Bibliographic Information</h3>

					{#if record.main_entry_personal_name?.a}
						<div class="field">
							<span class="label">Author:</span>
							<span class="value">{record.main_entry_personal_name.a}</span>
						</div>
					{/if}

					{#if record.publication_info}
						<div class="field">
							<span class="label">Publisher:</span>
							<span class="value">
								{#if record.publication_info.b}{record.publication_info.b}{/if}
								{#if record.publication_info.a} ({record.publication_info.a}){/if}
								{#if record.publication_info.c}, {record.publication_info.c}{/if}
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
						<div class="subjects">
							{#each record.subject_topical as subject}
								<span class="subject-tag">{subject.a}</span>
							{/each}
						</div>
					</section>
				{/if}
			</div>

			<aside class="sidebar">
				<div class="holdings-card">
					<h3>Holdings & Availability</h3>

					{#if holdings.length > 0}
						<ul class="holdings-list">
							{#each holdings as holding}
								<li class="holding-item">
									<div class="holding-info">
										{#if holding.call_number}
											<p class="call-number">{holding.call_number}</p>
										{/if}
										<p class="location">{holding.location || 'Main Library'}</p>
										{#if holding.copy_number}
											<p class="copy">Copy {holding.copy_number}</p>
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

<style>
	.record-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.record-header {
		margin-bottom: 2rem;
	}

	.back-link {
		display: inline-block;
		color: #667eea;
		text-decoration: none;
		margin-bottom: 1rem;
	}

	.back-link:hover {
		text-decoration: underline;
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

	.subjects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.subject-tag {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #e8eaf6;
		color: #3f51b5;
		border-radius: 16px;
		font-size: 0.875rem;
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
	}
</style>
