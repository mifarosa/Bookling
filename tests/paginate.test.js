import { describe, expect, it } from 'vitest';
import { paginate } from '../src/lib/paginate.js';

const para = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ') + '.';

describe('paginate', () => {
  it('groups paragraphs up to the word limit', () => {
    const pages = paginate([para(40), para(40), para(40)], 'en', 100);
    expect(pages.map((p) => p.length)).toEqual([2, 1]);
  });

  it('starts a new page at headings', () => {
    const pages = paginate([para(10), { text: 'Chapter 2', heading: true }, para(10)], 'en', 100);
    expect(pages).toHaveLength(2);
    expect(pages[1][0]).toBe('# Chapter 2');
  });

  it('splits a very long paragraph at sentence boundaries', () => {
    const long = Array.from({ length: 30 }, () => 'This is a short sentence here.').join(' ');
    const pages = paginate([long], 'en', 50);
    expect(pages.length).toBeGreaterThan(2);
    for (const p of pages) expect(p.join(' ').split(' ').length).toBeLessThanOrEqual(60);
  });
});
