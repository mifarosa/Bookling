import JSZip from 'jszip';

const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dt,dd,div,td,figcaption';
const HEADING_RE = /^H[1-6]$/;

function parseXml(text, type = 'application/xml') {
  const doc = new DOMParser().parseFromString(text, type);
  if (doc.getElementsByTagName('parsererror').length) {
    // Many real-world EPUBs contain invalid XHTML; the HTML parser is forgiving.
    return new DOMParser().parseFromString(text, 'text/html');
  }
  return doc;
}

function byLocalName(root, name) {
  return [...root.getElementsByTagName('*')].filter((el) => el.localName === name);
}

function resolvePath(baseDir, href) {
  const clean = decodeURIComponent(href.split('#')[0]);
  const parts = (baseDir ? baseDir + '/' + clean : clean).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

function normalizeSpace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Extracts heading/paragraph blocks from one XHTML content document. */
export function extractBlocks(xhtml) {
  const doc = parseXml(xhtml, 'application/xhtml+xml');
  const body = byLocalName(doc, 'body')[0] || doc.documentElement;
  if (!body) return [];

  for (const el of byLocalName(body, 'script').concat(byLocalName(body, 'style'), byLocalName(body, 'rt'))) {
    el.remove();
  }

  const candidates = [...body.querySelectorAll(BLOCK_SELECTOR)];
  const set = new Set(candidates);
  const leaves = candidates.filter((el) => {
    for (const d of el.getElementsByTagName('*')) if (set.has(d)) return false;
    return true;
  });

  if (!leaves.length) {
    const text = normalizeSpace(body.textContent || '');
    return text ? [text] : [];
  }

  const blocks = [];
  for (const el of leaves) {
    const text = normalizeSpace(el.textContent || '');
    if (!text) continue;
    if (HEADING_RE.test(el.tagName.toUpperCase())) blocks.push({ text, heading: true });
    else blocks.push(text);
  }
  return blocks;
}

/**
 * Parses an EPUB (2 or 3) into { title, author, language, blocks } in spine order.
 * @param {ArrayBuffer|Blob|Uint8Array} data
 */
export async function parseEpub(data, fallbackTitle = 'Untitled') {
  const zip = await JSZip.loadAsync(data);
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Not a valid EPUB: META-INF/container.xml is missing.');

  const container = parseXml(await containerFile.async('string'));
  const rootfile = byLocalName(container, 'rootfile')[0];
  const opfPath = rootfile?.getAttribute('full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error('Not a valid EPUB: package document not found.');

  const opf = parseXml(await zip.file(opfPath).async('string'));
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const meta = (name) => normalizeSpace(byLocalName(opf, name)[0]?.textContent || '');
  const manifest = new Map(
    byLocalName(opf, 'item').map((item) => [
      item.getAttribute('id'),
      { href: item.getAttribute('href'), type: item.getAttribute('media-type') || '' }
    ])
  );

  const blocks = [];
  for (const ref of byLocalName(opf, 'itemref')) {
    if (ref.getAttribute('linear') === 'no') continue;
    const item = manifest.get(ref.getAttribute('idref'));
    if (!item || !/html/.test(item.type)) continue;
    const file = zip.file(resolvePath(opfDir, item.href));
    if (!file) continue;
    blocks.push(...extractBlocks(await file.async('string')));
  }

  if (!blocks.length) throw new Error('No readable text found in this EPUB.');

  return {
    title: meta('title') || fallbackTitle,
    author: meta('creator'),
    language: meta('language'),
    blocks
  };
}

export async function importEpub(file) {
  return parseEpub(await file.arrayBuffer(), file.name.replace(/\.[^.]+$/, ''));
}
