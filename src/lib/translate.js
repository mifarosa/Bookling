// Machine translation for the "translate on tap" suggestion in the reader.
// Uses MyMemory (https://mymemory.translated.net/doc/spec.php): free, keyless, and CORS-enabled,
// so it works straight from a static site with no backend of our own.

const ENDPOINT = 'https://api.mymemory.translated.net/get';
const BAD_RESULT_RE = /INVALID|QUERY LENGTH|NO QUERY SPECIFIED|MYMEMORY WARNING/i;

const cache = new Map();

export class TranslateError extends Error {}

/**
 * Looks up a short text (a word or phrase) and returns its translation.
 * Results are cached in memory per (source, target, text) for the session.
 * @param {string} text
 * @param {string} sourceCode BCP-47 source language code (e.g. "en")
 * @param {string} targetCode BCP-47 target language code (e.g. "tr")
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<string>}
 */
export async function translateText(text, sourceCode, targetCode, { signal } = {}) {
  const q = text.trim();
  if (!q) return '';
  if (!sourceCode || !targetCode) throw new TranslateError('This language has no translate-to code set.');

  const key = `${sourceCode}|${targetCode}|${q.toLocaleLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(sourceCode)}|${encodeURIComponent(targetCode)}`;
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new TranslateError('Could not reach the translation service (are you offline?).');
  }
  if (!res.ok) throw new TranslateError(`Translation service returned ${res.status}.`);

  const data = await res.json();
  const translated = data?.responseData?.translatedText?.trim();
  if (!translated || BAD_RESULT_RE.test(translated)) {
    throw new TranslateError('No translation found.');
  }

  cache.set(key, translated);
  return translated;
}
