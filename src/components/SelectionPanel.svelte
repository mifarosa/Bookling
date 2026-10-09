<script>
  import { canSpeak, speak } from '../lib/speech.js';
  import { translateAlternatives, translateText } from '../lib/translate.js';

  /**
   * Shows a translation for an arbitrary selected phrase/sentence (not a single tracked word —
   * no status, no save). @type {{ language: any, text: string, onclose: () => void }}
   */
  let { language, text, onclose } = $props();

  let translation = $state('');
  let alternatives = $state([]);
  let loading = $state(false);
  let error = $state('');

  $effect(() => {
    const phrase = text;
    translation = '';
    alternatives = [];
    error = '';

    const sourceCode = language?.code;
    const targetCode = language?.translateTo;
    if (!sourceCode || !targetCode || !phrase) return;

    const controller = new AbortController();
    loading = true;
    translateText(phrase, sourceCode, targetCode, { signal: controller.signal })
      .then((result) => {
        translation = result;
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') error = err.message || 'Çeviri alınamadı.';
      })
      .finally(() => {
        loading = false;
      });
    translateAlternatives(phrase, sourceCode, targetCode, { signal: controller.signal }).then((result) => {
      alternatives = result;
    });
    return () => controller.abort();
  });
</script>

<aside class="panel" aria-label="Selection translation">
  <div class="head">
    <p class="phrase" dir={language?.rightToLeft ? 'rtl' : 'auto'}>{text}</p>
    {#if canSpeak()}
      <button onclick={() => speak(text, language?.code)} aria-label="Pronounce">🔊</button>
    {/if}
    <button class="close" onclick={onclose} aria-label="Close">✕</button>
  </div>

  <div class="translate-block">
    {#if loading}
      <p class="muted small">Çevriliyor…</p>
    {:else if translation}
      <p class="translation-text">{translation}</p>
    {:else if error}
      <p class="error small">{error}</p>
    {/if}
    {#if alternatives.length}
      <div class="alternatives">
        <span class="muted small">Diğer seçenekler:</span>
        <div class="row">
          {#each alternatives as alt}
            <span class="alt-chip">{alt}</span>
          {/each}
        </div>
      </div>
    {/if}
  </div>
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
    align-items: flex-start;
    gap: 0.5rem;
  }
  .phrase {
    font-size: 1.2rem;
    font-family: var(--reader-font);
    line-height: 1.4;
    flex: 1;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .translate-block {
    display: grid;
    gap: 0.5rem;
  }
  .translation-text {
    font-size: 1.15rem;
    font-family: var(--reader-font);
    line-height: 1.5;
    margin: 0;
    padding: 0.6rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .alternatives {
    display: grid;
    gap: 0.3rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .alt-chip {
    font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .small {
    font-size: 0.85rem;
  }
</style>
