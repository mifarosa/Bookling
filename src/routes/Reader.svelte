<script>
  import { onMount, tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import {
    db,
    deleteNote,
    loadTermMap,
    markUnknownAsKnown,
    normalizeTerm,
    notesForBook,
    saveNote,
    saveTerm,
    setResumeAnchor,
    clearResumeAnchor,
    STATUS
  } from '../lib/db.js';
  import { tokenize } from '../lib/tokenize.js';
  import { navigate } from '../lib/router.svelte.js';
  import TermPanel from '../components/TermPanel.svelte';
  import SelectionPanel from '../components/SelectionPanel.svelte';
  import Sheet from '../components/Sheet.svelte';

  let { bookId } = $props();

  const SANS_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  let book = $state(null);
  let language = $state(null);
  let pageIndex = $state(0);
  let paragraphs = $state([]);
  let error = $state('');
  let fontSize = $state(1.2);
  let fontFamily = $state('serif'); // 'serif' | 'sans'
  let readingTheme = $state('light'); // 'light' | 'sepia' | 'dark'
  let selected = $state(null); // { word, key }
  let phraseSelection = $state(''); // the text shown in SelectionPanel, once the user taps "Çevir"
  let selFab = $state(null); // { text, x, y } — the floating "Çevir" button for an active text selection
  let articleEl;
  let selectionTimer;
  let focusedPara = $state(null);
  let noteEditingPara = $state(null);
  let noteDraft = $state('');
  let showToc = $state(false);
  let showNotes = $state(false);
  let showAppearance = $state(false);
  const terms = new SvelteMap();
  const notes = new SvelteMap(); // paragraphIndex -> note row, for the current page
  let allNotes = $state([]);

  const code = $derived(language?.code || undefined);

  const blocks = $derived(
    paragraphs.map((p) => {
      if (p && typeof p === 'object' && p.image) return { kind: 'image', src: p.src, alt: p.alt };
      const heading = typeof p === 'string' && p.startsWith('# ');
      const text = heading ? p.slice(2) : p;
      return {
        kind: heading ? 'heading' : 'text',
        tokens: tokenize(text, code).map((t) => (t.isWord ? { ...t, key: normalizeTerm(t.text, code) } : t))
      };
    })
  );

  const pageWords = $derived(
    blocks.filter((b) => b.kind !== 'image').flatMap((b) => b.tokens.filter((t) => t.isWord).map((t) => t.key))
  );
  const unknownCount = $derived(new Set(pageWords.filter((k) => !terms.has(k))).size);
  const isLastPage = $derived(book ? pageIndex >= book.pageCount - 1 : true);
  const chapters = $derived(book?.chapters?.length > 1 ? book.chapters : []);
  const currentChapterTitle = $derived(
    chapters.length ? [...chapters].reverse().find((c) => c.page <= pageIndex)?.title : ''
  );

  onMount(async () => {
    try {
      book = await db.books.get(bookId);
      if (!book) throw new Error('Book not found.');
      language = await db.languages.get(book.languageId);
      for (const [k, v] of await loadTermMap(book.languageId)) terms.set(k, v);
      allNotes = await notesForBook(bookId);

      const [fs, ff, rt] = await Promise.all([
        db.settings.get('fontSize'),
        db.settings.get('readerFont'),
        db.settings.get('readingTheme')
      ]);
      if (fs) fontSize = fs.value;
      if (ff) fontFamily = ff.value;
      if (rt) readingTheme = rt.value;

      const anchor = book.resumeAnchor;
      await goTo(book.currentPage ?? 0, { paragraph: anchor?.page === book.currentPage ? anchor.paragraph : undefined });
    } catch (e) {
      error = e.message || String(e);
    }
  });

  async function goTo(index, { paragraph } = {}) {
    const i = Math.max(0, Math.min(index, book.pageCount - 1));
    const page = await db.pages.where({ bookId, index: i }).first();
    paragraphs = page?.paragraphs ?? [];
    pageIndex = i;
    selected = null;
    phraseSelection = '';
    selFab = null;
    focusedPara = null;
    noteEditingPara = null;
    notes.clear();
    for (const n of allNotes) if (n.pageIndex === i) notes.set(n.paragraphIndex, n);
    await db.books.update(bookId, { currentPage: i, lastOpenedAt: Date.now() });

    await tick();
    if (paragraph != null) {
      document.getElementById('p' + paragraph)?.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
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

  /** True while the user has an actual (non-collapsed) text selection — the tail end of a drag-select,
   *  as opposed to a plain tap, which collapses any prior selection before its click fires. */
  function hasActiveSelection() {
    const sel = window.getSelection();
    return !!(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
  }

  function select(token, e) {
    e?.stopPropagation();
    if (hasActiveSelection()) return; // this click is the tail of a sentence drag-select, not a tap
    phraseSelection = '';
    selected = { word: token.text, key: token.key };
  }

  /** Debounced selectionchange handler: shows a floating "Çevir" button near a sentence/phrase
   *  selected inside the reading text, without reacting to every intermediate drag position. */
  function onSelectionChange() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !articleEl) {
        selFab = null;
        return;
      }
      const text = sel.toString().trim();
      if (!text || !articleEl.contains(sel.anchorNode) || !articleEl.contains(sel.focusNode)) {
        selFab = null;
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        selFab = null;
        return;
      }
      selFab = {
        text,
        x: Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70),
        y: Math.max(rect.top - 44, 8)
      };
    }, 150);
  }

  function openSelectionTranslate() {
    if (!selFab) return;
    phraseSelection = selFab.text;
    selected = null;
    selFab = null;
    window.getSelection()?.removeAllRanges();
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

  async function setFontFamily(value) {
    fontFamily = value;
    await db.settings.put({ key: 'readerFont', value });
  }

  async function setTheme(value) {
    readingTheme = value;
    await db.settings.put({ key: 'readingTheme', value });
  }

  function statusOf(key) {
    return terms.get(key)?.status ?? STATUS.UNKNOWN;
  }

  function toggleFocus(bi) {
    if (hasActiveSelection()) return; // don't open paragraph actions at the tail of a drag-select
    focusedPara = focusedPara === bi ? null : bi;
    noteEditingPara = null;
  }

  async function toggleBookmark(bi, e) {
    e.stopPropagation();
    const isCurrent = book.resumeAnchor?.page === pageIndex && book.resumeAnchor?.paragraph === bi;
    if (isCurrent) {
      await clearResumeAnchor(bookId);
      book.resumeAnchor = null;
    } else {
      await setResumeAnchor(bookId, pageIndex, bi);
      book.resumeAnchor = { page: pageIndex, paragraph: bi };
    }
  }

  function excerptOf(bi) {
    const b = blocks[bi];
    if (!b || b.kind === 'image') return '[image]';
    return b.tokens
      .map((t) => t.text)
      .join('')
      .slice(0, 140);
  }

  function openNote(bi, e) {
    e?.stopPropagation();
    noteEditingPara = bi;
    noteDraft = notes.get(bi)?.text ?? '';
  }

  async function saveNoteDraft(bi) {
    const text = noteDraft.trim();
    if (!text) {
      await removeNote(bi);
      return;
    }
    const row = await saveNote(bookId, pageIndex, bi, excerptOf(bi), text);
    notes.set(bi, row);
    allNotes = [...allNotes.filter((n) => !(n.pageIndex === pageIndex && n.paragraphIndex === bi)), row];
    noteEditingPara = null;
  }

  async function removeNote(bi) {
    const row = notes.get(bi);
    if (row) {
      await deleteNote(row.id);
      notes.delete(bi);
      allNotes = allNotes.filter((n) => n.id !== row.id);
    }
    noteEditingPara = null;
  }

  async function jumpToNote(note) {
    showNotes = false;
    await goTo(note.pageIndex, { paragraph: note.paragraphIndex });
  }

  function jumpToChapter(chapter) {
    showToc = false;
    goTo(chapter.page);
  }

  const KEY_STATUS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, w: STATUS.WELL_KNOWN, i: STATUS.IGNORED };

  function onKey(e) {
    if (e.target.closest?.('input, textarea, select')) return;
    if (selected) {
      if (e.key === 'Escape') selected = null;
      else if (KEY_STATUS[e.key.toLowerCase()]) {
        const t = terms.get(selected.key);
        save({
          status: KEY_STATUS[e.key.toLowerCase()],
          translation: t?.translation ?? '',
          romanization: t?.romanization ?? '',
          parent: t?.parent ?? ''
        });
      }
      return;
    }
    if (phraseSelection) {
      if (e.key === 'Escape') phraseSelection = '';
      return;
    }
    if (showToc || showNotes || showAppearance) return; // Sheet handles its own Escape
    if (e.key === 'ArrowRight' && !isLastPage) goTo(pageIndex + 1);
    else if (e.key === 'ArrowLeft' && pageIndex > 0) goTo(pageIndex - 1);
    else if (e.key === 'Escape') focusedPara = null;
  }
