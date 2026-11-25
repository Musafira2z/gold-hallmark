// Owner's phone app service worker (Plan 19).
// It keeps only the "you're offline" page. Business numbers are never cached,
// so a lost or shared phone does not keep them.
const CACHE = "owner-offline-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/owner/offline", "/owner/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.mode !== "navigate") return; // everything else: the browser as usual
    event.respondWith(fetch(event.request).catch(() => caches.match("/owner/offline")));
});
