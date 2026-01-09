<script lang="ts">
	import { onMount } from 'svelte';

	let jobs = $state<any[]>([]);
	let loading = $state(false);
	let selectedStatus = $state('all');
	let autoRefresh = $state(true);
	let refreshInterval: any = null;

	onMount(() => {
		loadJobs();

		if (autoRefresh) {
			refreshInterval = setInterval(loadJobs, 5000); // Refresh every 5 seconds
		}

		return () => {
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}
		};
	});

	async function loadJobs() {
		loading = true;
		try {
			const url = selectedStatus === 'all'
				? '/api/batch/jobs'
				: `/api/batch/jobs?status=${selectedStatus}`;

			const response = await fetch(url);
			const data = await response.json();

			if (data.success) {
				jobs = data.jobs || [];
			}
		} catch (error) {
			console.error('Error loading jobs:', error);
		} finally {
			loading = false;
		}
	}

	async function cancelJob(jobId: string) {
		if (!confirm('Cancel this job?')) {
			return;
		}

		try {
			const response = await fetch('/api/batch/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jobId })
			});

			if (response.ok) {
				await loadJobs();
			}
		} catch (error) {
			console.error('Error cancelling job:', error);
		}
	}

	async function deleteJob(jobId: string) {
		if (!confirm('Delete this job from history?')) {
			return;
		}

		try {
			const response = await fetch(`/api/batch/jobs?id=${jobId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadJobs();
			}
		} catch (error) {
			console.error('Error deleting job:', error);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'completed': return 'success';
			case 'running': return 'info';
			case 'failed': return 'error';
			case 'cancelled': return 'warning';
			default: return 'default';
		}
	}

	function getJobTypeIcon(type: string): string {
		switch (type) {
			case 'find_replace': return '🔍';
			case 'batch_delete': return '🗑️';
			case 'macro': return '⚙️';
			case 'merge': return '🔀';
			case 'authority_control': return '✓';
			default: return '📄';
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function calculateProgress(job: any): number {
		if (job.total_records === 0) return 0;
		return Math.round((job.processed_records / job.total_records) * 100);
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;

		if (autoRefresh) {
			refreshInterval = setInterval(loadJobs, 5000);
		} else if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	}

	$effect(() => {
		loadJobs();
	});
</script>

<div class="job-queue">
	<div class="header">
		<div>
			<h2>Job Queue</h2>
			<p class="description">Monitor and manage batch operation jobs.</p>
		</div>
		<div class="header-actions">
			<label class="auto-refresh-toggle">
				<input type="checkbox" bind:checked={autoRefresh} onchange={toggleAutoRefresh} />
				Auto-refresh
			</label>
			<button class="btn btn-secondary" onclick={loadJobs}>
				🔄 Refresh
			</button>
		</div>
	</div>

	<div class="filters">
		<button
			class="filter-btn"
			class:active={selectedStatus === 'all'}
			onclick={() => selectedStatus = 'all'}
		>
			All
		</button>
		<button
			class="filter-btn"
			class:active={selectedStatus === 'running'}
			onclick={() => selectedStatus = 'running'}
		>
			Running
		</button>
		<button
			class="filter-btn"
			class:active={selectedStatus === 'completed'}
			onclick={() => selectedStatus = 'completed'}
		>
			Completed
		</button>
		<button
			class="filter-btn"
			class:active={selectedStatus === 'failed'}
			onclick={() => selectedStatus = 'failed'}
		>
			Failed
		</button>
	</div>

	<div class="jobs-list">
		{#if jobs.length === 0}
			<p class="empty-state">No jobs found.</p>
		{:else}
			{#each jobs as job}
				<div class="job-card">
					<div class="job-header">
						<div class="job-title">
							<span class="job-icon">{getJobTypeIcon(job.job_type)}</span>
							<div>
								<h3>{job.job_name}</h3>
								<p class="job-description">{job.description || 'No description'}</p>
							</div>
						</div>
						<span class="status-badge {getStatusColor(job.status)}">
							{job.status}
						</span>
					</div>

					<div class="job-stats">
						<div class="stat">
							<label>Total Records</label>
							<span>{job.total_records || 0}</span>
						</div>
						<div class="stat">
							<label>Processed</label>
							<span>{job.processed_records || 0}</span>
						</div>
						<div class="stat">
							<label>Successful</label>
							<span class="success-text">{job.successful_records || 0}</span>
						</div>
						<div class="stat">
							<label>Failed</label>
							<span class="error-text">{job.failed_records || 0}</span>
						</div>
					</div>

					{#if job.status === 'running' && job.total_records > 0}
						<div class="progress-bar">
							<div class="progress-fill" style="width: {calculateProgress(job)}%"></div>
							<span class="progress-text">{calculateProgress(job)}%</span>
						</div>
					{/if}

					<div class="job-meta">
						<span>Created: {formatDate(job.created_at)}</span>
						{#if job.completed_at}
							<span>Completed: {formatDate(job.completed_at)}</span>
						{/if}
					</div>

					{#if job.error_log && job.error_log.length > 0}
						<div class="error-log">
							<strong>Errors:</strong>
							<ul>
								{#each job.error_log.slice(0, 3) as error}
									<li>{error}</li>
								{/each}
							</ul>
							{#if job.error_log.length > 3}
								<p class="more-errors">...and {job.error_log.length - 3} more errors</p>
							{/if}
						</div>
					{/if}

					<div class="job-actions">
						{#if job.status === 'running'}
							<button class="btn btn-small btn-warning" onclick={() => cancelJob(job.id)}>
								Cancel
							</button>
						{/if}
						{#if job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'}
							<button class="btn btn-small btn-text" onclick={() => deleteJob(job.id)}>
								Delete
							</button>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.job-queue {
		max-width: 1200px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
	}

	.header-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.auto-refresh-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 14px;
	}

	h2 {
		font-size: 24px;
		color: #333;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 16px;
		color: #333;
		margin: 0;
	}

	.description {
		color: #666;
		margin: 0;
	}

	.filters {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
	}

	.filter-btn {
		padding: 8px 16px;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.filter-btn:hover {
		background: #f5f5f5;
	}

	.filter-btn.active {
		background: #e73b42;
		color: white;
		border-color: #e73b42;
	}

	.jobs-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.job-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 20px;
	}

	.job-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.job-title {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.job-icon {
		font-size: 24px;
	}

	.job-description {
		font-size: 13px;
		color: #666;
		margin: 4px 0 0 0;
	}

	.status-badge {
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.success {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.info {
		background: #d1ecf1;
		color: #0c5460;
	}

	.status-badge.error {
		background: #f8d7da;
		color: #721c24;
	}

	.status-badge.warning {
		background: #fff3cd;
		color: #856404;
	}

	.status-badge.default {
		background: #e0e0e0;
		color: #333;
	}

	.job-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		margin-bottom: 16px;
		padding: 16px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.stat label {
		font-size: 12px;
		color: #666;
		font-weight: 600;
		text-transform: uppercase;
	}

	.stat span {
		font-size: 20px;
		font-weight: 600;
		color: #333;
	}

	.success-text {
		color: #28a745;
	}

	.error-text {
		color: #dc3545;
	}

	.progress-bar {
		position: relative;
		height: 30px;
		background: #f0f0f0;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 16px;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #e73b42, #ff6b72);
		transition: width 0.3s ease;
	}

	.progress-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-weight: 600;
		font-size: 14px;
		color: #333;
	}

	.job-meta {
		display: flex;
		gap: 20px;
		font-size: 13px;
		color: #666;
		margin-bottom: 12px;
	}

	.error-log {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 12px;
	}

	.error-log ul {
		margin: 8px 0 0 0;
		padding-left: 20px;
	}

	.error-log li {
		font-size: 13px;
		color: #721c24;
		margin-bottom: 4px;
	}

	.more-errors {
		margin: 8px 0 0 0;
		font-size: 12px;
		color: #721c24;
		font-style: italic;
	}

	.job-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
	}

	.btn-small {
		padding: 6px 12px;
		font-size: 13px;
	}

	.btn-warning {
		background: #ffc107;
		color: #333;
	}

	.btn-warning:hover {
		background: #e0a800;
	}

	.btn-text {
		background: none;
		color: #666;
	}

	.btn-text:hover {
		color: #333;
		background: #f5f5f5;
	}

	.empty-state {
		text-align: center;
		color: #999;
		padding: 40px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 16px;
		}

		.job-stats {
			grid-template-columns: repeat(2, 1fr);
		}

		.job-header {
			flex-direction: column;
			gap: 12px;
		}

		.job-meta {
			flex-direction: column;
			gap: 8px;
		}
	}
</style>
