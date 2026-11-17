// Avisos con la app cerrada (Firebase Cloud Messaging). El "reloj" que los manda corre gratis en GitHub Actions.
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const pushReady = () => !DEMO && !!CONFIG.vapidKey && "serviceWorker" in navigator && "PushManager" in window;

export async function enablePush(cid) {
  if (!pushReady()) throw new Error("no-config");
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.ready;
  const m = await import(FB + "firebase-messaging.js");
  const token = await m.getToken(m.getMessaging(db.app), { vapidKey: CONFIG.vapidKey, serviceWorkerRegistration: reg });
  const id = token.slice(-16).replace(/[^a-zA-Z0-9]/g, "");
  await db.set(`clients/${cid}/settings/push`, { tokens: { [id]: token }, at: Date.now() }, false);
  localStorage.setItem("pushOn", "1"); localStorage.setItem("pushTok", token + cid);
  return true;
}
export const pushOn = () => { try { return localStorage.getItem("pushOn") === "1"; } catch { return false; } };

// Los tokens de aviso caducan (al actualizar la app, limpiar datos, etc.). Cada vez que se abre la app se renueva
// en silencio y reemplaza al anterior, así el "reloj" de avisos siempre tiene uno vigente.
export async function refreshPush(cid) {
  try {
    if (!pushReady() || !pushOn() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    const m = await import(FB + "firebase-messaging.js");
    const msg = m.getMessaging(db.app), opts = { vapidKey: CONFIG.vapidKey, serviceWorkerRegistration: reg };
    // Una vez (v1.11): descarta el token viejo, que en algunos celulares ya estaba caducado
    if (!localStorage.getItem("pushReset1")) { await m.deleteToken(msg).catch(() => {}); localStorage.setItem("pushReset1", "1"); localStorage.removeItem("pushTok"); }
    let token = await m.getToken(msg, opts);
    const saved = Object.values((await db.get(`clients/${cid}/settings/push`))?.tokens || {});
    if (token && saved.includes(token) && localStorage.getItem("pushTok") === token + cid) return;
    // Si el servidor lo borró por caducado, se pide uno nuevo de verdad
    if (token && !saved.includes(token) && localStorage.getItem("pushTok") === token + cid) { await m.deleteToken(msg).catch(() => {}); token = await m.getToken(msg, opts); }
    if (!token) return;
    const id = token.slice(-16).replace(/[^a-zA-Z0-9]/g, "");
    await db.set(`clients/${cid}/settings/push`, { tokens: { [id]: token }, at: Date.now() }, false);
    localStorage.setItem("pushTok", token + cid);
  } catch (e) { console.warn("refreshPush", e); }
}
