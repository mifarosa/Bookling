import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateError, translateText } from '../src/lib/translate.js';

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
