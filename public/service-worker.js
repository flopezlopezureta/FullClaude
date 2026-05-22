// Service Worker for Full Envíos PWA / TWA compatibility
// This service worker is functional but does NOT cache files, avoiding any caching traps while keeping the APK/PWA happy!

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[SW] Deleting cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[SW] All caches deleted.');
      return self.clients.claim();
    })
  );
});

// A functional fetch listener is required for Android TWA/PWA to prevent fallback Chrome notifications!
self.addEventListener('fetch', (event) => {
  // Pass-through straight to network without caching, ensuring no cache traps
  event.respondWith(fetch(event.request));
});

