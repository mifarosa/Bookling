const SHARE_CACHE = 'bookling-share-target';

/** Reads (and clears) whatever the service worker stored from a Web Share Target POST. */
export async function takeSharedPayload() {
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open(SHARE_CACHE);
  const result = {};

  const fileRes = await cache.match('shared-file');
  if (fileRes) {
    const name = decodeURIComponent(fileRes.headers.get('X-File-Name') || 'shared.txt');
    result.file = new File([await fileRes.blob()], name);
  }
  const textRes = await cache.match('shared-text');
  if (textRes) Object.assign(result, await textRes.json());

  await cache.delete('shared-file');
  await cache.delete('shared-text');
  return result.file || result.text || result.url ? result : null;
}
