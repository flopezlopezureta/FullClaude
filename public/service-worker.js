// Self-destroying Service Worker to break aggressive PWA caching of old builds
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
    }).then(() => {
      // Attempt to self-unregister if supported
      if (self.registration && typeof self.registration.unregister === 'function') {
        return self.registration.unregister();
      }
    })
  );
});

// No fetch listener so all requests go straight to the network!

