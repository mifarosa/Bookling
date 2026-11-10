<script>
  import { liveQuery } from 'dexie';
  import { db, STATUS } from '../lib/db.js';
  import { exportLuteCsv, importLuteCsv, statusToLute } from '../lib/lute.js';
  import { downloadText } from '../lib/download.js';

  const languages = liveQuery(() => db.languages.orderBy('name').toArray());

  let languageId = $state('');
  let statusFilter = $state('learning');
  let search = $state('');
  let limit = $state(200);
  let message = $state('');
  let error = $state('');

  const FILTERS = {
    all: () => true,
    learning: (s) => s >= 1 && s <= 5,
    known: (s) => s === STATUS.WELL_KNOWN || s === 5,
    ignored: (s) => s === STATUS.IGNORED
  };

  const terms = $derived.by(() => {
    const lang = languageId;
    return liveQuery(() =>
      lang === '' ? db.terms.toArray() : db.terms.where('languageId').equals(Number(lang)).toArray()
    );
  });

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const f = FILTERS[statusFilter];
    return ($terms ?? [])
      .filter((t) => f(t.status))
      .filter((t) => !q || t.text.includes(q) || (t.translation || '').toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const langName = (id) => $languages?.find((l) => l.id === id)?.name ?? '';

  async function doExport() {
    const csv = await exportLuteCsv(languageId === '' ? null : Number(languageId));
    const suffix = languageId === '' ? 'all' : langName(Number(languageId)).toLowerCase();
    downloadText(`bookling-terms-${suffix}.csv`, csv);
  }

  async function doImport(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    message = error = '';
    try {
      const r = await importLuteCsv(await file.text());
      message = `İçe aktarıldı: ${r.added} yeni, ${r.updated} güncellendi, ${r.skipped} atlandı.`;
      if (r.createdLanguages.length) {
        message += ` Yeni diller oluşturuldu: ${r.createdLanguages.join(', ')} (kodlarını Ayarlar'dan gir).`;
      }
    } catch (err) {
      error = err.message || String(err);
    }
  }

  async function remove(t) {
    if (confirm(`"${t.text}" kelimesi silinsin mi?`)) await db.terms.delete(t.id);
  }

  const STATUS_FILTERS = [
    { id: 'learning', label: 'Öğreniliyor' },
    { id: 'known', label: 'Biliyorum' },
    { id: 'ignored', label: 'Yok say' },
    { id: 'all', label: 'Hepsi' }
  ];

  const STATUS_LABEL = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
  const statusLabel = (s) => (s === STATUS.WELL_KNOWN ? 'Biliyorum' : s === STATUS.IGNORED ? 'Yok say' : (STATUS_LABEL[s] ?? statusToLute(s)));
</script>

<div class="page">
  <h1>Kelimeler</h1>

  <div class="row filters">
    <input type="search" bind:value={search} placeholder="Kelime veya çeviri ara…" aria-label="Ara" />
    <select bind:value={languageId} aria-label="Dil">
      <option value="">Tüm diller</option>
      {#each $languages ?? [] as l (l.id)}
        <option value={String(l.id)}>{l.name}</option>
      {/each}
    </select>
  </div>

  <div class="row chips" role="group" aria-label="Duruma göre filtrele">
    {#each STATUS_FILTERS as f}
      <button class="chip" class:on={statusFilter === f.id} onclick={() => (statusFilter = f.id)}>{f.label}</button>
    {/each}
    <span class="muted small count">{filtered.length} kelime</span>
  </div>

  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if filtered.length === 0}
    <div class="card empty-state">
      <span class="emoji" aria-hidden="true">🔤</span>
      <h2>{($terms ?? []).length === 0 ? 'Henüz kelime yok' : 'Eşleşen kelime yok'}</h2>
      <p class="muted">
        {#if ($terms ?? []).length === 0}
          Okurken bir kelimeye dokun; durumunu işaretlediğinde burada listelenir.
        {:else}
          Filtreyi ya da aramayı değiştirmeyi dene.
        {/if}
      </p>
    </div>
  {:else}
    <ul class="list">
      {#each filtered.slice(0, limit) as t (t.id)}
        <li class="term">
          <span class="badge" data-s={t.status} title="Durum">{statusLabel(t.status)}</span>
          <div class="text">
            <strong>{t.text}</strong>
            <span class="muted">{t.translation || '—'}</span>
          </div>
          {#if languageId === ''}<span class="muted small lang">{langName(t.languageId)}</span>{/if}
          <button class="ghost danger" onclick={() => remove(t)} aria-label="“{t.text}” kelimesini sil">✕</button>
        </li>
      {/each}
    </ul>
    {#if filtered.length > limit}
      <button onclick={() => (limit += 200)}>Daha fazla göster</button>
    {/if}
  {/if}

  <details class="card backup">
    <summary>Yedekle / içe aktar</summary>
    <p class="hint">Lute v3 ile uyumlu CSV dosyası. Kelimelerini yedeklemek ya da başka cihaza taşımak için kullan.</p>
    <div class="row">
      <button onclick={doExport}>⬇ CSV olarak dışa aktar</button>
      <label class="button">
        ⬆ CSV içe aktar
        <input type="file" accept=".csv,text/csv" onchange={doImport} hidden />
      </label>
    </div>
  </details>
</div>

<style>
  .filters {
    margin: 1rem 0 0.5rem;
  }
  .filters input {
    flex: 1 1 10rem;
  }
  .small {
    font-size: 0.85rem;
  }
  .chips {
    margin-bottom: 0.75rem;
  }
  .count {
    margin-left: auto;
  }
  .list {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  .term {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  .term:last-child {
    border-bottom: none;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .text span {
    overflow-wrap: anywhere;
  }
  .lang {
    white-space: nowrap;
  }
  .backup {
    margin-top: 1.5rem;
  }
  .backup summary {
    cursor: pointer;
    font-weight: 600;
  }
  .backup .hint {
    margin: 0.6rem 0;
  }
  .badge {
    display: inline-block;
    min-width: 2.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-align: center;
    border-radius: 4px;
    padding: 0 0.3rem;
    border: 1px solid var(--border);
  }
  .badge[data-s='1'] { background: var(--st-1); }
  .badge[data-s='2'] { background: var(--st-2); }
  .badge[data-s='3'] { background: var(--st-3); }
  .badge[data-s='4'] { background: var(--st-4); }
  .badge[data-s='5'] { background: var(--st-5); }
  .badge[data-s='98'],
  .badge[data-s='99'] { background: var(--bg); }
</style>
