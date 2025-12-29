<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let serials = $state<any[]>([]);
	let latestIssues = $state<Map<string, any>>(new Map());
	let loading = $state(true);
	let searchQuery = $state('');

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;

		// Load public serials
		const { data: serialsData } = await data.supabase
			.from('serials')
			.select('*')
			.eq('public_display', true)
			.eq('is_active', true)
			.order('title');

		serials = serialsData || [];

		// Load latest received issue for each serial
		for (const serial of serials) {
			const { data: issueData } = await data.supabase
				.from('serial_issues')
				.select('*')
				.eq('serial_id', serial.id)
				.eq('status', 'received')
				.order('received_date', { ascending: false })
				.limit(5);

			if (issueData && issueData.length > 0) {
				latestIssues.set(serial.id, issueData);
			}
		}

		loading = false;
	}

	let filteredSerials = $derived(
		serials.filter((serial) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				serial.title?.toLowerCase().includes(query) ||
				serial.issn?.toLowerCase().includes(query)
			);
		})
	);

	function getStatusText(status: string): string {
		switch (status) {
			case 'active':
				return 'Current Subscription';
			case 'trial':
				return 'Trial Access';
			case 'lapsed':
				return 'Subscription Lapsed';
			default:
				return status;
		}
	}
</script>

<svelte:head>
	<title>Serials Collection</title>
</svelte:head>

<div class="serials-public">
	<header class="page-header">
		<h1>Serials Collection</h1>
		<p class="subtitle">Browse our collection of journals, magazines, and periodicals</p>
	</header>

	<div class="search-bar">
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Search serials by title or ISSN..."
			class="search-input"
		/>
	</div>

	{#if loading}
		<div class="loading">Loading serials collection...</div>
	{:else if filteredSerials.length === 0}
		<div class="empty-state">
			<p>No serials found</p>
			{#if searchQuery}
				<p class="help-text">Try a different search term</p>
			{/if}
		</div>
	{:else}
		<div class="serials-grid">
			{#each filteredSerials as serial}
				<div class="serial-card">
					<div class="serial-header">
						<h2>{serial.title}</h2>
						{#if serial.issn}
							<span class="issn">ISSN: {serial.issn}</span>
						{/if}
					</div>

					<div class="serial-details">
						<div class="detail-row">
							<span><strong>Format:</strong> {serial.format || 'print'}</span>
							<span><strong>Frequency:</strong> {serial.frequency || 'unknown'}</span>
						</div>

						<div class="status-badge" class:active={serial.status === 'active'}>
							{getStatusText(serial.status || 'active')}
						</div>

						{#if serial.url}
							<div class="online-access">
								<a href={serial.url} target="_blank" rel="noopener noreferrer">
									🌐 Access Online
								</a>
							</div>
						{/if}

						{#if serial.public_notes}
							<p class="public-notes">{serial.public_notes}</p>
						{/if}
					</div>

					{#if latestIssues.has(serial.id)}
						<div class="latest-issues">
							<h3>Latest Received Issues</h3>
							<ul>
								{#each latestIssues.get(serial.id) || [] as issue}
									<li>
										<span class="issue-text">{issue.display_text}</span>
										<span class="issue-date">
											{new Date(issue.received_date).toLocaleDateString()}
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.serials-public {
		max-width: 1200px;
		margin: 0 auto;
		padding: var(--space-lg);
	}

	.page-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.page-header h1 {
		margin: 0 0 var(--space-sm) 0;
		color: var(--text-primary);
	}

	.subtitle {
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.search-bar {
		margin-bottom: var(--space-lg);
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.search-input {
		width: 100%;
		padding: var(--space-md);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		transition: var(--transition-smooth);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: var(--space-xl);
		color: var(--text-muted);
	}

	.help-text {
		font-size: 0.875rem;
		margin-top: var(--space-sm);
	}

	.serials-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: var(--space-lg);
	}

	.serial-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		transition: var(--transition-smooth);
	}

	.serial-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.serial-header {
		margin-bottom: var(--space-md);
		padding-bottom: var(--space-md);
		border-bottom: 2px solid var(--border);
	}

	.serial-header h2 {
		margin: 0 0 var(--space-xs) 0;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	.issn {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.serial-details {
		margin-bottom: var(--space-md);
	}

	.detail-row {
		display: flex;
		gap: var(--space-md);
		margin-bottom: var(--space-sm);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.status-badge {
		display: inline-block;
		padding: var(--space-xs) var(--space-sm);
		background: var(--text-muted);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: var(--space-sm);
	}

	.status-badge.active {
		background: var(--success);
	}

	.online-access {
		margin: var(--space-sm) 0;
	}

	.online-access a {
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
		transition: var(--transition-smooth);
	}

	.online-access a:hover {
		text-decoration: underline;
	}

	.public-notes {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-style: italic;
		margin-top: var(--space-sm);
		padding: var(--space-sm);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
	}

	.latest-issues {
		margin-top: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border);
	}

	.latest-issues h3 {
		margin: 0 0 var(--space-sm) 0;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.latest-issues ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.latest-issues li {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: var(--space-xs) 0;
		font-size: 0.875rem;
		gap: var(--space-sm);
	}

	.issue-text {
		color: var(--text-primary);
		flex: 1;
	}

	.issue-date {
		color: var(--text-muted);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.serials-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
