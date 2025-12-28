<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let serials = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const { data: serialsData } = await data.supabase.from('serials').select('*').order('title');

		serials = serialsData || [];
		loading = false;
	});
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
						<h3>{serial.title}</h3>
						<span class="badge" class:active={serial.is_active}>
							{serial.is_active ? 'Active' : 'Inactive'}
						</span>
					</div>

					<div class="serial-details">
						{#if serial.issn}
							<p><strong>ISSN:</strong> {serial.issn}</p>
						{/if}
						<p><strong>Format:</strong> {serial.format || 'print'}</p>
						<p><strong>Frequency:</strong> {serial.frequency || 'unknown'}</p>
						{#if serial.url}
							<p><strong>URL:</strong> <a href={serial.url} target="_blank">{serial.url}</a></p>
						{/if}
					</div>

					<div class="serial-actions">
						<a href="/admin/serials/{serial.id}/check-in">Check In Issue</a>
						<a href="/admin/serials/{serial.id}/issues">View Issues</a>
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
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: #667eea;
		color: white;
		text-decoration: none;
		border-radius: 4px;
	}

	.btn-primary:hover {
		background: #5568d3;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 8px;
	}

	.empty-state p {
		margin-bottom: 2rem;
		color: #666;
		font-size: 1.25rem;
	}

	.serials-list {
		display: grid;
		gap: 1rem;
	}

	.serial-card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.serial-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.serial-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		background: #999;
		color: white;
	}

	.badge.active {
		background: #4caf50;
	}

	.serial-details {
		margin-bottom: 1rem;
	}

	.serial-details p {
		margin: 0.5rem 0;
		font-size: 0.875rem;
	}

	.serial-details a {
		color: #667eea;
		word-break: break-all;
	}

	.serial-actions {
		display: flex;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	.serial-actions a {
		color: #667eea;
		text-decoration: none;
		font-size: 0.875rem;
	}

	.serial-actions a:hover {
		text-decoration: underline;
	}
</style>
