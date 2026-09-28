import { describe, expect, it } from 'vitest';
import { countWords, splitParagraphs, tokenize } from '../src/lib/tokenize.js';

describe('tokenize', () => {
  it('splits words and keeps punctuation/whitespace as non-words', () => {
    const tokens = tokenize('Hello, world!', 'en');
    expect(tokens.map((t) => t.text).join('')).toBe('Hello, world!');
    expect(tokens.filter((t) => t.isWord).map((t) => t.text)).toEqual(['Hello', 'world']);
  });

  it('keeps apostrophe contractions together', () => {
    const words = tokenize("I don't know l’homme", 'en').filter((t) => t.isWord).map((t) => t.text);
    expect(words).toContain("don't");
    expect(words).toContain('l’homme');
  });

  it('does not treat numbers as words', () => {
    expect(tokenize('In 1984 there were 3 cats', 'en').filter((t) => t.isWord).map((t) => t.text)).toEqual([
      'In',
      'there',
      'were',
      'cats'
    ]);
  });

  it('handles non-Latin scripts', () => {
    expect(countWords('Привет, как дела?', 'ru')).toBe(3);
    expect(countWords('Merhaba dünya, nasılsın?', 'tr')).toBe(3);
  });

  it('segments Japanese without spaces', () => {
    const words = tokenize('私は猫です', 'ja').filter((t) => t.isWord);
    expect(words.length).toBeGreaterThan(1);
  });
});

describe('splitParagraphs', () => {
  it('splits on newlines and drops empty lines', () => {
    expect(splitParagraphs('One.\r\n\r\nTwo  three.\nFour.\n\n')).toEqual(['One.', 'Two three.', 'Four.']);
  });
});
