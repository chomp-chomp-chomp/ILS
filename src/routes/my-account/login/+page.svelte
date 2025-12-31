<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let mode = $state<'email' | 'card'>('email');
  let email = $state('');
  let password = $state('');
  let card = $state('');
  let pin = $state('');
  let loading = $state(false);
  let error = $state('');
  let info = $state('');
  let resetEmail = $state('');

  async function handleEmailLogin() {
    loading = true;
    error = '';
    const { error: signInError } = await data.supabase.auth.signInWithPassword({ email, password });
    loading = false;
    if (signInError) {
      error = signInError.message;
      return;
    }
    goto('/my-account');
  }

  async function handleCardLogin() {
    loading = true;
    error = '';
    info = '';

    const { data: patron, error: rpcError } = await data.supabase.rpc('patron_card_login', {
      card_number: card,
      provided_pin: pin,
    });

    if (rpcError || !patron || patron.length === 0) {
      loading = false;
      error = 'Card number or PIN not recognized.';
      return;
    }

    const record = patron[0];
    if (!record.email) {
      loading = false;
      error = 'This card is missing an email address. Contact the library to finish setup.';
      return;
    }

    const { error: authError } = await data.supabase.auth.signInWithPassword({
      email: record.email,
      password: pin,
    });

    loading = false;
    if (authError) {
      info =
        'PIN verified. Please sign in with your email and password or ask staff to align your PIN and password.';
    } else {
      goto('/my-account');
    }
  }

  async function handleReset() {
    if (!resetEmail) {
      error = 'Enter your email to reset.';
      return;
    }
    const { error: resetError } = await data.supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '/my-account/settings',
    });
    info = resetError
      ? resetError.message
      : 'Password reset email sent. Check your inbox for next steps.';
  }
</script>

<div class="login-shell">
  <div class="panel">
    <p class="eyebrow">Patron self-service</p>
    <h1>Sign in to My Account</h1>
    <div class="tab-row">
      <button class:active={mode === 'email'} onclick={() => (mode = 'email')}>Email</button>
      <button class:active={mode === 'card'} onclick={() => (mode = 'card')}>Library card + PIN</button>
    </div>

    {#if error}
      <div class="alert error">{error}</div>
    {/if}
    {#if info}
      <div class="alert info">{info}</div>
    {/if}

    {#if mode === 'email'}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleEmailLogin();
        }}
        class="form"
      >
        <label>
          Email
          <input type="email" bind:value={email} required placeholder="you@example.com" />
        </label>
        <label>
          Password
          <input type="password" bind:value={password} required />
        </label>
        <button class="btn primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleCardLogin();
        }}
        class="form"
      >
        <label>
          Library card number
          <input bind:value={card} required />
        </label>
        <label>
          PIN
          <input type="password" bind:value={pin} required minlength="4" />
        </label>
        <button class="btn primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in with card'}
        </button>
      </form>
    {/if}

    <div class="divider"></div>

    <div class="reset">
      <p class="muted">Forgot your password?</p>
      <div class="reset-row">
        <input
          type="email"
          placeholder="you@example.com"
          bind:value={resetEmail}
          aria-label="Reset email"
        />
        <button class="btn ghost" type="button" onclick={handleReset}>Send reset link</button>
      </div>
      <p class="muted small">
        Need an account? Register with staff or choose email sign-up, then link your library card in
        settings.
      </p>
    </div>
  </div>
</div>

<style>
  .login-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e73b42 0%, #d12d34 100%);
    padding: 2rem;
  }

  .panel {
    background: #fff;
    border-radius: 16px;
    padding: 2rem;
    width: 100%;
    max-width: 540px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    color: #e73b42;
    margin: 0 0 0.25rem 0;
  }

  h1 {
    margin: 0 0 1rem 0;
  }

  .tab-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-row button {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.75rem;
    background: #f9fafb;
    cursor: pointer;
    font-weight: 700;
  }

  .tab-row button.active {
    background: #e73b42;
    color: #fff;
    border-color: #e73b42;
  }

  .alert {
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .alert.error {
    background: #fff5f5;
    border: 1px solid #f4c7c7;
    color: #e73b42;
  }

  .alert.info {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #1f2933;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 700;
  }

  input {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.75rem;
  }

  .btn {
    border: 1px solid #e5e7eb;
    padding: 0.75rem 0.9rem;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-weight: 700;
  }

  .btn.primary {
    background: #e73b42;
    color: #fff;
    border-color: #e73b42;
  }

  .btn.ghost {
    background: #f9fafb;
  }

  .divider {
    margin: 1rem 0;
    height: 1px;
    background: #f0f0f0;
  }

  .reset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reset-row {
    display: flex;
    gap: 0.5rem;
  }

  .muted {
    color: #6b7280;
    margin: 0;
  }

  .small {
    font-size: 0.9rem;
  }

  @media (max-width: 520px) {
    .reset-row {
      flex-direction: column;
    }
  }
</style>
