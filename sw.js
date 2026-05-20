// ╔══════════════════════════════════════════════════════════════╗
// ║                        MA VIGNE                             ║
// ║         Application de gestion viticole — PWA               ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  © 2026 Nicolas GUERET / GUERETTECH — Tous droits réservés. ║
// ╚══════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════════════════
// MA VIGNE — Service Worker v1.48
// v1.32 — Module Chat Firestore
// v1.41 — Refonte layout chat plein écran
// v1.46 — Fix SyntaxError JS critique
// v1.47 — Fix sidebar overflow + noms DM
// v1.48 — Fix chargement infini : SW ne bloque plus Firebase (return sans respondWith)
// ════════════════════════════════════════════════════════

const CACHE_NAME = 'mavigne-v1.48';
const SYNC_TAG   = 'mavigne-sync';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];

self.addEventListener('install', event => {
  console.log('[SW] Install v1.48');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).then(() => {
        return Promise.allSettled(
          CDN_URLS.map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate v1.48');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase/Google : laisser passer SANS interception
  // (Firestore utilise WebSockets/streams qui ne fonctionnent pas avec respondWith)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Open-Meteo : Network-first avec fallback cache
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell + CDN : Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    console.log('[SW] Background sync déclenché');
    event.waitUntil(flushOfflineQueue());
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'FLUSH_QUEUE') flushOfflineQueue();
});

async function flushOfflineQueue() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }));
}
