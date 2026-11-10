<script>
  import { onMount } from 'svelte';
  import { db } from '../lib/db.js';
  import { parseFile, parseText, saveBook, isEpub } from '../lib/importers/index.js';
  import { DEFAULT_WORDS_PER_PAGE } from '../lib/paginate.js';
  import { takeSharedPayload } from '../lib/share.js';
  import { route, navigate } from '../lib/router.svelte.js';

  let languages = $state([]);
  let languageId = $state(null);
  let wordsPerPage = $state(DEFAULT_WORDS_PER_PAGE);
  let file = $state(null);
  let title = $state('');
  let text = $state('');
  let busy = $state(false);
  let error = $state('');
  let dragging = $state(false);

  onMount(async () => {
    languages = await db.languages.orderBy('name').toArray();
    const last = await db.settings.get('lastLanguageId');
    languageId = languages.find((l) => l.id === last?.value)?.id ?? languages[0]?.id ?? null;

    if (route.params.get('shared')) {
      const shared = await takeSharedPayload();
      if (shared?.file) file = shared.file;
      if (shared?.title) title = shared.title;
      if (shared?.text || shared?.url) text = [shared.text, shared.url].filter(Boolean).join('\n\n');
    }
  });

  function onFile(e) {
    file = e.currentTarget.files?.[0] ?? null;
    error = '';
  }

  function onDrop(e) {
    e.preventDefault();
    dragging = false;
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      file = dropped;
      error = '';
    }
  }

  async function submit(e) {
    e.preventDefault();
    error = '';
    const language = languages.find((l) => l.id === languageId);
    if (!language) {
      error = 'Lütfen bir dil seç (Ayarlar\'dan dil ekleyebilirsin).';
      return;
    }
    busy = true;
    try {
      let parsed;
      if (file) {
        parsed = await parseFile(file);
        if (title.trim()) parsed.title = title.trim();
      } else if (text.trim()) {
        parsed = parseText(text, title.trim() || 'Yapıştırılan metin');
      } else {
        throw new Error('Bir dosya seç ya da metin yapıştır.');
      }
      await db.settings.put({ key: 'lastLanguageId', value: language.id });
      const id = await saveBook(parsed, language, Number(wordsPerPage) || DEFAULT_WORDS_PER_PAGE);
      navigate(`/read/${id}`);
    } catch (err) {
      error = err.message || String(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="page">
  <h1>Kitap ekle</h1>
  <form class="card" onsubmit={submit}>
    <label>
      Kitabın dili
      <select bind:value={languageId}>
        {#each languages as lang (lang.id)}
          <option value={lang.id}>{lang.name}</option>
        {/each}
      </select>
    </label>
    {#if languages.length === 0}
      <p class="hint">Henüz dil yok. <a href="#/settings">Ayarlar</a>'dan bir dil ekle.</p>
    {/if}

    {#if file}
      <div class="picked">
        <span aria-hidden="true">{isEpub(file) ? '📕' : '📄'}</span>
        <div class="picked-text">
          <strong>{file.name}</strong>
          <span class="muted small">{isEpub(file) ? 'EPUB' : 'Metin dosyası'}</span>
        </div>
        <button type="button" class="ghost" onclick={() => (file = null)} aria-label="Dosyayı kaldır">✕</button>
      </div>
    {:else}
      <label
        class="drop"
        class:dragging
        ondragover={(e) => {
          e.preventDefault();
          dragging = true;
        }}
        ondragleave={() => (dragging = false)}
        ondrop={onDrop}
      >
        <span class="drop-icon" aria-hidden="true">📥</span>
        <strong>Dosya seç veya buraya sürükle</strong>
        <span class="muted small">EPUB veya TXT</span>
        <input type="file" accept=".epub,.txt,application/epub+zip,text/plain" onchange={onFile} />
      </label>

      <div class="or" aria-hidden="true"><span>veya</span></div>

      <label>
        Metin yapıştır
        <textarea bind:value={text} rows="7" placeholder="Bir makale ya da bölüm yapıştır"></textarea>
      </label>
    {/if}

    <label>
      <span>Başlık <span class="muted">{file ? '(isteğe bağlı, kitabın kendi başlığının yerine geçer)' : '(isteğe bağlı)'}</span></span>
      <input bind:value={title} placeholder="Başlık" />
    </label>

    <details>
      <summary class="muted">Gelişmiş seçenekler</summary>
      <label class="option">
        Sayfa başına kelime
        <input type="number" min="50" max="2000" step="10" bind:value={wordsPerPage} />
        <span class="hint">Küçük sayı = daha kısa sayfalar. Telefon için 200–300 rahat okunur.</span>
      </label>
    </details>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="row actions">
      <a class="button" href="#/">Vazgeç</a>
      <button class="primary" type="submit" disabled={busy}>{busy ? 'Ekleniyor…' : 'Kitabı ekle'}</button>
    </div>
  </form>
</div>

<style>
  form {
    display: grid;
    gap: 1rem;
  }
  textarea {
    width: 100%;
    resize: vertical;
  }
  .small {
    font-size: 0.85rem;
  }
  /* The whole zone is a <label>, so clicking anywhere opens the file picker. */
  .drop {
    position: relative;
    align-items: center;
    text-align: center;
    gap: 0.25rem;
    padding: 1.6rem 1rem;
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    color: var(--text);
    cursor: pointer;
    font-size: 1rem;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .drop:hover,
  .drop.dragging {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .drop:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .drop input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .drop-icon {
    font-size: 1.8rem;
  }
  .picked {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
  }
  .picked-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .picked-text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .or {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--muted);
    font-size: 0.85rem;
  }
  .or::before,
  .or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  .option {
    margin-top: 0.75rem;
    max-width: 18rem;
  }
  summary {
    cursor: pointer;
  }
  .actions {
    justify-content: flex-end;
  }
</style>
