// MA VIGNE — Service Worker v2.07
// v2.07 — DOMAINE_NOM configurable : header accueil · badge Réglages · PDF · overlay édition admin · Réglages accessible à tous (mdp, thème, notifs, mentions légales)
// v2.06 — Firebase Auth : SDK auth-compat · signInWithEmailAndPassword · signOut · sendPasswordResetEmail · updatePassword+reauth · suppression sha256/checkMdp/RESEND
// v2.05 — Audit v4.5 : I4 surfTot parseFloat · N1/N2 versions cohérentes · V2 recalcTravaux guard surf_total · V4 jSearch guard meteo
// v2.04 — Bugs audit (suite) : I1 MDP_SOURCE supprimé · I2 double pull Firebase · I8 initMap collision · I9 isAdmin guard · I10 saveData membres · C7 sessions→renderHome · V8 mentions légales dark mode
// v2.03 — Audit bugs mai 2026 : zero confirm() natif (ovConfirmDel générique + DANGER_CFG étendu) · C2 deleteTracteuer→deleteTracteur · C9 Arrachee cohérent PDF · I3 Chloé avatar · I5 jDateDeb/jDateFin global · V4 export version 4.3
// v2.02 — États vides illustrés : SVG inline thématiques dans Journal, Parcelles, Tracteur, Phyto · drop-shadow CSS sur icônes · cohérence accent par module
// v2.01 — Leaflet hors réseau : bandeau discret en haut de carte · show/hide via navigator.onLine · listeners online/offline branchés · polygones toujours actifs
// v2.00 — Nav bar : fond sombre permanent #151A14 · halos colorés par module (vert/terre/or/acier/phyto) · labels blancs · anti-éblouissement terrain
// v1.99 — Journal compact : cards ~30% plus hautes · barre latérale colorée statut · dot halo · tâche+ouvrier+parcelle 2 lignes · badge ✓/…
// v1.98 — Zone dangereuse : overlay confirmation stylé · saisie mot-clé EFFACER · haptique [80,60,80] · suppression confirm() natif
// v1.97 — Polices min 11px : 53 classes CSS app upgradées 9–10px → 11px · 5 exceptions conservées (avatars ⌀18–20px, dots notif, chat)
// v1.96 — Overlay desktop : backdrop plein écran (inset:0 sans max-width) · modal centré max-width:430px · ombre latérale corrigée sur écrans larges
// v1.95 — Haptique : vibrate(60) sur confirmValidation+saveJournalEntry+marquerEnCours · vibrate(40) sur dévalidation · vibrate([80,60,80]) sur deleteSession+membre+activité
// v1.94 — Feedback async saveData : toast Firebase après confirmation · hors ligne toast orange · saveData(keyHint, toastMsg) · actions équipées : journal, marquerEnCours, savePriority, saveEditCond, saveTache, deleteTache, saveEditMembre
// v1.93 — Chips filtre tâche Parcelles : tâches 100% terminées (toutes parcelles Validé) poussées en fin de liste
// v1.92 — Design unifié 6 modules : mod-header thématique par module · stats band intégrée · onglets mod-ong-tab · palette couleurs
// v1.91 — Création activité depuis Réglages (admin) · Champ custom par activité · Overlay saisie avant validation parcelle
// v1.90 — PDF mensuel : nouvelle structure 2 pages · Heures sous météo · Avancement · Tracteur résumé · Anomalies tracteur
// v1.89 — Mise à jour auto sans unregister : controllerchange + _swReload() + rechargement différé si overlay ouvert
// v1.88 — Fix critique : renderTracteur — isReadOnly remplacé par !isTractoriste()
// v1.87 — Refacto stabilité : icon-192.png unifié · closeOv(null) sécurisé · fonctions export entretien hors bloc load
const CACHE_NAME = 'mavigne-v2.07';
const SYNC_TAG   = 'mavigne-sync';
const APP_SHELL = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];
self.addEventListener('install', event => {
  console.log('[SW] Install v2.07');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  console.log('[SW] Activate v2.07');
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
