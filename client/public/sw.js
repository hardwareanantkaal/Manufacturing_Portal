// Minimal service worker — exists only so the browser considers this app
// "installable" (Chrome's PWA install criteria require a registered service
// worker with a fetch handler). Deliberately does no caching: sensor data
// is always live, so an offline app shell isn't useful yet. If real offline
// support is wanted later, add a cache-first strategy for static assets here.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
