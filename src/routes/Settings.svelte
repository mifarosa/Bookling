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
      if (!row.name) throw new Error('Dil adı gerekli.');
      if (row.code && !isValidLocale(row.code)) throw new Error(`"${row.code}" geçerli bir dil kodu değil.`);
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
    if (!confirm(`"${lang.name}" dili silinsin mi?`)) return;
    const books = await db.books.where('languageId').equals(lang.id).count();
    const terms = await db.terms.where('languageId').equals(lang.id).count();
    if (books || terms) {
      error = `${lang.name} dilinde hâlâ ${books} kitap ve ${terms} kelime var; önce onları sil.`;
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
  <h1>Ayarlar</h1>

  <section class="card storage">
    <h2>Depolama</h2>
    <p class="hint">
      Tüm verin yalnızca bu cihazda saklanır. Yedeklemek için Kelimeler sayfasından kelimelerini dışa aktarabilirsin.
    </p>
    <p>
      Kullanılan: <strong>{usage || 'bilinmiyor'}</strong>
    </p>
    {#if persisted}
      <p class="ok">✓ Kalıcı depolama açık; tarayıcı verini kendiliğinden silmez.</p>
    {:else}
      <div class="row">
        <span class="hint">Tarayıcı, yer daraldığında verini silebilir.</span>
        <button onclick={askPersist}>Verimi koru</button>
      </div>
    {/if}
  </section>

  <h2>Diller</h2>
  <p class="hint intro">
    “Çeviri dili”, bir kelimeye dokunduğunda otomatik çevirinin hangi dile yapılacağını belirler
    (ör. Türkçe için <code>tr</code>). Dil kodu ise okunan kitabın dilidir (ör. <code>fr</code>, <code>de</code>, <code>es</code>).
  </p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#each languages as lang, li (lang.id ?? 'new-' + li)}
    <section class="card lang">
      <div class="fields">
        <label>Dil adı <input bind:value={lang.name} placeholder="ör. Fransızca" /></label>
        <label>Dil kodu <input bind:value={lang.code} placeholder="ör. fr" /></label>
        <label>Çeviri dili <input bind:value={lang.translateTo} placeholder="ör. tr" /></label>
      </div>
      <label class="inline"><input type="checkbox" bind:checked={lang.rightToLeft} /> Sağdan sola yazılır (Arapça, İbranice…)</label>

      <div class="row">
        <button class="danger" onclick={() => removeLanguage(lang)}>Sil</button>
        <span class="spacer"></span>
        <button class="primary" onclick={() => saveLanguage(lang)}>
          {saved && saved === lang.name.trim() ? 'Kaydedildi ✓' : 'Kaydet'}
        </button>
      </div>
    </section>
  {/each}

  <button onclick={addLanguage}>＋ Dil ekle</button>
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
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.75rem;
  }
  .fields input {
    width: 100%;
  }
  .intro {
    margin-bottom: 0.75rem;
  }
  .ok {
    color: #1a7f37;
  }
  @media (prefers-color-scheme: dark) {
    .ok {
      color: #56d364;
    }
  }
  code {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 0.25rem;
  }
</style>
