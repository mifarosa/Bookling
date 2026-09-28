import { db, requestPersistentStorage } from '../db.js';
import { paginate } from '../paginate.js';
import { countWords } from '../tokenize.js';
import { importEpub } from './epub.js';
import { importTxt, parseText } from './txt.js';

export function isEpub(file) {
  return /\.epub$/i.test(file.name) || file.type === 'application/epub+zip';
}

export async function parseFile(file) {
  return isEpub(file) ? importEpub(file) : importTxt(file);
}

export { parseText };

function wordsIn(paragraphs, code) {
  return paragraphs.reduce((sum, p) => sum + (typeof p === 'string' ? countWords(p, code) : 0), 0);
}

/**
 * Stores a parsed book and its pages. Returns the new book id.
 * @param {{title:string, author?:string, blocks:Array, chapters?:Array<{title:string, blockIndex:number}>}} parsed
 * @param {{id:number, code:string}} language
 */
export async function saveBook(parsed, language, wordsPerPage) {
  const { pages, blockPage } = paginate(parsed.blocks, language.code, wordsPerPage);
  if (!pages.length) throw new Error('The text is empty.');

  const wordCount = pages.reduce((sum, p) => sum + wordsIn(p, language.code), 0);

  const chapters = [];
  let lastPage = -1;
  for (const c of parsed.chapters ?? []) {
    const page = blockPage[c.blockIndex] ?? 0;
    if (page === lastPage) continue; // several TOC entries can land on the same reading page
    chapters.push({ title: c.title, page });
    lastPage = page;
  }

  const bookId = await db.transaction('rw', db.books, db.pages, async () => {
    const id = await db.books.add({
      title: parsed.title || 'Untitled',
      author: parsed.author || '',
      languageId: language.id,
      pageCount: pages.length,
      wordCount,
      currentPage: 0,
      resumeAnchor: null,
      chapters,
      createdAt: Date.now(),
      lastOpenedAt: Date.now()
    });
    await db.pages.bulkAdd(pages.map((paragraphs, index) => ({ bookId: id, index, paragraphs })));
    return id;
  });

  requestPersistentStorage();
  return bookId;
}
