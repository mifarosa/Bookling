<script>
  import { liveQuery } from 'dexie';
  import { db, deleteBook } from '../lib/db.js';

  const books = liveQuery(() => db.books.orderBy('lastOpenedAt').reverse().toArray());
  const languages = liveQuery(() => db.languages.toArray());

  const langName = (id) => $languages?.find((l) => l.id === id)?.name ?? '';

  /** A deterministic cover color per book, so the shelf doesn't look like a flat list. */
  function coverHue(title) {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
    return h;
  }

  async function remove(book, e) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete "${book.title}"? Your saved terms are kept.`)) await deleteBook(book.id);
  }
</script>

<div class="page">
  <div class="row header">
    <h1>Library</h1>
    <a class="button primary" href="#/import">+ Import</a>
  </div>

  {#if $books && $books.length === 0}
    <div class="card empty">
      <p>No books yet.</p>
      <p class="muted">Import an EPUB or TXT file, or paste some text, to start reading.</p>
      <a class="button primary" href="#/import">Import your first book</a>
    </div>
  {:else if $books}
    <ul class="shelf">
      {#each $books as book (book.id)}
        {@const progress = Math.round(((book.currentPage + 1) / book.pageCount) * 100)}
        {@const hue = coverHue(book.title)}
        <li>
          <a class="open" href="#/read/{book.id}">
            <div class="cover" style="background: linear-gradient(155deg, hsl({hue} 55% 45%), hsl({hue} 60% 30%))">
              <span class="initial">{book.title.trim().charAt(0).toUpperCase() || '?'}</span>
              <button class="remove" onclick={(e) => remove(book, e)} aria-label="Delete book">✕</button>
            </div>
            <div class="meta">
              <strong>{book.title}</strong>
              {#if book.author}<span class="muted small">{book.author}</span>{/if}
              <span class="muted small">
                {langName(book.languageId)} · s. {book.currentPage + 1}/{book.pageCount}
              </span>
              <span class="bar"><span style="width: {progress}%"></span></span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .header {
    justify-content: space-between;
  }
  .button {
    display: inline-block;
    text-decoration: none;
    border-radius: 8px;
    padding: 0.45rem 0.8rem;
  }
  .button.primary {
    background: var(--accent);
    color: var(--accent-text);
  }
  .empty {
    text-align: center;
  }
  .shelf {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1.1rem 0.9rem;
  }
  .open {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    text-decoration: none;
    color: inherit;
  }
  .cover {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: 8px;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .initial {
    font-family: var(--reader-font);
    font-size: 2.6rem;
    color: rgb(255 255 255 / 0.85);
  }
  .remove {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    line-height: 1;
    font-size: 0.75rem;
    border-radius: 50%;
    border: none;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .meta strong {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.25;
  }
  .small {
    font-size: 0.8rem;
  }
  .bar {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin-top: 0.2rem;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
