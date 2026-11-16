import { LS } from "./util.js";
// Arranque, inicio de sesión y navegación
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, setRefresher, refresh, go } from "./state.js";
import { act, toast, $ } from "./ui.js";
import { esc, ymd } from "./util.js";
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const isCoachEmail = async (email) => !!email && (await sha(email.trim().toLowerCase())) === CONFIG.coachEmailHash;
import { clientView, clientTabs } from "./client.js";
import { coachView } from "./coach.js";

const root = document.getElementById("app");

// Tema claro / oscuro
const applyTheme = () => document.documentElement.dataset.theme = LS.get("theme") || "dark";
applyTheme();
act("theme", (el) => { LS.set("theme", el.dataset.v); applyTheme(); refresh(); });

// Indicador de conexión
function netBadge() {
  const b = $("#net"); if (!b) return;
  b.hidden = navigator.onLine; b.textContent = "Sin conexión · tus registros se guardan y se sincronizan al volver la señal";
}
addEventListener("online", () => { netBadge(); toast("Conexión recuperada · sincronizando"); });
addEventListener("offline", netBadge);

// ---------------------------------------------------------- LOGIN
function loginView(msg = "") {
  root.className = "login";
  if (DEMO) {
    root.innerHTML = `<div class="login-box">
      <div class="logo">JR</div><h1>${esc(CONFIG.appName)}</h1>
      <p class="muted">Modo demo: los datos se guardan solo en este navegador.</p>
      <button class="btn primary big" data-a="demoIn" data-uid="cli-demo">Entrar como cliente (celular)</button>
      <button class="btn big" data-a="demoIn" data-uid="coach-demo">Entrar como coach (escritorio)</button>
      <button class="btn ghost small" data-a="demoReset">Reiniciar datos de ejemplo</button></div>`;
    return;
  }
  root.innerHTML = `<form class="login-box" id="loginF">
    <div class="logo">JR</div><h1>${esc(CONFIG.appName)}</h1>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    <label>Correo<input name="email" type="email" autocomplete="email" required></label>
    <label>Contraseña<input name="pass" type="password" autocomplete="current-password" required minlength="6"></label>
    <button class="btn primary big">Entrar</button>
    <button type="button" class="btn ghost small" data-a="forgot">Olvidé mi contraseña</button>
    <button type="button" class="btn ghost small" data-a="coachSignup">Soy el coach y es mi primera vez</button></form>`;
  $("#loginF").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    try { await db.signIn(f.get("email").trim(), f.get("pass")); }
    catch (err) { loginView(navigator.onLine ? "Correo o contraseña incorrectos" : "Necesitas conexión para iniciar sesión la primera vez"); }
  };
}
act("demoIn", (el) => db.signIn(el.dataset.uid));
act("demoReset", async () => { await db.resetData(); location.reload(); });
act("forgot", async () => {
  const email = $("#loginF [name=email]").value.trim(); if (!email) return toast("Escribe tu correo primero");
  try { await db.resetPass(email); toast("Te enviamos un correo para cambiar la contraseña"); } catch { toast("No se pudo enviar el correo"); }
});
act("coachSignup", async () => {
  const email = $("#loginF [name=email]").value.trim(), pass = $("#loginF [name=pass]").value;
  if (!(await isCoachEmail(email))) return toast("Ese correo no es el del coach");
  if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres");
  try { await db.signUp(email, pass); } catch (e) { toast("No se pudo crear: " + e.code); }
});
act("logout", async () => { S.viewAs = null; await db.signOut(); location.hash = ""; });

// El coach también puede usar la app como cliente (su propio registro)
act("asClient", async () => {
  const id = S.user.uid;
  let c = await db.get("clients/" + id);
  if (!c) { c = { name: "Joaquín Rojas", email: S.user.email || "", startDate: ymd(), kcal: 2400, cho: 280, fat: 70, prot: 160, steps: 9000, water: 2800, sleep: 8, phase: "Mantención", schedule: {} }; await db.set("clients/" + id, c); }
  S.viewAs = "client"; S.cid = id; S.raw = c;
  db.watch("clients/" + id, (x) => { if (x && S.cid === id) S.raw = x; });
  location.hash = "inicio";
});
act("asCoach", () => { S.viewAs = null; location.hash = "coach"; });

// ---------------------------------------------------------- AUTH
async function onUser(u) {
  S.user = u;
  if (!u) { S.role = null; return loginView(); }
  const isCoach = DEMO ? u.uid === "coach-demo" : await isCoachEmail(u.email);
  S.role = isCoach ? "coach" : "client";
  if (isCoach) { db.set("users/" + u.uid, { role: "coach", email: u.email, name: "Coach" }); }
  else {
    S.cid = u.uid;
    S.raw = (await db.get("clients/" + u.uid)) || {}; S.client = S.raw;
    db.watch("clients/" + u.uid, (c) => { if (c) { S.raw = c; } });
  }
  const coachHash = location.hash.startsWith("#coach");
  if (!location.hash || isCoach !== coachHash) location.hash = isCoach ? "coach" : "inicio";
  render();
}

// ---------------------------------------------------------- RENDER
let rendering = false, pending = false;
async function render() {
  if (!S.user) return;
  if (rendering) { pending = true; return; }
  rendering = true;
  try {
    S.route = (location.hash.slice(1) || "").split("/");
    const scrollY = window.scrollY, sameRoute = root.dataset.route === location.hash;
    if (S.role === "coach" && location.hash.startsWith("#coach")) S.viewAs = null;
    if (S.role === "coach" && S.viewAs !== "client") {
      root.className = "coach";
      root.innerHTML = `<div id="net" class="net" hidden></div>${await coachView()}`;
    } else {
      root.className = "client";
      const main = await clientView();
      root.innerHTML = `<div id="net" class="net" hidden></div><main class="cmain">${main}</main>${clientTabs()}`;
    }
    root.dataset.route = location.hash;
    netBadge();
    if (sameRoute) window.scrollTo(0, scrollY); else window.scrollTo(0, 0);
    document.dispatchEvent(new Event("rendered"));
  } catch (e) { console.error(e); root.innerHTML = `<div class="pad"><p class="err">Ocurrió un error: ${esc(e.message)}</p><button class="btn" data-a="logout">Salir</button></div>`; }
  rendering = false;
  if (pending) { pending = false; render(); }
}
setRefresher(render);
addEventListener("hashchange", render);

// ---------------------------------------------------------- BOOT
(async () => {
  try {
    await db.init();
    if (DEMO) await db.restore();
    db.onAuth(onUser);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="pad"><p class="err">No se pudo iniciar la app. Si es la primera vez, necesitas conexión.</p><p class="small muted">${esc(e.message)}</p></div>`;
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
