<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const history = data.history as any[];

  let search = $state('');
  let start = $state('');
  let end = $state('');
  let material = $state('');

  function exportCsv() {
    const rows = history.map((entry) => ({
      Title: entry.marcRecord?.title_statement?.a ?? 'Untitled',
      Author: entry.marcRecord?.main_entry_personal_name?.a ?? '',
      Action: entry.action,
      Date: new Date(entry.action_date).toISOString(),
      Barcode: entry.item?.barcode ?? '',
    }));

    const header = Object.keys(rows[0] ?? { Title: '', Author: '', Action: '', Date: '', Barcode: '' });
    const csv = [header.join(','), ...rows.map((r) => header.map((h) => `"${(r as any)[h]}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'checkout-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="page">
  <header class="header">
    <div>
      <p class="eyebrow">Privacy-aware</p>
      <h1>Checkout History</h1>
      <p class="muted">Opt-in to keep a history of items you borrow. Export or clear whenever you like.</p>
    </div>
    <form method="post" action="?/toggle_opt_in">
      <button type="submit" class="btn primary">
        {data.optedIn ? 'Disable history' : 'Enable history'}
      </button>
    </form>
  </header>

  {#if !data.optedIn}
    <div class="card">
      <p class="muted">
        History tracking is disabled. Enable it to see past checkouts, filter by date or material,
        and export to CSV.
      </p>
    </div>
  {:else}
    <section class="filters">
      <label>
        Search
        <input type="text" bind:value={search} placeholder="Title or author" />
      </label>
      <label>
        Start date
        <input type="date" bind:value={start} />
      </label>
      <label>
        End date
        <input type="date" bind:value={end} />
      </label>
      <label>
        Material
        <select bind:value={material}>
          <option value="">Any</option>
          <option value="book">Book</option>
          <option value="ebook">eBook</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select>
      </label>
      <button
        class="btn secondary"
        onclick={(e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (search) params.set('search', search);
          if (start) params.set('start', start);
          if (end) params.set('end', end);
          if (material) params.set('material', material);
          window.location.search = params.toString();
        }}
      >
        Apply
      </button>
      <button class="btn ghost" type="button" onclick={exportCsv}>Export CSV</button>
      <form method="post" action="?/clear_history">
        <button class="btn danger" type="submit">Clear history</button>
      </form>
    </section>

    {#if history.length === 0}
      <div class="card">
        <p class="muted">No history yet.</p>
      </div>
    {:else}
      <div class="history-list">
        {#each history as entry}
          <article class="card entry">
            <div>
              <p class="title">{entry.marcRecord?.title_statement?.a ?? 'Untitled'}</p>
              <p class="muted">{entry.marcRecord?.main_entry_personal_name?.a ?? 'Unknown author'}</p>
              <p class="muted small">Barcode: {entry.item?.barcode ?? '—'}</p>
            </div>
            <div class="meta">
              <span class="pill">{entry.action}</span>
              <p class="muted">{new Date(entry.action_date).toLocaleString()}</p>
            </div>
          </article>
        {/each}
      </div>
    {/if}
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

  .muted {
    color: #6b7280;
    margin: 0.2rem 0;
  }

  .card {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    padding: 1rem;
  }

  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
    align-items: end;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 600;
    color: #374151;
  }

  input,
  select {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0.6rem;
  }

  .btn {
    border: 1px solid #e5e7eb;
    padding: 0.65rem 0.9rem;
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

  .btn.danger {
    background: #fff5f5;
    color: #e73b42;
    border-color: #f4c7c7;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .entry {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .title {
    margin: 0;
    font-weight: 700;
  }

  .small {
    font-size: 0.9rem;
  }

  .meta {
    text-align: right;
  }

  .pill {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: #eef2ff;
    color: #3730a3;
    font-weight: 700;
    display: inline-block;
    margin-bottom: 0.25rem;
  }

  @media (max-width: 768px) {
    .entry {
      flex-direction: column;
      align-items: flex-start;
    }
    .meta {
      text-align: left;
    }
  }
</style>
