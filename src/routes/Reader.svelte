<script>
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { db, loadTermMap, markUnknownAsKnown, normalizeTerm, saveTerm, STATUS } from '../lib/db.js';
  import { tokenize } from '../lib/tokenize.js';
  import { navigate } from '../lib/router.svelte.js';
  import TermPanel from '../components/TermPanel.svelte';

  let { bookId } = $props();

  let book = $state(null);
  let language = $state(null);
  let pageIndex = $state(0);
  let paragraphs = $state([]);
  let error = $state('');
  let fontSize = $state(1.2);
  let selected = $state(null); // { word, key }
  const terms = new SvelteMap();

  const code = $derived(language?.code || undefined);

  const blocks = $derived(
    paragraphs.map((p) => {
      const heading = p.startsWith('# ');
      const text = heading ? p.slice(2) : p;
      return {
        heading,
        tokens: tokenize(text, code).map((t) => (t.isWord ? { ...t, key: normalizeTerm(t.text, code) } : t))
      };
    })
  );

  const pageWords = $derived(blocks.flatMap((b) => b.tokens.filter((t) => t.isWord).map((t) => t.key)));
  const unknownCount = $derived(new Set(pageWords.filter((k) => !terms.has(k))).size);
  const isLastPage = $derived(book ? pageIndex >= book.pageCount - 1 : true);

  onMount(async () => {
    try {
      book = await db.books.get(bookId);
      if (!book) throw new Error('Book not found.');
      language = await db.languages.get(book.languageId);
      for (const [k, v] of await loadTermMap(book.languageId)) terms.set(k, v);
      const fs = await db.settings.get('fontSize');
      if (fs) fontSize = fs.value;
      await goTo(book.currentPage ?? 0);
    } catch (e) {
      error = e.message || String(e);
    }
  });

  async function goTo(index) {
    const i = Math.max(0, Math.min(index, book.pageCount - 1));
    const page = await db.pages.where({ bookId, index: i }).first();
    paragraphs = page?.paragraphs ?? [];
    pageIndex = i;
    selected = null;
    window.scrollTo(0, 0);
    await db.books.update(bookId, { currentPage: i, lastOpenedAt: Date.now() });
  }

  async function markRestKnown() {
    const unknown = pageWords.filter((k) => !terms.has(k));
    if (unknown.length) {
      await markUnknownAsKnown(language.id, unknown);
      for (const [k, v] of await loadTermMap(language.id)) if (!terms.has(k)) terms.set(k, v);
    }
    if (isLastPage) navigate('/');
    else await goTo(pageIndex + 1);
  }

  function select(token) {
    selected = { word: token.text, key: token.key };
  }

  async function save(fields) {
    const row = await saveTerm(language.id, selected.key, fields);
    terms.set(selected.key, row);
  }

  async function forget() {
    const row = terms.get(selected.key);
    if (row) await db.terms.delete(row.id);
    terms.delete(selected.key);
  }

  async function setFont(delta) {
    fontSize = Math.round(Math.max(0.8, Math.min(2.4, fontSize + delta)) * 10) / 10;
    await db.settings.put({ key: 'fontSize', value: fontSize });
  }

  function statusOf(key) {
    return terms.get(key)?.status ?? STATUS.UNKNOWN;
  }

  const KEY_STATUS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, w: STATUS.WELL_KNOWN, i: STATUS.IGNORED };

  function onKey(e) {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight' && !isLastPage) goTo(pageIndex + 1);
    else if (e.key === 'ArrowLeft' && pageIndex > 0) goTo(pageIndex - 1);
    else if (e.key === 'Escape') selected = null;
    else if (selected && KEY_STATUS[e.key.toLowerCase()]) {
      const t = terms.get(selected.key);
      save({
        status: KEY_STATUS[e.key.toLowerCase()],
        translation: t?.translation ?? '',
        romanization: t?.romanization ?? '',
        parent: t?.parent ?? ''
      });
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if error}
  <p class="page error">{error} <a href="#/">Back to library</a></p>
{:else if book}
  <div class="reader" class:with-panel={selected}>
    <div class="main">
      <header>
        <a href="#/" aria-label="Back to library">←</a>
        <span class="title">{book.title}</span>
        <button onclick={() => setFont(-0.1)} aria-label="Smaller text">A−</button>
        <button onclick={() => setFont(0.1)} aria-label="Larger text">A+</button>
      </header>

      <article
        style="font-size: {fontSize}rem"
        dir={language?.rightToLeft ? 'rtl' : 'auto'}
        lang={language?.code || undefined}
      >
        {#each blocks as block}
          <svelte:element this={block.heading ? 'h2' : 'p'}>
            {#each block.tokens as t}
              {#if t.isWord}<span
                  class="w"
                  class:sel={selected?.key === t.key}
                  data-s={statusOf(t.key)}
                  role="button"
                  tabindex="-1"
                  onclick={() => select(t)}
                  onkeydown={(e) => e.key === 'Enter' && select(t)}>{t.text}</span
                >{:else}{t.text}{/if}
            {/each}
          </svelte:element>
        {/each}
      </article>

      <footer>
        <button onclick={() => goTo(pageIndex - 1)} disabled={pageIndex === 0}>← Prev</button>
        <span class="muted">
          {pageIndex + 1} / {book.pageCount}
          {#if unknownCount}· {unknownCount} new{/if}
        </span>
        <button class="primary" onclick={markRestKnown} title="Mark all unhighlighted-blue words as known">
          {isLastPage ? '✓ Finish' : '✓ Next'}
        </button>
        {#if !isLastPage}
          <button onclick={() => goTo(pageIndex + 1)} title="Next page without marking words">→</button>
        {/if}
      </footer>
    </div>

    {#if selected}
      <div class="side">
        <TermPanel
          {language}
          word={selected.word}
          termKey={selected.key}
          term={terms.get(selected.key)}
          onsave={save}
          ondelete={forget}
          onclose={() => (selected = null)}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  .reader {
    display: grid;
    grid-template-columns: 1fr;
    min-height: 100vh;
    min-height: 100dvh;
  }
  .main {
    display: flex;
    flex-direction: column;
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    padding-top: max(0.5rem, env(safe-area-inset-top));
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  header a {
    text-decoration: none;
    font-size: 1.3rem;
  }
  .title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }
  article {
    flex: 1;
    padding: 1rem 1.25rem 2rem;
    font-family: var(--reader-font);
    line-height: 1.75;
    overflow-wrap: break-word;
  }
  article h2 {
    font-size: 1.3em;
    line-height: 1.4;
  }
  .w {
    cursor: pointer;
    border-radius: 3px;
    padding: 0 1px;
    -webkit-tap-highlight-color: transparent;
  }
  .w[data-s='0'] { background: var(--st-0); }
  .w[data-s='1'] { background: var(--st-1); }
  .w[data-s='2'] { background: var(--st-2); }
  .w[data-s='3'] { background: var(--st-3); }
  .w[data-s='4'] { background: var(--st-4); }
  .w[data-s='5'] { border-bottom: 2px solid var(--st-5); }
  .w.sel {
    outline: 2px solid var(--accent);
  }
  footer {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    padding-bottom: max(0.6rem, env(safe-area-inset-bottom));
    background: var(--bg);
    border-top: 1px solid var(--border);
  }
  footer .muted {
    flex: 1;
    text-align: center;
    font-size: 0.9rem;
  }
  .side {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 60vh;
    z-index: 20;
    border-top: 1px solid var(--border);
    border-radius: 14px 14px 0 0;
    overflow: hidden;
    box-shadow: 0 -8px 24px rgb(0 0 0 / 0.15);
  }
  .with-panel article {
    padding-bottom: 62vh;
  }
  @media (min-width: 900px) {
    .with-panel article {
      padding-bottom: 2rem;
    }
    .reader.with-panel {
      grid-template-columns: 1fr 380px;
    }
    .side {
      position: sticky;
      top: 0;
      height: 100vh;
      height: 100dvh;
      border-radius: 0;
      border-top: none;
      border-left: 1px solid var(--border);
      box-shadow: none;
    }
  }
</style>
