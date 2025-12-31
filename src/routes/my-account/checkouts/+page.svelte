<script lang="ts">
  import BookCover from '$lib/components/BookCover.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const checkouts = data.checkouts as any[];

  let message = $state('');

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const info = params.get('message');
    if (info === 'renewed') message = 'Item renewed successfully';
    if (info === 'renewed_all') message = 'Eligible items were renewed';
  }

  function daysUntil(dateString: string) {
    const due = new Date(dateString);
    return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function printList() {
    window.print();
  }
</script>

<div class="page">
  <header class="header">
    <div>
      <p class="eyebrow">Current loans</p>
      <h1>Checkouts</h1>
      <p class="muted">Renew eligible items, download your list, and watch due dates.</p>
    </div>
    <div class="actions">
      <form method="post" action="?/renew_all">
        <button type="submit" class="btn secondary">Renew all</button>
      </form>
      <button class="btn ghost" onclick={printList}>Download (print/PDF)</button>
    </div>
  </header>

  {#if message}
    <div class="toast success">{message}</div>
  {/if}

  <p class="muted small">
    Renewal limit: {data.patronType.max_renewals} · Loan period: {data.patronType.default_loan_period_days} days
  </p>

  {#if checkouts.length === 0}
    <div class="card">
      <p class="muted">No active checkouts. Visit the catalog to borrow an item.</p>
      <a class="btn primary" href="/catalog">Browse catalog</a>
    </div>
  {:else}
    <div class="checkout-grid">
      {#each checkouts as checkout}
        <article class="card checkout">
          <BookCover
            recordId={checkout.item.marc_record?.id}
            title={checkout.item.marc_record?.title_statement?.a}
            author={checkout.item.marc_record?.main_entry_personal_name?.a}
            size="medium"
          />
          <div class="meta">
            <h2>
              <a href={`/catalog/record/${checkout.item.marc_record?.id ?? checkout.item.id}`}>
                {checkout.item.marc_record?.title_statement?.a ?? 'Untitled'}
              </a>
            </h2>
            <p class="muted">
              {checkout.item.marc_record?.main_entry_personal_name?.a ?? 'Unknown'}
            </p>
            <p class="muted">Barcode: {checkout.item.barcode}</p>
            <div class="tags">
              <span class="pill">Due {new Date(checkout.due_date).toLocaleDateString()}</span>
              <span class="pill subtle">Renewals {checkout.renewal_count}/{data.patronType.max_renewals}</span>
              {#if daysUntil(checkout.due_date) <= 3 && checkout.status !== 'overdue'}
                <span class="pill warn">Due soon</span>
              {/if}
              {#if checkout.status === 'overdue'}
                <span class="pill danger">Overdue</span>
              {/if}
            </div>
          </div>
          <form method="post" action="?/renew">
            <input type="hidden" name="checkoutId" value={checkout.id} />
            <button
              type="submit"
              class="btn primary"
              disabled={checkout.renewal_count >= data.patronType.max_renewals || checkout.status === 'overdue'}
            >
              {checkout.renewal_count >= data.patronType.max_renewals ? 'Maxed out' : 'Renew'}
            </button>
          </form>
        </article>
      {/each}
    </div>
  {/if}
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
    align-items: flex-start;
    gap: 1rem;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    color: #e73b42;
    margin: 0 0 0.25rem 0;
  }

  h1 {
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    border: 1px solid #e5e7eb;
    padding: 0.65rem 1rem;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-weight: 600;
  }

  .btn.primary {
    background: #e73b42;
    color: #fff;
    border-color: #e73b42;
  }

  .btn.secondary {
    background: #fff;
  }

  .btn.ghost {
    background: #f9fafb;
  }

  .muted {
    color: #6b7280;
    margin: 0.25rem 0;
  }

  .small {
    font-size: 0.9rem;
  }

  .card {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #f0f0f0;
    padding: 1rem;
  }

  .checkout-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkout {
    display: grid;
    grid-template-columns: 120px 1fr 150px;
    gap: 1rem;
    align-items: center;
  }

  .meta h2 {
    margin: 0;
  }

  .meta a {
    text-decoration: none;
    color: #1f2933;
  }

  .meta a:hover {
    color: #e73b42;
  }

  .tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }

  .pill {
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    background: #eef2ff;
    color: #3730a3;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .pill.subtle {
    background: #f9fafb;
    color: #4b5563;
  }

  .pill.warn {
    background: #fff7ed;
    color: #c05621;
  }

  .pill.danger {
    background: #fff5f5;
    color: #e73b42;
  }

  .toast {
    border-radius: 8px;
    padding: 0.85rem 1rem;
    font-weight: 600;
  }

  .toast.success {
    background: #e6f4ea;
    border: 1px solid #c4eed2;
    color: #15803d;
  }

  @media (max-width: 900px) {
    .checkout {
      grid-template-columns: 100px 1fr;
      grid-template-rows: auto auto;
    }

    .checkout form {
      grid-column: span 2;
      justify-self: flex-start;
    }
  }
</style>
