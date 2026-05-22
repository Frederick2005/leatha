const CACHE_VERSION = 'leatha-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Critical assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/feed',
  '/explore',
  '/leaderboard',
  '/offline',
  '/manifest.json',
];

// ─── Install ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // ── Supabase API — Network first, fall back to cache
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE, 60));
    return;
  }

  // ── Supabase Storage (images/files) — Cache first
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // ── Skip Supabase auth calls — always network
  if (url.hostname.includes('supabase.co')) return;

  // ── Static assets (JS, CSS, fonts) — Cache first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // ── Images — Cache first
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // ── Navigation (page loads) — Network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }
});

// ─── Strategies ────────────────────────────────────

// Network first — try network, fall back to cache
async function networkFirstStrategy(request, cacheName, maxAgeSeconds = 300) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No cached data available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Cache first — serve from cache, update in background
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Update cache in background
    fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Navigation strategy — network first, offline page fallback
async function navigationStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Try cached version of this specific page
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fall back to offline page
    const offlinePage = await caches.match('/offline');
    return offlinePage || new Response('You are offline', { status: 503 });
  }
}

// ─── Cache size management ─────────────────────────
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// Trim caches periodically
self.addEventListener('message', (event) => {
  if (event.data === 'TRIM_CACHES') {
    trimCache(DYNAMIC_CACHE, 50);
    trimCache(IMAGE_CACHE, 100);
  }
});