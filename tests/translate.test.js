import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateError, translateAlternatives, translateText } from '../src/lib/translate.js';

function mockFetchOnce(body, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body
  });
}

describe('translateText', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the translated text and calls the MyMemory endpoint with langpair', async () => {
    mockFetchOnce({ responseData: { translatedText: 'kedi' } });
    const result = await translateText('cat-lookup', 'en', 'tr');
    expect(result).toBe('kedi');
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('api.mymemory.translated.net');
    expect(url).toContain('langpair=en|tr');
    expect(url).toContain('q=cat-lookup');
  });

  it('caches repeated lookups of the same word/language pair', async () => {
    mockFetchOnce({ responseData: { translatedText: 'kopek' } });
    await translateText('dog-cache-word', 'en', 'tr');
    await translateText('Dog-Cache-Word', 'en', 'tr'); // case-insensitive cache key
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the service reports an error result', async () => {
    mockFetchOnce({ responseData: { translatedText: 'INVALID SOURCE LANGUAGE' } });
    await expect(translateText('xyz123', 'en', 'tr')).rejects.toThrow(TranslateError);
  });

  it('throws a TranslateError on a non-ok HTTP response', async () => {
    mockFetchOnce({}, false, 500);
    await expect(translateText('dog', 'en', 'tr')).rejects.toThrow(TranslateError);
  });

  it('throws when the language has no translate-to code', async () => {
    await expect(translateText('dog', 'en', '')).rejects.toThrow(TranslateError);
  });

  it('resolves empty input without calling the network', async () => {
    global.fetch = vi.fn();
    expect(await translateText('   ', 'en', 'tr')).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('translateAlternatives', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns other matches, excluding the primary result and duplicates, best match first', async () => {
    mockFetchOnce({
      responseData: { translatedText: 'kedi' },
      matches: [
        { translation: 'kedi', match: 1 }, // same as primary, dropped
        { translation: 'pisi', match: 0.7 },
        { translation: 'Pisi', match: 0.7 }, // duplicate of "pisi", case-insensitive
        { translation: 'kedicik', match: 0.9 }
      ]
    });
    const alts = await translateAlternatives('alt-word-1', 'en', 'tr');
    expect(alts).toEqual(['kedicik', 'pisi']);
  });

  it('caps the list and returns an empty array when there are no matches', async () => {
    mockFetchOnce({ responseData: { translatedText: 'x' } });
    expect(await translateAlternatives('alt-word-2', 'en', 'tr')).toEqual([]);
  });

  it('never throws: resolves to an empty array when the lookup fails', async () => {
    mockFetchOnce({}, false, 500);
    await expect(translateAlternatives('alt-word-3', 'en', 'tr')).resolves.toEqual([]);
  });

  it('shares one network request with a concurrent translateText call for the same word', async () => {
    mockFetchOnce({ responseData: { translatedText: 'ev' }, matches: [{ translation: 'konut', match: 0.5 }] });
    const [text, alts] = await Promise.all([
      translateText('alt-word-4', 'en', 'tr'),
      translateAlternatives('alt-word-4', 'en', 'tr')
    ]);
    expect(text).toBe('ev');
    expect(alts).toEqual(['konut']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
