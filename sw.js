// MA VIGNE — Service Worker v1.71
// v1.65 — Tracteur : onglets par tracteur · fiches d'entretien · état réparateur + notifs · parc tracteurs Réglages · fiches d'entretien · état réparateur + notifs · parc tracteurs Réglages
// v1.58 — Chat réécrit de zéro
// v1.59 — Fix boîte de saisie invisible : hauteur #page-chat corrigée
// v1.60 — Fix mentions légales accessibles depuis l'écran de login (mini-modal z-index 10000)
// v1.61 — Bouton ✕ recherche Parcelles/Journal · Filtre Journal par parcelle · editCond réservé admin
// v1.62 — Toast confirmation validation · Dots pagination card Accueil · Filtre Journal par dates · Colorisation Leaflet dynamique · Actions destructives Réglages · Reset filtre parcelle au changement de page
// v1.63 — Cards Accueil 3 modes tap + card Priorité fixe · Pill filtres Journal · Arrachées en fin liste · Toast saveJournalEntry · Card session Tracteur épinglée
// v1.64 — Tracteur : sessions "En cours" fond sombre (scard-enc) · tri En cours → Terminées · multi-sessions en cours supportées
// v1.66 — Fix layout onglets (dans en-tête sombre) · Association activité↔tracteur (défaut Réglages + modifiable session) · badge tracteur sur sessions · alerte réparateur · PDF entretien avec tracteur + override
// v1.67 — Fix chevauchement onglets tracteurs
// v1.68 — Fix erreurs JS : guillemets inline onclick → data-* + addEventListener
// v1.69 — Fiche entretien : suppression champ travail effectué · encadrement renforcé
// v1.70 — Dark mode (Auto/Clair/Sombre) · États vides soignés · Météo cache offline · Bandeau offline persistant · --texte-doux:#767676 · PDF rapport de saison complet · app-root
// v1.71 — Fix race condition iOS Safari : window.initLogin exposé avant DOMContentLoaded (écran login vide après maj)
const CACHE_NAME = 'mavigne-v1.71';
const SYNC_TAG   = 'mavigne-sync';
const APP_SHELL = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];
self.addEventListener('install', event => {
  console.log('[SW] Install v1.71');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  console.log('[SW] Activate v1.71');
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
      caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
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
