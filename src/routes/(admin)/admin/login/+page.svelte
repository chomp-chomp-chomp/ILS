<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');
	let showResetForm = $state(false);
	let resetEmail = $state('');
	let resetSuccess = $state(false);
	let resetLoading = $state(false);
	let resetError = $state('');

	async function handleLogin() {
		loading = true;
		error = '';

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			error = signInError.message;
			loading = false;
		} else {
			goto('/admin');
		}
	}

	async function handlePasswordReset() {
		if (!resetEmail) {
			resetError = 'Please enter your email address';
			return;
		}

		resetLoading = true;
		resetError = '';

		try {
			const { error: resetEmailError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
				redirectTo: `${window.location.origin}/admin/reset-password`
			});

			if (resetEmailError) {
				resetError = resetEmailError.message;
			} else {
				resetSuccess = true;
			}
		} catch (err) {
			resetError = 'Failed to send reset email. Please try again.';
		} finally {
			resetLoading = false;
		}
	}

	function toggleResetForm() {
		showResetForm = !showResetForm;
		resetSuccess = false;
		resetError = '';
		resetEmail = email; // Pre-fill with login email if provided
	}
</script>

<div class="login-container">
	<div class="login-box">
		<h1>Admin Login</h1>
		<p class="subtitle">Library Catalog System</p>

		{#if !showResetForm}
			<!-- Login Form -->
			{#if error}
				<div class="error">{error}</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
				<div class="form-group">
					<label for="email">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						placeholder="admin@library.org"
					/>
				</div>

				<div class="form-group">
					<label for="password">Password</label>
					<input id="password" type="password" bind:value={password} required />
				</div>

				<button type="submit" disabled={loading}>
					{loading ? 'Logging in...' : 'Login'}
				</button>
			</form>

			<div class="forgot-password">
				<button type="button" onclick={toggleResetForm} class="link-button">
					Forgot password?
				</button>
			</div>
		{:else}
			<!-- Password Reset Form -->
			<button type="button" onclick={toggleResetForm} class="back-button">
				← Back to Login
			</button>

			{#if resetSuccess}
				<div class="success">
					<p><strong>Check your email!</strong></p>
					<p>
						We've sent a password reset link to <strong>{resetEmail}</strong>.
						Click the link in the email to reset your password.
					</p>
					<p class="note">
						The link will expire in 1 hour. If you don't see the email, check your spam folder.
					</p>
				</div>
			{:else}
				{#if resetError}
					<div class="error">{resetError}</div>
				{/if}

				<p class="reset-instructions">
					Enter your email address and we'll send you a link to reset your password.
				</p>

				<form onsubmit={(e) => { e.preventDefault(); handlePasswordReset(); }}>
					<div class="form-group">
						<label for="reset-email">Email</label>
						<input
							id="reset-email"
							type="email"
							bind:value={resetEmail}
							required
							placeholder="admin@library.org"
						/>
					</div>

					<button type="submit" disabled={resetLoading}>
						{resetLoading ? 'Sending...' : 'Send Reset Link'}
					</button>
				</form>
			{/if}
		{/if}

		<div class="info">
			<p><strong>Setup Instructions:</strong></p>
			<ol>
				<li>Create a Supabase account and project</li>
				<li>Run the database schema from DATABASE_SCHEMA.md</li>
				<li>Create a user in Supabase Authentication</li>
				<li>Set environment variables in Vercel</li>
			</ol>
		</div>

		<div class="links">
			<a href="/">← Back to Home</a>
		</div>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 2rem;
	}

	.login-box {
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

	.info {
		margin-top: 2rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.info strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.info ol {
		margin: 0;
		padding-left: 1.5rem;
	}

	.info li {
		margin-bottom: 0.25rem;
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

	.forgot-password {
		margin-top: 1rem;
		text-align: center;
	}

	.link-button {
		background: none;
		border: none;
		color: #667eea;
		text-decoration: none;
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0;
	}

	.link-button:hover {
		text-decoration: underline;
	}

	.back-button {
		background: none;
		border: none;
		color: #667eea;
		text-decoration: none;
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0.5rem 0;
		margin-bottom: 1rem;
		display: block;
	}

	.back-button:hover {
		text-decoration: underline;
	}

	.success {
		background: #d4edda;
		color: #155724;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		border: 1px solid #c3e6cb;
	}

	.success p {
		margin: 0 0 0.75rem 0;
	}

	.success p:last-child {
		margin-bottom: 0;
	}

	.success .note {
		font-size: 0.875rem;
		opacity: 0.9;
	}

	.reset-instructions {
		margin-bottom: 1.5rem;
		color: #666;
	}
</style>
