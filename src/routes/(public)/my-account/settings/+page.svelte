<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let contact = $state({
    email: data.patron.email ?? '',
    phone: data.patron.phone ?? '',
    address1: data.patron.address_line1 ?? '',
    address2: data.patron.address_line2 ?? '',
    city: data.patron.city ?? '',
    state: data.patron.state_province ?? '',
    postal: data.patron.postal_code ?? '',
  });

  let prefs = $state({
    email_opt_in: data.patron.preferences?.email_opt_in ?? true,
    sms_opt_in: data.patron.preferences?.sms_opt_in ?? false,
    sms_number: data.patron.preferences?.sms_number ?? '',
    default_pickup_location: data.patron.preferences?.default_pickup_location ?? '',
    digital_receipts: data.patron.preferences?.digital_receipts ?? true,
    marketing_opt_out: data.patron.preferences?.marketing_opt_out ?? true,
    notice_lead_time_days: data.patron.preferences?.notice_lead_time_days ?? 3,
    checkout_history_opt_in: data.patron.preferences?.checkout_history_opt_in ?? false,
  });

  let pin = $state('');
  let pinConfirm = $state('');
  let password = $state('');
  let passwordConfirm = $state('');
</script>

<div class="page">
  <header class="header">
    <div>
      <p class="eyebrow">Account settings</p>
      <h1>Profile & Preferences</h1>
      <p class="muted">Update contact information, communication choices, and credentials.</p>
    </div>
  </header>

  <section class="grid two-col">
    <form method="post" action="?/contact" class="card form">
      <h2>Contact information</h2>
      <label>
        Email
        <input name="email" type="email" bind:value={contact.email} />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" bind:value={contact.phone} />
      </label>
      <label>
        Address line 1
        <input name="address1" bind:value={contact.address1} />
      </label>
      <label>
        Address line 2
        <input name="address2" bind:value={contact.address2} />
      </label>
      <div class="grid two-col">
        <label>
          City
          <input name="city" bind:value={contact.city} />
        </label>
        <label>
          State/Province
          <input name="state" bind:value={contact.state} />
        </label>
      </div>
      <label>
        Postal code
        <input name="postal" bind:value={contact.postal} />
      </label>
      <button class="btn primary" type="submit">Save contact info</button>
    </form>

    <form method="post" action="?/preferences" class="card form">
      <h2>Communication & privacy</h2>
      <label class="checkbox">
        <input type="checkbox" name="email_opt_in" checked={prefs.email_opt_in} />
        Email notices
      </label>
      <label class="checkbox">
        <input type="checkbox" name="sms_opt_in" checked={prefs.sms_opt_in} />
        SMS notices
      </label>
      <label>
        SMS number
        <input name="sms_number" bind:value={prefs.sms_number} />
      </label>
      <label>
        Default pickup location
        <input name="pickup" bind:value={prefs.default_pickup_location} />
      </label>
      <label class="checkbox">
        <input type="checkbox" name="digital_receipts" checked={prefs.digital_receipts} />
        Digital receipts
      </label>
      <label class="checkbox">
        <input type="checkbox" name="marketing_opt_out" checked={prefs.marketing_opt_out} />
        Opt out of marketing
      </label>
      <label>
        Notice lead time (days)
        <input name="notice_lead_time_days" type="number" min="0" bind:value={prefs.notice_lead_time_days} />
      </label>
      <label class="checkbox">
        <input type="checkbox" name="checkout_history_opt_in" checked={prefs.checkout_history_opt_in} />
        Store checkout history
      </label>
      <button class="btn primary" type="submit">Save preferences</button>
    </form>
  </section>

  <section class="grid two-col">
    <form method="post" action="?/pin" class="card form">
      <h2>Change PIN (card login)</h2>
      <label>
        New PIN
        <input name="pin" type="password" bind:value={pin} required />
      </label>
      <label>
        Confirm PIN
        <input name="confirm" type="password" bind:value={pinConfirm} required />
      </label>
      <button class="btn secondary" type="submit">Update PIN</button>
    </form>

    <form method="post" action="?/password" class="card form">
      <h2>Change password</h2>
      <label>
        New password
        <input name="password" type="password" bind:value={password} required />
      </label>
      <label>
        Confirm password
        <input name="confirm" type="password" bind:value={passwordConfirm} required />
      </label>
      <button class="btn secondary" type="submit">Update password</button>
    </form>
  </section>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    color: #e73b42;
    margin: 0 0 0.25rem 0;
  }

  .muted {
    color: #6b7280;
    margin: 0.25rem 0;
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  .two-col {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }

  .card {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    padding: 1rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 600;
  }

  .checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  input {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0.65rem;
  }

  .btn {
    border: 1px solid #e5e7eb;
    padding: 0.65rem 0.9rem;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-weight: 700;
  }

  .btn.primary {
    background: #e73b42;
    color: #fff;
    border-color: #e73b42;
  }

  .btn.secondary {
    background: #f9fafb;
  }
</style>
