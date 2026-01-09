<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let serials = $state<any[]>([]);
	let loading = $state(true);
	let stats = $state<Map<string, any>>(new Map());

	onMount(async () => {
		const { data: serialsData } = await supabase
			.from('serials')
			.select('*, vendors(name)')
			.order('title');

		serials = serialsData || [];

		// Get stats for each serial
		for (const serial of serials) {
			const { data: issueStats } = await supabase
				.from('serial_issues')
				.select('status')
				.eq('serial_id', serial.id);

			const received = issueStats?.filter((i) => i.status === 'received').length || 0;
			const expected = issueStats?.filter((i) => i.status === 'expected').length || 0;
			const late = issueStats?.filter((i) => i.status === 'late').length || 0;
			const claimed = issueStats?.filter((i) => i.status === 'claimed').length || 0;

			stats.set(serial.id, { received, expected, late, claimed });
		}

		loading = false;
	});

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'active':
				return 'badge-active';
			case 'cancelled':
				return 'badge-cancelled';
			case 'trial':
				return 'badge-trial';
			case 'lapsed':
				return 'badge-lapsed';
			default:
				return '';
		}
	}
</script>

<div class="serials-page">
	<header class="page-header">
		<h1>Serials Management</h1>
		<a href="/admin/serials/new" class="btn-primary">Add New Serial</a>
	</header>

	{#if loading}
		<p>Loading...</p>
	{:else if serials.length === 0}
		<div class="empty-state">
			<p>No serials registered yet</p>
			<a href="/admin/serials/new" class="btn-primary">Add Your First Serial</a>
		</div>
	{:else}
		<div class="serials-list">
			{#each serials as serial}
				<div class="serial-card">
					<div class="serial-header">
						<div class="serial-title">
							<h3>{serial.title}</h3>
							{#if serial.issn}
								<span class="issn">ISSN: {serial.issn}</span>
							{/if}
						</div>
						<span class="badge {getStatusBadgeClass(serial.status || 'active')}">
							{serial.status || 'active'}
						</span>
					</div>

					<div class="serial-details">
						<div class="detail-row">
							<span><strong>Format:</strong> {serial.format || 'print'}</span>
							<span><strong>Frequency:</strong> {serial.frequency || 'unknown'}</span>
							{#if serial.vendors?.name}
								<span><strong>Vendor:</strong> {serial.vendors.name}</span>
							{/if}
						</div>
						{#if serial.url}
							<p><strong>URL:</strong> <a href={serial.url} target="_blank">{serial.url}</a></p>
						{/if}
					</div>

					{#if stats.get(serial.id)}
						<div class="issue-stats">
							<div class="stat">
								<span class="stat-value">{stats.get(serial.id).received}</span>
								<span class="stat-label">Received</span>
							</div>
							<div class="stat">
								<span class="stat-value">{stats.get(serial.id).expected}</span>
								<span class="stat-label">Expected</span>
							</div>
							{#if stats.get(serial.id).late > 0}
								<div class="stat stat-warning">
									<span class="stat-value">{stats.get(serial.id).late}</span>
									<span class="stat-label">Late</span>
								</div>
							{/if}
							{#if stats.get(serial.id).claimed > 0}
								<div class="stat stat-danger">
									<span class="stat-value">{stats.get(serial.id).claimed}</span>
									<span class="stat-label">Claimed</span>
								</div>
							{/if}
						</div>
					{/if}

					<div class="serial-actions">
						<a href="/admin/serials/{serial.id}/check-in" class="action-primary">Check In</a>
						<a href="/admin/serials/{serial.id}/issues">Issues</a>
						<a href="/admin/serials/{serial.id}/patterns">Patterns</a>
						<a href="/admin/serials/{serial.id}/claims">Claims</a>
						<a href="/admin/serials/{serial.id}/binding">Binding</a>
						<a href="/admin/serials/{serial.id}/edit">Edit</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.serials-page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-lg);
	}

	h1 {
		margin: 0;
	}

	.btn-primary {
		padding: var(--space-sm) var(--space-md);
		background: var(--accent);
		color: white;
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: var(--transition-smooth);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-xl) var(--space-lg);
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
	}

	.empty-state p {
		margin-bottom: var(--space-lg);
		color: var(--text-muted);
		font-size: 1.25rem;
	}

	.serials-list {
		display: grid;
		gap: var(--space-md);
	}

	.serial-card {
		background: var(--bg-secondary);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.serial-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-md);
	}

	.serial-title h3 {
		margin: 0 0 var(--space-xs) 0;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	.issn {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.badge {
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-lg);
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.5px;
	}

	.badge-active {
		background: var(--success);
		color: white;
	}

	.badge-cancelled {
		background: var(--danger);
		color: white;
	}

	.badge-trial {
		background: var(--info);
		color: white;
	}

	.badge-lapsed {
		background: var(--warning);
		color: white;
	}

	.serial-details {
		margin-bottom: var(--space-md);
	}

	.detail-row {
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		font-size: 0.875rem;
		margin-bottom: var(--space-xs);
	}

	.serial-details p {
		margin: var(--space-xs) 0;
		font-size: 0.875rem;
	}

	.serial-details a {
		color: var(--accent);
		word-break: break-all;
	}

	.issue-stats {
		display: flex;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-sm);
		min-width: 80px;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-warning .stat-value {
		color: var(--warning);
	}

	.stat-danger .stat-value {
		color: var(--danger);
	}

	.serial-actions {
		display: flex;
		gap: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.serial-actions a {
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.875rem;
		transition: var(--transition-smooth);
	}

	.serial-actions a:hover {
		color: var(--accent);
	}

	.serial-actions .action-primary {
		color: var(--accent);
		font-weight: 600;
	}
</style>
