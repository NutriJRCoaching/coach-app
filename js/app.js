import { LS } from "./util.js";
// Arranque, inicio de sesión y navegación
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, setRefresher, refresh, go } from "./state.js";
import { act, toast, closeSheet, $ } from "./ui.js";
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
  b.hidden = navigator.onLine; b.textContent = "Estás sin conexión · puedes seguir registrando: tus datos se guardan en el celular y se sincronizan cuando vuelva la señal";
}
addEventListener("online", async () => {
  netBadge(); toast("Conexión recuperada · sincronizando…");
  try { await Promise.race([db.whenSynced(), new Promise((_, r) => setTimeout(r, 20000))]); toast("✓ Tus datos se sincronizaron", 3000); } catch {}
});
addEventListener("offline", () => { netBadge(); toast("Sin conexión · tus registros quedan guardados", 3000); });

// ---------------------------------------------------------- LOGIN
function loginView(msg = "") {
  root.className = "login";
  if (DEMO) {
    root.innerHTML = `<div class="login-box">
      <img class="logo-img" src="icons/logo.png" alt="IMA"><p class="muted">Modo demo: los datos se guardan solo en este navegador.</p>
      <button class="btn primary big" data-a="demoIn" data-uid="cli-demo">Entrar como cliente (celular)</button>
      <button class="btn big" data-a="demoIn" data-uid="coach-demo">Entrar como coach (escritorio)</button>
      <button class="btn ghost small" data-a="demoReset">Reiniciar datos de ejemplo</button><p class="ver">v${CONFIG.appVersion}</p></div>`;
    return;
  }
  root.innerHTML = `<form class="login-box" id="loginF">
    <img class="logo-img" src="icons/logo.png" alt="IMA">
    ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    <label>Correo<input name="email" type="email" autocomplete="username email" required value="${esc(LS.get("lastEmail") || "")}"></label>
    <label>Contraseña<input name="pass" type="password" autocomplete="current-password" required minlength="6"></label>
    <label class="chkrow"><input type="checkbox" name="keep" ${LS.get("keep") === "0" ? "" : "checked"}> Mantener sesión iniciada</label>
    <label class="chkrow"><input type="checkbox" name="remember" ${LS.get("lastEmail") !== null || LS.get("rememberEmail") !== "0" ? "checked" : ""}> Recordar mi correo</label>
    <button class="btn primary big">Entrar</button>
    <button type="button" class="btn ghost small" data-a="forgot">Olvidé mi contraseña</button><p class="ver">v${CONFIG.appVersion}</p></form>`;
  $("#loginF").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target), email = f.get("email").trim(), keep = !!f.get("keep");
    LS.set("keep", keep ? "1" : "0");
    if (f.get("remember")) { LS.set("lastEmail", email); LS.set("rememberEmail", "1"); } else { try { localStorage.removeItem("lastEmail"); } catch {} LS.set("rememberEmail", "0"); }
    try { await db.signIn(email, f.get("pass"), keep); }
    catch (err) { loginView(navigator.onLine ? "Correo o contraseña incorrectos" : "Necesitas conexión para iniciar sesión la primera vez"); }
  };
}
act("demoIn", (el) => db.signIn(el.dataset.uid));
act("demoReset", async () => { await db.resetData(); location.reload(); });
act("forgot", async () => {
  const email = $("#loginF [name=email]").value.trim(); if (!email) return toast("Escribe tu correo primero");
  try { await db.resetPass(email); toast("Te enviamos un correo para cambiar la contraseña"); } catch { toast("No se pudo enviar el correo"); }
});
act("logout", async () => { S.viewAs = null; await db.signOut(); location.hash = ""; });

