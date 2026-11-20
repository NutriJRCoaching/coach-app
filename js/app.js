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
      <img class="logo-img" src="icons/logo.png?v=ima2" alt="IMA"><p class="muted">Modo demo: los datos se guardan solo en este navegador.</p>
      <button class="btn primary big" data-a="demoIn" data-uid="cli-demo">Entrar como cliente (celular)</button>
      <button class="btn big" data-a="demoIn" data-uid="coach-demo">Entrar como coach (escritorio)</button>
      <button class="btn ghost small" data-a="demoReset">Reiniciar datos de ejemplo</button><p class="ver">v${CONFIG.appVersion}</p></div>`;
    return;
  }
  root.innerHTML = `<form class="login-box" id="loginF">
    <img class="logo-img" src="icons/logo.png?v=ima2" alt="IMA">
    ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    <label>Correo<input name="email" type="email" autocomplete="username email" required value="${esc(LS.get("lastEmail") || "")}"></label>
    <label>Contraseña<input name="pass" type="password" autocomplete="current-password" required minlength="6"></label>
    <label class="chkrow"><input type="checkbox" name="keep" ${LS.get("keep") === "0" ? "" : "checked"}> Mantener sesión iniciada</label>
    <label class="chkrow"><input type="checkbox" name="remember" ${LS.get("lastEmail") !== null || LS.get("rememberEmail") !== "0" ? "checked" : ""}> Recordar mi correo</label>
    <button class="btn primary big">Entrar</button>
    <button type="button" class="btn ghost small" data-a="forgot">Olvidé mi contraseña</button>
    <div class="login-sep"><span>¿Primera vez?</span></div>
    <button type="button" class="btn big" data-a="signupView">Crear mi cuenta</button><p class="ver">v${CONFIG.appVersion}</p></form>`;
  $("#loginF").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target), email = f.get("email").trim(), keep = !!f.get("keep");
    LS.set("keep", keep ? "1" : "0");
    if (f.get("remember")) { LS.set("lastEmail", email); LS.set("rememberEmail", "1"); } else { try { localStorage.removeItem("lastEmail"); } catch {} LS.set("rememberEmail", "0"); }
    try { await db.signIn(email, f.get("pass"), keep); }
    catch (err) { loginView(navigator.onLine ? "Correo o contraseña incorrectos" : "Necesitas conexión para iniciar sesión la primera vez"); }
  };
}
// Primera vez: el cliente crea su contraseña con el correo que le dio a su coach.
// Solo puede entrar cuando el coach le dio acceso (y después de verificar su correo).
function signupView(msg = "") {
  root.className = "login";
  root.innerHTML = `<form class="login-box" id="signF">
    <img class="logo-img" src="icons/logo.png?v=ima2" alt="IMA"><h3>Crear mi cuenta</h3>
    <p class="muted small">Usa el <b>mismo correo que le diste a tu coach</b>. Te enviaremos un correo para verificarlo.</p>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    <label>Correo<input name="email" type="email" autocomplete="username email" required></label>
    <label>Crea tu contraseña<input name="pass" type="password" autocomplete="new-password" required minlength="6"></label>
    <label>Repite la contraseña<input name="pass2" type="password" autocomplete="new-password" required minlength="6"></label>
    <button class="btn primary big">Crear cuenta</button>
    <button type="button" class="btn ghost small" data-a="loginBack">Ya tengo cuenta · Entrar</button></form>`;
  $("#signF").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target), email = f.get("email").trim().toLowerCase();
    if (f.get("pass") !== f.get("pass2")) return signupView("Las contraseñas no coinciden");
    try { LS.set("lastEmail", email); await db.signUp(email, f.get("pass")); }
    catch (err) { signupView(err.code === "auth/email-already-in-use" ? "Ese correo ya tiene cuenta: vuelve atrás y entra con tu contraseña (o usa “Olvidé mi contraseña”)" : err.code === "auth/weak-password" ? "La contraseña debe tener al menos 6 caracteres" : navigator.onLine ? "No se pudo crear la cuenta" : "Necesitas conexión para crear tu cuenta"); }
  };
}
act("signupView", () => signupView());
act("loginBack", () => loginView());
// Pantalla de espera: falta verificar el correo o que el coach dé acceso
function waitView(kind) {
  root.className = "login";
  const em = esc(S.user?.email || "");
  root.innerHTML = `<div class="login-box"><img class="logo-img" src="icons/logo.png?v=ima2" alt="IMA">
    ${kind === "verify" ? `<h3>Verifica tu correo</h3><p>Te enviamos un correo a <b>${em}</b>. Ábrelo y toca el enlace para confirmar que es tuyo (revisa también Spam o Promociones).</p>
      <button class="btn primary big" data-a="recheck">Ya lo verifiqué</button><button class="btn ghost small" data-a="resendVerify">Reenviar correo</button>`
    : `<h3>Tu cuenta está creada ✓</h3><p>Tu coach todavía no activa tu acceso para <b>${em}</b>. Avísale por WhatsApp y vuelve a entrar cuando te confirme.</p>
      <button class="btn primary big" data-a="recheck">Ya me dio acceso</button>`}
    <button class="btn ghost small" data-a="logout">Salir</button><p class="ver">v${CONFIG.appVersion}</p></div>`;
}
act("recheck", async () => { try { await db.reloadUser(); } catch {} onUser(db.user); });
act("resendVerify", async () => { try { await db.sendVerify(); toast("Te reenviamos el correo"); } catch { toast("Espera unos minutos antes de pedir otro"); } });
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
  // Plan de ejemplo con 4 alternativas (19-nov-2026), solo si aún no tiene opciones: para ver cómo se ve "Mi plan"
  if (!c.menus?.length && !c.planDemo1911) {
    const { jrPlan } = await import("./seed-plan.js"), { menus, pauta } = jrPlan();
    c = { ...c, menus, pauta: c.pauta && Object.keys(c.pauta).length ? c.pauta : pauta, planDemo1911: true };
    db.set("clients/" + id, { menus, pauta: c.pauta, planDemo1911: true });
  }
  // 20-nov: la opción "Con legumbres" del plan de ejemplo se compara con la pauta del día con legumbres
  if (c.planDemo1911 && !c.planLeg2011) {
    const { JR_PAUTA_LEG } = await import("./seed-plan.js");
    const menus = (c.menus || []).map((m) => (m.id === "jr-ej-3" ? { ...m, leg: true } : m));
    c = { ...c, menus, pautaLeg: c.pautaLeg || JR_PAUTA_LEG, planLeg2011: true };
    db.set("clients/" + id, { menus, pautaLeg: c.pautaLeg, planLeg2011: true });
  }
  S.viewAs = "client"; S.cid = id; S.raw = c; LS.set("viewAs", "client");
  db.watch("clients/" + id, (x) => { if (x && S.cid === id) S.raw = x; });
  if (!location.hash || location.hash.startsWith("#coach")) location.hash = "inicio";
  render();
}
act("asClient", () => { S.preview = null; enterClient(); });
// Ver la app tal como la ve un cliente (no guarda nada en tu celular ni activa sus avisos)
export async function previewClient(cid) {
  const c = await db.get("clients/" + cid); if (!c) return toast("No se encontró el cliente");
  S.viewAs = "client"; S.preview = { cid, name: c.name || "Cliente" }; S.cid = cid; S.raw = c; S.date = ymd();
  db.watch("clients/" + cid, (x) => { if (x && S.cid === cid) S.raw = x; });
  location.hash = "inicio"; render();
}
act("previewClient", (el) => previewClient(el.dataset.id));
act("asCoach", () => { const back = S.preview ? `coach/c/${S.preview.cid}/resumen` : "coach"; S.viewAs = null; S.preview = null; LS.set("viewAs", "coach"); location.hash = back; });

// ---------------------------------------------------------- AUTH
export async function onUser(u) {
  S.user = u;
  if (!u) { S.role = null; return loginView(); }
  const isCoach = DEMO ? u.uid === "coach-demo" : await isCoachEmail(u.email);
  S.role = isCoach ? "coach" : "client";
  if (isCoach) { db.set("users/" + u.uid, { role: "coach", email: u.email, name: "Coach" }); }
  else {
    // Cliente: su ficha se busca por su correo en "access" (la creó el coach antes de que tuviera cuenta)
    let cid = null;
    if (DEMO) cid = u.uid;
    else {
      const own = await db.get("clients/" + u.uid).catch(() => null); // clientes creados con el sistema antiguo
      if (own) cid = u.uid;
      else {
        if (!u.emailVerified) return waitView("verify");
        await db.freshToken().catch(() => {});
        const acc = await db.get("access/" + u.email.trim().toLowerCase()).catch(() => null);
        if (!acc?.ok || !acc.cid) return waitView("access");
        cid = acc.cid;
      }
    }
    S.cid = cid;
    S.raw = (await db.get("clients/" + cid)) || {}; S.client = S.raw;
    db.watch("clients/" + cid, (c) => { if (c && S.cid === cid) { S.raw = c; } });
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
      root.innerHTML = `<div id="net" class="net" hidden></div>${S.preview ? `<div class="pvbar"><span>Viendo como <b>${esc(S.preview.name)}</b> · lo que toques se guarda en su cuenta</span><button class="btn tiny" data-a="asCoach">Volver al panel</button></div>` : ""}<main class="cmain">${main}<p class="ver">${esc(CONFIG.appName)} · v${CONFIG.appVersion}</p></main>${clientTabs()}`;
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
