<script>
  import { STATUS } from '../lib/db.js';
  import { dictionaryUrl } from '../lib/dictionary.js';
  import { canSpeak, speak } from '../lib/speech.js';

  /**
   * @type {{
   *   language: any, word: string, termKey: string, term: any,
   *   onsave: (fields: object) => void, ondelete: () => void, onclose: () => void
   * }}
   */
  let { language, word, termKey, term, onsave, ondelete, onclose } = $props();

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
  let dictIndex = $state(0);

  $effect(() => {
    // Reset the form whenever another word is selected.
    termKey;
    translation = term?.translation ?? '';
    romanization = term?.romanization ?? '';
    parent = term?.parent ?? '';
  });

  const dictionaries = $derived(language?.dictionaries ?? []);
  const activeDict = $derived(dictionaries[dictIndex] ?? null);
  const status = $derived(term?.status ?? STATUS.UNKNOWN);

  function setStatus(value) {
    onsave({ status: value, translation, romanization, parent });
  }

  function saveDetails(e) {
    e?.preventDefault();
    onsave({ status: status || STATUS.NEW, translation, romanization, parent });
  }

  function openDict(d, i) {
    if (d.embed) dictIndex = i;
    else window.open(dictionaryUrl(d.url, word), '_blank', 'noopener');
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
    <label>
      Translation
      <textarea rows="2" bind:value={translation} placeholder="Meaning, notes…"></textarea>
    </label>
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

  {#if dictionaries.length}
    <div class="dicts row">
      {#each dictionaries as d, i}
        <button class:current={d.embed && i === dictIndex} onclick={() => openDict(d, i)}>
          {d.name}{d.embed ? '' : ' ↗'}
        </button>
      {/each}
    </div>
    {#if activeDict?.embed}
      <iframe
        title="{activeDict.name}: {word}"
        src={dictionaryUrl(activeDict.url, word)}
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      ></iframe>
      <a class="muted small" href={dictionaryUrl(activeDict.url, word)} target="_blank" rel="noopener"
        >Open {activeDict.name} in a new tab ↗</a
      >
    {/if}
  {/if}
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
  .two > label {
    flex: 1 1 8rem;
  }
  .two input {
    width: 100%;
  }
  .dicts button {
    font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
  }
  iframe {
    width: 100%;
    flex: 1;
    min-height: 260px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
  }
  .small {
    font-size: 0.8rem;
  }
</style>
