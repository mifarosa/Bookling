import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractBlocks, parseEpub } from '../src/lib/importers/epub.js';

async function makeEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title><dc:creator>Jane Doe</dc:creator><dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/ch%202.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`
  );
  const page = (title, body) => `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title><style>p{}</style></head>
<body><h1>${title}</h1>${body}</body></html>`;
  zip.file('OEBPS/text/ch1.xhtml', page('One', '<p>First   paragraph.</p><div><p>Nested.</p></div>'));
  zip.file('OEBPS/text/ch 2.xhtml', page('Two', '<blockquote>Quoted text.</blockquote>'));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('epub importer', () => {
  it('reads metadata and spine text in order', async () => {
    const book = await parseEpub(await makeEpub());
    expect(book).toMatchObject({ title: 'Test Book', author: 'Jane Doe', language: 'en' });
    expect(book.blocks).toEqual([
      { text: 'One', heading: true },
      'First paragraph.',
      'Nested.',
      { text: 'Two', heading: true },
      'Quoted text.'
    ]);
  });

  it('falls back to the HTML parser for broken XHTML', () => {
    const blocks = extractBlocks('<html><body><p>Hello <br> there<p>Second</body></html>');
    expect(blocks).toEqual(['Hello there', 'Second']);
  });

  it('rejects non-EPUB zips', async () => {
    const zip = new JSZip();
    zip.file('foo.txt', 'bar');
    await expect(parseEpub(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/container/);
  });
});
