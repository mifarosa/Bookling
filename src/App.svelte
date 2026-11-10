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

  // "Import" lives under the Library tab, so keep that tab highlighted there.
  const activeTab = $derived(section === 'import' ? 'library' : section);

  const nav = [
    { id: 'library', href: '#/', label: 'Kitaplık', icon: '📚' },
    { id: 'terms', href: '#/terms', label: 'Kelimeler', icon: '🔤' },
    { id: 'stats', href: '#/stats', label: 'İstatistik', icon: '📊' },
    { id: 'settings', href: '#/settings', label: 'Ayarlar', icon: '⚙️' }
  ];
</script>

{#if section !== 'read'}
  <header>
    <a class="brand" href="#/">📖 Bookling</a>
    <nav aria-label="Ana menü">
      {#each nav as item}
        <a
          href={item.href}
          class:active={activeTab === item.id}
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <span class="icon" aria-hidden="true">{item.icon}</span>
          <span class="label">{item.label}</span>
        </a>
      {/each}
    </nav>
    <a
      class="coffee"
      href="https://www.buymeacoffee.com/mifarosa"
      target="_blank"
      rel="noopener"
      aria-label="Bana bir kahve ısmarla"
    >
      ☕ <span class="coffee-text">Kahve ısmarla</span>
    </a>
  </header>
{/if}

<main class:with-nav={section !== 'read'}>
  {#if error}
    <p class="page error">Yerel veritabanı açılamadı: {error}</p>
  {:else if !ready}
    <p class="page muted" role="status">Yükleniyor…</p>
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
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    padding-top: max(0.5rem, env(safe-area-inset-top));
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 700;
    font-size: 1.05rem;
    text-decoration: none;
    color: var(--text);
    white-space: nowrap;
  }
  nav {
    display: flex;
    gap: 0.25rem;
    margin-right: auto;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    text-decoration: none;
    color: var(--muted);
    padding: 0.45rem 0.75rem;
    border-radius: 10px;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
  }
  nav a:hover {
    color: var(--text);
  }
  nav a.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    font-weight: 600;
  }
  .coffee {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    padding: 0.4rem 0.7rem;
    border-radius: 10px;
    color: #3d2b00;
    background: #ffdd57;
    border: 1px solid #e8c547;
    transition: filter 0.15s ease;
  }
  .coffee:hover {
    filter: brightness(1.05);
  }

  /* Phones: the menu becomes a bottom tab bar, within thumb's reach. */
  @media (max-width: 639px) {
    .coffee-text {
      display: none;
    }
    nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 15;
      margin: 0;
      gap: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom);
    }
    nav a {
      flex: 1;
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.5rem 0.25rem;
      border-radius: 0;
      font-size: 0.72rem;
      background: transparent;
    }
    nav a.active {
      background: transparent;
    }
    nav a .icon {
      font-size: 1.3rem;
      line-height: 1.2;
    }
  }

  main.with-nav {
    min-height: calc(100dvh - 3.2rem);
  }
  @media (max-width: 639px) {
    main.with-nav {
      /* room for the fixed bottom tab bar */
      padding-bottom: calc(4.2rem + env(safe-area-inset-bottom));
    }
  }
</style>
