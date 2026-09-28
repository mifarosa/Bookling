import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Served from the root of https://bookling.mifarosa.com; set BASE_PATH (e.g. /bookling/) for a sub-path host.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Bookling',
        short_name: 'Bookling',
        description: 'Learn languages by reading ebooks, fully offline.',
        lang: 'en',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#faf7f2',
        theme_color: '#3d5a80',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        share_target: {
          action: 'share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'file',
                accept: ['.epub', '.txt', 'application/epub+zip', 'text/plain']
              }
            ]
          }
        }
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']
      },
      devOptions: { enabled: false }
    })
  ],
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.js']
  }
});
