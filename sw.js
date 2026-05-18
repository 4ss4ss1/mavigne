// ════════════════════════════════════════════════════════
// MA VIGNE — Service Worker v2.0
// Stratégie :
//   index.html   → Network-first + rechargement auto si nouvelle version
//   Firebase     → Network-only (temps réel, jamais en cache)
//   Météo        → Network-first avec fallback cache
//   CDN (Leaflet, Fonts) → Cache-first (stable, jamais modifié)
// ════════════════════════════════════════════════════════

// ⚠️ IMPORTANT : incrémenter ce numéro à chaque déploiement
// Le navigateur détecte le changement et force la mise à jour automatiquement
const CACHE_VERSION = 'mavigne-v2.0';
const CACHE_CDN     = 'mavigne-cdn-v1'; // cache séparé pour les ressources CDN stables

// Ressources CDN stables (ne changent jamais — versionnées dans l'URL)
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap',
];

// ── Installation ─────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install', CACHE_VERSION);
  event.waitUntil(
    // Pré-cacher uniquement les ressources CDN stables
    caches.open(CACHE_CDN).then(cache =>
      Promise.allSettled(CDN_URLS.map(url => cache.add(url).catch(() => {})))
    ).then(() => {
      // Prendre le contrôle immédiatement sans attendre la fermeture des onglets
      return self.skipWaiting();
    })
  );
});

// ── Activation : nettoyage des anciens caches ─────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== CACHE_CDN)
          .map(k => {
            console.log('[SW] Suppression ancien cache :', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
     .then(() => {
       // Notifier tous les onglets ouverts qu'une nouvelle version est active
       return self.clients.matchAll({ type: 'window' }).then(clients => {
         clients.forEach(client => {
           client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
         });
       });
     })
  );
});

// ── Fetch : stratégie par type de requête ─────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Firebase / Firestore → Network-only, jamais en cache
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('resend.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. Open-Meteo (météo) → Network-first avec fallback cache
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. CDN stables (Leaflet, Fonts) → Cache-first
  if (CDN_URLS.some(u => event.request.url.startsWith(u.split('?')[0])) ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_CDN).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. index.html et fichiers locaux → Network-first
  //    Si le réseau répond → servir + mettre en cache
  //    Si hors ligne → fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Navigation sans cache → index.html en fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ── Messages depuis l'app ─────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'FLUSH_QUEUE') {
    flushOfflineQueue();
  }
});

// ── Background Sync ───────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'mavigne-sync') {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }));
}
