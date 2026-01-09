<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const holds = data.holds as any[];
</script>

<div class="page">
  <header class="header">
    <div>
      <p class="eyebrow">Queue management</p>
      <h1>Holds</h1>
      <p class="muted">Track your spot in line, change pickup locations, and pause during vacations.</p>
    </div>
    <a class="btn primary" href="/catalog/search">Place new hold</a>
  </header>

  {#if holds.length === 0}
    <div class="card">
      <p class="muted">No active holds.</p>
    </div>
  {:else}
    <div class="holds">
      {#each holds as hold}
        <article class="card hold">
          <div class="info">
            <p class="title">{hold.marc_record?.title_statement?.a ?? 'Untitled'}</p>
            <p class="muted">{hold.marc_record?.main_entry_personal_name?.a ?? 'Unknown author'}</p>
            <div class="tags">
              <span class="pill">Status: {hold.status.replace('_', ' ')}</span>
              {#if hold.queue_position}
                <span class="pill subtle">Queue #{hold.queue_position}</span>
              {/if}
              <span class="pill subtle">{hold.pickup_location ?? 'Pickup desk'}</span>
              {#if hold.suspended_until}
                <span class="pill warn">Suspended until {new Date(hold.suspended_until).toLocaleDateString()}</span>
              {/if}
            </div>
          </div>
          <div class="actions">
            {#if hold.status !== 'picked_up'}
              <form method="post" action="?/cancel">
                <input type="hidden" name="holdId" value={hold.id} />
                <button type="submit" class="btn ghost">Cancel</button>
              </form>
            {/if}
            {#if hold.status !== 'suspended'}
              <form method="post" action="?/suspend">
                <input type="hidden" name="holdId" value={hold.id} />
                <label class="muted small">
                  Suspend until
                  <input type="date" name="until" />
                </label>
                <button class="btn secondary" type="submit">Suspend</button>
              </form>
            {:else}
              <form method="post" action="?/resume">
                <input type="hidden" name="holdId" value={hold.id} />
                <button class="btn secondary" type="submit">Resume</button>
              </form>
            {/if}

            <form method="post" action="?/notifications" class="notification-form">
              <input type="hidden" name="holdId" value={hold.id} />
              <label><input type="checkbox" name="email" checked={hold.notification_channels?.includes('email')} /> Email</label>
              <label><input type="checkbox" name="sms" checked={hold.notification_channels?.includes('sms')} /> SMS</label>
              <button class="btn ghost" type="submit">Save alerts</button>
            </form>
          </div>
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

  .btn {
    border: 1px solid #e5e7eb;
    padding: 0.6rem 0.9rem;
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

  .holds {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .card {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    padding: 1rem;
  }

  .hold {
    display: grid;
    grid-template-columns: 1fr 260px;
    gap: 1rem;
  }

  .title {
    margin: 0;
    font-weight: 700;
    color: #1f2933;
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
    font-weight: 700;
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

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .notification-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .small {
    font-size: 0.9rem;
  }

  @media (max-width: 900px) {
    .hold {
      grid-template-columns: 1fr;
    }
  }
</style>
