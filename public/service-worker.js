const CACHE_NAME = 'full-envios-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Se añadirán automáticamente los assets estáticos por el navegador al navegar
];

// Instalar el Service Worker y cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activar y limpiar caches antiguos
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estrategia de red preferida, cayendo a cache si falla (Network First)
self.addEventListener('fetch', (event) => {
  // Solo cacheamos peticiones GET
  if (event.request.method !== 'GET') return;
  
  // No cacheamos llamadas a la API (queremos datos frescos)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si la API falla por red, podríamos devolver una respuesta vacía o error amigable
        return new Response(JSON.stringify({ error: 'No internet connection' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Guardar en cache una copia de lo que bajamos con éxito
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en el cache
        return caches.match(event.request);
      })
  );
});
