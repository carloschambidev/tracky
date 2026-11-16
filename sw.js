/**
 * sw.js - Service Worker principal de Tracky
 * Estrategia: Network-First con respaldo en Caché para archivos propios
 * y Cache-First para librerías CDN, garantizando funcionamiento 100% offline.
 */

const CACHE_NAME = 'tracky-cache-v16';

// Lista de recursos estáticos locales (con rutas relativas para GitHub Pages) y CDNs externos
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/calendar.css',
  './js/main.js',
  './js/db/db.js',
  './js/logic/recurrence.js',
  './js/logic/dateUtils.js',
  './js/logic/dayStatus.js',
  './js/ui/theme.js',
  './js/ui/header.js',
  './js/ui/taskList.js',
  './js/ui/modal.js',
  './js/ui/calendarView.js',
  './js/ui/confetti.js',
  'https://cdn.jsdelivr.net/npm/vanilla-calendar-pro@2.9.10/build/vanilla-calendar.min.css',
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdn.jsdelivr.net/npm/vanilla-calendar-pro@2.9.10/+esm',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/+esm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando archivos estáticos de Tracky (v11)...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[Service Worker] Eliminando caché antigua:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Filtramos únicamente peticiones HTTP/HTTPS (ignora chrome-extension:// u otros esquemas)
  if (event.request.url.startsWith('http') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
        })
    );
  }
});
