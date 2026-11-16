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
  await db.set(`clients/${cid}/settings/push`, { tokens: { [id]: token }, at: Date.now() });
  localStorage.setItem("pushOn", "1");
  return true;
}
export const pushOn = () => { try { return localStorage.getItem("pushOn") === "1"; } catch { return false; } };
