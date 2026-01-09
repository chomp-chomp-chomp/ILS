<script lang="ts">
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let fileInput: HTMLInputElement;
	let uploading = $state(false);
	let results = $state<any>(null);
	let error = $state('');

	const csvTemplate = `first_name,last_name,email,phone,patron_type,create_login,temp_password
John,Doe,john.doe@example.com,555-0101,student,yes,TempPass123
Jane,Smith,jane.smith@example.com,555-0102,faculty,yes,TempPass456
Bob,Johnson,bob@example.com,555-0103,staff,no,`;

	async function handleFileUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;

		uploading = true;
		error = '';
		results = null;

		try {
			const text = await file.text();
			const lines = text.split('\n').filter(l => l.trim());

			if (lines.length < 2) {
				throw new Error('CSV file is empty or missing header row');
			}

			// Parse CSV
			const headers = lines[0].split(',').map(h => h.trim());
			const rows = lines.slice(1);

			const patronTypes = await getPatronTypes();
			const created: any[] = [];
			const errors: any[] = [];

			for (let i = 0; i < rows.length; i++) {
				const values = rows[i].split(',').map(v => v.trim());
				const row: any = {};
				headers.forEach((header, idx) => {
					row[header] = values[idx] || '';
				});

				try {
					// Validate required fields
					if (!row.first_name || !row.last_name || !row.patron_type) {
						throw new Error('Missing required fields: first_name, last_name, patron_type');
					}

					// Find patron type
					const patronType = patronTypes.find(
						pt => pt.name.toLowerCase() === row.patron_type.toLowerCase()
					);
					if (!patronType) {
						throw new Error(`Invalid patron type: ${row.patron_type}`);
					}

					// Generate barcode
					const { data: barcode, error: barcodeError } = await supabase
						.rpc('generate_patron_barcode');
					if (barcodeError) throw barcodeError;

					let userId = null;

					// Create auth user if requested
					if (row.create_login?.toLowerCase() === 'yes' && row.email) {
						const password = row.temp_password || generatePassword();

						const { data: authData, error: authError } = await supabase.auth.admin.createUser({
							email: row.email,
							password: password,
							email_confirm: true
						});

						if (authError) throw authError;
						userId = authData.user.id;
					}

					// Create patron record
					const { data: patron, error: patronError } = await supabase
						.from('patrons')
						.insert({
							barcode: barcode,
							first_name: row.first_name,
							last_name: row.last_name,
							email: row.email || null,
							phone: row.phone || null,
							patron_type_id: patronType.id,
							status: 'active',
							user_id: userId
						})
						.select()
						.single();

					if (patronError) throw patronError;

					created.push({
						name: `${row.first_name} ${row.last_name}`,
						email: row.email,
						barcode: barcode,
						hasLogin: !!userId,
						password: row.create_login?.toLowerCase() === 'yes' ? (row.temp_password || 'Generated') : null
					});

				} catch (err: any) {
					errors.push({
						row: i + 2, // +2 because of header and 0-index
						name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown',
						error: err.message
					});
				}
			}

			results = { created, errors };

		} catch (err: any) {
			error = `Error processing file: ${err.message}`;
		} finally {
			uploading = false;
		}
	}

	async function getPatronTypes() {
		const { data: types, error } = await supabase
			.from('patron_types')
			.select('*')
			.eq('is_active', true);

		if (error) throw error;
		return types || [];
	}

	function generatePassword(): string {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
		let password = '';
		for (let i = 0; i < 12; i++) {
			password += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return password;
	}

	function downloadTemplate() {
		const blob = new Blob([csvTemplate], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'patron_bulk_upload_template.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadResults() {
		if (!results) return;

		let csv = 'Name,Email,Barcode,Login Created,Temporary Password\n';
		results.created.forEach((p: any) => {
			csv += `${p.name},${p.email},${p.barcode},${p.hasLogin ? 'Yes' : 'No'},${p.password || ''}\n`;
		});

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'patron_upload_results.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="bulk-upload-page">
	<header class="page-header">
		<h1>Bulk Upload Patrons</h1>
		<a href="/admin/circulation/patrons" class="btn-secondary">Back to Patrons</a>
	</header>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if !results}
		<div class="upload-section">
			<h2>Upload CSV File</h2>

			<div class="instructions">
				<h3>Instructions:</h3>
				<ol>
					<li>Download the CSV template below</li>
					<li>Fill in patron information (one patron per row)</li>
					<li>Set <code>create_login</code> to "yes" to automatically create login accounts</li>
					<li>Provide a <code>temp_password</code> or leave blank to auto-generate</li>
					<li>Upload the completed CSV file</li>
				</ol>

				<h4>CSV Columns:</h4>
				<ul>
					<li><strong>first_name</strong> (required)</li>
					<li><strong>last_name</strong> (required)</li>
					<li><strong>email</strong> (optional, required for login)</li>
					<li><strong>phone</strong> (optional)</li>
					<li><strong>patron_type</strong> (required): student, faculty, staff, or public</li>
					<li><strong>create_login</strong>: "yes" or "no" - whether to create auth account</li>
					<li><strong>temp_password</strong> (optional): leave blank to auto-generate</li>
				</ul>

				<button onclick={downloadTemplate} class="btn-primary">
					Download CSV Template
				</button>
			</div>

			<div class="upload-box">
				<input
					bind:this={fileInput}
					type="file"
					accept=".csv"
					onchange={handleFileUpload}
					disabled={uploading}
					class="file-input"
				/>
				<label for="file">
					{uploading ? 'Uploading...' : 'Choose CSV File'}
				</label>
			</div>
		</div>
	{:else}
		<div class="results-section">
			<h2>Upload Results</h2>

			{#if results.created.length > 0}
				<div class="success-box">
					<h3>✓ Successfully Created ({results.created.length})</h3>
					<div class="actions">
						<button onclick={downloadResults} class="btn-primary">
							Download Results CSV
						</button>
					</div>
					<div class="results-table">
						<table>
							<thead>
								<tr>
									<th>Name</th>
									<th>Email</th>
									<th>Barcode</th>
									<th>Login Created</th>
									<th>Temp Password</th>
								</tr>
							</thead>
							<tbody>
								{#each results.created as patron}
									<tr>
										<td>{patron.name}</td>
										<td>{patron.email || '—'}</td>
										<td class="barcode">{patron.barcode}</td>
										<td>{patron.hasLogin ? '✓ Yes' : 'No'}</td>
										<td class="password">{patron.password || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if results.errors.length > 0}
				<div class="error-box">
					<h3>⚠ Errors ({results.errors.length})</h3>
					<div class="results-table">
						<table>
							<thead>
								<tr>
									<th>Row</th>
									<th>Name</th>
									<th>Error</th>
								</tr>
							</thead>
							<tbody>
								{#each results.errors as err}
									<tr>
										<td>{err.row}</td>
										<td>{err.name}</td>
										<td class="error-text">{err.error}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<div class="actions">
				<button onclick={() => { results = null; error = ''; }} class="btn-secondary">
					Upload Another File
				</button>
				<a href="/admin/circulation/patrons" class="btn-primary">
					Go to Patrons List
				</a>
			</div>
		</div>
	{/if}
</div>

<style>
	.bulk-upload-page {
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

	.error {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		border: 1px solid #fcc;
	}

	.upload-section,
	.results-section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	.instructions {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.instructions h3,
	.instructions h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
	}

	.instructions ol,
	.instructions ul {
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;
	}

	.instructions li {
		margin-bottom: 0.5rem;
		line-height: 1.6;
	}

	.instructions code {
		background: white;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.875rem;
		color: #e73b42;
	}

	.upload-box {
		text-align: center;
		padding: 3rem;
		border: 2px dashed #d0d0d0;
		border-radius: 8px;
		background: #fafafa;
	}

	.file-input {
		display: none;
	}

	.upload-box label {
		display: inline-block;
		padding: 1rem 2rem;
		background: #e73b42;
		color: white;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s;
	}

	.upload-box label:hover {
		background: #d12d34;
	}

	.results-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
	}

	.success-box {
		background: #d4edda;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #c3e6cb;
	}

	.success-box h3 {
		color: #155724;
	}

	.error-box {
		background: #fff3cd;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #ffc107;
	}

	.error-box h3 {
		color: #856404;
	}

	.results-table {
		margin-top: 1rem;
		overflow-x: auto;
		background: white;
		border-radius: 4px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f8f9fa;
		border-bottom: 2px solid #e0e0e0;
	}

	th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.875rem;
	}

	td {
		padding: 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.875rem;
	}

	.barcode {
		font-family: monospace;
		font-weight: 500;
	}

	.password {
		font-family: monospace;
		font-size: 0.8rem;
		color: #666;
	}

	.error-text {
		color: #c33;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.2s;
		display: inline-block;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover {
		background: #d12d34;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background: #5a6268;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.actions {
			flex-direction: column;
			width: 100%;
		}

		.actions button,
		.actions a {
			width: 100%;
			text-align: center;
		}
	}
</style>
