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

/**
 * Stores a parsed book and its pages. Returns the new book id.
 * @param {{title:string, author?:string, blocks:Array}} parsed
 * @param {{id:number, code:string}} language
 */
export async function saveBook(parsed, language, wordsPerPage) {
  const pages = paginate(parsed.blocks, language.code, wordsPerPage);
  if (!pages.length) throw new Error('The text is empty.');

  const wordCount = pages.reduce(
    (sum, p) => sum + p.reduce((s, para) => s + countWords(para, language.code), 0),
    0
  );

  const bookId = await db.transaction('rw', db.books, db.pages, async () => {
    const id = await db.books.add({
      title: parsed.title || 'Untitled',
      author: parsed.author || '',
      languageId: language.id,
      pageCount: pages.length,
      wordCount,
      currentPage: 0,
      createdAt: Date.now(),
      lastOpenedAt: Date.now()
    });
    await db.pages.bulkAdd(pages.map((paragraphs, index) => ({ bookId: id, index, paragraphs })));
    return id;
  });

  requestPersistentStorage();
  return bookId;
}
