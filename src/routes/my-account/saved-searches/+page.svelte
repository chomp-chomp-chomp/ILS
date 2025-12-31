<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let name = $state('');
  let query = $state('');
  let alert = $state(true);
  let frequency = $state('weekly');
</script>

<div class="page">
  <header class="header">
    <div>
      <p class="eyebrow">Keep tabs on new items</p>
      <h1>Saved Searches</h1>
      <p class="muted">Save frequent searches and receive alerts when new items match.</p>
    </div>
  </header>

  <section class="card form">
    <h2>Create search</h2>
    <form method="post" action="?/create" class="form-grid">
      <label>
        Name
        <input name="name" bind:value={name} required />
      </label>
      <label>
        Query
        <input name="query" bind:value={query} required placeholder="title: dogs AND author: carl" />
      </label>
      <label class="checkbox">
        <input type="checkbox" name="alert" checked={alert} />
        Email alerts
      </label>
      <label>
        Frequency
        <select name="frequency" bind:value={frequency}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      <button class="btn primary" type="submit">Save search</button>
    </form>
  </section>

  <section class="card">
    <div class="section-header">
      <h2>Saved searches</h2>
    </div>
    {#if data.searches.length === 0}
      <p class="muted">No saved searches yet.</p>
    {:else}
      <ul class="list">
        {#each data.searches as search}
          <li class="item">
            <div>
              <p class="title">{search.name}</p>
              <p class="muted">
                Last run: {search.last_run_at ? new Date(search.last_run_at).toLocaleString() : 'Never'}
                · Alerts: {search.send_email_alerts ? search.alert_frequency : 'Off'}
              </p>
              <a class="text-link" href={`/catalog/search?q=${encodeURIComponent(search.query?.q ?? '')}`}>
                Run search
              </a>
            </div>
            <div class="controls">
              <form method="post" action="?/update" class="inline-form">
                <input type="hidden" name="id" value={search.id} />
                <input type="hidden" name="name" value={search.name} />
                <input type="hidden" name="query" value={search.query?.q ?? ''} />
                <label class="checkbox">
                  <input type="checkbox" name="alert" checked={search.send_email_alerts} />
                  Email
                </label>
                <select name="frequency" value={search.alert_frequency}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button class="btn secondary" type="submit">Update</button>
              </form>
              <form method="post" action="?/delete">
                <input type="hidden" name="id" value={search.id} />
                <button class="btn ghost" type="submit">Delete</button>
              </form>
            </div>
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

  .card {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    padding: 1rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
    align-items: end;
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
    padding: 0.6rem;
  }

  .checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
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

  .btn.ghost {
    background: #fff;
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .item {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem;
    border: 1px solid #f4f4f5;
    border-radius: 10px;
    align-items: center;
  }

  .title {
    margin: 0;
    font-weight: 700;
    color: #1f2933;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .inline-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .text-link {
    color: #e73b42;
    text-decoration: none;
    font-weight: 700;
  }

  @media (max-width: 900px) {
    .item {
      flex-direction: column;
      align-items: flex-start;
    }

    .controls {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
