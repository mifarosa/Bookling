# Bookling

**https://bookling.mifarosa.com**

Offline-first PWA for learning languages by reading ebooks -- Lute/LWT compatible, no server required.

Import an EPUB or TXT file (or paste an article), then read it with every word colour-coded by how well
you know it. Tap a word to look it up in your dictionaries, give it a translation and set its status.
Everything is stored on your device in IndexedDB; there is no backend and no account.

## Features

- **Import**: EPUB 2/3 (with images and a table of contents) and TXT files, pasted text, or the system
  share sheet (Web Share Target, Android when installed).
- **Reading**: language-agnostic word splitting with `Intl.Segmenter` (works for Japanese/Chinese too),
  paginated pages with inline EPUB images, chapter table of contents, adjustable font size and family,
  three reading themes (light/sepia/dark), right-to-left languages.
- **Direct translate**: tapping a word looks it up automatically (a free machine translation via
  MyMemory) and fills the translation field for a new word; for a word you've already translated it's
  offered as a suggestion instead of overwriting what you saved. You can also give a word a translation,
  pronunciation and root form by hand, and look it up in your own dictionaries.
- **Term statuses** (same scale as Lute): unknown, 1–5 learning stages, well known (W), ignored (I) —
  shown as a subtle underline rather than a solid block, so the page still reads like a book. "✓ Next"
  marks every still-unknown word on the page as known and moves on, like LingQ.
- **Reading position & notes**: tap a paragraph to mark it as where you left off (it's restored exactly
  on reopen) or to attach a note to it; a notes list per book lets you jump back to any of them.
- **Dictionaries**: per-language URL templates where `###` is replaced by the word; show them embedded
  in the reader or open them in a new tab (for sites like Tureng that block embedding).
- **Pronunciation** via the Web Speech API.
- **Lute v3 CSV** term import/export, so you can move your vocabulary between Bookling and Lute.
- **Stats**: known words per language, words learned this week, terms per learning stage.
- **Offline**: the app shell is precached by a service worker; after the first visit it works without
  a network connection. The translate lookup needs a connection; everything else doesn't.

Keyboard shortcuts in the reader: `←`/`→` change page, `1`–`5`, `W`, `I` set the selected word's
status, `Esc` closes the word panel.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/
npm test         # unit tests (Vitest)
npm run build    # production build in dist/
npm run preview  # serve the production build (service worker enabled)
```

The app is built for a domain root. Set `BASE_PATH=/some/path/` to host it under a sub-path.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests and builds on every pull request, and deploys `main` to
GitHub Pages at `bookling.mifarosa.com`. One-time setup:

1. DNS: a `CNAME` record `bookling` → `mifarosa.github.io`.
2. **Settings → Pages**: Source **GitHub Actions**, Custom domain `bookling.mifarosa.com`, then
   **Enforce HTTPS** once the certificate is issued.

`public/CNAME` records the domain in the deployed site as well.

Routing uses the URL hash (`#/read/1`), so deep links work on GitHub Pages without a 404 fallback.

## Translation

Word lookups use [MyMemory](https://mymemory.translated.net/doc/spec.php), a free, keyless, CORS-enabled
translation API, so no backend or API key is needed. Set each language's "Translate to" code in Settings
(BCP-47, e.g. `tr`). MyMemory's anonymous tier is rate-limited (a few thousand words/day); if you hit that
limit, translations simply stop being suggested until it resets — dictionary lookups still work.

## Tech

Svelte 5, Vite, Dexie (IndexedDB), JSZip (EPUB parsing), vite-plugin-pwa / Workbox.

## Data & backups

Your books and terms live only in this browser's storage. Bookling asks the browser to keep the data
persistent, but browsers (especially iOS Safari) may still clear it; export your terms as CSV from the
Terms page regularly.
