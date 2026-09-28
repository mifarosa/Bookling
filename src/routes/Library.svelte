<script>
  import { liveQuery } from 'dexie';
  import { db, deleteBook } from '../lib/db.js';

  const books = liveQuery(() => db.books.orderBy('lastOpenedAt').reverse().toArray());
  const languages = liveQuery(() => db.languages.toArray());

  const langName = (id) => $languages?.find((l) => l.id === id)?.name ?? '';

  async function remove(book) {
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
    <ul class="books">
      {#each $books as book (book.id)}
        {@const progress = Math.round(((book.currentPage + 1) / book.pageCount) * 100)}
        <li class="card">
          <a class="open" href="#/read/{book.id}">
            <strong>{book.title}</strong>
            {#if book.author}<span class="muted">{book.author}</span>{/if}
            <span class="muted small">
              {langName(book.languageId)} · page {book.currentPage + 1}/{book.pageCount} · {book.wordCount} words
            </span>
            <span class="bar"><span style="width: {progress}%"></span></span>
          </a>
          <button class="danger" onclick={() => remove(book)} aria-label="Delete book">✕</button>
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
  .books {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.75rem;
  }
  .books li {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .open {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    text-decoration: none;
    color: inherit;
    min-width: 0;
  }
  .small {
    font-size: 0.85rem;
  }
  .bar {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin-top: 0.4rem;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
