// Service worker: guarda la app en el celular para que abra sin conexión.
// Cada vez que publiques cambios, sube el número de versión.
const VERSION = "v4";
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/app.css", "icons/icon-192.png", "icons/icon-512.png",
  "js/app.js", "js/config.js", "js/db.js", "js/util.js", "js/ui.js", "js/state.js", "js/data.js", "js/foods.js", "js/realfoods.js", "js/icons.js",
  "js/client.js", "js/train.js", "js/coach.js", "js/demo.js"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const own = u.origin === location.origin, sdk = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.hostname);
  if (!own && !sdk) return; // Firestore, Open Food Facts, etc. van directo a la red
  // Red primero (para recibir actualizaciones), y si no hay señal, lo guardado
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => cs[0] ? cs[0].focus() : self.clients.openWindow("./"))); });
