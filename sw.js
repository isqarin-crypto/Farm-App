/* Farm Manager offline cache: network first, cached copy when offline. */
const CACHE = 'farm-manager-v20';
const ASSETS = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }
        /* site missing or error (e.g. 404): keep using the saved copy */
        return caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : null)).then(r => r || res);
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

/* ---------- reminders while the app is closed (Android may wake this about once or twice a day for installed apps) ---------- */
function kv() { return new Promise(res => { const q = indexedDB.open('farmapp.sw', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
function kvGet(d, k) { return new Promise(res => { const r = d.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }
function kvSet(d, k, v) { return new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = t.onerror = () => res(); }); }
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
async function remindFromSW() {
  const d = await kv(); if (!d) return;
  const list = (await kvGet(d, 'reminders')) || [], sent = new Set((await kvGet(d, 'sent')) || []), t = iso(new Date());
  for (const r of list) {
    if (t < plus(r.date, -r.rd) || t > r.end) continue;
    const key = (t >= r.date ? 'day:' : 'pre:') + r.date;
    if ((r.notified || []).includes(key) || sent.has(r.id + '|' + key)) continue;
    const dd = Math.round((new Date(r.date + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5);
    await self.registration.showNotification(`${r.title} — ${dd <= 0 ? 'due today' : dd === 1 ? 'due tomorrow' : 'due in ' + dd + ' days'}`, { body: r.block || 'Farm Manager', tag: 'rem-' + r.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: '#record/' + r.id } });
    sent.add(r.id + '|' + key);
  }
  await kvSet(d, 'sent', [...sent].slice(-500));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'farm-reminders') e.waitUntil(remindFromSW()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./index.html' + ((e.notification.data && e.notification.data.url) || '#today'), self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate ? c.navigate(url).catch(() => { }) : null; return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
