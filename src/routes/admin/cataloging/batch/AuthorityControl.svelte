<script lang="ts">
	let fieldType = $state('subjects');
	let autoCorrect = $state(false);
	let issues = $state<any[]>([]);
	let loading = $state(false);
	let message = $state('');
	let messageType = $state<'success' | 'error' | 'info'>('info');

	async function runCheck() {
		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/authority', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fieldType,
					autoCorrect,
					previewOnly: true
				})
			});

			const data = await response.json();

			if (data.success) {
				issues = data.issues || [];
				message = `Found ${data.summary.issuesFound} authority issues in ${data.summary.recordsChecked} records`;
				messageType = 'info';
			}
		} catch (error) {
			message = 'Error running authority check';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function applyCorrections() {
		if (!confirm(`Apply ${issues.length} authority corrections?`)) {
			return;
		}

		loading = true;
		message = '';

		try {
			const response = await fetch('/api/batch/authority', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fieldType,
					autoCorrect: true,
					previewOnly: false
				})
			});

			const data = await response.json();

			if (data.success) {
				message = 'Authority corrections applied successfully';
				messageType = 'success';
				issues = [];
			}
		} catch (error) {
			message = 'Error applying corrections';
			messageType = 'error';
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="authority-control">
	<h2>Authority Control</h2>
	<p class="description">Detect and correct unauthorized headings to maintain catalog consistency.</p>

	<div class="info-box">
		<p>Authority control ensures that subject headings, names, and other controlled vocabularies follow established standards (LCSH, LCNAF, etc.).</p>
	</div>

	{#if message}
		<div class="message {messageType}">{message}</div>
	{/if}

	<div class="controls">
		<div class="form-group">
			<label for="fieldType">Check Authority For</label>
			<select id="fieldType" bind:value={fieldType}>
				<option value="subjects">Subject Headings</option>
				<option value="names">Name Headings</option>
				<option value="all">All Fields</option>
			</select>
		</div>

		<div class="form-group">
			<label>
				<input type="checkbox" bind:checked={autoCorrect} />
				Automatically apply high-confidence corrections (>80% match)
			</label>
		</div>

		<button class="btn btn-primary" onclick={runCheck} disabled={loading}>
			{loading ? 'Checking...' : 'Run Authority Check'}
		</button>
	</div>

	{#if issues.length > 0}
		<div class="issues-section">
			<div class="section-header">
				<h3>Authority Issues ({issues.length})</h3>
				<button class="btn btn-primary" onclick={applyCorrections} disabled={loading}>
					Apply Corrections
				</button>
			</div>

			<div class="issues-list">
				{#each issues as issue}
					<div class="issue-card">
						<div class="issue-header">
							<div>
								<strong>{issue.recordTitle}</strong>
								<span class="field-type-badge">{issue.fieldType}</span>
							</div>
							<span class="confidence-badge" class:high={issue.confidence > 0.8}>
								{(issue.confidence * 100).toFixed(0)}% confidence
							</span>
						</div>

						<div class="issue-body">
							<div class="value-comparison">
								<div class="current-value">
									<label>Current</label>
									<span>{issue.currentValue}</span>
								</div>
								<div class="arrow">→</div>
								<div class="suggested-value">
									<label>Suggested</label>
									<span>{issue.suggestedValue || 'No suggestion'}</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.authority-control {
		max-width: 1000px;
	}

	h2 {
		font-size: 24px;
		color: #333;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 20px;
		color: #333;
		margin: 0;
	}

	.description {
		color: #666;
		margin-bottom: 20px;
	}

	.info-box {
		background: #e7f3ff;
		border: 1px solid #b3d9ff;
		border-radius: 4px;
		padding: 16px;
		margin-bottom: 20px;
	}

	.info-box p {
		margin: 0;
		color: #004085;
	}

	.message {
		padding: 12px 16px;
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

	.message.info {
		background: #d1ecf1;
		color: #0c5460;
		border: 1px solid #bee5eb;
	}

	.controls {
		background: #f9f9f9;
		padding: 20px;
		border-radius: 8px;
		margin-bottom: 30px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 8px;
		color: #333;
	}

	.form-group select {
		width: 100%;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
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

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #e73b42;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #d12a31;
	}

	.issues-section {
		margin-top: 30px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.issues-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.issue-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 16px;
	}

	.issue-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.field-type-badge {
		display: inline-block;
		padding: 3px 8px;
		background: #e0e0e0;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		margin-left: 8px;
	}

	.confidence-badge {
		padding: 4px 8px;
		background: #f0f0f0;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
	}

	.confidence-badge.high {
		background: #d4edda;
		color: #155724;
	}

	.issue-body {
		padding-top: 12px;
		border-top: 1px solid #eee;
	}

	.value-comparison {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 16px;
		align-items: center;
	}

	.current-value,
	.suggested-value {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.current-value label,
	.suggested-value label {
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
	}

	.current-value span {
		background: #f8d7da;
		color: #721c24;
		padding: 8px;
		border-radius: 4px;
	}

	.suggested-value span {
		background: #d4edda;
		color: #155724;
		padding: 8px;
		border-radius: 4px;
		font-weight: 600;
	}

	.arrow {
		font-size: 20px;
		color: #666;
	}

	@media (max-width: 768px) {
		.value-comparison {
			grid-template-columns: 1fr;
		}

		.arrow {
			transform: rotate(90deg);
			text-align: center;
		}

		.section-header {
			flex-direction: column;
			gap: 12px;
			align-items: flex-start;
		}
	}
</style>
