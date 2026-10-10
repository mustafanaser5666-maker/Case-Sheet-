/* Case Sheet service worker */
const V = 'v1';
const SHELL = `cs-shell-${V}`;
const RT = `cs-rt-${V}`;
const CORE = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== RT) await caches.delete(k);
    await self.clients.claim();
  })());
});
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
  return res;
}
async function networkFirst(req, name, fallback) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(name)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (fallback) return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
    return new Response('', { status: 503 });
  }
}
async function swr(req) {
  const c = await caches.open(RT);
  const hit = await c.match(req);
  const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname === '/sw.js') return;
    if (/\.png$/.test(u.pathname)) return e.respondWith(cacheFirst(req));
    if (u.pathname.startsWith('/api/')) return e.respondWith(networkFirst(req, RT, false));
    return e.respondWith(networkFirst(req, SHELL, req.mode === 'navigate'));
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return e.respondWith(swr(req));
});
