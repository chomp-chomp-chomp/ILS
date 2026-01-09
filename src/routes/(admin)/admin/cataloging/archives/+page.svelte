<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let records = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let message = $state('');

	onMount(async () => {
		await loadArchivedRecords();
	});

	async function loadArchivedRecords() {
		try {
			const { data: recordsData, error: fetchError } = await supabase
				.from('marc_records')
				.select('*')
				.eq('status', 'archived')
				.order('archived_at', { ascending: false });

			if (fetchError) throw fetchError;

			records = recordsData || [];
		} catch (err: any) {
			error = `Error loading archived records: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	async function restoreRecord(recordId: string) {
		if (!confirm('Restore this record to active status?')) return;

		try {
			const { error: restoreError } = await supabase.rpc('restore_marc_record', {
				record_id: recordId
			});

			if (restoreError) throw restoreError;

			message = 'Record restored successfully';
			await loadArchivedRecords();
		} catch (err: any) {
			error = `Error restoring record: ${err.message}`;
		}
	}

	async function moveToTrash(recordId: string) {
		if (!confirm('Move this record to trash? It will be permanently deleted after 30 days.')) return;

		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const userId = sessionData?.session?.user?.id;

			const { error: deleteError } = await supabase.rpc('soft_delete_marc_record', {
				record_id: recordId,
				user_id: userId
			});

			if (deleteError) throw deleteError;

			message = 'Record moved to trash';
			await loadArchivedRecords();
		} catch (err: any) {
			error = `Error moving to trash: ${err.message}`;
		}
	}

	function formatDate(dateString: string | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}
</script>

<div class="archives-page">
	<div class="page-header">
		<div>
			<h1>Archived Records</h1>
			<p class="subtitle">Records that have been archived from the active catalog</p>
		</div>
		<div class="header-actions">
			<a href="/admin/cataloging" class="btn btn-secondary">Back to Cataloging</a>
			<a href="/admin/cataloging/trash" class="btn btn-secondary">View Trash</a>
		</div>
	</div>

	{#if message}
		<div class="message success">{message}</div>
	{/if}

	{#if error}
		<div class="message error">{error}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading archived records...</div>
	{:else if records.length === 0}
		<div class="empty-state">
			<p>No archived records found.</p>
			<p class="help-text">
				When you archive a record, it will appear here. Archived records are hidden from the public
				catalog but can be restored at any time.
			</p>
		</div>
	{:else}
		<div class="stats">
			<strong>{records.length}</strong> archived record{records.length !== 1 ? 's' : ''}
		</div>

		<div class="records-list">
			{#each records as record (record.id)}
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
								<strong>Archived:</strong>
								{formatDate(record.archived_at)}
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
						<button onclick={() => moveToTrash(record.id)} class="btn btn-small btn-danger">
							Move to Trash
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.archives-page {
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
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
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
		.archives-page {
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