</script>

<svelte:window onkeydown={onKey} onscroll={() => (selFab = null)} />
<svelte:document onselectionchange={onSelectionChange} />

{#if error}
  <p class="page error">{error} <a href="#/">Back to library</a></p>
{:else if book}
  <div class="reader" data-theme={readingTheme} class:with-panel={selected || phraseSelection}>
    <div class="main">
      <header>
        <a href="#/" aria-label="Back to library">←</a>
        <div class="titles">
          <span class="title">{book.title}</span>
          {#if currentChapterTitle}<span class="chapter muted">{currentChapterTitle}</span>{/if}
        </div>
        {#if chapters.length}
          <button class="icon" onclick={() => (showToc = true)} aria-label="Table of contents" title="İçindekiler"
            >☰</button
          >
        {/if}
        <button class="icon" onclick={() => (showNotes = true)} aria-label="Notes" title="Notlarım">
          📝{#if allNotes.length}<sup>{allNotes.length}</sup>{/if}
        </button>
        <button class="icon" onclick={() => (showAppearance = true)} aria-label="Appearance" title="Görünüm"
          >Aa</button
        >
      </header>

      <article
        bind:this={articleEl}
        style="font-size: {fontSize}rem; font-family: {fontFamily === 'sans' ? SANS_STACK : 'var(--reader-font)'}"
        dir={language?.rightToLeft ? 'rtl' : 'auto'}
        lang={language?.code || undefined}
      >
        {#each blocks as block, bi}
          {@const bookmarked = book.resumeAnchor?.page === pageIndex && book.resumeAnchor?.paragraph === bi}
          {@const hasNote = notes.has(bi)}
          <div
            id={'p' + bi}
            class="para"
            class:bookmarked
            class:has-note={hasNote}
            class:focused={focusedPara === bi}
            role="button"
            tabindex="-1"
            onclick={() => toggleFocus(bi)}
            onkeydown={(e) => e.key === 'Enter' && toggleFocus(bi)}
          >
            {#if block.kind === 'image'}
              <figure class="img-block">
                <img src={block.src} alt={block.alt} loading="lazy" />
              </figure>
            {:else}
              <svelte:element this={block.kind === 'heading' ? 'h2' : 'p'}>
                {#each block.tokens as t}
                  {#if t.isWord}<span
                      class="w"
                      class:sel={selected?.key === t.key}
                      data-s={statusOf(t.key)}
                      role="button"
                      tabindex="-1"
                      onclick={(e) => select(t, e)}
                      onkeydown={(e) => e.key === 'Enter' && select(t, e)}>{t.text}</span
                    >{:else}{t.text}{/if}
                {/each}
              </svelte:element>
            {/if}

            {#if focusedPara === bi}
              <div class="para-actions" onclick={(e) => e.stopPropagation()} role="toolbar" aria-label="Paragraph actions">
                {#if noteEditingPara === bi}
                  <textarea bind:value={noteDraft} rows="2" placeholder="Bu bölümle ilgili notun…" autofocus
                  ></textarea>
                  <div class="row">
                    <button class="primary" onclick={() => saveNoteDraft(bi)}>Kaydet</button>
                    {#if notes.has(bi)}<button class="danger" onclick={() => removeNote(bi)}>Notu sil</button>{/if}
                    <button onclick={() => (noteEditingPara = null)}>Vazgeç</button>
                  </div>
                {:else}
                  <button class:on={bookmarked} onclick={(e) => toggleBookmark(bi, e)}>
                    📍 {bookmarked ? 'Kaldığın yer' : 'Kaldığın yeri işaretle'}
                  </button>
                  <button class:on={hasNote} onclick={(e) => openNote(bi, e)}>
                    📝 {hasNote ? 'Notu düzenle' : 'Not ekle'}
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </article>

      <footer>
        <button onclick={() => goTo(pageIndex - 1)} disabled={pageIndex === 0}>← Prev</button>
        <span class="muted">
          {pageIndex + 1} / {book.pageCount}
          {#if unknownCount}· {unknownCount} new{/if}
        </span>
        <button class="primary" onclick={markRestKnown} title="Mark all unhighlighted words as known">
          {isLastPage ? 'Finish' : 'Next'}
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
          term={terms.get(selected.key)}
          onsave={save}
          ondelete={forget}
          onclose={() => (selected = null)}
        />
      </div>
    {:else if phraseSelection}
      <div class="side">
        <SelectionPanel {language} text={phraseSelection} onclose={() => (phraseSelection = '')} />
      </div>
    {/if}
  </div>

  {#if selFab}
    <button
      class="translate-fab"
      style="left: {selFab.x}px; top: {selFab.y}px;"
      onclick={openSelectionTranslate}
    >
      🌐 Çevir
    </button>
  {/if}

  {#if showToc}
    <Sheet title="İçindekiler" onclose={() => (showToc = false)}>
      {#if chapters.length}
        <ul class="list">
          {#each chapters as c}
            <li>
              <button class="list-row" class:active={c.page === pageIndex} onclick={() => jumpToChapter(c)}>
                <span>{c.title}</span>
                <span class="muted">s. {c.page + 1}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">İçindekiler bulunamadı.</p>
      {/if}
    </Sheet>
  {/if}

  {#if showNotes}
    <Sheet title="Notlarım" onclose={() => (showNotes = false)}>
      {#if allNotes.length}
        <ul class="list">
          {#each [...allNotes].sort((a, b) => a.pageIndex - b.pageIndex) as n (n.id)}
            <li>
              <button class="list-row note-row" onclick={() => jumpToNote(n)}>
                <span class="excerpt muted">{n.excerpt}</span>
                <span class="note-text">{n.text}</span>
                <span class="muted small">s. {n.pageIndex + 1}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Henüz not eklemedin. Bir paragrafa dokunup "Not ekle"yi seç.</p>
      {/if}
    </Sheet>
  {/if}

  {#if showAppearance}
    <Sheet title="Görünüm" onclose={() => (showAppearance = false)}>
      <div class="appearance">
        <div class="group">
          <span class="muted small">Yazı boyutu</span>
          <div class="row">
            <button onclick={() => setFont(-0.1)} aria-label="Smaller text">A−</button>
            <span class="muted">{fontSize.toFixed(1)}×</span>
            <button onclick={() => setFont(0.1)} aria-label="Larger text">A+</button>
          </div>
        </div>
        <div class="group">
          <span class="muted small">Yazı tipi</span>
          <div class="row">
            <button class:on={fontFamily === 'serif'} onclick={() => setFontFamily('serif')}>Serif</button>
            <button class:on={fontFamily === 'sans'} onclick={() => setFontFamily('sans')}>Sans</button>
          </div>
        </div>
        <div class="group">
          <span class="muted small">Renk teması</span>
          <div class="row themes">
            <button class="theme-swatch light" class:on={readingTheme === 'light'} onclick={() => setTheme('light')}
              >Açık</button
            >
            <button class="theme-swatch sepia" class:on={readingTheme === 'sepia'} onclick={() => setTheme('sepia')}
              >Sepya</button
            >
            <button class="theme-swatch dark" class:on={readingTheme === 'dark'} onclick={() => setTheme('dark')}
              >Koyu</button
            >
          </div>
        </div>
      </div>
    </Sheet>
  {/if}
{/if}

<style>
  .reader {
    display: grid;
    grid-template-columns: 1fr;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg);
    color: var(--text);
  }
  .reader[data-theme='sepia'] {
    --bg: #f4ecd8;
    --surface: #faf3e3;
    --text: #433422;
    --muted: #8a7a5c;
    --border: #e3d5b6;
    --accent: #93502a;
    --accent-text: #ffffff;
  }
  .reader[data-theme='dark'] {
    --bg: #16181d;
    --surface: #1f232a;
    --text: #e6e3dd;
    --muted: #9aa1ad;
    --border: #333842;
    --accent: #7aa2d6;
    --accent-text: #0f1115;
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
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    padding-top: max(0.5rem, env(safe-area-inset-top));
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  header a {
    text-decoration: none;
    font-size: 1.3rem;
    color: var(--text);
    padding: 0 0.2rem;
  }
  .titles {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
  }
  .title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }
  .chapter {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.75rem;
  }
  .icon {
    padding: 0.4rem 0.5rem;
    font-size: 1rem;
    position: relative;
  }
  .icon sup {
    color: var(--accent);
    font-weight: 700;
  }
  article {
    flex: 1;
    padding: 1rem 1.25rem 2rem;
    line-height: 1.75;
    overflow-wrap: break-word;
  }
  article h2 {
    font-size: 1.3em;
    line-height: 1.4;
    margin: 1.6em 0 0.8em;
  }
  .para {
    position: relative;
    border-radius: 8px;
    margin: 0 -0.5rem;
    padding: 0 0.5rem;
    scroll-margin-top: 4.2rem;
  }
  .para p {
    margin: 0;
    text-indent: 1.4em;
  }
  h2 + .para p,
  .para:first-child p {
    text-indent: 0;
  }
  .para.focused {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .para.bookmarked::before {
    content: '';
    position: absolute;
    left: -0.55rem;
    top: 0.35em;
    bottom: 0.35em;
    width: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .para.has-note::after {
    content: '📝';
    position: absolute;
    right: -0.1rem;
    top: 0.1em;
    font-size: 0.7em;
    opacity: 0.75;
  }
  .img-block {
    margin: 1.2em 0;
    text-align: center;
  }
  .img-block img {
    max-width: 100%;
    max-height: 70vh;
    border-radius: 8px;
  }
  .para-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.5rem 0 0.9rem;
    font-family: var(--ui-font);
    font-size: 0.85rem;
  }
  .para-actions textarea {
    width: 100%;
    resize: vertical;
  }
  .para-actions button.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  /* Plain reading text: no status markings on the words themselves — tap one to see/set its status. */
  .w {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .w.sel {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-radius: 3px;
  }
  .translate-fab {
    position: fixed;
    z-index: 25;
    transform: translate(-50%, -100%);
    background: var(--accent);
    color: var(--accent-text);
    border: none;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: var(--ui-font);
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.25);
    white-space: nowrap;
    cursor: pointer;
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
    font-family: var(--ui-font);
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

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .list-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    text-align: left;
    border: none;
    background: transparent;
    padding: 0.6rem 0.4rem;
    border-radius: 8px;
  }
  .list-row:hover {
    background: var(--bg);
  }
  .list-row.active {
    color: var(--accent);
    font-weight: 600;
  }
  .note-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
  .excerpt {
    font-size: 0.8rem;
  }
  .note-text {
    font-size: 0.95rem;
  }

  .appearance {
    display: grid;
    gap: 1.1rem;
  }
  .group {
    display: grid;
    gap: 0.4rem;
  }
  .themes button {
    flex: 1;
  }
  .theme-swatch.on {
    outline: 2px solid var(--accent);
  }
</style>
