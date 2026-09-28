import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractBlocks, parseEpub } from '../src/lib/importers/epub.js';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function makeEpub({ withNav = true } = {}) {
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
    <item id="pic" href="images/photo.png" media-type="image/png"/>
    ${withNav ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : ''}
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`
  );
  const page = (title, body) => `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title><style>p{}</style></head>
<body><h1>${title}</h1>${body}</body></html>`;
  zip.file(
    'OEBPS/text/ch1.xhtml',
    page(
      'One',
      '<p>First   paragraph.</p><div><p>Nested.</p></div>' +
        '<figure><img src="../images/photo.png" alt="A photo"/><figcaption>Caption text.</figcaption></figure>'
    )
  );
  zip.file('OEBPS/text/ch 2.xhtml', page('Two', '<blockquote>Quoted text.</blockquote>'));
  zip.file('OEBPS/images/photo.png', TINY_PNG_B64, { base64: true });
  if (withNav) {
    zip.file(
      'OEBPS/nav.xhtml',
      `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body><nav epub:type="toc"><ol>
  <li><a href="text/ch1.xhtml">Chapter One</a></li>
  <li><a href="text/ch%202.xhtml">Chapter Two</a></li>
</ol></nav></body></html>`
    );
  }
  return zip.generateAsync({ type: 'uint8array' });
}

describe('extractBlocks', () => {
  it('reads headings and paragraphs, skipping nested duplicates', async () => {
    const blocks = await extractBlocks('<html><body><h1>One</h1><p>First   paragraph.</p><div><p>Nested.</p></div></body></html>');
    expect(blocks).toEqual([{ text: 'One', heading: true }, 'First paragraph.', 'Nested.']);
  });

  it('extracts an image inside a figure, resolving its href, and keeps the caption as text', async () => {
    const resolveImage = async (href) => `resolved:${href}`;
    const blocks = await extractBlocks(
      '<html><body><figure><img src="pic.png" alt="A cat"/><figcaption>My cat.</figcaption></figure></body></html>',
      resolveImage
    );
    expect(blocks).toEqual([{ image: true, src: 'resolved:pic.png', alt: 'A cat' }, 'My cat.']);
  });

  it('drops an image when resolveImage cannot find it', async () => {
    const blocks = await extractBlocks('<html><body><p>Text</p><img src="missing.png"/></body></html>', async () => null);
    expect(blocks).toEqual(['Text']);
  });

  it('falls back to the HTML parser for broken XHTML', async () => {
    const blocks = await extractBlocks('<html><body><p>Hello <br> there<p>Second</body></html>');
    expect(blocks).toEqual(['Hello there', 'Second']);
  });
});

describe('parseEpub', () => {
  it('reads metadata and spine text/images in order', async () => {
    const book = await parseEpub(await makeEpub());
    expect(book).toMatchObject({ title: 'Test Book', author: 'Jane Doe', language: 'en' });
    expect(book.blocks[0]).toEqual({ text: 'One', heading: true });
    expect(book.blocks[1]).toBe('First paragraph.');
    expect(book.blocks[2]).toBe('Nested.');
    expect(book.blocks[3]).toMatchObject({ image: true, alt: 'A photo' });
    expect(book.blocks[3].src).toMatch(/^data:image\/png;base64,/);
    expect(book.blocks[4]).toBe('Caption text.');
    expect(book.blocks[5]).toEqual({ text: 'Two', heading: true });
    expect(book.blocks[6]).toBe('Quoted text.');
  });

  it('builds a table of contents from the EPUB3 nav document', async () => {
    const book = await parseEpub(await makeEpub());
    expect(book.chapters).toEqual([
      { title: 'Chapter One', blockIndex: 0 },
      { title: 'Chapter Two', blockIndex: 5 }
    ]);
  });

  it('falls back to one chapter per spine file when there is no nav/NCX', async () => {
    const book = await parseEpub(await makeEpub({ withNav: false }));
    expect(book.chapters).toEqual([
      { title: 'One', blockIndex: 0 },
      { title: 'Two', blockIndex: 5 }
    ]);
  });

  it('rejects non-EPUB zips', async () => {
    const zip = new JSZip();
    zip.file('foo.txt', 'bar');
    await expect(parseEpub(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/container/);
  });
});
