// Machine translation for the "translate on tap" panel in the reader. Everything is shown in the app
// itself — no redirecting to an external dictionary site.
// Uses MyMemory (https://mymemory.translated.net/doc/spec.php): free, keyless, and CORS-enabled,
// so it works straight from a static site with no backend of our own.
//
// MyMemory's translation memory is crowdsourced, so especially for very common short words (stopwords
// like "the") it can return noisy entries: HTML-entity-escaped control characters from tab-separated
// source data, or long unrelated fragments. We decode entities and filter those out below, picking the
// best surviving candidate (by MyMemory's own match score) across both its single "best" result and its
// list of alternate matches, rather than trusting the "best" one blindly.

const ENDPOINT = 'https://api.mymemory.translated.net/get';
const BAD_RESULT_RE = /INVALID|QUERY LENGTH|NO QUERY SPECIFIED|MYMEMORY WARNING/i;
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;
const MAX_ALTERNATIVES = 4;

const cache = new Map(); // "source|target|text" -> the raw MyMemory response (parsed JSON)
const inflight = new Map(); // same key -> in-flight fetch promise, so parallel calls share one request

export class TranslateError extends Error {}

function cacheKey(text, sourceCode, targetCode) {
  return `${sourceCode}|${targetCode}|${text.trim().toLocaleLowerCase()}`;
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

/**
 * Decodes and validates one candidate translation. Returns the cleaned string, or null if it's empty,
 * an API error placeholder, contains control characters (a sign of mangled source data), or is
 * implausibly long for the word/phrase being looked up.
 */
function sanitizeCandidate(raw, queryLength) {
  if (!raw) return null;
  const decoded = decodeEntities(raw).trim();
  if (!decoded || BAD_RESULT_RE.test(decoded) || CONTROL_CHAR_RE.test(decoded)) return null;
  if (decoded.length > Math.max(40, queryLength * 6)) return null;
  return decoded;
}

/** Fetches (and caches) the raw MyMemory response for one lookup. */
async function lookup(text, sourceCode, targetCode, { signal } = {}) {
  const q = text.trim();
  if (!sourceCode || !targetCode) throw new TranslateError('This language has no translate-to code set.');

  const key = cacheKey(q, sourceCode, targetCode);
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(sourceCode)}|${encodeURIComponent(targetCode)}`;
  const promise = (async () => {
    let res;
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new TranslateError('Could not reach the translation service (are you offline?).');
    }
    if (!res.ok) throw new TranslateError(`Translation service returned ${res.status}.`);
    const data = await res.json();
    cache.set(key, data);
    return data;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Looks up `text` and returns every usable translation (MyMemory's "best" result plus its alternate
 * matches), deduplicated and sorted best-first by MyMemory's own match score.
 */
async function bestCandidates(text, sourceCode, targetCode, opts) {
  const q = text.trim();
  const data = await lookup(q, sourceCode, targetCode, opts);

  const raw = [];
  if (data?.responseData?.translatedText) {
    raw.push({ text: data.responseData.translatedText, score: data.responseData.match ?? 1 });
  }
  for (const m of data?.matches ?? []) {
    if (m?.translation) raw.push({ text: m.translation, score: m.match ?? 0 });
  }
  raw.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const seen = new Set();
  const candidates = [];
  for (const c of raw) {
    const clean = sanitizeCandidate(c.text, q.length);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(clean);
  }
  return candidates;
}

/**
 * Looks up a short text (a word or phrase) and returns its best translation.
 * @param {string} text
 * @param {string} sourceCode BCP-47 source language code (e.g. "en")
 * @param {string} targetCode BCP-47 target language code (e.g. "tr")
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<string>}
 */
export async function translateText(text, sourceCode, targetCode, opts = {}) {
  if (!text.trim()) return '';
  const [best] = await bestCandidates(text, sourceCode, targetCode, opts);
  if (!best) throw new TranslateError('No translation found.');
  return best;
}

/**
 * Returns a short list of other translations for the same text (from MyMemory's translation-memory
 * matches), so the panel can offer choices itself instead of linking out to a dictionary site.
 * Never throws: on any lookup failure it resolves to an empty list, since the caller already surfaces
 * `translateText`'s error for the same lookup.
 * @returns {Promise<string[]>}
 */
export async function translateAlternatives(text, sourceCode, targetCode, opts = {}) {
  if (!text.trim()) return [];
  let candidates;
  try {
    candidates = await bestCandidates(text, sourceCode, targetCode, opts);
  } catch {
    return [];
  }
  return candidates.slice(1, 1 + MAX_ALTERNATIVES);
}
