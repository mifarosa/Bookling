<script>
  import { liveQuery } from 'dexie';
  import { db, STATUS } from '../lib/db.js';

  const stats = liveQuery(async () => {
    const [languages, terms, books] = await Promise.all([
      db.languages.orderBy('name').toArray(),
      db.terms.toArray(),
      db.books.toArray()
    ]);
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return languages
      .map((l) => {
        const own = terms.filter((t) => t.languageId === l.id);
        const known = own.filter((t) => t.status === STATUS.WELL_KNOWN || t.status === 5).length;
        const learning = own.filter((t) => t.status >= 1 && t.status <= 4).length;
        const knownThisWeek = own.filter(
          (t) => (t.status === STATUS.WELL_KNOWN || t.status === 5) && t.updatedAt >= weekAgo
        ).length;
        const langBooks = books.filter((b) => b.languageId === l.id);
        const byStatus = [1, 2, 3, 4, 5].map((s) => own.filter((t) => t.status === s).length);
        return { language: l, known, learning, knownThisWeek, byStatus, books: langBooks.length };
      })
      .filter((s) => s.known || s.learning || s.books);
  });
</script>

<div class="page">
  <h1>İstatistik</h1>
  {#if $stats && $stats.length === 0}
    <div class="card empty-state">
      <span class="emoji" aria-hidden="true">📊</span>
      <h2>Henüz veri yok</h2>
      <p class="muted">Bir şeyler oku ve kelimeleri işaretle; ilerlemen burada görünecek.</p>
      <a class="button primary" href="#/">Kitaplığa git</a>
    </div>
  {/if}
  <div class="grid">
    {#each $stats ?? [] as s (s.language.id)}
      {@const max = Math.max(1, ...s.byStatus)}
      <section class="card">
        <h2>{s.language.name}</h2>
        <div class="big">{s.known.toLocaleString()}</div>
        <div class="muted">bilinen kelime</div>
        <dl>
          <dt>Öğreniliyor</dt><dd>{s.learning}</dd>
          <dt>Bu hafta bilinen</dt><dd>+{s.knownThisWeek}</dd>
          <dt>Kitap</dt><dd>{s.books}</dd>
        </dl>
        <div class="bars" aria-label="Öğrenme aşamasına göre kelime sayısı">
          {#each s.byStatus as n, i}
            <div class="bar">
              <span data-s={i + 1} style="height: {(n / max) * 100}%"></span>
              <small>{n}</small>
              <small class="stage">{i + 1}</small>
            </div>
          {/each}
        </div>
        <p class="hint legend">Altındaki sayılar öğrenme aşamasıdır: 1 = yeni, 5 = neredeyse öğrenildi.</p>
      </section>
    {/each}
  </div>
</div>

<style>
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
  h2 {
    margin: 0 0 0.5rem;
  }
  .big {
    font-size: 2.4rem;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 1rem;
    margin: 1rem 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .bars {
    display: flex;
    gap: 0.4rem;
    height: 70px;
    align-items: flex-end;
  }
  .bar {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
  }
  .bar span {
    width: 100%;
    min-height: 2px;
    border-radius: 3px 3px 0 0;
  }
  .bar span[data-s='1'] { background: var(--st-1); }
  .bar span[data-s='2'] { background: var(--st-2); }
  .bar span[data-s='3'] { background: var(--st-3); }
  .bar span[data-s='4'] { background: var(--st-4); }
  .bar span[data-s='5'] { background: var(--st-5); }
  small {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .bars {
    height: 90px;
  }
  .bar span {
    margin-top: 0.1rem;
  }
  .stage {
    font-weight: 600;
  }
  .legend {
    margin: 0.5rem 0 0;
  }
</style>
