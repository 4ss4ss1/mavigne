// MA VIGNE — Service Worker v2.23
// v2.23 — Network-first pour index.html : mise à jour auto sans vider le cache · CDN cache-first inchangé · index v4.23
// v2.22 — Fix profils vides : guard vide dans loadData() pour MEMBRES/SAISONS/TACHES (localStorage corrompu écrasait données statiques) · index v4.22
// v2.21 — Fix profils vides : suppression double lecture ?tenant= dans _fbLoad (conflit avec guard v4.20) · index v4.21
// v2.20 — Guard tenant : correction auto tenant invalide (mavigne_mavigne→marchand-grillot) · meilleurs messages erreur login Firebase · index v4.20
// v2.19 — Fix calcHeures : tâches custom calculées à la volée depuis PARCELLES si absentes de TRAVAUX · index v4.19
// v2.18 — Lien invitation ?tenant=slug : pose TENANT_ID sans onboarding · copyInviteLink() dans Réglages · index v4.18
// v2.17 — Onboarding intégré + tenantId · index v4.17
// v2.16 — Fix recalcTravaux · index v4.16
// v2.15 — Refacto taches · index v4.15
// v2.14 — Toast saveJournalEntry · index v4.14
// v2.13 — Backup localStorage 7 jours · index v4.13
// v2.12 — Fix dark mode · index v4.12
// v2.11 — Fix CONFIG · index v4.11
// v2.10 — Fix applyFbData tableaux vides · index v4.10
// v2.09 — Fix critique Firebase Auth · index v4.8
// v2.08 — PDF v2 · v2.07 — DOMAINE_NOM · v2.06 — Firebase Auth · v2.00–v2.05 — divers
const CACHE_NAME = 'mavigne-v2.23';
const SYNC_TAG   = 'mavigne-sync';

// Fichiers mis en cache à l'install (hors index.html — géré en network-first)
const SHELL_STATIC = ['./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];

self.addEventListener('install', event => {
  console.log('[SW] Install v2.23');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Mettre en cache index.html + statics + CDN
      cache.addAll(['./index.html', ...SHELL_STATIC]).then(() =>
        Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
      )
    ).then(() => self.skipWaiting()) // prend le contrôle immédiatement
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate v2.23');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Suppression ancien cache :', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim()) // prend le contrôle de tous les onglets ouverts
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes Firebase / Google
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) return;

  // Météo : network-first avec fallback cache (données fraîches en priorité)
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request).then(r => {
        const rc = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // ── index.html : NETWORK-FIRST ──
  // Toujours essayer le réseau pour avoir la dernière version.
  // Si le réseau répond → mettre à jour le cache → servir la réponse fraîche.
  // Si hors ligne → fallback sur le cache (PWA fonctionne quand même).
  if (url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(r => {
        if (r.ok) {
          const rc = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
        }
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CDN (Leaflet, fonts) et autres statics : cache-first (ne changent pas)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(r => {
        if (r.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
        return r;
      }).catch(() => undefined);
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushOfflineQueue());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'FLUSH_QUEUE') flushOfflineQueue();
});

async function flushOfflineQueue() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(c => c.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }));
}
