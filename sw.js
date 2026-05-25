// MA VIGNE — Service Worker v1.94
// v1.94 — Accueil : card mode 1 → tâche la plus avancée · pill priorité sans fond blanc ni bordure · bouton ✏️ retiré de l'Accueil (admin via Parcelles uniquement)
// v1.93 — Chips filtre tâche Parcelles : tâches 100% terminées (toutes parcelles Validé) poussées en fin de liste
// v1.92 — Design unifié 6 modules : mod-header thématique par module · stats band intégrée · onglets mod-ong-tab · palette couleurs (Accueil vert vigne · Parcelles terre · Journal papier · Tracteur acier · Phyto bleu nuit · Réglages ardoise)
// v1.91 — Création activité depuis Réglages (admin) · Champ custom par activité (ex: Tarière → Nombre de trous) · Overlay saisie avant validation parcelle · Format parcellesFaites mixte string|{nom,data} · Suppression activité · renderActTracList redesign
// v1.90 — PDF mensuel : nouvelle structure 2 pages · Heures sous météo · Avancement · Tracteur résumé · Anomalies tracteur · Saut de page · Détails page 2
// v1.89 — Mise à jour auto sans unregister : controllerchange + _swReload() + rechargement différé si overlay ouvert
// v1.88 — Fix critique : renderTracteur — isReadOnly (var locale applyRoles) remplacé par !isTractoriste()
// v1.87 — Refacto stabilité : icon-192.png unifié · closeOv(null) sécurisé · fonctions export entretien hors bloc load · window.render* indentation normalisée
// v1.86 — Météo mini badge dans bannière header · Fix toggle card (tacheLaMoinsAvancee) · Pill priorité collée · Fix sessions tracteur vides (re-pull)
// v1.85 — Fix navigation : masquage immédiat ancienne page (suppression pageOut/animationend → fin scroll infini)
// v1.84 — Guard renderSDTracEncart : re-render uniquement sur sessions/tracteurs_list/reparateur/activites
// v1.83 — Debounce 300ms pSearch + jSearch
// v1.82 — Optimisation Firebase : FB_REALTIME (6 listeners) · fbPullStatic ponctuel · re-pull Réglages
// v1.81 — Redesign module Tracteur : 2 onglets Sessions/Entretiens · pills parc tracteurs en-tête · FAB + · filtres dans contenu · toast systématique · hint tap sessions en cours
// v1.80 — Transition pages fade pur · Card accueil 2 modes · Pill priorité ⚡ · Card stat pleine largeur
// v1.79 — Audit CSS/UX : --texte-doux · --radius-card · segmented-control · fade pages
const CACHE_NAME = 'mavigne-v1.94';
const SYNC_TAG   = 'mavigne-sync';
const APP_SHELL = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];
self.addEventListener('install', event => {
  console.log('[SW] Install v1.94');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  console.log('[SW] Activate v1.94');
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
