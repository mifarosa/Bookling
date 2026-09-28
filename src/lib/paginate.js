import { countWords } from './tokenize.js';

export const DEFAULT_WORDS_PER_PAGE = 250;

/**
 * Groups paragraphs into pages of roughly `wordsPerPage` words without splitting paragraphs,
 * except when a single paragraph is much longer than a page; those are split at sentence ends.
 * Chapter titles (objects with `heading: true`) always start a new page.
 * @param {Array<string|{text:string, heading?:boolean}>} blocks
 * @returns {string[][]} pages, each an array of paragraph strings (headings prefixed with "# ")
 */
export function paginate(blocks, code, wordsPerPage = DEFAULT_WORDS_PER_PAGE) {
  const pages = [];
  let current = [];
  let count = 0;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    count = 0;
  };

  for (const block of blocks) {
    const isHeading = typeof block === 'object' && block.heading;
    const text = typeof block === 'string' ? block : block.text;
    if (isHeading) {
      flush();
      current.push('# ' + text);
      continue;
    }
    for (const piece of splitLong(text, code, wordsPerPage)) {
      const n = countWords(piece, code);
      if (count > 0 && count + n > wordsPerPage) flush();
      current.push(piece);
      count += n;
    }
  }
  flush();
  return pages;
}

function splitLong(text, code, limit) {
  if (countWords(text, code) <= limit * 1.5) return [text];
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+["'”’)\]]*\s*|[^.!?。！？]+$/gu) || [text];
  const out = [];
  let buf = '';
  let n = 0;
  for (const s of sentences) {
    const k = countWords(s, code);
    if (n > 0 && n + k > limit) {
      out.push(buf.trim());
      buf = '';
      n = 0;
    }
    buf += s;
    n += k;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
