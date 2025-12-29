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
	let status = $state('active');
	let vendorId = $state('');
	let budgetId = $state('');
	let publicDisplay = $state(true);
	let notes = $state('');

	let vendors = $state<any[]>([]);
	let budgets = $state<any[]>([]);
	let saving = $state(false);
	let error = $state('');

	import { onMount } from 'svelte';

	onMount(async () => {
		// Load vendors
		const { data: vendorData } = await data.supabase
			.from('vendors')
			.select('id, name')
			.eq('is_active', true)
			.order('name');
		vendors = vendorData || [];

		// Load budgets
		const { data: budgetData } = await data.supabase
			.from('budgets')
			.select('id, name, code')
			.eq('status', 'active')
			.order('name');
		budgets = budgetData || [];
	});

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
				status,
				vendor_id: vendorId || null,
				budget_id: budgetId || null,
				public_display: publicDisplay,
				is_active: status === 'active',
				notes: notes || null
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
					<label for="vendor">Vendor</label>
					<select id="vendor" bind:value={vendorId}>
						<option value="">Select vendor...</option>
						{#each vendors as vendor}
							<option value={vendor.id}>{vendor.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="budget">Budget/Fund</label>
					<select id="budget" bind:value={budgetId}>
						<option value="">Select budget...</option>
						{#each budgets as budget}
							<option value={budget.id}>{budget.name} ({budget.code})</option>
						{/each}
					</select>
				</div>
			</div>

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

			<div class="form-row">
				<div class="form-group">
					<label for="status">Status</label>
					<select id="status" bind:value={status}>
						<option value="active">Active</option>
						<option value="trial">Trial</option>
						<option value="cancelled">Cancelled</option>
						<option value="lapsed">Lapsed</option>
					</select>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={publicDisplay} />
						<span>Display in Public Catalog</span>
					</label>
				</div>
			</div>
		</section>

		<section class="form-section">
			<h2>Notes</h2>

			<div class="form-group">
				<label for="notes">Internal Notes</label>
				<textarea id="notes" bind:value={notes} rows="4" placeholder="Internal notes..."></textarea>
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
	select,
	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
		font-family: inherit;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	textarea {
		resize: vertical;
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
