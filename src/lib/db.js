import Dexie from 'dexie';

// Term statuses follow Lute v3: 1-5 = learning stages, 99 = well known, 98 = ignored.
// Status 0 means "unknown" and is never stored; an absent term row is unknown.
export const STATUS = Object.freeze({
  UNKNOWN: 0,
  NEW: 1,
  LEARNING_2: 2,
  LEARNING_3: 3,
  LEARNING_4: 4,
  LEARNED: 5,
  IGNORED: 98,
  WELL_KNOWN: 99
});

export const db = new Dexie('bookling');

db.version(1).stores({
  languages: '++id, &name',
  books: '++id, languageId, lastOpenedAt',
  pages: '++id, [bookId+index], bookId',
  terms: '++id, &[languageId+text], languageId, status',
  settings: 'key'
});

// v2: per-paragraph notes, so readers can jot something down without leaving the page.
db.version(2).stores({
  notes: '++id, bookId, [bookId+pageIndex], updatedAt'
});

/** `translateTo` is the target language for the built-in machine translation lookup. */
export const DEFAULT_LANGUAGES = [
  { name: 'English', code: 'en', translateTo: 'tr', rightToLeft: false },
  { name: 'German', code: 'de', translateTo: 'tr', rightToLeft: false },
  { name: 'Spanish', code: 'es', translateTo: 'tr', rightToLeft: false }
];

export async function ensureSeedData() {
  if ((await db.languages.count()) === 0) {
    await db.languages.bulkAdd(DEFAULT_LANGUAGES);
  }
}

export function normalizeTerm(text, code) {
  return text.trim().toLocaleLowerCase(code || undefined);
}

/** Returns a Map of normalized term text -> term row for the given language. */
export async function loadTermMap(languageId) {
  const rows = await db.terms.where('languageId').equals(languageId).toArray();
  return new Map(rows.map((t) => [t.text, t]));
}

export async function saveTerm(languageId, text, fields) {
  const now = Date.now();
  const existing = await db.terms.where({ languageId, text }).first();
  if (existing) {
    await db.terms.update(existing.id, { ...fields, updatedAt: now });
    return { ...existing, ...fields, updatedAt: now };
  }
  const row = {
    languageId,
    text,
    status: STATUS.NEW,
    translation: '',
    romanization: '',
    parent: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...fields
  };
  row.id = await db.terms.add(row);
  return row;
}

/** Marks every given word that has no term row yet as well known. */
export async function markUnknownAsKnown(languageId, words) {
  const now = Date.now();
  const unique = [...new Set(words)];
  const existing = await db.terms
    .where('[languageId+text]')
    .anyOf(unique.map((w) => [languageId, w]))
    .toArray();
  const have = new Set(existing.map((t) => t.text));
  const rows = unique
    .filter((w) => !have.has(w))
    .map((text) => ({
      languageId,
      text,
      status: STATUS.WELL_KNOWN,
      translation: '',
      romanization: '',
      parent: '',
      tags: [],
      createdAt: now,
      updatedAt: now
    }));
  if (rows.length) await db.terms.bulkAdd(rows);
  return rows.length;
}

export async function deleteBook(bookId) {
  await db.transaction('rw', db.books, db.pages, db.notes, async () => {
    await db.pages.where('bookId').equals(bookId).delete();
    await db.notes.where('bookId').equals(bookId).delete();
    await db.books.delete(bookId);
  });
}

/** Marks a paragraph as the reader's current resume point ("kaldığım yer"). */
export async function setResumeAnchor(bookId, pageIndex, paragraphIndex) {
  await db.books.update(bookId, { resumeAnchor: { page: pageIndex, paragraph: paragraphIndex } });
}

export async function clearResumeAnchor(bookId) {
  await db.books.update(bookId, { resumeAnchor: null });
}

export function notesForBook(bookId) {
  return db.notes.where('bookId').equals(bookId).toArray();
}

export async function saveNote(bookId, pageIndex, paragraphIndex, excerpt, text) {
  const now = Date.now();
  const existing = await db.notes.where({ bookId, pageIndex, paragraphIndex }).first();
  if (existing) {
    await db.notes.update(existing.id, { text, excerpt, updatedAt: now });
    return { ...existing, text, excerpt, updatedAt: now };
  }
  const row = { bookId, pageIndex, paragraphIndex, excerpt, text, createdAt: now, updatedAt: now };
  row.id = await db.notes.add(row);
  return row;
}

export async function deleteNote(id) {
  await db.notes.delete(id);
}

/** Asks the browser not to evict our IndexedDB data (important on iOS). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
  } catch {
    // Not supported; data stays best-effort.
  }
  return false;
}
