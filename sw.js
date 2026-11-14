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
const VERSION = 'ade-rt-v5';
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
      .then(() => self.skipWaiting())
  );
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
