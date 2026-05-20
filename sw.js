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
// MA VIGNE — Service Worker v1.33
// v1.27 — Splash : vrai logo GT détouré sur fond noir + animation lumière
// v1.28 — Rôle saisonnier : lecture seule (Accueil/Parcelles/Journal, sans écriture)
// v1.29 — Fix overlay mentions légales : structure modal standard + closeOv + fermeture backdrop
// v1.30 — KML intégré en statique : suppression import KML, polygones auto au chargement
// v1.31 — Nouveau logo splash : version fond blanc détourée sur fond noir
// v1.32 — Module Chat : canaux thématiques + messages privés, temps réel Firebase Firestore
// v1.33 — Fix écran noir iOS : failsafe splash 6s + visibilitychange reload + init try/catch
// ════════════════════════════════════════════════════════

const CACHE_NAME = 'mavigne-v1.33';
const SYNC_TAG   = 'mavigne-sync';

// Fichiers à mettre en cache immédiatement (app shell)
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// CDN à mettre en cache (Leaflet + Google Fonts)
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];

// ── Installation : mise en cache de l'app shell ──────────
self.addEventListener('install', event => {
  console.log('[SW] Install v1.33');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // App shell local (critique — doit réussir)
      return cache.addAll(APP_SHELL).then(() => {
        // CDN optionnel — on ignore les erreurs pour ne pas bloquer l'install
        return Promise.allSettled(
          CDN_URLS.map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyage des anciens caches ─────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate v1.33');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie par type de requête ─────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Firebase / Firestore → Network-first, pas de cache (temps réel)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Firebase inaccessible → répondre 503 proprement
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Open-Meteo (météo) → Network-first avec fallback cache
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

  // 3. App shell + CDN → Cache-first (fonctionne hors ligne)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // Pas en cache → réseau, puis mise en cache pour la prochaine fois
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Ultime fallback : retourner index.html pour les navigations
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Background Sync : vider la queue dès que la connexion revient ──
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    console.log('[SW] Background sync déclenché');
    event.waitUntil(flushOfflineQueue());
  }
});

// ── Message depuis l'app principale ──────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // L'app envoie la queue à vider quand elle revient en ligne
  if (event.data && event.data.type === 'FLUSH_QUEUE') {
    flushOfflineQueue();
  }
});

// ── Vider la queue des sauvegardes en attente ─────────────
async function flushOfflineQueue() {
  // Notifier tous les clients (onglets ouverts) de vider leur queue
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
  });
}
