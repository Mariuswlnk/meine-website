const CACHE_NAME = "digital-cafe-v2";
const ASSETS = [
    "/digital-cafe",
    "/static/digital-cafe.css?v=2",
    "/static/digital-cafe.js?v=2",
    "/static/digital-cafe-bg.jpg",
    "/static/digital-cafe-manifest.json",
    "/digital-cafe-sw.js",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    event.respondWith(
        caches.match(event.request).then((cached) => (
            cached || fetch(event.request).catch(() => caches.match("/digital-cafe"))
        ))
    );
});
