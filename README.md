# Bookling

Offline-first PWA for learning languages by reading ebooks -- Lute/LWT compatible, no server required.

Import an EPUB or TXT file (or paste an article), then read it with every word colour-coded by how well
you know it. Tap a word to look it up in your dictionaries, give it a translation and set its status.
Everything is stored on your device in IndexedDB; there is no backend and no account.

## Features

- **Import**: EPUB 2/3 and TXT files, pasted text, or the system share sheet (Web Share Target, Android
  when installed).
- **Reading**: language-agnostic word splitting with `Intl.Segmenter` (works for Japanese/Chinese too),
  paginated pages, adjustable font size, right-to-left languages.
- **Term statuses** (same scale as Lute): unknown, 1–5 learning stages, well known (W), ignored (I).
  "✓ Next" marks every still-unknown word on the page as known and moves on, like LingQ.
- **Dictionaries**: per-language URL templates where `###` is replaced by the word; show them embedded
  in the reader or open them in a new tab (for sites like Tureng that block embedding).
- **Pronunciation** via the Web Speech API.
- **Lute v3 CSV** term import/export, so you can move your vocabulary between Bookling and Lute.
- **Stats**: known words per language, words learned this week, terms per learning stage.
- **Offline**: the app shell is precached by a service worker; after the first visit it works without
  a network connection.

Keyboard shortcuts in the reader: `←`/`→` change page, `1`–`5`, `W`, `I` set the selected word's
status, `Esc` closes the word panel.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/bookling/
npm test         # unit tests (Vitest)
npm run build    # production build in dist/
npm run preview  # serve the production build (service worker enabled)
```

The app is served under `/bookling/` by default to match GitHub Pages. Set `BASE_PATH=/` to build for
a domain root.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests and builds on every pull request, and deploys `main` to
GitHub Pages. Enable it once in **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Routing uses the URL hash (`#/read/1`), so deep links work on GitHub Pages without a 404 fallback.

## Tech

Svelte 5, Vite, Dexie (IndexedDB), JSZip (EPUB parsing), vite-plugin-pwa / Workbox.

## Data & backups

Your books and terms live only in this browser's storage. Bookling asks the browser to keep the data
persistent, but browsers (especially iOS Safari) may still clear it; export your terms as CSV from the
Terms page regularly.
