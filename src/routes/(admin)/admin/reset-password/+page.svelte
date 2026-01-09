<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	// Check if we have an access token from the reset link
	onMount(() => {
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const accessToken = hashParams.get('access_token');

		if (!accessToken) {
			error = 'Invalid or expired reset link. Please request a new password reset.';
		}
	});

	async function handleResetPassword() {
		error = '';

		if (newPassword.length < 6) {
			error = 'Password must be at least 6 characters long';
			return;
		}

		if (newPassword !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;

		try {
			const { error: updateError } = await data.supabase.auth.updateUser({
				password: newPassword
			});

			if (updateError) {
				error = updateError.message;
			} else {
				success = true;
				setTimeout(() => {
					goto('/admin');
				}, 2000);
			}
		} catch (err) {
			error = 'Failed to reset password. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="reset-container">
	<div class="reset-box">
		<h1>Reset Password</h1>
		<p class="subtitle">Enter your new password</p>

		{#if success}
			<div class="success">
				<p><strong>Password updated successfully!</strong></p>
				<p>Redirecting to admin panel...</p>
			</div>
		{:else}
			{#if error}
				<div class="error">{error}</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
				<div class="form-group">
					<label for="new-password">New Password</label>
					<input
						id="new-password"
						type="password"
						bind:value={newPassword}
						required
						minlength="6"
						placeholder="At least 6 characters"
					/>
				</div>

				<div class="form-group">
					<label for="confirm-password">Confirm Password</label>
					<input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						required
						minlength="6"
						placeholder="Re-enter your password"
					/>
				</div>

				<button type="submit" disabled={loading}>
					{loading ? 'Updating...' : 'Update Password'}
				</button>
			</form>
		{/if}

		<div class="links">
			<a href="/admin/login">← Back to Login</a>
		</div>
	</div>
</div>

<style>
	.reset-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 2rem;
	}

	.reset-box {
		background: white;
		padding: 3rem;
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 450px;
		width: 100%;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		text-align: center;
	}

	.subtitle {
		text-align: center;
		color: #666;
		margin-bottom: 2rem;
	}

	.error {
		background: #fee;
		color: #c33;
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		border: 1px solid #fcc;
	}

	.success {
		background: #d4edda;
		color: #155724;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		border: 1px solid #c3e6cb;
		text-align: center;
	}

	.success p {
		margin: 0 0 0.5rem 0;
	}

	.success p:last-child {
		margin-bottom: 0;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #667eea;
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #5568d3;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.links {
		margin-top: 1.5rem;
		text-align: center;
	}

	.links a {
		color: #667eea;
		text-decoration: none;
	}

	.links a:hover {
		text-decoration: underline;
	}
</style>
