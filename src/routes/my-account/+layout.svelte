<script lang="ts">
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import type { LayoutData } from './$types';

  let { data }: { data: LayoutData } = $props();

  const navLinks = [
    { href: '/my-account', label: 'Dashboard' },
    { href: '/my-account/checkouts', label: 'Checkouts' },
    { href: '/my-account/history', label: 'History' },
    { href: '/my-account/holds', label: 'Holds' },
    { href: '/my-account/fines', label: 'Fines & Fees' },
    { href: '/my-account/saved-searches', label: 'Saved Searches' },
    { href: '/my-account/settings', label: 'Settings' },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/my-account/login';
  }
  const isAuthPage = data.isAuthPage;
</script>

{#if isAuthPage}
  <slot />
{:else}
  <div class="account-shell">
    <aside class="sidebar">
      <div class="patron-meta">
        <p class="patron-name">{data.patron.first_name} {data.patron.last_name}</p>
        <p class="patron-type">{data.patron.patron_type?.name ?? 'Patron'}</p>
        {#if data.patron.expiration_date}
          <p class="meta-line">Expires {new Date(data.patron.expiration_date).toLocaleDateString()}</p>
        {/if}
      </div>

      <nav>
        {#each navLinks as link}
          <a class:active={$page.url.pathname === link.href} href={link.href}>
            {link.label}
          </a>
        {/each}
      </nav>

      <button class="logout" onclick={handleLogout}>Logout</button>
    </aside>

    <main class="content">
      <slot />
    </main>
  </div>
{/if}

<style>
  .account-shell {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 100vh;
    background: #f5f5f5;
  }

  .sidebar {
    background: #fff;
    border-right: 1px solid #eee;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .patron-meta {
    background: #fdf4f4;
    border: 1px solid #f4d3d6;
    border-radius: 8px;
    padding: 1rem;
  }

  .patron-name {
    margin: 0;
    font-weight: 700;
    color: #2c3e50;
  }

  .patron-type,
  .meta-line {
    margin: 0.25rem 0 0 0;
    color: #666;
    font-size: 0.9rem;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  nav a {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    color: #2c3e50;
    font-weight: 500;
    border: 1px solid transparent;
  }

  nav a:hover,
  nav a.active {
    border-color: #e73b42;
    color: #e73b42;
    background: #fff5f5;
  }

  .logout {
    margin-top: auto;
    border: 1px solid #f1c7c9;
    background: #fff;
    color: #e73b42;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-weight: 600;
  }

  .logout:hover {
    background: #fff0f0;
  }

  .content {
    padding: 2rem;
  }

  @media (max-width: 960px) {
    .account-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: sticky;
      top: 0;
      z-index: 5;
      border-right: none;
      border-bottom: 1px solid #eee;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    nav {
      flex-direction: row;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    nav a {
      padding: 0.5rem 0.75rem;
    }

    .patron-meta {
      width: 100%;
    }
  }
</style>
