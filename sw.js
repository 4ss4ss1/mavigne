// MA VIGNE — Service Worker v1.84
// v1.65 — Tracteur : onglets par tracteur · fiches d'entretien · état réparateur + notifs · parc tracteurs Réglages
// v1.66 — Fix layout onglets · Association activité↔tracteur · badge tracteur sessions · alerte réparateur · PDF entretien
// v1.67 — Fix chevauchement onglets tracteurs
// v1.68 — Fix erreurs JS : guillemets inline onclick → data-* + addEventListener
// v1.69 — Fiche entretien : suppression champ travail effectué · encadrement renforcé
// v1.70 — Dark mode · États vides · Météo cache offline · Bandeau offline persistant · PDF rapport saison
// v1.71 — Fix race condition iOS Safari : window.initLogin exposé avant DOMContentLoaded
// v1.72 — Entretien : encart résumé compact · modal liste fiches · suppression/édition admin · toggle anomalie
// v1.73 — Fix critique : suppression lignes orphelines dupliquées après exportPDFPhyto
// v1.74 — Fix perte données : COLLECTIONS complète · fbPushIfAbsent par collection
// v1.75 — Haptique showToast · Blocage session si tracteur en répar · Changement tracteur session en cours
// v1.76 — Blocage coche parcelle · Décoche autorisée · renderSDTracEncart fallback id→nom
// v1.77 — Fix résolution tracteur/réparateur quand id Firebase = nom
// v1.78 — Fix race condition : applyFbData re-render encart tracteur si session ouverte
// v1.79 — Audit CSS/UX : --texte-doux · --radius-card · segmented-control · fade pages
// v1.80 — Transition pages fade pur · Card accueil 2 modes · Pill priorité ⚡ · Card stat pleine largeur
// v1.81 — Redesign module Tracteur : 2 onglets Sessions/Entretiens · pills parc tracteurs en-tête · FAB + · filtres dans contenu · toast systématique sur toutes les actions · hint tap sessions en cours
// v1.82 — Optimisation Firebase : FB_REALTIME (6 listeners) · fbPullStatic ponctuel · re-pull Réglages
// v1.83 — Debounce 300ms pSearch + jSearch
// v1.84 — Guard renderSDTracEncart : re-render uniquement sur sessions/tracteurs_list/reparateur/activites
const CACHE_NAME = 'mavigne-v1.84';
const SYNC_TAG   = 'mavigne-sync';
const APP_SHELL = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];
self.addEventListener('install', event => {
  console.log('[SW] Install v1.84');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  console.log('[SW] Activate v1.84');
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
