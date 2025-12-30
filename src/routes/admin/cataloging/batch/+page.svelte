<script lang="ts">
	import { onMount } from 'svelte';
	import FindReplace from './FindReplace.svelte';
	import BatchDelete from './BatchDelete.svelte';
	import MacroEditor from './MacroEditor.svelte';
	import Deduplication from './Deduplication.svelte';
	import AuthorityControl from './AuthorityControl.svelte';
	import JobQueue from './JobQueue.svelte';

	let activeTab = $state<string>('find-replace');

	const tabs = [
		{ id: 'find-replace', label: 'Find & Replace', icon: '🔍' },
		{ id: 'batch-delete', label: 'Batch Delete', icon: '🗑️' },
		{ id: 'macros', label: 'MARC Macros', icon: '⚙️' },
		{ id: 'deduplication', label: 'Deduplication', icon: '🔀' },
		{ id: 'authority', label: 'Authority Control', icon: '✓' },
		{ id: 'jobs', label: 'Job Queue', icon: '📋' }
	];
</script>

<div class="batch-operations-container">
	<header class="page-header">
		<h1>Batch Operations</h1>
		<p class="subtitle">Powerful tools for bulk MARC record management</p>
	</header>

	<div class="tabs">
		{#each tabs as tab}
			<button
				class="tab"
				class:active={activeTab === tab.id}
				onclick={() => activeTab = tab.id}
			>
				<span class="icon">{tab.icon}</span>
				<span>{tab.label}</span>
			</button>
		{/each}
	</div>

	<div class="tab-content">
		{#if activeTab === 'find-replace'}
			<FindReplace />
		{:else if activeTab === 'batch-delete'}
			<BatchDelete />
		{:else if activeTab === 'macros'}
			<MacroEditor />
		{:else if activeTab === 'deduplication'}
			<Deduplication />
		{:else if activeTab === 'authority'}
			<AuthorityControl />
		{:else if activeTab === 'jobs'}
			<JobQueue />
		{/if}
	</div>
</div>

<style>
	.batch-operations-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 20px;
	}

	.page-header {
		margin-bottom: 30px;
	}

	.page-header h1 {
		font-size: 28px;
		color: #333;
		margin-bottom: 8px;
	}

	.subtitle {
		font-size: 16px;
		color: #666;
		margin: 0;
	}

	.tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
		border-bottom: 2px solid #e0e0e0;
		overflow-x: auto;
	}

	.tab {
		padding: 12px 20px;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 15px;
		color: #666;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.tab:hover {
		background: #f5f5f5;
		color: #333;
	}

	.tab.active {
		color: #e73b42;
		border-bottom-color: #e73b42;
		font-weight: 600;
	}

	.tab .icon {
		font-size: 18px;
	}

	.tab-content {
		background: white;
		border-radius: 8px;
		padding: 30px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		min-height: 500px;
	}

	@media (max-width: 768px) {
		.batch-operations-container {
			padding: 12px;
		}

		.tabs {
			flex-wrap: nowrap;
			overflow-x: scroll;
		}

		.tab {
			padding: 10px 16px;
			font-size: 14px;
		}

		.tab-content {
			padding: 20px;
		}
	}
</style>
