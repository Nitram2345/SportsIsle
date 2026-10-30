// Offline cache. ponytail: SHELL is maintained by hand; tests/pwa.test.js fails when it drifts. Bump CACHE on every release.
const CACHE = 'sbi-v5';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'icons/icon.svg',
  'src/config.js',
  'src/main.js',
  'src/storage.js',
  'src/logic/combat.js',
  'src/logic/game.js',
  'src/logic/hex.js',
  'src/logic/map.js',
  'src/logic/movement.js',
  'src/logic/ram.js',
  'src/logic/rng.js',
  'src/logic/vision.js',
  'src/render/camera.js',
  'src/render/renderer.js',
  'src/render/sprites.js',
  'src/render/terrain.js',
  'src/ui/editor-view.js',
  'src/ui/game-view.js',
  'src/ui/input.js',
  'units/golfer.svg',
  'units/hockey.svg',
  'units/jogger.svg',
  'units/karate.svg',
  'units/rugby.svg',
  'units/soccer.svg',
  'units/tennis.svg',
  'facilities/dojo.svg',
  'facilities/golf.svg',
  'facilities/hockey.svg',
  'facilities/house.svg',
  'facilities/park.svg',
  'facilities/rugby.svg',
  'facilities/soccer.svg',
  'facilities/tabletennis.svg',
  'facilities/tennis.svg',
  'maps/index.json',
];

self.addEventListener('install', e => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  // bundled maps listed in maps/index.json
  const index = await (await cache.match('maps/index.json')).json();
  await cache.addAll(index.map(m => 'maps/' + m.file));
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
