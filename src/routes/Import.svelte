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

  async function submit(e) {
    e.preventDefault();
    error = '';
    const language = languages.find((l) => l.id === languageId);
    if (!language) {
      error = 'Please pick a language (add one in Settings).';
      return;
    }
    busy = true;
    try {
      let parsed;
      if (file) {
        parsed = await parseFile(file);
        if (title.trim()) parsed.title = title.trim();
      } else if (text.trim()) {
        parsed = parseText(text, title.trim() || 'Pasted text');
      } else {
        throw new Error('Choose a file or paste some text.');
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
  <h1>Import</h1>
  <form class="card" onsubmit={submit}>
    <label>
      Language
      <select bind:value={languageId}>
        {#each languages as lang (lang.id)}
          <option value={lang.id}>{lang.name}</option>
        {/each}
      </select>
    </label>

    <label>
      File (EPUB or TXT)
      <input type="file" accept=".epub,.txt,application/epub+zip,text/plain" onchange={onFile} />
    </label>
    {#if file}
      <p class="muted">Selected: {file.name} ({isEpub(file) ? 'EPUB' : 'text'})
        <button type="button" onclick={() => (file = null)}>Clear</button></p>
    {/if}

    <label>
      Title {file ? '(optional, overrides the book title)' : ''}
      <input bind:value={title} placeholder="Title" />
    </label>

    {#if !file}
      <label>
        …or paste text
        <textarea bind:value={text} rows="8" placeholder="Paste an article or a chapter here"></textarea>
      </label>
    {/if}

    <details>
      <summary class="muted">Options</summary>
      <label>
        Words per page
        <input type="number" min="50" max="2000" step="10" bind:value={wordsPerPage} />
      </label>
    </details>

    {#if error}<p class="error">{error}</p>{/if}

    <div class="row">
      <button class="primary" type="submit" disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>
      <a href="#/">Cancel</a>
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
</style>
