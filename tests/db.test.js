import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearResumeAnchor,
  db,
  deleteBook,
  deleteNote,
  ensureSeedData,
  notesForBook,
  saveNote,
  setResumeAnchor
} from '../src/lib/db.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeedData();
});

async function makeBook() {
  const language = await db.languages.toArray().then((l) => l[0]);
  const bookId = await db.books.add({
    title: 'Test Book',
    author: '',
    languageId: language.id,
    pageCount: 2,
    wordCount: 10,
    currentPage: 0,
    resumeAnchor: null,
    chapters: [],
    createdAt: Date.now(),
    lastOpenedAt: Date.now()
  });
  await db.pages.bulkAdd([
    { bookId, index: 0, paragraphs: ['Hello world.'] },
    { bookId, index: 1, paragraphs: ['Bye now.'] }
  ]);
  return bookId;
}

describe('resume anchor', () => {
  it('sets and clears the reader bookmark on a book', async () => {
    const bookId = await makeBook();
    await setResumeAnchor(bookId, 1, 3);
    expect((await db.books.get(bookId)).resumeAnchor).toEqual({ page: 1, paragraph: 3 });

    await clearResumeAnchor(bookId);
    expect((await db.books.get(bookId)).resumeAnchor).toBeNull();
  });
});

describe('notes', () => {
  it('creates then updates a note for the same paragraph', async () => {
    const bookId = await makeBook();
    const created = await saveNote(bookId, 0, 0, 'Hello world.', 'first note');
    expect(created.id).toBeDefined();

    const updated = await saveNote(bookId, 0, 0, 'Hello world.', 'edited note');
    expect(updated.id).toBe(created.id);

    const all = await notesForBook(bookId);
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('edited note');
  });

  it('deletes a note', async () => {
    const bookId = await makeBook();
    const note = await saveNote(bookId, 0, 0, 'excerpt', 'text');
    await deleteNote(note.id);
    expect(await notesForBook(bookId)).toEqual([]);
  });

  it('removes notes when the book is deleted', async () => {
    const bookId = await makeBook();
    await saveNote(bookId, 0, 0, 'excerpt', 'text');
    await deleteBook(bookId);
    expect(await notesForBook(bookId)).toEqual([]);
    expect(await db.books.get(bookId)).toBeUndefined();
  });
});
