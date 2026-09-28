<script>
  import { STATUS } from '../lib/db.js';
  import { canSpeak, speak } from '../lib/speech.js';
  import { translateAlternatives, translateText } from '../lib/translate.js';

  /**
   * @type {{
   *   language: any, word: string, term: any,
   *   onsave: (fields: object) => void, ondelete: () => void, onclose: () => void
   * }}
   */
  let { language, word, term, onsave, ondelete, onclose } = $props();

  const STATUS_BUTTONS = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
    { value: STATUS.WELL_KNOWN, label: 'Known', title: 'Well known (W)' },
    { value: STATUS.IGNORED, label: 'Ignore', title: 'Ignore (I)' }
  ];

  let translation = $state('');
  let romanization = $state('');
  let parent = $state('');

  // Direct machine translation, shown entirely in this panel (no dictionary site to jump to):
  // fetched automatically for every word tapped, used to fill the translation field when the term
  // is new, and offered as alternatives from the same lookup otherwise. Never overwrites a saved
  // translation that differs from the fresh result.
  let suggestion = $state('');
  let alternatives = $state([]);
  let suggestLoading = $state(false);
  let suggestError = $state('');

  $effect(() => {
    // Reset the form whenever another word is selected.
    const w = word;
    const savedTranslation = term?.translation ?? '';
    translation = savedTranslation;
    romanization = term?.romanization ?? '';
    parent = term?.parent ?? '';
    suggestion = '';
    alternatives = [];
    suggestError = '';

    const sourceCode = language?.code;
    const targetCode = language?.translateTo;
    if (!sourceCode || !targetCode || !w) return;

    const controller = new AbortController();
    suggestLoading = true;
    translateText(w, sourceCode, targetCode, { signal: controller.signal })
      .then((result) => {
        suggestion = result;
        if (!savedTranslation && !translation) translation = result;
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') suggestError = err.message || 'Çeviri alınamadı.';
      })
      .finally(() => {
        suggestLoading = false;
      });
    translateAlternatives(w, sourceCode, targetCode, { signal: controller.signal }).then((result) => {
      alternatives = result;
    });
    return () => controller.abort();
  });

  const status = $derived(term?.status ?? STATUS.UNKNOWN);

  function setStatus(value) {
    onsave({ status: value, translation, romanization, parent });
  }

  function saveDetails(e) {
    e?.preventDefault();
    onsave({ status: status || STATUS.NEW, translation, romanization, parent });
  }

  function useTranslation(value) {
    translation = value;
    saveDetails();
  }
</script>

<aside class="panel" aria-label="Term details">
  <div class="head">
    <strong class="word" dir={language?.rightToLeft ? 'rtl' : 'auto'}>{word}</strong>
    {#if canSpeak()}
      <button onclick={() => speak(word, language?.code)} aria-label="Pronounce">🔊</button>
    {/if}
    <button class="close" onclick={onclose} aria-label="Close">✕</button>
  </div>

  <div class="translate-block">
    {#if suggestLoading}
      <p class="suggest muted small">Çevriliyor…</p>
    {/if}
    <textarea
      class="translation-input"
      rows="1"
      bind:value={translation}
      placeholder="Çeviri / anlam…"
      onchange={saveDetails}
    ></textarea>
    {#if suggestion && suggestion.trim().toLocaleLowerCase() !== translation.trim().toLocaleLowerCase()}
      <button type="button" class="suggest-chip" onclick={() => useTranslation(suggestion)}>
        ✨ Öneriyi kullan: <strong>{suggestion}</strong>
      </button>
    {:else if suggestError}
      <p class="suggest muted small">{suggestError}</p>
    {/if}
    {#if alternatives.length}
      <div class="alternatives">
        <span class="muted small">Diğer seçenekler:</span>
        <div class="row">
          {#each alternatives as alt}
            <button type="button" class="alt-chip" onclick={() => useTranslation(alt)}>{alt}</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="statuses" role="group" aria-label="Status">
    {#each STATUS_BUTTONS as b}
      <button
        class="st"
        data-s={b.value}
        class:current={status === b.value}
        title={b.title ?? `Learning stage ${b.value}`}
        onclick={() => setStatus(b.value)}>{b.label}</button
      >
    {/each}
  </div>

  <form onsubmit={saveDetails}>
    <div class="row two">
      <label>
        Pronunciation
        <input bind:value={romanization} />
      </label>
      <label>
        Parent (root form)
        <input bind:value={parent} />
      </label>
    </div>
    <div class="row">
      <button class="primary" type="submit">Save</button>
      {#if term}<button type="button" class="danger" onclick={ondelete}>Forget</button>{/if}
    </div>
  </form>
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--surface);
    height: 100%;
    overflow-y: auto;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .word {
    font-size: 1.4rem;
    font-family: var(--reader-font);
    flex: 1;
    overflow-wrap: anywhere;
  }
  .statuses {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .st {
    min-width: 2.4rem;
    padding: 0.4rem 0.5rem;
  }
  .st[data-s='1'] { background: var(--st-1); }
  .st[data-s='2'] { background: var(--st-2); }
  .st[data-s='3'] { background: var(--st-3); }
  .st[data-s='4'] { background: var(--st-4); }
  .st[data-s='5'] { background: var(--st-5); }
  .current {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    font-weight: 700;
  }
  form {
    display: grid;
    gap: 0.5rem;
  }
  textarea {
    width: 100%;
    resize: vertical;
  }
  .translate-block {
    display: grid;
    gap: 0.35rem;
  }
  .translation-input {
    font-size: 1.15rem;
    font-family: var(--reader-font);
    resize: vertical;
    min-height: 2.6rem;
  }
  .suggest-chip {
    text-align: left;
    width: 100%;
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    color: var(--text);
  }
  .suggest {
    margin: 0;
  }
  .alternatives {
    display: grid;
    gap: 0.3rem;
  }
  .alt-chip {
    font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
  }
  .two > label {
    flex: 1 1 8rem;
  }
  .two input {
    width: 100%;
  }
  .small {
    font-size: 0.8rem;
  }
</style>
