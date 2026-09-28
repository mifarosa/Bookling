/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

export const SHARE_CACHE = 'bookling-share-target';

self.skipWaiting();
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Web Share Target: stash the shared payload in Cache Storage and let the app pick it up.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return;

  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const cache = await caches.open(SHARE_CACHE);
      const file = form.get('file');
      if (file && typeof file !== 'string') {
        await cache.put(
          'shared-file',
          new Response(file, { headers: { 'X-File-Name': encodeURIComponent(file.name) } })
        );
      }
      const payload = {
        title: form.get('title') || '',
        text: form.get('text') || '',
        url: form.get('url') || ''
      };
      await cache.put('shared-text', new Response(JSON.stringify(payload)));
      return Response.redirect(new URL('./#/import?shared=1', self.registration.scope).href, 303);
    })()
  );
});
