import { describe, expect, it } from 'vitest';
import { paginate } from '../src/lib/paginate.js';

const para = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ') + '.';

describe('paginate', () => {
  it('groups paragraphs up to the word limit', () => {
    const { pages } = paginate([para(40), para(40), para(40)], 'en', 100);
    expect(pages.map((p) => p.length)).toEqual([2, 1]);
  });

  it('starts a new page at headings', () => {
    const { pages } = paginate([para(10), { text: 'Chapter 2', heading: true }, para(10)], 'en', 100);
    expect(pages).toHaveLength(2);
    expect(pages[1][0]).toBe('# Chapter 2');
  });

  it('splits a very long paragraph at sentence boundaries', () => {
    const long = Array.from({ length: 30 }, () => 'This is a short sentence here.').join(' ');
    const { pages } = paginate([long], 'en', 50);
    expect(pages.length).toBeGreaterThan(2);
    for (const p of pages) expect(p.join(' ').split(' ').length).toBeLessThanOrEqual(60);
  });

  it('keeps images as their own atomic block, uncounted towards the word limit', () => {
    const img = { image: true, src: 'data:x', alt: 'a photo' };
    const { pages, blockPage } = paginate([para(90), img, para(90)], 'en', 100);
    expect(pages[0]).toEqual([para(90), img]);
    expect(blockPage).toEqual([0, 0, 1]);
  });

  it('returns blockPage mapping each source block to its resulting page', () => {
    const { blockPage } = paginate(
      [para(40), { text: 'Ch 1', heading: true }, para(40), para(40), para(40)],
      'en',
      100
    );
    // heading always flushes and starts a fresh page; two 40-word paras then fit on one page.
    expect(blockPage).toEqual([0, 1, 1, 1, 2]);
  });
});
