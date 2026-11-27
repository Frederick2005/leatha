// Leatha service worker v3.
// Deliberately conservative: page HTML and API data are NEVER cached, so a deploy
// can't leave users on stale pages (the cause of profiles not loading in the PWA).
// Only immutable hashed build assets and images are cached; /offline is the fallback.
const CACHE_VERSION = "leatha-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

// Drop every cache from older versions (v1/v2 held stale HTML and API responses).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase / third parties

  // Hashed build assets are immutable: cache-first is safe.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  // Pages: always network; offline page only when the network is truly down.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || new Response("You are offline", { status: 503 });
      }),
    );
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
