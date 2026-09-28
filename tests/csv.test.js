import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects, toCsv } from '../src/lib/csv.js';

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [
      ['a', 'b,c', 'say "hi"'],
      ['multi\nline', '', 'x']
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('parses header objects case-insensitively and strips BOM', () => {
    const objs = parseCsvObjects('﻿Language,Term\r\nEnglish,cat\r\n');
    expect(objs).toEqual([{ language: 'English', term: 'cat' }]);
  });
});
