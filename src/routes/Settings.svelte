<script>
  import { onMount } from 'svelte';
  import { db } from '../lib/db.js';

  let languages = $state([]);
  let persisted = $state(null);
  let usage = $state('');
  let saved = $state('');
  let error = $state('');

  onMount(async () => {
    await load();
    try {
      persisted = await navigator.storage?.persisted?.();
      const est = await navigator.storage?.estimate?.();
      if (est?.usage != null) usage = (est.usage / 1024 / 1024).toFixed(1) + ' MB';
    } catch {
      // Storage API unavailable.
    }
  });

  async function load() {
    languages = await db.languages.orderBy('name').toArray();
  }

  async function saveLanguage(lang) {
    error = '';
    try {
      const row = $state.snapshot(lang);
      row.name = row.name.trim();
      row.code = row.code.trim();
      row.translateTo = row.translateTo.trim();
      if (!row.name) throw new Error('Language name is required.');
      if (row.code && !isValidLocale(row.code)) throw new Error(`"${row.code}" is not a valid language code.`);
      if (row.id) await db.languages.put(row);
      else lang.id = await db.languages.add(row);
      saved = row.name;
      setTimeout(() => (saved = ''), 2000);
    } catch (e) {
      error = e.message || String(e);
    }
  }

  function isValidLocale(code) {
    try {
      return Intl.getCanonicalLocales(code).length === 1;
    } catch {
      return false;
    }
  }

  async function removeLanguage(lang) {
    if (!lang.id) {
      languages = languages.filter((l) => l !== lang);
      return;
    }
    const books = await db.books.where('languageId').equals(lang.id).count();
    const terms = await db.terms.where('languageId').equals(lang.id).count();
    if (books || terms) {
      error = `${lang.name} still has ${books} books and ${terms} terms; delete them first.`;
      return;
    }
    await db.languages.delete(lang.id);
    await load();
  }

  function addLanguage() {
    languages.push({ name: '', code: '', translateTo: 'tr', rightToLeft: false });
  }

  async function askPersist() {
    persisted = await navigator.storage?.persist?.();
  }
</script>

<div class="page">
  <h1>Settings</h1>

  <section class="card storage">
    <h2>Storage</h2>
    <p class="muted">
      Everything lives on this device only. Export your terms from the Terms page to back them up.
    </p>
    <p>
      Used: {usage || 'unknown'} ·
      {#if persisted}
        Persistent storage granted ✓
      {:else}
        Storage may be cleared by the browser.
        <button onclick={askPersist}>Keep my data</button>
      {/if}
    </p>
  </section>

  <h2>Languages</h2>
  <p class="muted small">
    "Translate to" is the language tapping a word translates into automatically — a free machine
    translation shown right in the reader, with a couple of alternatives to choose from.
  </p>
  {#if error}<p class="error">{error}</p>{/if}

  {#each languages as lang, li (lang.id ?? 'new-' + li)}
    <section class="card lang">
      <div class="row">
        <label>Name <input bind:value={lang.name} placeholder="e.g. French" /></label>
        <label>Code <input bind:value={lang.code} placeholder="e.g. fr" size="6" /></label>
        <label>Translate to <input bind:value={lang.translateTo} placeholder="e.g. tr" size="6" /></label>
        <label class="inline"><input type="checkbox" bind:checked={lang.rightToLeft} /> Right-to-left</label>
      </div>

      <div class="row">
        <span class="spacer"></span>
        <button class="danger" onclick={() => removeLanguage(lang)}>Delete</button>
        <button class="primary" onclick={() => saveLanguage(lang)}>
          {saved && saved === lang.name.trim() ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </section>
  {/each}

  <button onclick={addLanguage}>+ Add language</button>
</div>

<style>
  .lang,
  .storage {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .storage h2,
  .storage p {
    margin: 0;
  }
  .spacer {
    flex: 1;
  }
  .small {
    font-size: 0.85rem;
  }
</style>
