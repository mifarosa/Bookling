import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeedData, STATUS } from '../src/lib/db.js';
import { exportLuteCsv, importLuteCsv, statusFromLute, statusToLute } from '../src/lib/lute.js';
import { parseCsvObjects } from '../src/lib/csv.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeedData();
});

describe('Lute status mapping', () => {
  it('maps W/I and numbers', () => {
    expect(statusFromLute('W')).toBe(STATUS.WELL_KNOWN);
    expect(statusFromLute('i')).toBe(STATUS.IGNORED);
    expect(statusFromLute('3')).toBe(3);
    expect(statusFromLute('')).toBe(STATUS.NEW);
    expect(statusToLute(STATUS.WELL_KNOWN)).toBe('W');
    expect(statusToLute(2)).toBe('2');
  });
});

describe('Lute CSV import/export', () => {
  const csv = [
    'term,parent,translation,language,tags,added,status,link_status,pronunciation',
    'Gato,,cat,Spanish,"animal, noun",2024-01-02 10:00:00,W,,',
    'perro,,dog,Spanish,,,2,,',
    'bonjour,,hello,French,,,1,,bɔ̃ʒuʁ'
  ].join('\n');

  it('imports terms, normalizes case and creates missing languages', async () => {
    const r = await importLuteCsv(csv);
    expect(r).toMatchObject({ added: 3, updated: 0, skipped: 0, createdLanguages: ['French'] });

    const spanish = await db.languages.where('name').equals('Spanish').first();
    const gato = await db.terms.where({ languageId: spanish.id, text: 'gato' }).first();
    expect(gato).toMatchObject({ translation: 'cat', status: STATUS.WELL_KNOWN, tags: ['animal', 'noun'] });

    const again = await importLuteCsv(csv);
    expect(again).toMatchObject({ added: 0, updated: 3 });
  });

  it('exports what it imported', async () => {
    await importLuteCsv(csv);
    const out = parseCsvObjects(await exportLuteCsv(null));
    const perro = out.find((r) => r.term === 'perro');
    expect(perro).toMatchObject({ language: 'Spanish', translation: 'dog', status: '2' });
    expect(out.find((r) => r.term === 'bonjour').pronunciation).toBe('bɔ̃ʒuʁ');
  });

  it('rejects files without required columns', async () => {
    await expect(importLuteCsv('foo,bar\n1,2')).rejects.toThrow(/language/);
  });
});
