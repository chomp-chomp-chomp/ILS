<script lang="ts">
  import BookCover from '$lib/components/BookCover.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let notifications = $state<any[]>(data.notifications || []);
  let checkouts = $state<any[]>(data.checkouts as any[]);
  let holds = $state<any[]>(data.holds as any[]);

  function formatDate(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  }

  function daysUntil(dateString?: string | null) {
    if (!dateString) return null;
    const due = new Date(dateString);
    const diff = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function urgencyLabel(checkout: (typeof checkouts)[number]) {
    if (checkout.status === 'overdue') return 'Overdue';
    const days = daysUntil(checkout.due_date);
    if (days !== null && days <= 3) return 'Due soon';
    return 'On time';
  }
</script>

<div class="page">
  <header class="hero">
    <div>
      <p class="eyebrow">Welcome back</p>
      <h1>{data.patron.first_name} {data.patron.last_name}</h1>
      <p class="lede">
        Manage your checkouts, holds, saved searches, and notifications in one place.
      </p>
      <div class="badge-row">
        <span class="badge">Library Card #{data.patron.barcode}</span>
        {#if data.patron.expiration_date}
          <span class="badge subtle">
            Expires {formatDate(data.patron.expiration_date)}
          </span>
        {/if}
        {#if data.patron.status !== 'active'}
          <span class="badge warning">Status: {data.patron.status}</span>
        {/if}
      </div>
    </div>
    <div class="quick-actions">
      <a class="btn primary" href="/catalog">Search Catalog</a>
      <a class="btn ghost" href="/my-account/settings">Update Settings</a>
    </div>
  </header>

  <section class="grid stats">
    <div class="card stat">
      <p class="label">Items checked out</p>
      <p class="value">{data.stats.checkouts}</p>
    </div>
    <div class="card stat">
      <p class="label">Overdue</p>
      <p class="value warning">{data.stats.overdue}</p>
    </div>
    <div class="card stat">
      <p class="label">Holds</p>
      <p class="value">{data.stats.holds}</p>
    </div>
    <div class="card stat">
      <p class="label">Fines/Fees</p>
      <p class="value accent">${data.stats.fines.toFixed(2)}</p>
    </div>
  </section>

  <section class="grid two-col">
    <div class="card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Current checkouts</p>
          <h2>Due soon</h2>
        </div>
        <a class="text-link" href="/my-account/checkouts">View all</a>
      </div>
      {#if checkouts.length === 0}
        <p class="muted">No items checked out. Find something new to read!</p>
      {:else}
        <div class="checkout-list">
          {#each checkouts.slice(0, 4) as checkout}
            <article class="checkout">
              <BookCover
                recordId={checkout.item.marc_record?.id}
                title={checkout.item.marc_record?.title_statement?.a}
                author={checkout.item.marc_record?.main_entry_personal_name?.a}
                size="small"
              />
              <div class="checkout-meta">
                <h3>
                  <a href={`/catalog/record/${checkout.item.marc_record?.id ?? checkout.item.id}`}>
                    {checkout.item.marc_record?.title_statement?.a ?? 'Untitled'}
                  </a>
                </h3>
                {#if checkout.item.marc_record?.main_entry_personal_name?.a}
                  <p class="muted">{checkout.item.marc_record.main_entry_personal_name.a}</p>
                {/if}
                <p class="due">
                  Due {formatDate(checkout.due_date)}
                  <span class="pill {checkout.status === 'overdue' ? 'overdue' : ''}">
                    {urgencyLabel(checkout)}
                  </span>
                </p>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>

    <div class="card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Notifications</p>
          <h2>Latest updates</h2>
        </div>
        <a class="text-link" href="/my-account/settings">Preferences</a>
      </div>
      {#if notifications.length === 0}
        <p class="muted">No notifications yet. We will let you know when something needs attention.</p>
      {:else}
        <ul class="notice-list">
          {#each notifications as notice}
            <li>
              <p class="label">{notice.type}</p>
              <p class="muted">{notice.title ?? 'Account update'}</p>
              {#if notice.message}
                <p class="message">{notice.message}</p>
              {/if}
              <p class="time">{new Date(notice.created_at).toLocaleString()}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>

  <section class="grid two-col">
    <div class="card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Holds</p>
          <h2>Ready & queued</h2>
        </div>
        <a class="text-link" href="/my-account/holds">Manage holds</a>
      </div>
      {#if holds.length === 0}
        <p class="muted">You have no holds placed. Place a hold from search results.</p>
      {:else}
        <div class="holds">
          {#each holds.slice(0, 3) as hold}
            <div class="hold">
              <div>
                <p class="label">{hold.marc_record?.title_statement?.a ?? 'Untitled'}</p>
                <p class="muted">
                  {hold.status.replace('_', ' ')} · Queue #{hold.queue_position ?? '—'}
                </p>
              </div>
              <span class="pill">{hold.pickup_location ?? 'Pickup desk'}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Reading lists</p>
          <h2>Your lists</h2>
        </div>
        <a class="text-link" href="/catalog/my-lists">Open lists</a>
      </div>
      {#if data.readingLists.length === 0}
        <p class="muted">Create a list to track items you love or want to borrow later.</p>
      {:else}
        <ul class="list-list">
          {#each data.readingLists as list}
            <li>
              <div>
                <p class="label">{list.name}</p>
                <p class="muted">Created {formatDate(list.created_at)}</p>
              </div>
              <span class="pill {list.is_public ? 'success' : ''}">{list.is_public ? 'Public' : 'Private'}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .hero {
    background: #fff;
    border-radius: 12px;
    padding: 1.75rem;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid #f0f0f0;
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
    color: #1f2933;
  }

  .lede {
    color: #5f6c72;
    margin: 0.35rem 0 0.75rem 0;
  }

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .badge {
    background: #fff5f5;
    color: #e73b42;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #f4d3d6;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .badge.subtle {
    color: #6b7280;
    border-color: #e5e7eb;
    background: #f9fafb;
  }

  .badge.warning {
    background: #fff4e5;
    color: #c05621;
    border-color: #fbd38d;
  }

  .quick-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .btn {
    text-decoration: none;
    border-radius: 8px;
    padding: 0.75rem 1.1rem;
    font-weight: 600;
    border: 1px solid transparent;
    color: #1f2933;
    background: #fff;
  }

  .btn.primary {
    background: #e73b42;
    color: #fff;
    border-color: #e73b42;
  }

  .btn.ghost {
    border-color: #e5e7eb;
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  .stats {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .two-col {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }

  .card {
    background: #fff;
    border-radius: 12px;
    padding: 1.25rem;
    border: 1px solid #f0f0f0;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .label {
    margin: 0;
    color: #6b7280;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .value {
    font-size: 2rem;
    margin: 0;
    font-weight: 700;
  }

  .value.warning {
    color: #f97316;
  }

  .value.accent {
    color: #e73b42;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  h2 {
    margin: 0;
    color: #1f2933;
  }

  .text-link {
    color: #e73b42;
    text-decoration: none;
    font-weight: 600;
  }

  .checkout-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .checkout {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 0.75rem;
    align-items: center;
  }

  .checkout-meta h3 {
    margin: 0;
    font-size: 1rem;
  }

  .checkout-meta a {
    text-decoration: none;
    color: #1f2933;
  }

  .checkout-meta a:hover {
    color: #e73b42;
  }

  .muted {
    margin: 0.25rem 0;
    color: #6b7280;
  }

  .due {
    margin: 0.35rem 0;
    color: #1f2933;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .pill {
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    background: #eef2ff;
    color: #3730a3;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .pill.overdue {
    background: #fff5f5;
    color: #e73b42;
  }

  .pill.success {
    background: #e6f4ea;
    color: #15803d;
  }

  .notice-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .notice-list li {
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
  }

  .notice-list .message {
    margin: 0.35rem 0;
    color: #374151;
  }

  .notice-list .time {
    margin: 0;
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .holds,
  .list-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-top: 1rem;
  }

  .hold,
  .list-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid #f0f0f0;
    border-radius: 10px;
  }

  .message {
    color: #374151;
    margin: 0.35rem 0;
  }

  @media (max-width: 768px) {
    .hero {
      flex-direction: column;
    }
    .checkout {
      grid-template-columns: 60px 1fr;
    }
  }
</style>
