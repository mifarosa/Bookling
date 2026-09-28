<script>
  import { onMount } from 'svelte';
  import { ensureSeedData } from './lib/db.js';
  import { route } from './lib/router.svelte.js';
  import Library from './routes/Library.svelte';
  import Import from './routes/Import.svelte';
  import Reader from './routes/Reader.svelte';
  import Terms from './routes/Terms.svelte';
  import Stats from './routes/Stats.svelte';
  import Settings from './routes/Settings.svelte';

  let ready = $state(false);
  let error = $state('');

  onMount(async () => {
    try {
      await ensureSeedData();
      ready = true;
    } catch (e) {
      error = e.message || String(e);
    }
  });

  const section = $derived(route.parts[0] || 'library');

  const nav = [
    { id: 'library', href: '#/', label: 'Library' },
    { id: 'terms', href: '#/terms', label: 'Terms' },
    { id: 'stats', href: '#/stats', label: 'Stats' },
    { id: 'settings', href: '#/settings', label: 'Settings' }
  ];
</script>

{#if section !== 'read'}
  <header>
    <a class="brand" href="#/">📖 Bookling</a>
    <nav>
      {#each nav as item}
        <a href={item.href} class:active={section === item.id}>{item.label}</a>
      {/each}
    </nav>
  </header>
{/if}

<main>
  {#if error}
    <p class="page error">Could not open the local database: {error}</p>
  {:else if !ready}
    <p class="page muted">Loading…</p>
  {:else if section === 'read'}
    {#key route.parts[1]}
      <Reader bookId={Number(route.parts[1])} />
    {/key}
  {:else if section === 'import'}
    <Import />
  {:else if section === 'terms'}
    <Terms />
  {:else if section === 'stats'}
    <Stats />
  {:else if section === 'settings'}
    <Settings />
  {:else}
    <Library />
  {/if}
</main>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.6rem 1rem;
    padding-top: max(0.6rem, env(safe-area-inset-top));
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 700;
    text-decoration: none;
    color: var(--text);
  }
  nav {
    display: flex;
    gap: 0.25rem;
    overflow-x: auto;
  }
  nav a {
    text-decoration: none;
    color: var(--muted);
    padding: 0.35rem 0.6rem;
    border-radius: 8px;
    white-space: nowrap;
  }
  nav a.active {
    color: var(--text);
    background: var(--bg);
  }
</style>
