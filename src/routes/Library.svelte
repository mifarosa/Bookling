<script>
  import { liveQuery } from 'dexie';
  import { db, deleteBook } from '../lib/db.js';

  const books = liveQuery(() => db.books.orderBy('lastOpenedAt').reverse().toArray());
  const languages = liveQuery(() => db.languages.toArray());

  const langName = (id) => $languages?.find((l) => l.id === id)?.name ?? '';

  let search = $state('');
  const visible = $derived.by(() => {
    const q = search.trim().toLocaleLowerCase();
    const all = $books ?? [];
    return q ? all.filter((b) => `${b.title} ${b.author ?? ''}`.toLocaleLowerCase().includes(q)) : all;
  });

  /** A deterministic cover color per book, so the shelf doesn't look like a flat list. */
  function coverHue(title) {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
    return h;
  }

  async function remove(book, e) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`"${book.title}" silinsin mi? Kaydettiğin kelimeler silinmez.`)) await deleteBook(book.id);
  }
</script>

<div class="page">
  <div class="row header">
    <h1>Kitaplık</h1>
    <a class="button primary" href="#/import">＋ Kitap ekle</a>
  </div>

  {#if $books && $books.length === 0}
    <div class="card empty-state">
      <span class="emoji" aria-hidden="true">📚</span>
      <h2>Henüz kitabın yok</h2>
      <p class="muted">Bir EPUB veya TXT dosyası ekle ya da bir metin yapıştır; okurken bilmediğin kelimelere dokunup çeviriye bak.</p>
      <a class="button primary" href="#/import">İlk kitabını ekle</a>
    </div>
  {:else if $books}
    {#if $books.length > 5}
      <input
        class="search"
        type="search"
        bind:value={search}
        placeholder="Kitap veya yazar ara…"
        aria-label="Kitaplıkta ara"
      />
    {/if}

    {#if visible.length === 0}
      <p class="muted">“{search}” ile eşleşen kitap yok.</p>
    {/if}

    <ul class="shelf">
      {#each visible as book (book.id)}
        {@const progress = Math.round(((book.currentPage + 1) / book.pageCount) * 100)}
        {@const hue = coverHue(book.title)}
        <li>
          <a class="open" href="#/read/{book.id}" aria-label="{book.title} kitabını aç, %{progress}">
            <div class="cover" style="background: linear-gradient(155deg, hsl({hue} 55% 45%), hsl({hue} 60% 30%))">
              <span class="initial">{book.title.trim().charAt(0).toUpperCase() || '?'}</span>
              <span class="pct">%{progress}</span>
            </div>
            <div class="meta">
              <strong>{book.title}</strong>
              {#if book.author}<span class="muted small">{book.author}</span>{/if}
              <span class="muted small">
                {langName(book.languageId)} · sayfa {book.currentPage + 1}/{book.pageCount}
              </span>
              <span class="bar"><span style="width: {progress}%"></span></span>
            </div>
          </a>
          <button class="remove" onclick={(e) => remove(book, e)} aria-label="“{book.title}” kitabını sil" title="Sil">
            🗑
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .header {
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  .search {
    width: 100%;
    margin-bottom: 1rem;
  }
  .shelf li {
    position: relative;
  }
  .shelf {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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
  .pct {
    position: absolute;
    left: 0.4rem;
    bottom: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.4);
    color: #fff;
  }
  /* Big enough to hit with a thumb, but clear of the cover so it can't be tapped by accident. */
  .remove {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    min-height: 0;
    line-height: 1;
    font-size: 1rem;
    border-radius: 50%;
    border: none;
    background: rgb(0 0 0 / 0.45);
    color: #fff;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .shelf li:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  @media (hover: none) {
    .remove {
      opacity: 0.85;
      width: 2.2rem;
      height: 2.2rem;
      font-size: 0.9rem;
    }
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
