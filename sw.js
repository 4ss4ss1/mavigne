// ╔══════════════════════════════════════════════════════════════╗
// ║                        MA VIGNE                             ║
// ║         Application de gestion viticole — PWA               ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  © 2026 Nicolas GUERET / GUERETTECH — Tous droits réservés.               ║
// ║                                                              ║
// ║  Ce code source est une œuvre originale protégée par le      ║
// ║  droit d'auteur (Code de la propriété intellectuelle,        ║
// ║  articles L.111-1 et suivants).                              ║
// ║                                                              ║
// ║  Toute reproduction, distribution, modification ou           ║
// ║  utilisation commerciale, partielle ou totale, sans          ║
// ║  autorisation écrite préalable de l'auteur est               ║
// ║  strictement interdite et constitue une contrefaçon          ║
// ║  passible de poursuites judiciaires.                         ║
// ╚══════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════════════════
// MA VIGNE — Service Worker v1.44
// v1.27 — Splash : vrai logo GT détouré sur fond noir + animation lumière
// v1.28 — Rôle saisonnier : lecture seule (Accueil/Parcelles/Journal, sans écriture)
// v1.29 — Fix overlay mentions légales : structure modal standard + closeOv + fermeture backdrop
// v1.30 — KML intégré en statique : suppression import KML, polygones auto au chargement
// v1.31 — Nouveau logo splash : version fond blanc détourée sur fond noir
// v1.32 — Module Chat : canaux thématiques + messages privés, temps réel Firebase Firestore
// v1.43 — Fix chat iOS : padding-bottom, notifs, tags masqués mobile
// v1.43 — Fix layout chat iOS (nav cachée, plein écran), chatSendActive, notifs DM
// v1.44 — Fix notifs : chatInit au login pour dmbadge-*, overflow body iOS, viewport interactive-widget
// ════════════════════════════════════════════════════════

const CACHE_NAME = 'mavigne-v1.44';
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
  console.log('[SW] Install v1.44');
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
  console.log('[SW] Activate v1.44');
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

  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

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
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'FLUSH_QUEUE') {
    flushOfflineQueue();
  }
});

async function flushOfflineQueue() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
  });
}
