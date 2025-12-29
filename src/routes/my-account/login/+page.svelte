<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleLogin() {
		loading = true;
		error = '';

		const { error: signInError } = await data.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			error = signInError.message;
			loading = false;
		} else {
			// Check if user is linked to a patron record
			const { data: { user } } = await data.supabase.auth.getUser();

			if (user) {
				const { data: patronData } = await data.supabase
					.from('patrons')
					.select('id')
					.eq('user_id', user.id)
					.single();

				if (!patronData) {
					error = 'Your account is not linked to a patron record. Please contact library staff.';
					await data.supabase.auth.signOut();
					loading = false;
					return;
				}
			}

			goto('/my-account');
		}
	}
</script>

<div class="login-container">
	<div class="login-box">
		<h1>Patron Login</h1>
		<p class="subtitle">Access your library account</p>

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
					placeholder="your.email@example.com"
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

		<div class="info">
			<p><strong>Don't have an account?</strong></p>
			<p>Visit the library or contact staff to register for a library card and create your online account.</p>
		</div>

		<div class="links">
			<a href="/catalog">← Back to Catalog</a>
		</div>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #e73b42 0%, #d12d34 100%);
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
		color: #2c3e50;
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
		font-size: 0.875rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
		transition: all 0.2s;
	}

	input:focus {
		outline: none;
		border-color: #e73b42;
		box-shadow: 0 0 0 3px rgba(231, 59, 66, 0.1);
	}

	button {
		width: 100%;
		padding: 0.875rem;
		background: #e73b42;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #d12d34;
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
		color: #333;
	}

	.info p {
		margin: 0;
		color: #666;
		line-height: 1.5;
	}

	.links {
		margin-top: 1.5rem;
		text-align: center;
	}

	.links a {
		color: #e73b42;
		text-decoration: none;
		font-weight: 500;
	}

	.links a:hover {
		text-decoration: underline;
	}

	@media (max-width: 480px) {
		.login-box {
			padding: 2rem;
		}

		h1 {
			font-size: 1.5rem;
		}
	}
</style>
