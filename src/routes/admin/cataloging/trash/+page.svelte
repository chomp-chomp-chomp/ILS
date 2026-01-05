<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let records = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let message = $state('');

	onMount(async () => {
		await loadDeletedRecords();
	});

	async function loadDeletedRecords() {
		try {
			const { data: recordsData, error: fetchError } = await data.supabase
				.from('marc_records')
				.select('*')
				.eq('status', 'deleted')
				.order('deleted_at', { ascending: false });

			if (fetchError) throw fetchError;

			records = recordsData || [];
		} catch (err: any) {
			error = `Error loading deleted records: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	async function restoreRecord(recordId: string) {
		if (!confirm('Restore this record from trash?')) return;

		try {
			// Restore moves from deleted -> active
			const { error: updateError } = await data.supabase
				.from('marc_records')
				.update({
					status: 'active',
					deleted_at: null,
					deleted_by: null
				})
				.eq('id', recordId);

			if (updateError) throw updateError;

			message = 'Record restored successfully';
			await loadDeletedRecords();
		} catch (err: any) {
			error = `Error restoring record: ${err.message}`;
		}
	}

	async function permanentlyDelete(recordId: string) {
		if (
			!confirm(
				'PERMANENTLY DELETE this record? This action cannot be undone.\n\nThis will also delete all associated holdings and attachments.'
			)
		)
			return;

		try {
			// First delete holdings
			await data.supabase.from('holdings').delete().eq('marc_record_id', recordId);

			// Then delete the record
			const { error: deleteError } = await data.supabase
				.from('marc_records')
				.delete()
				.eq('id', recordId);

			if (deleteError) throw deleteError;

			message = 'Record permanently deleted';
			await loadDeletedRecords();
		} catch (err: any) {
			error = `Error deleting record: ${err.message}`;
		}
	}

	async function emptyTrash() {
		if (
			!confirm(
				`PERMANENTLY DELETE all ${records.length} records in trash? This action cannot be undone.`
			)
		)
			return;

		try {
			const recordIds = records.map((r) => r.id);

			// Delete all holdings for these records
			for (const id of recordIds) {
				await data.supabase.from('holdings').delete().eq('marc_record_id', id);
			}

			// Delete all records
			const { error: deleteError } = await data.supabase
				.from('marc_records')
				.delete()
				.in('id', recordIds);

			if (deleteError) throw deleteError;

			message = `${records.length} records permanently deleted`;
			await loadDeletedRecords();
		} catch (err: any) {
			error = `Error emptying trash: ${err.message}`;
		}
	}

	function formatDate(dateString: string | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}

	function getDaysInTrash(deletedAt: string | null): number {
		if (!deletedAt) return 0;
		const deleted = new Date(deletedAt);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - deleted.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}

	function getDaysUntilPurge(deletedAt: string | null): number {
		const daysInTrash = getDaysInTrash(deletedAt);
		return Math.max(0, 30 - daysInTrash);
	}
</script>

<div class="trash-page">
	<div class="page-header">
		<div>
			<h1>Trash</h1>
			<p class="subtitle">
				Deleted records are retained for 30 days before permanent deletion
			</p>
		</div>
		<div class="header-actions">
			<a href="/admin/cataloging" class="btn btn-secondary">Back to Cataloging</a>
			<a href="/admin/cataloging/archives" class="btn btn-secondary">View Archives</a>
			{#if records.length > 0}
				<button onclick={emptyTrash} class="btn btn-danger">Empty Trash</button>
			{/if}
		</div>
	</div>

	{#if message}
		<div class="message success">{message}</div>
	{/if}

	{#if error}
		<div class="message error">{error}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading trash...</div>
	{:else if records.length === 0}
		<div class="empty-state">
			<p>Trash is empty.</p>
			<p class="help-text">
				When you delete a record, it will appear here for 30 days before permanent deletion.
			</p>
		</div>
	{:else}
		<div class="stats">
			<strong>{records.length}</strong> record{records.length !== 1 ? 's' : ''} in trash
		</div>

		<div class="records-list">
			{#each records as record (record.id)}
				{@const daysLeft = getDaysUntilPurge(record.deleted_at)}
				<div class="record-card">
					<div class="record-info">
						<h3 class="record-title">{record.title_statement?.a || 'Untitled'}</h3>
						{#if record.main_entry_personal_name?.a}
							<p class="record-author">by {record.main_entry_personal_name.a}</p>
						{/if}
						<div class="record-meta">
							<span class="meta-item">
								<strong>Material Type:</strong>
								{record.material_type || 'Unknown'}
							</span>
							{#if record.isbn}
								<span class="meta-item">
									<strong>ISBN:</strong>
									{record.isbn}
								</span>
							{/if}
							<span class="meta-item">
								<strong>Deleted:</strong>
								{formatDate(record.deleted_at)}
							</span>
							<span class="meta-item warning">
								<strong>Purges in:</strong>
								{daysLeft} day{daysLeft !== 1 ? 's' : ''}
							</span>
						</div>
					</div>
					<div class="record-actions">
						<a href="/admin/cataloging/edit/{record.id}" class="btn btn-small btn-secondary">
							View
						</a>
						<button onclick={() => restoreRecord(record.id)} class="btn btn-small btn-primary">
							Restore
						</button>
						<button
							onclick={() => permanentlyDelete(record.id)}
							class="btn btn-small btn-danger"
						>
							Delete Forever
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.trash-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		gap: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
	}

	.header-actions {
		display: flex;
		gap: 1rem;
		flex-shrink: 0;
	}

	.stats {
		background: #fff3cd;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #ffeeba;
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #666;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: #f9f9f9;
		border-radius: 8px;
		border: 2px dashed #ddd;
	}

	.empty-state p {
		margin: 0.5rem 0;
		color: #666;
	}

	.help-text {
		font-size: 0.9rem;
		color: #999;
	}

	.records-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.record-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 2rem;
	}

	.record-info {
		flex: 1;
	}

	.record-title {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1.1rem;
	}

	.record-author {
		margin: 0 0 0.75rem 0;
		color: #666;
		font-style: italic;
	}

	.record-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		font-size: 0.85rem;
		color: #666;
	}

	.meta-item {
		display: flex;
		gap: 0.25rem;
	}

	.meta-item.warning {
		color: #d9534f;
		font-weight: 500;
	}

	.record-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.message {
		padding: 1rem;
		border-radius: 8px;
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

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		font-size: 0.9rem;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-small {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d32f35;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	@media (max-width: 768px) {
		.trash-page {
			padding: 1rem;
		}

		.page-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.header-actions {
			width: 100%;
			flex-direction: column;
		}

		.record-card {
			flex-direction: column;
			gap: 1rem;
		}

		.record-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.record-meta {
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
