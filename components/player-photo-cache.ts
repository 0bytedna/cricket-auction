// Photo bytes live in Cache Storage, not localStorage's small text-only quota.
const cacheName = 'spl-player-photos-v1';
const pending = new Map<string, Promise<Blob>>();

async function openPhotoCache() {
  try {
    return await caches.open(cacheName);
  } catch {
    return undefined; // Private browsing / storage disabled: network still works.
  }
}

export function loadPlayerPhoto(source: string): Promise<Blob> {
  const url = new URL(source, window.location.origin);
  if (url.origin !== window.location.origin ||
      !(url.pathname.startsWith('/players/') ||
        url.pathname === '/api/player-photo' ||
        url.pathname === '/player-placeholder.svg')) {
    return Promise.reject(new Error('Invalid local player photo'));
  }
  const key = url.href; // Includes refresh version; old photos cannot satisfy new requests.
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const cache = await openPhotoCache();
    const saved = await cache?.match(key).catch(() => undefined);
    if (saved) return saved.blob();
    const response = await fetch(key, { cache: 'force-cache' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
      throw new Error('Player photo unavailable');
    const copy = response.clone();
    const blob = await response.blob();
    if (cache) await cache.put(key, copy).catch(() => {});
    return blob;
  })();
  pending.set(key, request);
  void request.finally(() => pending.delete(key)).catch(() => {});
  return request;
}

export async function cachePlayerPhotos(
  sources: string[],
  progress?: (completed: number, total: number) => void,
) {
  const unique = [...new Set(sources.filter(Boolean))];
  let cursor = 0;
  let completed = 0;
  let failed = 0;
  await Promise.all(Array.from({ length: Math.min(10, unique.length) }, async () => {
    while (cursor < unique.length) {
      const source = unique[cursor++];
      try { await loadPlayerPhoto(source); } catch { failed++; }
      progress?.(++completed, unique.length);
    }
  }));
  return { failed };
}

export async function removeOldPlayerPhotos(sources: string[]) {
  const cache = await openPhotoCache();
  if (!cache) return;
  const keep = new Set(sources.map(source => new URL(source, window.location.origin).href));
  const entries = await cache.keys();
  await Promise.all(entries.filter(entry => !keep.has(entry.url)).map(entry => cache.delete(entry)));
}
