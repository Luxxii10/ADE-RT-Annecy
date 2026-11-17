/* ============================================================
   Service worker — EDT Labo RT

   Fichiers de l'appli (ce dossier) : réseau d'abord, copie en cache en
   secours. On voit la dernière version quand il y a du réseau, et l'appli
   s'ouvre quand même sans réseau.
   Polices Google : cache d'abord, elles ne changent jamais.
   Flux ADE, proxies et fichiers de pilotage GitHub : jamais interceptés.

   Les 5 derniers EDT consultables hors ligne ne sont pas gérés ici : la
   page les range elle-même dans le cache « ade-edt-hors-ligne ».

   Changer VERSION à chaque mise en ligne d'un sw.js modifié.
   ============================================================ */
const VERSION = 'ade-rt-v10';
const CACHE_APPLI = VERSION + '-appli';
const CACHE_POLICES = VERSION + '-polices';

const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

// Jamais en cache : données vivantes, et URL horodatées qui rempliraient le cache
const JAMAIS = /dispo\.txt|annonce\.txt|raw\.githubusercontent|grenet\.fr|workers\.dev|allorigins|codetabs|corsproxy/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_APPLI)
      .then(c => c.addAll(FICHIERS))
      .catch(() => {})                 // sans réseau à l'installation : rattrapé à la visite suivante
  );
  // Pas de skipWaiting ici : la page propose « Recharger » et nous envoie
  // SKIP_WAITING quand l'utilisateur accepte. À la toute première visite il
  // n'y a pas d'ancien worker, celui-ci s'active donc tout seul.
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles
        .filter(k => k.startsWith('ade-rt-') && !k.startsWith(VERSION))
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || JAMAIS.test(req.url)) return;

  if (/fonts\.(googleapis|gstatic)\.com/.test(req.url)) {
    e.respondWith(cacheDabord(req, CACHE_POLICES));
    return;
  }
  if (new URL(req.url).origin === self.location.origin) {
    e.respondWith(reseauDabord(req));
  }
});

/* ---------- Notifications ----------
   Le push arrive vide (voir worker-push/worker.js) : on va chercher le
   texte auprès du Worker, dont l'adresse a été rangée par la page dans le
   cache « ade-push » au moment de l'abonnement. */
self.addEventListener('push', e => { e.waitUntil(afficherPush()); });

async function afficherPush() {
  let m = { titre: 'EDT Labo RT', corps: 'Ton emploi du temps a bougé, ouvre l\'appli pour voir.', url: './' };
  try {
    const rep = await (await caches.open('ade-push')).match('cfg');
    const cfg = rep ? await rep.json() : null;
    const sub = await self.registration.pushManager.getSubscription();
    if (cfg && cfg.worker && sub) {
      const r = await fetch(cfg.worker + '/message?id=' + await empreinte(sub.endpoint));
      if (r.ok) m = { ...m, ...(await r.json()) };
    }
  } catch (err) { /* sans réseau : message générique */ }
  return self.registration.showNotification(m.titre, {
    body: m.corps, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png',
    tag: 'edt', renotify: true, data: { url: m.url || './' },
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const cible = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ouverte = fenetres.find(c => c.url.startsWith(self.registration.scope));
    if (ouverte) { await ouverte.focus(); return; }
    await self.clients.openWindow(cible);
  })());
});

// Même calcul que le Worker : l'identifiant d'un abonnement est l'empreinte de son adresse
async function empreinte(s) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  let b = ''; for (const x of h) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}

async function cacheDabord(req, nom) {
  const cache = await caches.open(nom);
  const trouve = await cache.match(req);
  if (trouve) return trouve;
  const rep = await fetch(req);
  if (rep.ok || rep.type === 'opaque') cache.put(req, rep.clone());
  return rep;
}

async function reseauDabord(req) {
  const cache = await caches.open(CACHE_APPLI);
  try {
    const rep = await fetch(req);
    if (rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch (err) {
    const trouve = await cache.match(req, { ignoreSearch: true });
    if (trouve) return trouve;
    // Navigation vers une adresse inconnue (#sel=…, ?x=…) : on sert l'appli
    if (req.mode === 'navigate') return cache.match('./index.html');
    throw err;
  }
}
