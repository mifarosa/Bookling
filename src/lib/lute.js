import { db, normalizeTerm, STATUS } from './db.js';
import { parseCsvObjects, toCsv } from './csv.js';

// Lute v3 term CSV columns (same order as Lute's own export).
export const LUTE_COLUMNS = [
  'term',
  'parent',
  'translation',
  'language',
  'tags',
  'added',
  'status',
  'link_status',
  'pronunciation'
];

export function statusToLute(status) {
  if (status === STATUS.WELL_KNOWN) return 'W';
  if (status === STATUS.IGNORED) return 'I';
  return String(status);
}

export function statusFromLute(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'W' || v === '99') return STATUS.WELL_KNOWN;
  if (v === 'I' || v === '98') return STATUS.IGNORED;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  return STATUS.NEW;
}

function splitTags(value) {
  return String(value ?? '')
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

/** Builds a Lute-compatible CSV string from term rows. */
export function termsToLuteCsv(terms, languagesById) {
  const rows = terms.map((t) => [
    t.text,
    t.parent || '',
    t.translation || '',
    languagesById.get(t.languageId)?.name || '',
    (t.tags || []).join(', '),
    formatDate(t.createdAt),
    statusToLute(t.status),
    '',
    t.romanization || ''
  ]);
  return toCsv([LUTE_COLUMNS, ...rows]);
}

export async function exportLuteCsv(languageId) {
  const languages = await db.languages.toArray();
  const byId = new Map(languages.map((l) => [l.id, l]));
  const terms =
    languageId == null
      ? await db.terms.toArray()
      : await db.terms.where('languageId').equals(languageId).toArray();
  terms.sort((a, b) => a.languageId - b.languageId || a.text.localeCompare(b.text));
  return termsToLuteCsv(terms, byId);
}

/**
 * Imports Lute v3 term CSV. Existing terms are updated; languages missing locally are created.
 * Returns { added, updated, skipped, createdLanguages }.
 */
export async function importLuteCsv(text) {
  const records = parseCsvObjects(text);
  if (records.length && !('term' in records[0] && 'language' in records[0])) {
    throw new Error('CSV must have at least "language" and "term" columns.');
  }

  const result = { added: 0, updated: 0, skipped: 0, createdLanguages: [] };
  const languages = await db.languages.toArray();
  const byName = new Map(languages.map((l) => [l.name.toLowerCase(), l]));
  const now = Date.now();

  await db.transaction('rw', db.languages, db.terms, async () => {
    for (const r of records) {
      const langName = r.language.trim();
      const termText = r.term.trim();
      if (!langName || !termText) {
        result.skipped++;
        continue;
      }

      let lang = byName.get(langName.toLowerCase());
      if (!lang) {
        lang = { name: langName, code: '', translateTo: 'tr', rightToLeft: false };
        lang.id = await db.languages.add(lang);
        byName.set(langName.toLowerCase(), lang);
        result.createdLanguages.push(langName);
      }

      const key = normalizeTerm(termText, lang.code);
      const fields = {
        status: statusFromLute(r.status),
        translation: r.translation || '',
        parent: r.parent || '',
        romanization: r.pronunciation || '',
        tags: splitTags(r.tags),
        updatedAt: now
      };
      const existing = await db.terms.where({ languageId: lang.id, text: key }).first();
      if (existing) {
        await db.terms.update(existing.id, fields);
        result.updated++;
      } else {
        const added = Date.parse(r.added);
        await db.terms.add({
          languageId: lang.id,
          text: key,
          createdAt: Number.isNaN(added) ? now : added,
          ...fields
        });
        result.added++;
      }
    }
  });

  return result;
}
