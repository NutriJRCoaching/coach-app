// Service worker: guarda la app en el celular para que abra sin conexión.
// Cada vez que publiques cambios, sube el número de versión.
const VERSION = "v91";
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/app.css", "icons/icon-192.png?v=ima2", "icons/icon-512.png?v=ima2", "icons/logo.png?v=ima2", "icons/badge-96.png?v=ima2", "js/seed-jr.js", "js/seed-plan.js",
  "js/app.js", "js/config.js", "js/db.js", "js/util.js", "js/ui.js", "js/state.js", "js/data.js", "js/foods.js", "js/realfoods.js", "js/icons.js",
  "js/client.js", "js/train.js", "js/coach.js", "js/demo.js", "js/voice.js", "js/push.js", "js/offchile.js", "js/menus.js", "js/alerts.js", "js/features.js", "js/onboarding.js", "js/intercambio.js", "js/recorder.js", "js/player.js"];

// cache: "reload" = baja cada archivo del servidor (no del caché del navegador, que GitHub guarda hasta 10 min)
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))); });
// La versión nueva espera hasta que el usuario toque "Actualizar"
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });
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
  e.respondWith(fetch(own ? new Request(e.request, { cache: "no-cache" }) : e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
// Avisos que llegan con la app cerrada (Firebase Cloud Messaging)
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data.json(); } catch {}
  const x = d.data || d.notification || d;
  e.waitUntil(self.registration.showNotification(x.title || "IMA", { body: x.body || "", icon: "icons/icon-192.png?v=ima2", badge: "icons/badge-96.png?v=ima2", tag: x.tag || undefined, data: { url: x.url || "./" }, vibrate: [200, 100, 200] }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs[0]; if (c) { c.focus(); return c.navigate ? c.navigate(url) : null; } return self.clients.openWindow(url);
  }));
});
