<script lang="ts">
	import type { PageData } from './$types';
	import ILLRequestQueue from '$lib/components/ILLRequestQueue.svelte';

	let { data }: { data: PageData } = $props();

	let message = $state('');

	async function handleStatusChange(id: string, newStatus: string) {
		try {
			const response = await fetch('/api/ill/requests', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, status: newStatus })
			});

			if (!response.ok) throw new Error('Failed to update status');

			message = 'Status updated successfully!';
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error) {
			console.error('Error updating status:', error);
			message = 'Error updating status';
		}
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>Lending Requests</h1>
		<div class="header-actions">
			<a href="/admin/ill" class="btn btn-secondary">← Back to ILL Dashboard</a>
		</div>
	</div>

	<div class="info-box">
		<h3>Lending Workflow</h3>
		<ol>
			<li><strong>Pending:</strong> New requests from other libraries awaiting review</li>
			<li><strong>Approve/Deny:</strong> Check availability and approve or deny the request</li>
			<li>
				<strong>Shipped:</strong> Pull the item from the shelf and ship to the requesting library
			</li>
			<li><strong>Completed:</strong> Item has been returned by the borrowing library</li>
		</ol>
	</div>

	{#if message}
		<div class="message {message.includes('Error') ? 'error' : 'success'}">{message}</div>
	{/if}

	<div class="card">
		<ILLRequestQueue
			requests={data.requests}
			requestType="lending"
			onStatusChange={handleStatusChange}
		/>
	</div>
</div>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 30px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 30px;
	}

	.page-header h1 {
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.info-box {
		background: #f0f9ff;
		border-left: 4px solid #3b82f6;
		padding: 20px;
		margin-bottom: 20px;
		border-radius: 4px;
	}

	.info-box h3 {
		margin: 0 0 12px 0;
		color: #1e40af;
	}

	.info-box ol {
		margin: 0;
		padding-left: 20px;
	}

	.info-box li {
		margin-bottom: 8px;
	}

	.message {
		padding: 12px 20px;
		border-radius: 4px;
		margin-bottom: 20px;
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

	.card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 20px;
	}

	.btn {
		display: inline-block;
		padding: 8px 20px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		border: none;
		cursor: pointer;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}
</style>
