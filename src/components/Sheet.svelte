<script>
  /** A small bottom sheet (desktop: centered dialog) used for the TOC, notes list and appearance menu. */
  let { title, onclose, children } = $props();

  function onKey(e) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<button class="backdrop" onclick={onclose} aria-label="Close"></button>
<div class="sheet" role="dialog" aria-label={title}>
  <div class="head">
    <strong>{title}</strong>
    <button class="close" onclick={onclose} aria-label="Close">✕</button>
  </div>
  <div class="body">
    {@render children?.()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background: rgb(0 0 0 / 0.35);
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 31;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 24px rgb(0 0 0 / 0.2);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .head strong {
    font-size: 1.05rem;
  }
  .body {
    overflow-y: auto;
    padding: 0.5rem 1rem 1.25rem;
  }
  @media (min-width: 640px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(480px, 90vw);
      max-height: 80vh;
      border-radius: 16px;
    }
  }
</style>
