// MA VIGNE — Service Worker v2.21
// v2.21 — Fix profils vides : suppression double lecture ?tenant= dans _fbLoad (conflit avec guard v4.20) · index v4.21
// v2.19 — Fix calcHeures : tâches custom calculées à la volée depuis PARCELLES si absentes de TRAVAUX · index v4.19
// v2.18 — Lien invitation ?tenant=slug : pose TENANT_ID sans onboarding · copyInviteLink() dans Réglages · index v4.18
// v2.17 — Onboarding intégré + tenantId (fbDoc→mavigne_{TENANT_ID}) + création compte Firebase Auth admin · index v4.17
// v2.16 — Fix recalcTravaux : init TRAVAUX à la volée pour tâches custom (Relevage 2, etc.) · index v4.16
// v2.15 — Refacto taches : Ebourgeonnage/Pioche sans numerotation · migration auto donnees Firebase · index v4.15
// v2.14 — Toast saveJournalEntry : showToast immédiat dans saveJournalEntry (indépendant Firebase) · index v4.14
// v2.13 — Backup localStorage versionné 7 jours (mavigne_backup_YYYY-MM-DD, purge auto) · index v4.13
// v2.12 — Fix dark mode : 6 couleurs hardcodées → variables CSS (tc-nd, pc-dot, hv2-tv-item, hv2-card-or, sdp-skip, home-prio-detail-inner) · index v4.12
// v2.11 — Fix CONFIG non déclarée globalement + sw.js clone Response corrigé · index v4.11
// v2.10 — Fix applyFbData : ignore tableau vide Firebase pour saisons/taches/membres → conserve données statiques · index v4.10
// v2.09 — Fix critique Firebase Auth : pull complet post-auth uniquement (_fbLoadAfterAuth) · suppression repull _tracRepullDone · index v4.8
// v2.08 — Rapport saison PDF v2 · index v4.8
// v2.07 — DOMAINE_NOM configurable · index v4.6
// v2.06 — Firebase Auth · index v4.6
// v2.05 — Audit v4.5
// v2.04 — Bugs audit (suite)
// v2.03 — Audit bugs mai 2026
// v2.02 — États vides illustrés
// v2.01 — Leaflet hors réseau
// v2.00 — Nav bar fond sombre permanent
const CACHE_NAME = 'mavigne-v2.21';
const SYNC_TAG   = 'mavigne-sync';
const APP_SHELL = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];
self.addEventListener('install', event => {
  console.log('[SW] Install v2.21');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  console.log('[SW] Activate v2.21');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(fetch(event.request).then(r => {
      const rc = r.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
      return r;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(r => {
        if (r.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
        return r;
      }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : undefined);
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
