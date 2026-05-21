const CACHE_NAME = 'leatha-v1';
const OFFLINE_URL = '/offline';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/feed',
  '/explore',
  '/offline',
  '/manifest.json',
];

// Install — cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls — always need fresh data
  if (url.hostname.includes('supabase.co')) return;

  // Skip Cloudflare worker routes
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache, update cache in background
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Not in cache — fetch from network
      return fetch(request)
        .then((response) => {
          if (!response.ok) return response;

          // Cache successful responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed — show offline page for navigation
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attempts') {
    event.waitUntil(syncOfflineAttempts());
  }
});

async function syncOfflineAttempts() {
  const db = await openDB();
  const offlineAttempts = await db.getAll('offline-attempts');
  
  for (const attempt of offlineAttempts) {
    try {
      await fetch('/api/attempts', {
        method: 'POST',
        body: JSON.stringify(attempt)
      });
      await db.delete('offline-attempts', attempt.id);
    } catch (e) {
      // Will retry next sync
    }
  }
}