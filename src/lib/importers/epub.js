import JSZip from 'jszip';

const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dt,dd,div,td,figcaption';
const MEDIA_SELECTOR = 'img,image';
const HEADING_RE = /^H[1-6]$/;
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

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

function extToMime(href) {
  const ext = href.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_TYPES[ext] || 'application/octet-stream';
}

function imageHref(el) {
  return el.localName === 'img'
    ? el.getAttribute('src')
    : el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
}

/** Walks the tree in document order, yielding each block-level leaf and each image, depth-first. */
function* walkBlocks(el) {
  for (const child of [...el.children]) {
    if (child.matches(MEDIA_SELECTOR)) {
      yield { kind: 'media', el: child };
      continue;
    }
    const hasBlockDescendant = child.querySelector(`${BLOCK_SELECTOR},${MEDIA_SELECTOR}`);
    if (!hasBlockDescendant && child.matches(BLOCK_SELECTOR)) {
      yield { kind: 'text', el: child };
      continue;
    }
    yield* walkBlocks(child);
  }
}

/**
 * Extracts heading/paragraph/image blocks from one XHTML content document, in document order.
 * @param {string} xhtml
 * @param {(href: string) => Promise<string|null>} [resolveImage] resolves a relative image href to a
 *   displayable URL (typically a data: URI); images are skipped when omitted or when it returns null.
 */
export async function extractBlocks(xhtml, resolveImage) {
  const doc = parseXml(xhtml, 'application/xhtml+xml');
  const body = byLocalName(doc, 'body')[0] || doc.documentElement;
  if (!body) return [];

  for (const el of byLocalName(body, 'script').concat(byLocalName(body, 'style'), byLocalName(body, 'rt'))) {
    el.remove();
  }

  const items = [...walkBlocks(body)];
  const blocks = [];
  for (const item of items) {
    if (item.kind === 'media') {
      const href = imageHref(item.el);
      const src = href && resolveImage ? await resolveImage(href) : null;
      if (src) blocks.push({ image: true, src, alt: item.el.getAttribute('alt') || '' });
      continue;
    }
    const text = normalizeSpace(item.el.textContent || '');
    if (!text) continue;
    if (HEADING_RE.test(item.el.tagName.toUpperCase())) blocks.push({ text, heading: true });
    else blocks.push(text);
  }

  if (!items.length) {
    const text = normalizeSpace(body.textContent || '');
    return text ? [text] : [];
  }
  return blocks;
}

/** Flattens a nav/NCX tree of {title, href} entries in document order. */
function readTocEntries(doc, isNcx) {
  if (isNcx) {
    return byLocalName(doc, 'navPoint')
      .map((np) => ({
        title: normalizeSpace(byLocalName(np, 'text')[0]?.textContent || ''),
        href: byLocalName(np, 'content')[0]?.getAttribute('src') || ''
      }))
      .filter((e) => e.title && e.href);
  }
  const nav =
    byLocalName(doc, 'nav').find((n) => (n.getAttribute('epub:type') || n.getAttributeNS(null, 'type') || '').includes('toc')) ||
    byLocalName(doc, 'nav')[0];
  if (!nav) return [];
  return [...nav.querySelectorAll('a[href]')]
    .map((a) => ({ title: normalizeSpace(a.textContent || ''), href: a.getAttribute('href') || '' }))
    .filter((e) => e.title && e.href);
}

/**
 * Parses an EPUB (2 or 3) into { title, author, language, blocks, chapters } in spine order.
 * `chapters` is a list of { title, blockIndex } pointing into `blocks`.
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
  const items = byLocalName(opf, 'item');
  const manifest = new Map(
    items.map((item) => [
      item.getAttribute('id'),
      { href: item.getAttribute('href'), type: item.getAttribute('media-type') || '', props: item.getAttribute('properties') || '' }
    ])
  );

  const imageCache = new Map();
  async function resolveImage(spineHref, imgHref) {
    const path = resolvePath(spineHref.includes('/') ? spineHref.slice(0, spineHref.lastIndexOf('/')) : '', imgHref);
    if (imageCache.has(path)) return imageCache.get(path);
    const file = zip.file(path);
    if (!file) return null;
    const base64 = await file.async('base64');
    const mime = extToMime(path);
    const url = `data:${mime};base64,${base64}`;
    imageCache.set(path, url);
    return url;
  }

  const spineRefs = byLocalName(opf, 'itemref').filter((r) => r.getAttribute('linear') !== 'no');
  const blocks = [];
  const spineStart = new Map(); // resolved file path -> blockIndex where that spine item begins

  for (const ref of spineRefs) {
    const item = manifest.get(ref.getAttribute('idref'));
    if (!item || !/html/.test(item.type)) continue;
    const path = resolvePath(opfDir, item.href);
    const file = zip.file(path);
    if (!file) continue;
    spineStart.set(path, blocks.length);
    const xhtml = await file.async('string');
    const itemBlocks = await extractBlocks(xhtml, (href) => resolveImage(path, href));
    blocks.push(...itemBlocks);
  }

  if (!blocks.length) throw new Error('No readable text found in this EPUB.');

  // Table of contents: prefer the EPUB3 nav document, fall back to the EPUB2 NCX, then to spine headings.
  let tocEntries = [];
  const navItem = items.find((i) => (i.getAttribute('properties') || '').includes('nav'));
  if (navItem) {
    const navPath = resolvePath(opfDir, navItem.getAttribute('href'));
    const navFile = zip.file(navPath);
    if (navFile) tocEntries = readTocEntries(parseXml(await navFile.async('string'), 'application/xhtml+xml'), false);
  }
  if (!tocEntries.length) {
    const ncxItem = items.find((i) => i.getAttribute('media-type') === 'application/x-dtbncx+xml');
    if (ncxItem) {
      const ncxPath = resolvePath(opfDir, ncxItem.getAttribute('href'));
      const ncxFile = zip.file(ncxPath);
      if (ncxFile) tocEntries = readTocEntries(parseXml(await ncxFile.async('string')), true);
    }
  }

  const chapters = [];
  const seenPages = new Set();
  const tocBase = navItem ? resolvePath(opfDir, navItem.getAttribute('href')) : opfDir;
  const tocBaseDir = tocBase.includes('/') ? tocBase.slice(0, tocBase.lastIndexOf('/')) : '';
  for (const entry of tocEntries) {
    const path = resolvePath(tocBaseDir, entry.href);
    const blockIndex = spineStart.get(path);
    if (blockIndex == null || seenPages.has(blockIndex)) continue;
    seenPages.add(blockIndex);
    chapters.push({ title: entry.title, blockIndex });
  }
  if (!chapters.length) {
    // No usable TOC: fall back to one chapter per non-empty spine file, named after its first heading.
    let n = 0;
    for (const blockIndex of spineStart.values()) {
      if (seenPages.has(blockIndex) || blockIndex >= blocks.length) continue;
      seenPages.add(blockIndex);
      n++;
      const first = blocks[blockIndex];
      const title = first && typeof first === 'object' && first.heading ? first.text : `Chapter ${n}`;
      chapters.push({ title, blockIndex });
    }
  }

  return {
    title: meta('title') || fallbackTitle,
    author: meta('creator'),
    language: meta('language'),
    blocks,
    chapters
  };
}

export async function importEpub(file) {
  return parseEpub(await file.arrayBuffer(), file.name.replace(/\.[^.]+$/, ''));
}
