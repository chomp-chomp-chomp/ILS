<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let amount = $state('');
  let selectedFine = $state<string | null>(null);
</script>

<div class="page">
  <header class="header">
    <div>
      <p class="eyebrow">Fees & Balances</p>
      <h1>Fines</h1>
      <p class="muted">See itemized charges, review payment history, and pay online.</p>
    </div>
    <div class="badge">Total Balance: ${data.totalBalance.toFixed(2)}</div>
  </header>

  <section class="grid two-col">
    <div class="card">
      <div class="section-header">
        <h2>Outstanding fines</h2>
      </div>
      {#if data.fines.length === 0}
        <p class="muted">No fines at this time.</p>
      {:else}
        <ul class="list">
          {#each data.fines as fine}
            <li class="item">
              <div>
                <p class="title">{fine.reason}</p>
                <p class="muted">
                  {new Date(fine.fine_date).toLocaleDateString()} · Status: {fine.status}
                </p>
              </div>
              <div class="amount">${Number(fine.balance ?? fine.amount).toFixed(2)}</div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="card">
      <div class="section-header">
        <h2>Make a payment</h2>
      </div>
      <form method="post" action="?/pay" class="form">
        <label>
          Apply to fine (optional)
          <select bind:value={selectedFine}>
            <option value="">Any</option>
            {#each data.fines as fine}
              <option value={fine.id}>{fine.reason} (${Number(fine.balance ?? fine.amount).toFixed(2)})</option>
            {/each}
          </select>
        </label>
        <label>
          Amount
          <input type="number" min="0" step="0.01" name="amount" bind:value={amount} required />
        </label>
        <label>
          Method
          <select name="method">
            <option value="online">Online</option>
            <option value="cash">Cash at desk</option>
          </select>
        </label>
        <input type="hidden" name="fineId" value={selectedFine ?? ''} />
        <button type="submit" class="btn primary">Submit payment</button>
        <p class="muted small">Payments are recorded and routed to the configured provider.</p>
      </form>
    </div>
  </section>

  <section class="card">
    <div class="section-header">
      <h2>Payment history</h2>
    </div>
    {#if data.payments.length === 0}
      <p class="muted">No payments recorded.</p>
    {:else}
      <ul class="list">
        {#each data.payments as payment}
          <li class="item">
            <div>
              <p class="title">Payment {payment.id.slice(0, 8)}</p>
              <p class="muted">
                {payment.method} · {new Date(payment.created_at).toLocaleString()} · {payment.status}
              </p>
            </div>
            <div class="amount">${Number(payment.amount).toFixed(2)}</div>
          </li>
        {/each}
      </ul>
    {/if}
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

  .badge {
    background: #fff5f5;
    color: #e73b42;
    border: 1px solid #f4d3d6;
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    font-weight: 700;
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

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    border: 1px solid #f4f4f5;
    border-radius: 10px;
  }

  .title {
    margin: 0;
    font-weight: 700;
    color: #1f2933;
  }

  .amount {
    font-weight: 700;
    color: #e73b42;
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

  input,
  select {
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

  .small {
    font-size: 0.9rem;
  }
</style>
