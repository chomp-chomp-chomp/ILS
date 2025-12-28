<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let title = $state('');
	let issn = $state('');
	let frequency = $state('monthly');
	let format = $state('print');
	let url = $state('');
	let emailList = $state('');
	let subscriptionStart = $state('');
	let subscriptionEnd = $state('');
	let isActive = $state(true);

	let saving = $state(false);
	let error = $state('');

	async function saveSerial() {
		saving = true;
		error = '';

		try {
			const serialData = {
				title,
				issn: issn || null,
				frequency,
				format,
				url: url || null,
				email_list: emailList || null,
				subscription_start: subscriptionStart || null,
				subscription_end: subscriptionEnd || null,
				is_active: isActive,
			};

			const { error: insertError } = await data.supabase.from('serials').insert([serialData]);

			if (insertError) throw insertError;

			goto('/admin/serials');
		} catch (err) {
			error = `Error: ${err.message}`;
		} finally {
			saving = false;
		}
	}
</script>

<div class="new-serial">
	<h1>Add New Serial</h1>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); saveSerial(); }}>
		<section class="form-section">
			<h2>Basic Information</h2>

			<div class="form-group">
				<label for="title">Title *</label>
				<input id="title" type="text" bind:value={title} required placeholder="Serial title" />
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="issn">ISSN</label>
					<input id="issn" type="text" bind:value={issn} placeholder="1234-5678" />
				</div>

				<div class="form-group">
					<label for="frequency">Frequency</label>
					<select id="frequency" bind:value={frequency}>
						<option value="daily">Daily</option>
						<option value="weekly">Weekly</option>
						<option value="monthly">Monthly</option>
						<option value="quarterly">Quarterly</option>
						<option value="annual">Annual</option>
						<option value="irregular">Irregular</option>
					</select>
				</div>
			</div>
		</section>

		<section class="form-section">
			<h2>Format & Access</h2>

			<div class="form-group">
				<label for="format">Format</label>
				<select id="format" bind:value={format}>
					<option value="print">Print</option>
					<option value="electronic">Electronic</option>
					<option value="email_newsletter">Email Newsletter</option>
				</select>
			</div>

			{#if format === 'electronic' || format === 'email_newsletter'}
				<div class="form-group">
					<label for="url">URL</label>
					<input id="url" type="url" bind:value={url} placeholder="https://..." />
				</div>
			{/if}

			{#if format === 'email_newsletter'}
				<div class="form-group">
					<label for="emailList">Email List Address</label>
					<input id="emailList" type="email" bind:value={emailList} placeholder="newsletter@example.com" />
				</div>
			{/if}
		</section>

		<section class="form-section">
			<h2>Subscription</h2>

			<div class="form-row">
				<div class="form-group">
					<label for="subscriptionStart">Start Date</label>
					<input id="subscriptionStart" type="date" bind:value={subscriptionStart} />
				</div>

				<div class="form-group">
					<label for="subscriptionEnd">End Date</label>
					<input id="subscriptionEnd" type="date" bind:value={subscriptionEnd} />
				</div>
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={isActive} />
					<span>Active Subscription</span>
				</label>
			</div>
		</section>

		<div class="form-actions">
			<button type="submit" class="btn-primary" disabled={saving || !title}>
				{saving ? 'Saving...' : 'Save Serial'}
			</button>
			<a href="/admin/serials" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>

<style>
	.new-serial {
		max-width: 900px;
		background: white;
		padding: 2rem;
		border-radius: 8px;
	}

	h1 {
		margin: 0 0 1.5rem 0;
	}

	.error {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		border: 1px solid #fcc;
	}

	.form-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.form-section:last-of-type {
		border-bottom: none;
	}

	.form-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	input,
	select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: #667eea;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		margin: 0;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		border: none;
		font-size: 1rem;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #5568d3;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e0e0e0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #d0d0d0;
	}
</style>
