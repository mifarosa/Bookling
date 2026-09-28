import { countWords } from './tokenize.js';

export const DEFAULT_WORDS_PER_PAGE = 250;

/**
 * Groups paragraphs into pages of roughly `wordsPerPage` words without splitting paragraphs,
 * except when a single paragraph is much longer than a page; those are split at sentence ends.
 * Chapter titles (objects with `heading: true`) always start a new page. Images are atomic and
 * never contribute to the word count.
 * @param {Array<string|{text:string, heading?:boolean}|{image:true, src:string, alt?:string}>} blocks
 * @returns {{ pages: Array<Array<string|{image:true,src:string,alt?:string}>>, blockPage: number[] }}
 *   `blockPage[i]` is the resulting page index for `blocks[i]` (its first piece, if split).
 */
export function paginate(blocks, code, wordsPerPage = DEFAULT_WORDS_PER_PAGE) {
  const pages = [];
  const blockPage = new Array(blocks.length).fill(0);
  let current = [];
  let count = 0;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    count = 0;
  };

  blocks.forEach((block, i) => {
    if (typeof block === 'object' && block.image) {
      blockPage[i] = pages.length;
      current.push(block);
      return;
    }

    const isHeading = typeof block === 'object' && block.heading;
    const text = typeof block === 'string' ? block : block.text;

    if (isHeading) {
      flush();
      blockPage[i] = pages.length;
      current.push('# ' + text);
      return;
    }

    let recorded = false;
    for (const piece of splitLong(text, code, wordsPerPage)) {
      const n = countWords(piece, code);
      if (count > 0 && count + n > wordsPerPage) flush();
      if (!recorded) {
        blockPage[i] = pages.length;
        recorded = true;
      }
      current.push(piece);
      count += n;
    }
  });
  flush();
  return { pages, blockPage };
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
