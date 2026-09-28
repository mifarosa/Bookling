// Machine translation for the "translate on tap" panel in the reader. Everything is shown in the app
// itself — no redirecting to an external dictionary site.
// Uses MyMemory (https://mymemory.translated.net/doc/spec.php): free, keyless, and CORS-enabled,
// so it works straight from a static site with no backend of our own.

const ENDPOINT = 'https://api.mymemory.translated.net/get';
const BAD_RESULT_RE = /INVALID|QUERY LENGTH|NO QUERY SPECIFIED|MYMEMORY WARNING/i;
const MAX_ALTERNATIVES = 4;

const cache = new Map(); // "source|target|text" -> the raw MyMemory response (parsed JSON)
const inflight = new Map(); // same key -> in-flight fetch promise, so parallel calls share one request

export class TranslateError extends Error {}

function cacheKey(text, sourceCode, targetCode) {
  return `${sourceCode}|${targetCode}|${text.trim().toLocaleLowerCase()}`;
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
 * Looks up a short text (a word or phrase) and returns its best translation.
 * @param {string} text
 * @param {string} sourceCode BCP-47 source language code (e.g. "en")
 * @param {string} targetCode BCP-47 target language code (e.g. "tr")
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<string>}
 */
export async function translateText(text, sourceCode, targetCode, opts = {}) {
  if (!text.trim()) return '';
  const data = await lookup(text, sourceCode, targetCode, opts);
  const translated = data?.responseData?.translatedText?.trim();
  if (!translated || BAD_RESULT_RE.test(translated)) {
    throw new TranslateError('No translation found.');
  }
  return translated;
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
  let data;
  try {
    data = await lookup(text, sourceCode, targetCode, opts);
  } catch {
    return [];
  }

  const primary = data?.responseData?.translatedText?.trim().toLocaleLowerCase() ?? '';
  const seen = new Set(primary ? [primary] : []);
  const alternatives = [];

  for (const m of [...(data?.matches ?? [])].sort((a, b) => (b.match ?? 0) - (a.match ?? 0))) {
    const candidate = m?.translation?.trim();
    if (!candidate || BAD_RESULT_RE.test(candidate)) continue;
    const key = candidate.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push(candidate);
    if (alternatives.length >= MAX_ALTERNATIVES) break;
  }
  return alternatives;
}
