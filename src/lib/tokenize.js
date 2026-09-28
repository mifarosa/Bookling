// Language-agnostic tokenizer built on Intl.Segmenter, with a Unicode regex fallback.

const segmenterCache = new Map();

function getSegmenter(code) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  const key = code || 'und';
  if (!segmenterCache.has(key)) {
    segmenterCache.set(key, new Intl.Segmenter(code || undefined, { granularity: 'word' }));
  }
  return segmenterCache.get(key);
}

const HAS_LETTER = /\p{L}/u;
const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

function fallbackTokenize(text) {
  const tokens = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), isWord: false });
    tokens.push({ text: m[0], isWord: HAS_LETTER.test(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), isWord: false });
  return tokens;
}

/**
 * Splits text into tokens: { text, isWord }.
 * Apostrophe contractions ("don't", "l'homme") are kept as a single word, like Lute does.
 */
export function tokenize(text, code) {
  const seg = getSegmenter(code);
  if (!seg) return fallbackTokenize(text);

  const raw = [];
  for (const s of seg.segment(text)) {
    // Pure numbers are not vocabulary.
    raw.push({ text: s.segment, isWord: Boolean(s.isWordLike) && HAS_LETTER.test(s.segment) });
  }

  // Merge word + apostrophe + word sequences that some segmenters split apart.
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    const prev = out[out.length - 1];
    const next = raw[i + 1];
    if (!t.isWord && /^['’]$/.test(t.text) && prev?.isWord && next?.isWord) {
      prev.text += t.text + next.text;
      i++;
      continue;
    }
    out.push({ ...t });
  }
  return out;
}

/** Splits text into paragraphs (blank-line or single newline separated, trimmed, non-empty). */
export function splitParagraphs(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

/** Counts word-like tokens. */
export function countWords(text, code) {
  return tokenize(text, code).filter((t) => t.isWord).length;
}