// El coach también puede usar la app como cliente (su propio registro)
async function enterClient() {
  const id = S.user.uid;
  let c = await db.get("clients/" + id);
  if (!c) { c = { name: "Joaquín Rojas", email: S.user.email || "", startDate: ymd(), kcal: 2400, cho: 280, fat: 70, prot: 160, steps: 9000, water: 2800, sleep: 8, phase: "Mantención", schedule: {} }; await db.set("clients/" + id, c); }
  // Primera vez: carga su rutina inicial (IMA) y el calendario semanal
  if (!c.seeded && !(await db.list(`clients/${id}/routines`)).length) {
    const { jrRoutines } = await import("./seed-jr.js");
    const { routines, schedule, lib } = jrRoutines();
    for (const [rid, r] of Object.entries(routines)) await db.set(`clients/${id}/routines/${rid}`, r);
    c = { ...c, schedule, rest: c.rest || 180, startDate: c.startDate && c.startDate <= ymd() ? c.startDate : ymd() };
    c.seeded = true;
    await db.set("clients/" + id, { schedule, rest: c.rest, startDate: c.startDate, seeded: true });
    const cur = (await db.get("library/exercises"))?.items || [];
    if (!cur.length) await db.set("library/exercises", { items: lib }, false);
    toast("Tu rutina quedó cargada ✓");
  }
  // Objetivos pedidos por Joaquín (16-nov-2026): P 120 · C 380 · G 60 · 10.000 pasos
  if (!c.goals1611) { c = { ...c, prot: 120, cho: 380, fat: 60, kcal: 120 * 4 + 380 * 4 + 60 * 9, steps: 10000, goals1611: true }; db.set("clients/" + id, { prot: 120, cho: 380, fat: 60, kcal: c.kcal, steps: 10000, goals1611: true }); }
  S.viewAs = "client"; S.cid = id; S.raw = c; LS.set("viewAs", "client");
  db.watch("clients/" + id, (x) => { if (x && S.cid === id) S.raw = x; });
  if (!location.hash || location.hash.startsWith("#coach")) location.hash = "inicio";
  render();
}
act("asClient", enterClient);
act("asCoach", () => { S.viewAs = null; LS.set("viewAs", "coach"); location.hash = "coach"; });

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
  if (isCoach && LS.get("viewAs") === "client" && !location.hash.startsWith("#coach")) return enterClient();
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
      root.innerHTML = `<div id="net" class="net" hidden></div><main class="cmain">${main}<p class="ver">${esc(CONFIG.appName)} · v${CONFIG.appVersion}</p></main>${clientTabs()}`;
    }
    if (!sameRoute) root.querySelector(".cmain, .cpanel")?.classList.add("enter");
    root.dataset.route = location.hash;
    netBadge();
    if (sameRoute) window.scrollTo(0, scrollY); else window.scrollTo(0, 0);
    document.dispatchEvent(new Event("rendered"));
  } catch (e) { console.error(e); root.innerHTML = `<div class="pad"><p class="err">Ocurrió un error: ${esc(e.message)}</p><button class="btn" data-a="logout">Salir</button></div>`; }
  rendering = false;
  if (pending) { pending = false; render(); }
}
setRefresher(render);
db.onStale = () => { if (!document.querySelector(".sheet-bg") && !document.activeElement?.matches?.("input,textarea,select")) render(); };
addEventListener("hashchange", () => { if (document.querySelector(".sheet-bg")) closeSheet(); render(); });

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
  if ("serviceWorker" in navigator && location.protocol === "https:") registerSW();
})();

// ---------------------------------------------------------- ACTUALIZACIONES
function registerSW() {
  let reg = null, updating = false;
  const reload = () => location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating) reload(); });
  const update = async () => {
    if (updating) return; updating = true;
    try { sessionStorage.setItem("justUpdated", "1"); } catch {}
    const btn = document.querySelector("#upd button"); if (btn) btn.textContent = "Actualizando…";
    try { (reg?.waiting || reg?.installing)?.postMessage("skip"); } catch {}
    // Respaldo: si en 1,5 s no se activó, se reinstala desde cero (la app siempre baja el código nuevo con conexión)
    setTimeout(async () => { try { await reg?.unregister(); } catch {} reload(); }, 1500);
  };
  const ask = () => {
    try { if (sessionStorage.getItem("justUpdated")) return; } catch {}
    if (document.getElementById("upd")) return;
    const d = document.createElement("div");
    d.id = "upd"; d.className = "upd";
    d.innerHTML = `<span><b>Nueva versión disponible</b><small>Toca para actualizar la app</small></span><button class="btn small">Actualizar</button>`;
    d.addEventListener("click", update);
    document.body.appendChild(d);
  };
  try { setTimeout(() => sessionStorage.removeItem("justUpdated"), 10000); } catch {}
  navigator.serviceWorker.register("sw.js").then((r) => {
    reg = r;
    if (r.waiting && navigator.serviceWorker.controller) ask();
    r.addEventListener("updatefound", () => {
      const w = r.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) ask(); });
    });
    const check = () => r.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    setInterval(check, 15 * 60 * 1000);
  }).catch(() => {});
}
