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
      message = `Imported: ${r.added} new, ${r.updated} updated, ${r.skipped} skipped.`;
      if (r.createdLanguages.length) {
        message += ` New languages created: ${r.createdLanguages.join(', ')} (set their code in Settings).`;
      }
    } catch (err) {
      error = err.message || String(err);
    }
  }

  async function remove(t) {
    await db.terms.delete(t.id);
  }
</script>

<div class="page">
  <h1>Terms</h1>

  <div class="card row">
    <button onclick={doExport}>⬇ Export Lute CSV</button>
    <label class="button">
      ⬆ Import Lute CSV
      <input type="file" accept=".csv,text/csv" onchange={doImport} hidden />
    </label>
    <span class="muted small">Compatible with Lute v3 term import/export.</span>
  </div>
  {#if message}<p>{message}</p>{/if}
  {#if error}<p class="error">{error}</p>{/if}

  <div class="row filters">
    <select bind:value={languageId} aria-label="Language">
      <option value="">All languages</option>
      {#each $languages ?? [] as l (l.id)}
        <option value={String(l.id)}>{l.name}</option>
      {/each}
    </select>
    <select bind:value={statusFilter} aria-label="Status">
      <option value="learning">Learning (1–5)</option>
      <option value="known">Known</option>
      <option value="ignored">Ignored</option>
      <option value="all">All</option>
    </select>
    <input type="search" bind:value={search} placeholder="Search…" />
  </div>

  <p class="muted small">{filtered.length} terms</p>
  <table>
    <thead>
      <tr><th>Term</th><th>Translation</th><th>Status</th><th>Language</th><th></th></tr>
    </thead>
    <tbody>
      {#each filtered.slice(0, limit) as t (t.id)}
        <tr>
          <td>{t.text}</td>
          <td>{t.translation}</td>
          <td><span class="badge" data-s={t.status}>{statusToLute(t.status)}</span></td>
          <td class="muted">{langName(t.languageId)}</td>
          <td><button class="danger small" onclick={() => remove(t)} aria-label="Delete term">✕</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if filtered.length > limit}
    <button onclick={() => (limit += 200)}>Show more</button>
  {/if}
</div>

<style>
  .filters {
    margin: 1rem 0 0.5rem;
  }
  .filters input {
    flex: 1 1 10rem;
  }
  .button {
    display: inline-block;
    flex-direction: row;
    color: var(--text);
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 8px;
    padding: 0.45rem 0.8rem;
    cursor: pointer;
    font-size: 1rem;
  }
  .small {
    font-size: 0.85rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    display: block;
    overflow-x: auto;
  }
  th,
  td {
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .badge {
    display: inline-block;
    min-width: 1.6rem;
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
</style>
