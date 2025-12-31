<script lang="ts">
	import { onMount } from 'svelte';

	let authorities = $state<any[]>([]);
	let letter = $state('A');
	let type = $state('');
	let loading = $state(false);

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

	const types = [
		{ value: '', label: 'All Types' },
		{ value: 'personal_name', label: 'Personal Names' },
		{ value: 'corporate_name', label: 'Corporate Names' },
		{ value: 'geographic_name', label: 'Geographic Names' },
		{ value: 'topical_subject', label: 'Subjects' }
	];

	$effect(() => {
		loadAuthorities(letter, type);
	});

	async function loadAuthorities(currentLetter: string, currentType: string) {
		loading = true;

		try {
			const params = new URLSearchParams();
			if (currentType) params.set('type', currentType);
			params.set('limit', '200');
			params.set('starts_with', currentLetter);

			const response = await fetch(`/api/authorities?${params.toString()}`);
			const data = await response.json();

			authorities = data.authorities || [];
		} catch (error) {
			console.error('Error loading authorities:', error);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Browse Authorities - Admin</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>Browse Authorities</h1>
		<p>Browse authority records alphabetically</p>
	</header>

	<div class="controls">
		<select bind:value={type}>
			{#each types as typeOption}
				<option value={typeOption.value}>{typeOption.label}</option>
			{/each}
		</select>
	</div>

	<div class="alphabet-nav">
		{#each alphabet as char}
			<button
				class="letter-btn"
				class:active={letter === char}
				onclick={() => (letter = char)}
			>
				{char}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="loading">Loading...</div>
	{:else if authorities.length === 0}
		<div class="no-results">
			<p>No authorities found starting with "{letter}"</p>
		</div>
	{:else}
		<div class="browse-list">
			<h2>Authorities starting with "{letter}" ({authorities.length})</h2>
			<ul>
				{#each authorities as authority}
					<li>
						<a href="/admin/cataloging/authorities/{authority.id}">
							<strong>{authority.heading}</strong>
							{#if authority.birth_date || authority.death_date}
								<span class="dates">
									({authority.birth_date || '?'}–{authority.death_date || '?'})
								</span>
							{/if}
						</a>
						<span class="type">{authority.type.replace('_', ' ')}</span>
						{#if authority.usage_count > 0}
							<span class="usage">{authority.usage_count} uses</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 20px;
	}

	.page-header {
		margin-bottom: 30px;
	}

	.page-header h1 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.page-header p {
		margin: 0;
		color: #666;
	}

	.controls {
		margin-bottom: 20px;
	}

	.controls select {
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.alphabet-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 30px;
		padding: 20px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.letter-btn {
		width: 40px;
		height: 40px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.letter-btn:hover {
		background: #f8f9fa;
		border-color: #667eea;
	}

	.letter-btn.active {
		background: #667eea;
		color: white;
		border-color: #667eea;
	}

	.loading,
	.no-results {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.browse-list {
		background: white;
		border-radius: 8px;
		padding: 30px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.browse-list h2 {
		margin: 0 0 20px 0;
		color: #333;
		font-size: 20px;
	}

	.browse-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.browse-list li {
		padding: 12px 0;
		border-bottom: 1px solid #eee;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.browse-list li:last-child {
		border-bottom: none;
	}

	.browse-list a {
		flex: 1;
		text-decoration: none;
		color: #333;
	}

	.browse-list a:hover strong {
		color: #667eea;
	}

	.dates {
		color: #666;
		font-size: 14px;
		margin-left: 8px;
	}

	.type {
		font-size: 12px;
		padding: 4px 8px;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 4px;
		text-transform: capitalize;
	}

	.usage {
		font-size: 12px;
		color: #666;
	}
</style>
