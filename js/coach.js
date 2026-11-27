import { LS } from "./util.js";
// Panel del coach (escritorio)
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, refresh, go } from "./state.js";
import { I } from "./icons.js";
import { act, toast, sheet, closeSheet, confirmBox, promptBox, bar, lineChart, dualChart, $, $$ } from "./ui.js";
import { e1rm } from "./util.js";
import { esc, ymd, addDays, fmtDate, weekInfo, dayTotals, itemMacros, sleepHours, sleepColor, r0, r1, num, avg, sum, uid, trend, DAYS, embedUrl, pad, lastOpenTxt, lastOpenCls } from "./util.js";
import { PAY_FIELDS } from "./data.js";
let PAYD = null; // datos para transferir (library/payment), para la vista previa en Datos
import { DEFAULT_RANGES, adjTxt, payMsg, reviewWindow, monthCal, judge, weightCorr, STOOL_KG, waterAuto, routineBlock, planStr, setStr, isRotation, nextInRotation, appStart, payState, regSoFar, trainSoFar, hasFood, ratioCls } from "./data.js";
import "./onboarding.js";
import { startRecording, uploadToDrive, driveReady, recSupported } from "./recorder.js";
import { FEATURES, SVC_COLS, loadMatrix, has, defaultOf } from "./features.js";
import { mealList, getDays, getRoutines, getSessions, getClient, weekPlan, prevSession, prevFor, refSet, modsBetween, setProgress, exProgress, MEASURE_ZONES, PHOTO_TYPES, resetFoodCache, applyStage, stagesBar, phaseColor, PHASES, PHASE_PCT, phaseAt, hasPlans, CHECKIN, CHECKIN_OLD } from "./data.js";
import { weeksTable } from "./client.js";
import { GROUPS } from "./foods.js";
import { menusEditor } from "./menus.js";
import { undoSource, track, forget } from "./undo.js";
import { afterActs } from "./ui.js";
import { loadCtx, alertsFor, levelOf, SERVICES, SERVICE_GROUPS, emailKey, checkinDayTxt } from "./alerts.js";

// Pendientes de todos los clientes (se recalculan como máximo cada 30 s o al guardar algo)
let AL = { at: 0, map: {}, dirty: true, busy: null };
export const resetAlerts = () => { AL.at = 0; AL.dirty = true; };
window.addEventListener("ima-alerts", () => resetAlerts());
// Rutina en edición: muestra "Cambios sin guardar" apenas se toca algo de la tabla o del detalle
document.addEventListener("change", (e) => { if (e.target.closest?.("[data-rdirty]")) { const b = document.getElementById("rDirty"); if (b) b.hidden = false; } }); // otros módulos (ej. el editor del plan) piden recalcular los avisos
async function computeAlerts(clients) {
  const out = {};
  await Promise.all(clients.map(async (c) => { const x = await loadCtx(c); out[c.id] = { x, A: alertsFor(c, x) }; }));
  AL = { at: Date.now(), map: out, dirty: false, busy: null }; return out;
}
// Cambiar de pestaña no espera a recalcular los pendientes de todos: usa lo último y lo actualiza por detrás
async function allAlerts(clients) {
  const have = clients.every((c) => AL.map[c.id]);
  if (have && !AL.dirty) {
    if (Date.now() - AL.at > 60000 && !AL.busy && !document.body.classList.contains("rec-on")) AL.busy = computeAlerts(clients).catch(() => (AL.busy = null));
    return AL.map;
  }
  return AL.busy && !AL.dirty ? AL.busy : computeAlerts(clients);
}
// Pendientes de un cliente plegados: puntos con la cantidad por color (rojo / amarillo / gris, o verde si está al día); al tocar se despliega la lista
const OPEN_P = new Set();
function pendDrop(A, cid) {
  const n = (k) => A.filter((a) => a.c === k).length, r = n("r"), y = n("y"), i = n("i");
  const dots = `${r ? `<span class="pdot r" title="Urgentes">${r}</span>` : ""}${y ? `<span class="pdot y" title="Pendientes">${y}</span>` : ""}${!r && !y ? `<span class="pdot g" title="Al día">✓</span>` : ""}${i ? `<span class="pdot i" title="Informativos">${i}</span>` : ""}`;
  if (!A.length) return `<div class="pdrop">${dots}</div>`;
  return `<details class="pdrop" ${OPEN_P.has(cid) ? "open" : ""} data-cid="${cid}"><summary data-a="pdTog" data-cid="${cid}">${dots}<span class="muted small">ver</span></summary><div class="pdlist">${A.map((a) => chip(a, cid)).join(" ")}</div></details>`;
}
act("pdTog", (el) => { const id = el.dataset.cid; el.parentElement.open ? OPEN_P.delete(id) : OPEN_P.add(id); });
const chip = (a, cid) => `<a class="badge ${a.c === "i" ? "" : a.c}" href="#coach/c/${cid}/${a.tab}">${esc(a.t)}</a>`;

const TABS = [["datos", "Datos y objetivos"], ["resumen", "Timeline semanal"], ["etapas", "Etapas"], ["entrenos", "Entrenamiento"], ["comida", "Alimentación"], ["plan", "Plan alimentación"], ["progreso", "Progreso"], ["checkins", "Check-ins"], ["feedback", "Retroalimentación"]];
let CW = null; // semana que está viendo el coach
let PF = null; // último cliente precargado

export async function coachView() {
  const [, sec, cid, tab] = S.route;
  const clients = (await db.list("clients")).filter((c) => !c.archived && c.id !== S.user?.uid).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const [ALL] = await Promise.all([allAlerts(clients), loadMatrix()]);
  S.coachAlerts = { clients, ALL };
  let main;
  if (sec === "c" && cid) main = await clientPanel(cid, tab || "resumen", ALL[cid]);
  else if (sec === "lib") main = await library();
  else main = await overview(clients, ALL);
  const nR = Object.values(ALL).reduce((t, v) => t + v.A.filter((a) => a.c === "r").length, 0), nY = Object.values(ALL).reduce((t, v) => t + v.A.filter((a) => a.c === "y").length, 0);
  return `<aside class="side"><div class="brand"><img src="icons/logo.png?v=ima2" class="logo-sm" alt="">${esc(CONFIG.appName)}<button class="icon-btn bell ${nR ? "ring" : ""}" data-a="coachBell" title="Pendientes">${I.bell}${nR + nY ? `<i class="bdg ${nR ? "" : "y"}">${nR + nY}</i>` : ""}</button></div>
  <a href="#coach" class="${!sec ? "on" : ""}">Clientes</a>
  ${SERVICE_GROUPS.map(([k, l]) => { const g = clients.filter((c) => (c.service || "") === k); return g.length ? `<div class="side-g">${l}</div>${g.map((c) => `<a href="#coach/c/${c.id}/${tab || "resumen"}" class="sub ${cid === c.id ? "on" : ""}"><span class="lv ${levelOf(ALL[c.id]?.A || [])}"></span>${esc(c.name || "Sin nombre")}</a>`).join("")}` : ""; }).join("")}
  <a href="#coach/lib" class="${sec === "lib" ? "on" : ""}">Biblioteca</a>
  <button class="btn small" data-a="asClient">Mi registro (vista cliente)</button>
  <button class="btn small" data-a="newClient">＋ Nuevo cliente</button>
  <button class="btn ghost small" data-a="importOpen">Importar clientes</button>
  <div class="grow"></div>
  <button class="btn ghost small" data-a="theme" data-v="${(LS.get("theme") || "dark") === "dark" ? "light" : "dark"}">Tema ${(LS.get("theme") || "dark") === "dark" ? "claro" : "oscuro"}</button>
  <button class="btn ghost small" data-a="logout">Cerrar sesión</button>${DEMO ? `<small class="muted">MODO DEMO</small>` : ""}<p class="ver">v${CONFIG.appVersion}</p></aside>
  <section class="cpanel">${main}</section>`;
}

// ================================================================ RESUMEN GENERAL
act("coachBell", () => {
  const { clients, ALL } = S.coachAlerts || { clients: [], ALL: {} };
  const rows = clients.map((c) => ({ c, A: (ALL[c.id]?.A || []).filter((a) => a.c !== "i") })).filter((r) => r.A.length).sort((a, b) => b.A.filter((x) => x.c === "r").length - a.A.filter((x) => x.c === "r").length);
  sheet("Pendientes", rows.length ? rows.map(({ c, A }) => `<div class="bell-c"><a href="#coach/c/${c.id}/resumen" data-a="closeSheet"><b>${esc(c.name)}</b></a>${A.map((a) => `<a class="pend ${a.c}" href="#coach/c/${c.id}/${a.tab}" data-a="closeSheet"><span class="dot"></span>${esc(a.t)}</a>`).join("")}</div>`).join("") : `<p class="muted center">Todo al día ✓</p>`);
});
async function overview(clients, ALL) {
  const today = ymd();
  const rows = clients.map((c) => {
    const { x, A } = ALL[c.id] || { x: { routines: [], sessions: [], days: {}, checkins: [] }, A: [] };
    const w = c.startDate ? weekInfo(c, today) : null;
    const plan = w ? weekPlan(c, x.routines, x.sessions) : null;
    const F = w ? regSoFar(c, w, x.days || {}, hasFood, today) : { k: 0, n: 0 }, W = w ? regSoFar(c, w, x.days || {}, (d) => d.weight, today) : { k: 0, n: 0 };
    const foodDays = F, wDays = W;
    const lastCi = [...x.checkins].sort((a, b) => b.id.localeCompare(a.id))[0];
    return { c, x, A, w, plan, foodDays, wDays, lastCi, lv: levelOf(A) };
  }).sort((a, b) => "ryg".indexOf(a.lv) - "ryg".indexOf(b.lv) || a.c.name.localeCompare(b.c.name));
  const nR = rows.filter((r) => r.lv === "r").length, nY = rows.filter((r) => r.lv === "y").length;
  const active = (r) => r.x.access?.ok || r.c.example;
  return `<div class="row between"><h1>Clientes</h1><div class="row gap"><button class="btn small" data-a="exampleClient">Crear cliente de ejemplo</button></div></div>
  <div class="ov-sum"><div class="ov r"><b>${nR}</b><span>con algo urgente</span></div><div class="ov y"><b>${nY}</b><span>con pendientes</span></div><div class="ov g"><b>${rows.length - nR - nY}</b><span>al día</span></div><div class="ov"><b>${rows.filter(active).length}/${rows.length}</b><span>con acceso a la app</span></div></div>
  <p class="muted small">${fmtDate(today, true)} · <span class="badge r">rojo</span> urgente · <span class="badge y">amarillo</span> pendiente · <span class="badge">gris</span> informativo. Toca los puntos de un cliente para ver sus pendientes y luego uno para ir directo a resolverlo.</p>
  <table class="tbl big ovt"><tr><th></th><th>Cliente</th><th>Asesoría</th><th>Semana</th><th>Check-in</th><th>Entrenos</th><th>Comida</th><th>Pesajes</th><th>Pendientes</th></tr>
  ${rows.map(({ c, x, A, w, plan, foodDays, wDays, lastCi, lv }) => `<tr><td><span class="lv ${lv}"></span></td><td><a href="#coach/c/${c.id}/resumen"><b>${esc(c.name)}</b></a>${c.example ? ' <span class="badge">ejemplo</span>' : ""}<br><small class="muted">${x.access?.ok ? "✓ con acceso" : c.email ? "sin acceso aún" : "sin correo"}</small>${x.access?.ok ? `<br><small class="lastopen ${lastOpenCls(x.presence?.at)}" title="${x.presence ? `Última vez que abrió la app · ${esc(x.presence.ua || "")} · v${esc(x.presence.ver || "?")}` : "Se registra desde la versión 1.43 de la app"}">${x.presence?.at ? "📱 " + lastOpenTxt(x.presence.at) : "📱 aún sin registro"}</small>` : ""}</td>
    <td>${c.service ? esc(SERVICES[c.service]) : '<span class="badge r">Definir</span>'}${c.modalidad ? `<br><small class="muted">${esc(c.modalidad)}</small>` : ""}</td>
    <td>${w ? `${w.n}<br><small style="color:${phaseColor(applyStage(c).phase)}">${esc(applyStage(c).phase || "")}</small>` : "—"}</td>
    <td>${checkinDayTxt(c)}${c.checkinForm ? '<br><small class="muted">formulario</small>' : ""}${lastCi ? `<br><small class="muted">últ. sem. ${+lastCi.id.slice(1)}</small>` : ""}</td>
    <td>${active({ x, c }) && plan && plan.total ? `${(() => { const t = trainSoFar(plan, today); return `<span class="pill ${t.done >= t.due ? "g" : t.due - t.done >= 2 ? "r" : "y"}" title="Hechos / los que le correspondían hasta hoy (de ${t.total} en la semana)">${t.done}/${t.due}</span><br><small class="muted">de ${t.total}</small>`; })()}` : "—"}</td>
    <td>${active({ x, c }) && c.service !== "entrenamiento" ? (foodDays.n ? `<span class="pill ${ratioCls(foodDays.k, foodDays.n)}" title="Días con comida registrada / días que van de su semana">${foodDays.k}/${foodDays.n}</span>` : '<span class="muted small">recién parte</span>') : "—"}</td><td>${active({ x, c }) ? (wDays.n ? `<span class="pill ${ratioCls(wDays.k, wDays.n)}" title="Días con peso / días que van de su semana">${wDays.k}/${wDays.n}</span>` : '<span class="muted small">recién parte</span>') : "—"}</td>
    <td class="ovchips">${pendDrop(A, c.id)}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">Aún no tienes clientes. Crea uno con “＋ Nuevo cliente” o usa “Importar clientes”.</td></tr>`}</table>`;
}

act("newClient", () => sheet("Nuevo cliente", `<p class="muted small">Se crea su ficha para que vayas cargando su plan. El cliente crea su propia contraseña con este correo y solo puede entrar cuando le des acceso.</p>
  <label>Nombre<input id="ncN"></label><label>Correo<input id="ncE" type="email"></label>
  <label>Tipo de asesoría<select id="ncT">${Object.entries(SERVICES).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
  <label>Fecha de inicio<input id="ncS" type="date" value="${ymd()}"></label><button class="btn primary big" data-a="newClientOk">Crear</button>`));
act("newClientOk", async () => {
  const name = $("#ncN").value.trim(), email = emailKey($("#ncE").value);
  if (!name) return toast("Escribe el nombre");
  const id = uid();
  await db.set("clients/" + id, { name, email, service: $("#ncT").value, startDate: $("#ncS").value, phase: "Mantención", sleep: 8, rest: CONFIG.defaultRest, schedule: {}, createdAt: Date.now() });
  if (email) await db.set("access/" + email, { cid: id, name, ok: false, at: Date.now() });
  closeSheet(); resetAlerts(); go(`coach/c/${id}/datos`);
});
const inviteTxt = (c) => `Hola ${(c.name || "").split(" ")[0]}! Ya tienes acceso a IMA, tu app de asesoría:\n${location.origin + location.pathname}\n\n1. Ábrela en Chrome (Android) o Safari (iPhone) y agrégala a tu pantalla de inicio.\n2. Toca "Crear mi cuenta" y usa este correo: ${c.email}\n3. Crea tu contraseña y confirma el correo que te llega.\n\nCualquier duda me escribes 💪`;
act("copyInv", () => { navigator.clipboard.writeText($("#inv").innerText); toast("Copiado"); });

// ================================================================ PANEL DE UN CLIENTE
async function clientPanel(cid, tab, AA) {
  const c = { id: cid, ...(await getClient(cid)) };
  if (c.service === "entrenamiento") c.selfCalc = await db.get(`clients/${cid}/settings/calc`).catch(() => null); // sus metas salen de su calculadora
  if (tab === "entrenos") db.set("clients/" + cid, { seen: { ...(c.seen || {}), entrenos: Date.now() } });
  // Adelanta en segundo plano lo que usan las otras pestañas, así cambiar de pestaña es instantáneo
  if (PF !== cid) { PF = cid; ["routines", "sessions", "days", "checkins", "feedbacks", "measures", "exnotes"].forEach((x) => db.list(`clients/${cid}/${x}`).catch(() => {})); db.get("library/exercises").catch(() => {}); }
  const A = (AA?.A || []).filter((a) => a.c !== "i"), info = (AA?.A || []).filter((a) => a.c === "i");
  const now = weekInfo(c, ymd()); if (now.n < 1) now.n = 1; // aún no empieza: se muestra la semana 1
  if (!CW || CW.cid !== cid) CW = { cid, n: now.n };
  const wDate = addDays(c.startDate || ymd(), (CW.n - 1) * 7);
  const w = weekInfo(c, wDate);
  const views = { resumen: tlView, etapas: stagesView, entrenos: trainingView, rutinas: trainingView, comida: foodView, plan: async (c) => { const cc = await planCtx(c); S._coachClient = cc; return menusEditor(cc); }, progreso: progView, checkins: checkinsView, feedback: feedbackView, datos: dataView };
  const weekNav = ["resumen", "entrenos", "comida", "feedback"].includes(tab);
  return `<div class="row between"><h1>${esc(c.name)} <small class="muted">· ${c.service ? esc(SERVICES[c.service]) : "Asesoría sin definir"}${c.startDate ? (appStart(c) > ymd() ? ` · empieza el ${fmtDate(appStart(c))}` : ` · Semana ${now.n}`) : ""}${c.service === "entrenamiento" ? "" : ` · <span style="color:${phaseColor(applyStage(c).phase)}">${esc(applyStage(c).phase || "")}</span>`}</small></h1>
  <span class="row gap">${recSupported() ? `<button class="btn small" data-a="recFree" data-cid="${cid}" title="Graba un video cuando quieras (pantalla + tu cara) y mándaselo a este cliente">🎥 Grabar video</button>` : ""}<label class="btn small" title="Mándale un video que ya tienes en el computador (ej. uno que grabaste y descargaste)">⬆ Mandar un video<input type="file" accept="video/*" hidden data-a-change="frFile" data-cid="${cid}"></label><button class="btn small" data-a="previewClient" data-id="${cid}">Ver como cliente</button></span></div>
  ${AA?.x?.access?.ok ? `<p class="small lastopen ${lastOpenCls(AA.x.presence?.at)}">📱 ${AA.x.presence?.at ? `Abrió la app por última vez: <b>${lastOpenTxt(AA.x.presence.at)}</b> <span class="muted">· ${esc(AA.x.presence.ua || "")} · v${esc(AA.x.presence.ver || "?")}</span>` : "Aún no hay registro de cuándo abrió la app (se registra desde la v1.43)"}</p>` : ""}
  ${A.length || info.length ? `<div class="alertbar">${A.map((a) => chip(a, cid)).join("")}${info.map((a) => chip(a, cid)).join("")}</div>` : `<div class="alertbar"><span class="badge g">Todo al día ✓</span></div>`}
  <div class="row between">
  ${weekNav ? `<div class="row gap"><button class="btn small" data-a="cwShift" data-n="-1">‹</button><b>Semana ${w.n}</b> <span class="muted small">${fmtDate(w.first)} – ${fmtDate(w.last)}</span><button class="btn small" data-a="cwShift" data-n="1" ${w.n >= now.n ? "disabled" : ""}>›</button></div>` : "<span></span>"}</div>
  <nav class="ctabs">${TABS.filter(([k]) => !(k === "plan" && !has("plan_menus", c)) && !(k === "etapas" && c.service === "entrenamiento")).map(([k, l]) => `<a href="#coach/c/${cid}/${k}" class="${k === tab ? "on" : ""}">${k === "rutinas" && c.service === "nutricion" ? "Rutinas (las arma el cliente)" : l}</a>`).join("")}</nav>
  <div class="cbody">${await (views[tab] || tlView)(c, w)}</div>`;
}
act("cwShift", (el) => { CW.n += +el.dataset.n; refresh(); });

// ---------- Timeline semanal
let TLM = { m: "kcal", month: null };
const METRICS = [["kcal", "Calorías", "#ef4444", "kcal"], ["cho", "Carbohidratos", "#eab308", "g"], ["fat", "Grasas", "#3b82f6", "g"], ["prot", "Proteína", "#22c55e", "g"], ["steps", "Pasos", "#14b8a6", ""], ["water", "Agua", "#06b6d4", "ml"], ["sleep", "Sueño", "#a855f7", "h"], ["cardio", "Cardio", "#f97316", "min"]];
const dayVal = (x, k) => { if (!x) return null; if (["kcal", "cho", "fat", "prot"].includes(k)) { const t = dayTotals(x); return Object.values(x.meals || {}).some((m) => m.length) ? t[k] : null; } if (k === "water") return sum(x.water || [], (y) => y.ml) || null; if (k === "sleep") return sleepHours(x.sleep); if (k === "cardio") return sum(x.cardio || [], (y) => y.min) || null; return x[k] || null; };
const ma7 = (vals) => vals.map((_, i) => { const w = vals.slice(Math.max(0, i - 6), i + 1).filter((v) => v != null); return w.length >= 2 ? avg(w) : null; });
async function tlView(c0, w) {
  const c = applyStage(c0, w.first), ph = c.phase || "";
  const prevW = weekInfo(c, addDays(w.first, -7));
  const from = addDays(ymd(), -55);
  const [days, pdays, sessions, routines, allDays] = await Promise.all([getDays(w.first, w.last, c.id), getDays(prevW.first, prevW.last, c.id), getSessions(c.id), getRoutines(c.id), getDays(c0.startDate && c0.startDate < from ? c0.startDate : from, ymd(), c.id)]);
  const plan = weekPlan(c, routines, sessions, w.first);
  const row = (d) => { const x = days[d] || {}, t = dayTotals(x), sl = sleepHours(x.sleep); return { d, x, t, sl, water: sum(x.water || [], (y) => y.ml), cardio: sum(x.cardio || [], (y) => y.min) }; };
  const R = w.days.map(row);
  const agg = (dd, f) => avg(dd.map(f).filter((v) => v != null && v !== 0));
  const pR = prevW.days.map((d) => { const x = pdays[d] || {}; return { x, t: dayTotals(x), sl: sleepHours(x.sleep) }; });
  const cmp = (a, b, dec = 1, neutral) => a == null || b == null ? "" : `<small class="${neutral ? "muted" : a - b > 0 ? "g" : "r"}">${a - b > 0 ? "+" : ""}${dec ? r1(a - b) : r0(a - b)}</small>`;
  const cell = (k, v, goal, fmt = r0) => v == null || v === 0 ? `<td class="muted">—</td>` : `<td class="${judge(k, v, goal, ph)}">${fmt(v)}</td>`;
  const lines = [
    ["weight", "Peso (kg)", (r) => r.x.weight, null, r1, (r) => r.x.weight],
    ["wcorr", "Peso corregido (kg)", (r) => weightCorr(r.x), null, r1, (r) => weightCorr(r.x)],
    ["kcal", "Calorías", (r) => r.t.kcal, c.kcal, r0, (r) => r.t.kcal],
    ["cho", "CHO (g)", (r) => r.t.cho, c.cho, r0, (r) => r.t.cho],
    ["fat", "Lípidos (g)", (r) => r.t.fat, c.fat, r0, (r) => r.t.fat],
    ["prot", "Proteína (g)", (r) => r.t.prot, c.prot, r0, (r) => r.t.prot],
    ["steps", "Pasos", (r) => r.x.steps, c.steps, (v) => r0(v).toLocaleString("es-CL"), (r) => r.x.steps],
    ["water", "Agua (ml)", (r) => r.water, c.water, r0, (r) => sum(r.x.water || [], (y) => y.ml)],
    ["sleep", "Sueño (h)", (r) => r.sl, c.sleep, r1, (r) => r.sl],
    ["cardio", "Cardio (min)", (r) => r.cardio, null, r0, (r) => sum(r.x.cardio || [], (y) => y.min)]
  ];
  const dmap = Object.fromEntries(R.map((r) => [r.d, r])), reg = (f) => regSoFar(c0, w, dmap, f); // proporcional a lo que va de la semana
  // gráfico: peso vs la métrica elegida, últimos 56 días, con media móvil de 7 días
  const keys = Array.from({ length: 56 }, (_, i) => addDays(ymd(), i - 55));
  const wv = keys.map((k) => weightCorr(allDays[k])), mm = METRICS.find((x) => x[0] === TLM.m), mv = keys.map((k) => dayVal(allDays[k], TLM.m));
  const goalOf = { kcal: c.kcal, cho: c.cho, fat: c.fat, prot: c.prot, steps: c.steps, water: c.water, sleep: c.sleep }[TLM.m];
  if (!TLM.month) TLM.month = w.first.slice(0, 7);
  return `<div class="tl-top">
  <div class="card tl-cal">${monthCal(c0.service === "entrenamiento" ? { ...c0, stages: [] } : c0, { month: TLM.month, selWeek: w.n, nav: "tlMonth", act: "tlWeek" })}</div>
  <div class="card"><div class="card-t">Entrenamientos</div><div class="big">${plan.doneCount}/${plan.total}</div>${(() => { const t = trainSoFar(plan); return w.first <= ymd() && ymd() <= w.last && t.due < t.total ? `<p class="small ${t.done >= t.due ? "g" : "y"}">${t.done} de ${t.due} hasta hoy</p>` : ""; })()}${plan.rotation ? `<p class="small muted">Rotación${plan.next?.name ? ` · próximo: <b>${esc(plan.next.name)}</b>` : ""}</p>` : ""}${plan.slots.filter((s) => !s.rest).map((s) => `<div class="small"><span class="badge ${s.status}${s.rot && s.status === "proximo" ? " sugd" : ""}">${s.rot && s.status === "proximo" ? (s.sug ? "sugerido" : "para completar") : s.status}</span> ${esc(s.name)} · ${fmtDate(s.date)}</div>`).join("") || '<p class="muted small">Sin calendario de rutinas.</p>'}${plan.missing ? `<p class="small red">${plan.missing > 1 ? "Le faltan" : "Le falta"} ${plan.missing}: ya no alcanzan los días con descanso.</p>` : ""}</div>
  <div class="tl-side"><div class="card"><div class="card-t">Peso promedio</div><div class="big">${r1(agg(R, (r) => weightCorr(r.x))) || "—"} <small>kg</small></div>${cmp(agg(R, (r) => weightCorr(r.x)), agg(pR, (r) => weightCorr(r.x)), 1, true)} <small class="muted">vs sem. anterior</small></div>
  <div class="card"><div class="card-t">Días con registro</div><ul class="adh">${[["Comida", reg((r) => Object.values(r.x.meals || {}).some((m) => m.length))], ["Peso", reg((r) => r.x.weight)], ["Sueño", reg((r) => r.sl)], ["Pasos", reg((r) => r.x.steps)], ["Agua", reg((r) => r.water)]].map(([l, n]) => `<li><span>${l}</span><b class="${ratioCls(n.k, n.n)}">${n.n ? `${n.k}/${n.n}` : "—"}</b></li>`).join("")}</ul></div></div></div>
  <div class="card"><div class="row between"><div class="card-t">Tendencia · peso corporal vs ${mm[1].toLowerCase()} (últimos 56 días, media de 7 días)</div></div>
  <div class="chips">${METRICS.map(([k, l, col]) => `<button class="chip ${k === TLM.m ? "on" : ""}" style="${k === TLM.m ? `background:${col};border-color:${col}` : ""}" data-a="tlMetric" data-k="${k}">${l}</button>`).join("")}</div>
  ${dualChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), { vals: wv, trend: ma7(wv), color: "var(--txt)", unit: "kg" }, { vals: mv, trend: ma7(mv), color: mm[2], unit: mm[3], goal: goalOf })}
  <div class="legend small"><span><i style="background:var(--txt)"></i>Peso (kg, eje izquierdo)</span><span><i style="background:${mm[2]}"></i>${mm[1]} (eje derecho)</span><span>- - - meta</span></div></div>
  <div class="card scroll-x"><table class="tbl tl"><tr><th></th>${R.map((r) => `<th>${fmtDate(r.d)}</th>`).join("")}<th>Promedio</th><th>Objetivo</th><th>vs sem. ant.</th></tr>
  ${lines.map(([k, l, f, goal, fmt, pf]) => { const a = agg(R, f), pa = agg(pR, pf); return `<tr><td><b>${l}</b></td>${R.map((r) => cell(k, f(r), goal, fmt)).join("")}<td class="${judge(k, a, goal, ph)}"><b>${a != null ? fmt(a) : "—"}</b></td><td class="muted">${goal ? fmt(goal) : ""}</td><td>${cmp(a, pa, ["weight", "wcorr", "sleep"].includes(k), k === "weight" || k === "wcorr")}</td></tr>`; }).join("")}
  <tr><td><b>Pesaje</b></td>${R.map((r) => `<td class="small">${r.x.weight ? `${r.x.weightFast === false ? '<span class="r">sin ayuno</span>' : '<span class="g">ayunas</span>'}${r.x.weightBath === false ? '<br><span class="y">sin baño</span>' : ""}` : "—"}</td>`).join("")}<td colspan="3"></td></tr>
  <tr><td><b>Calidad sueño</b></td>${R.map((r) => `<td>${r.x.sleep?.quality || "—"}</td>`).join("")}<td colspan="3"></td></tr>
  <tr><td><b>Cafeína PM (día anterior)</b></td>${R.map((r) => `<td>${r.x.cafPM == null ? "—" : r.x.cafPM ? '<span class="y">Sí</span>' : '<span class="g">No</span>'}</td>`).join("")}<td colspan="3"></td></tr>
  </table><div class="legend small"><span><i class="okc"></i>en meta</span><span><i class="lowc"></i>ojo</span><span><i class="hic"></i>lejos de la meta</span><span class="muted">Pasarse en pasos, agua, sueño o proteína no se marca como malo. Peso corregido = si se pesó sin ir al baño, se restan ${STOOL_KG * 1000} g (una deposición promedio).</span></div></div>
  <div class="card"><div class="card-t">Timeline por semanas</div>${weeksTable(c0, await getDays(c0.startDate || addDays(ymd(), -120), ymd(), c0.id), routines, sessions)}</div>`;
}
act("tlMetric", (el) => { TLM.m = el.dataset.k; refresh(); });
act("tlMonth", (el) => { TLM.month = el.dataset.m; refresh(); });
act("tlWeek", (el) => { CW.n = +el.dataset.w; refresh(); });

// ---------- Entrenamiento (20-nov): una sola pestaña para la revisión semanal
// 1) lo que hizo esta semana (compacto) · 2) la rutina semana a semana con la próxima editable · 3) configuración plegada
async function trainingView(c, w) {
  return `<div class="card-t mt">Semana ${w.n} · lo que hizo</div><div class="ses-grid">${await sessionsView(c, w)}</div>${await routinesView(c)}`;
}
// ---------- Retro por entrenamiento: clients/{id}/sretros/{sessionId} = { text, at, seen } o { skip: true }
act("srSave", async (el) => {
  const text = el.value.trim(), path = `clients/${CW.cid}/sretros/${el.dataset.sid}`;
  if (text) await db.set(path, { text, at: Date.now(), seen: false, skip: false }); else await db.del(path);
  resetAlerts(); toast(text ? "Retro guardada ✓ (tu cliente la ve en su entrenamiento)" : "Retro borrada"); refresh();
});
act("srSkip", async (el) => { await db.set(`clients/${CW.cid}/sretros/${el.dataset.sid}`, { skip: true, at: Date.now() }); resetAlerts(); toast("Marcado como revisado"); refresh(); });
// ---------- Entrenamientos de la semana
async function sessionsView(c, w) {
  const all = await getSessions(c.id);
  const list = all.filter((s) => s.weekKey === w.key && s.status === "fin").sort((a, b) => a.startedAt - b.startedAt);
  const [exnotes, audios0, sretros] = await Promise.all([db.list(`clients/${c.id}/exnotes`), db.list(`clients/${c.id}/audios`), db.list(`clients/${c.id}/sretros`).catch(() => [])]);
  // audios en partes (alta calidad): se arma cada uno con sus partes, que vienen en la misma lista
  const audios = audios0.filter((a) => !String(a.id).includes("~p")).map((a) => (a.parts > 1 ? { ...a, data: a.data + [...Array(a.parts - 1)].map((_, k) => audios0.find((x) => x.id === `${a.id}~p${k + 2}`)?.data ?? "\u0000").join("") } : a)).map((a) => (a.data?.includes("\u0000") ? { ...a, data: "" } : a));
  if (!list.length) return `<p class="muted">Sin entrenamientos registrados esta semana.</p>`;
  const routines = await getRoutines(c.id);
  return list.map((s) => {
    const prev = prevFor(all, s), sv = s.survey || {}, rt = routines.find((r) => r.id === s.routineId);
    return `<div class="card sesc"><div class="row between"><h3>${esc(s.routineName)} <small class="muted">${fmtDate(s.date, true)} · ${s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) + " min" : ""}</small></h3>
    <div class="row gap small">${sv.intensidad ?? sv.dureza ? `<span class="pill">Intensidad ${sv.intensidad ?? sv.dureza}/10</span>` : ""}${sv.fuerza ? `<span class="pill">Fuerza ${sv.fuerza}/5</span>` : ""}${sv.energia ? `<span class="pill">Energía ${sv.energia}/5</span>` : ""}${sv.doms ? `<span class="pill">DOMS ${sv.doms}/5</span>` : ""}${sv.general ? `<span class="pill">General ${sv.general}/5</span>` : ""}${sv.articular === "si" ? `<span class="badge r">Molestia articular: ${esc(sv.articularDet || "")}</span>` : ""}${sv.orden === "no" ? `<span class="badge y">No siguió el orden</span>` : ""}</div></div>
    ${s.comment ? `<div class="note">💬 ${esc(s.comment)}</div>` : ""}
    ${(() => { const r = sretros.find((y) => y.id === s.id); const st = !r ? `<span class="badge y">Pendiente</span>` : r.skip ? `<span class="badge">Revisado sin comentario</span>` : `<span class="badge g">✓ Enviada${r.seen ? " · la vio" : ""}</span>`;
      return `<div class="sretro ${r ? "" : "srp"}"><div class="row between"><b class="small">💬 Tu retro de este entrenamiento</b>${st}</div>
      <textarea rows="2" placeholder="Ej: muy bien la prensa, la próxima sube 5 kg. En el curl cuida no balancear." data-a-change="srSave" data-sid="${s.id}">${esc(r?.text || "")}</textarea>
      ${!r || (!r.text && !r.skip) ? `<button class="btn tiny ghost" data-a="srSkip" data-sid="${s.id}">Revisado, sin comentario</button>` : ""}</div>`; })()}
    ${audios.find((a) => a.id === s.id)?.data ? `<div class="note">🎙️ Audio del cliente (${audios.find((a) => a.id === s.id).secs || "?"} s)<br><audio controls src="${audios.find((a) => a.id === s.id).data}"></audio></div>` : ""}
    <details><summary class="small muted">Ver detalle por serie</summary><table class="tbl"><tr><th>Ejercicio</th><th>Serie</th><th>Esta semana</th><th>Última vez</th><th>Δ</th><th>Nota</th></tr>
    ${s.exercises.map((e) => e.sets.map((x, j) => { const ref = refSet(prev, e.exId, j); const dw = ref && x.w !== "" && ref.w !== "" ? r1(x.w - ref.w) : null, dr = ref && x.r !== "" && ref.r !== "" ? x.r - ref.r : null;
      return `<tr class="${e.extra ? "extra-row" : ""}">${j === 0 ? `<td rowspan="${e.sets.length}"><b>${esc(e.name)}</b>${e.extra ? ' <span class="badge extra">Extra</span>' : ""}${e.replaced ? `<br><small class="muted">reemplazó a ${esc(e.replacedFrom)}</small>` : ""}${e.tech ? `<br><span class="badge tech-${e.tech}">Técnica ${e.tech}</span>` : ""}${exnotes.find((n) => n.id === e.exId)?.text ? `<br><small class="muted">⚙ ${esc(exnotes.find((n) => n.id === e.exId).text)}</small>` : ""}</td>` : ""}
      <td>${j + 1}${e.target?.[j] ? `<br><small class="muted">plan ${esc(e.target[j].reps)}${e.target[j].rir !== "" && e.target[j].rir != null ? "@" + e.target[j].rir : ""}</small>` : ""}</td><td><b>${x.w || "–"} × ${x.r || "–"}</b>${x.rir !== "" ? ` RIR ${x.rir}` : ""}${x.tech ? ` <span class="badge tech-${x.tech}">téc. ${x.tech}</span>` : ""}</td><td class="muted">${ref ? `${ref.w}×${ref.r}${ref.rir !== "" ? " RIR " + ref.rir : ""}` : "—"}</td>
      <td>${(() => { const pg = setProgress(x, ref); return pg ? `<span class="prog ${pg.k}">${pg.k === "up" ? "▲" : pg.k === "down" ? "▼" : pg.k === "bad" ? "⚠" : "•"} ${pg.t}</span>` : ""; })()}</td><td class="small">${esc(x.note || "")}</td></tr>`; }).join("")).join("")}</table></details></div>`;
  }).join("");
}

// Cambios rápidos a una rutina desde Entrenamientos (quedan marcados para la semana que viene, igual que en el editor)
async function patchRoutine(rid, fn, msg) {
  const c = await getClient(CW.cid), routines = await getRoutines(CW.cid), r = routines.find((x) => x.id === rid); if (!r) return;
  fn(r);
  const rv0 = reviewWindow(c, routines, await getSessions(CW.cid)), w = rv0?.open ? rv0.next : weekInfo(c, ymd());
  const prevCh = r.changes?.week === w.key ? r.changes.list : [];
  const { id, ...data } = r; data.updatedAt = Date.now(); if (msg) data.changes = { week: w.key, list: [...prevCh, msg], at: Date.now() };
  await db.set(`clients/${CW.cid}/routines/${rid}`, data);
  if (rv0?.open) { await db.set("clients/" + CW.cid, { rutReview: { week: rv0.next.key, same: false, at: Date.now() } }); resetAlerts(); }
  if (RE?.r?.id === rid) RE = null; toast("Guardado ✓");
}
act("nwNote", (el) => { const v = el.value.trim(); patchRoutine(el.dataset.r, (r) => (r.note = v), v ? `Comentario de la rutina: ${v}` : ""); });
act("nwEx", (el) => { const v = el.value.trim(), f = el.dataset.f; patchRoutine(el.dataset.r, (r) => { const e = r.exercises.find((x) => x.id === el.dataset.e); if (e) e[f] = v; }, v ? `${r_name(el)}: ${f === "wSug" ? "peso sugerido " + v + " kg" : v}` : ""); });
const r_name = (el) => el.closest("label")?.firstChild?.textContent?.trim() || "Ejercicio";

// ---------- Plan de alimentación por etapa: aquí se diseña un plan para cada etapa del Timeline; la app del cliente
// muestra solo el de la etapa de esa semana. Se pasan al editor las etapas (con sus semanas) y los valores para la calculadora.
async function planCtx(c) {
  const now = c.startDate ? Math.max(1, weekInfo(c, ymd()).n) : 1, st = validSt(c), cur = phaseAt(c) || "Mantención";
  // Plan antiguo (uno solo): pasa a ser el plan de la etapa actual, con las metas generales (o las de su pauta)
  if (!hasPlans(c) && ((c.menus || []).length || Object.keys(c.pauta || {}).length)) {
    const t = {}; for (const k of ["kcal", "cho", "fat", "prot"]) if (+c[k]) t[k] = +c[k];
    c.plans = { [cur]: { menus: c.menus || [], pauta: c.pauta || {}, pautaLeg: c.pautaLeg || {}, targets: t, migrated: true, at: Date.now() } };
    await db.set("clients/" + c.id, { plans: c.plans });
  }
  const used = new Map();
  for (const x of st) { const u = used.get(x.phase) || { phase: x.phase, ranges: [] }; u.ranges.push([+x.from, +x.to]); used.set(x.phase, u); }
  for (const ph of Object.keys(c.plans || {})) if (!used.has(ph)) used.set(ph, { phase: ph, ranges: [] });
  if (!used.size) used.set(cur, { phase: cur, ranges: [] });
  const list = [...used.values()].map((u) => { const r = u.ranges.sort((a, b) => a[0] - b[0]), on = r.some(([a, b]) => now >= a && now <= b), nx = r.find(([a]) => a > now);
    return { ...u, color: phaseColor(u.phase), current: on || (!st.length && u.phase === cur), startsIn: nx ? nx[0] - now : null, past: r.length && r.every(([, b]) => b < now), ready: !!c.plans?.[u.phase] }; })
    .sort((a, b) => (b.current - a.current) || ((a.startsIn ?? 99) - (b.startsIn ?? 99)) || a.past - b.past);
  const def = (await db.get("library/phases")) || {};
  return { ...c, phaseList: list, curPhase: list.find((x) => x.current)?.phase || list[0].phase, lastKg: (await lastWeight(c.id)) || c.weightStart || null, pctOf: (p) => def.pct?.[p] ?? PHASE_PCT[p] ?? 0, weekOf: (n) => addDays(c.startDate || ymd(), (n - 1) * 7) };
}


// ---------- Rutinas (editor)
let RE = null; // rutina en edición
async function routinesView(c) {
  const routines = await getRoutines(c.id), lib = (await db.get("library/exercises"))?.items || [], sessions = await getSessions(c.id);
  const sched = c.schedule || {};
  // Se abre sola la primera rutina (antes había que elegirla)
  if ((!RE || RE.cid !== c.id) && routines.length) { const r0_ = routines[0]; RE = { cid: c.id, r: JSON.parse(JSON.stringify(r0_)), orig: JSON.stringify(r0_.exercises || []), origNote: r0_.note || "" }; }
  const ed = RE && RE.cid === c.id ? RE.r : null;
  const rv = reviewWindow(c, routines, sessions);
  const edDirty = ed && (exDiff(ed.exercises, RE.orig) || (ed.note || "") !== (RE.origNote || ""));
  return `${rv ? `<div class="card review ${rv.done ? "ok" : rv.open ? "due" : ""}"><div class="row between"><div><div class="card-t">Pendientes para la semana ${rv.next.n} · parte el ${fmtDate(rv.next.first, true)}</div>
    <p class="small">${rv.done ? "✓ Todo revisado. El cliente ve los ajustes en su semana." : rv.open ? "Ya terminó su semana: en cada rutina ajusta series, reps, RIR, kg sugerido y comentarios y toca “Guardar cambios”, o márcala “Sin cambios”." : `Se abre el ${fmtDate(rv.lastTrain)} (su último entrenamiento de la semana). Igual puedes dejarla lista antes.`}</p>
    <div class="rv-list">${rv.list.map((x) => { const dz = edDirty && ed.id === x.r.id; return `<button class="rv-item ${x.done ? "ok" : dz ? "dz" : ""}" data-a="rEdit" data-id="${x.r.id}">${x.done ? "✓" : dz ? "●" : "○"} <b>${esc(x.r.name)}</b><small>${dz ? "cambios sin guardar" : x.done ? (x.same ? "sin cambios" : "con ajustes") : "por revisar"}</small></button>`; }).join("")}</div></div>
    ${rv.done ? `<button class="btn small ghost" data-a="rvUndo" data-w="${rv.next.key}">Deshacer</button>` : `<button class="btn small" data-a="rvSame" data-w="${rv.next.key}">Todas sin cambios</button>`}</div></div>` : ""}
  <div class="row gap"><div class="routine-list">${routines.map((r) => `<button class="btn ${ed?.id === r.id ? "primary" : ""}" data-a="rEdit" data-id="${r.id}">${esc(r.name)}</button>`).join("")}<button class="btn ghost" data-a="rNew">＋ Nueva rutina</button><label class="btn ghost" title="Archivo ima-rutinas.json con rutinas pasadas desde su planilla">Importar rutinas<input type="file" accept=".json,application/json" hidden data-a-change="rImport"></label></div></div>
  ${ed ? blockGrid(c, ed, sessions, rv) + `<details class="card-d" ${RE.openDetail ? "open" : ""}><summary class="card-t" data-a="rDetail">Ejercicios de ${esc(ed.name)}: agregar, quitar u ordenar · video, tips, tempo, descanso y reemplazos</summary>${routineEditor(ed, lib)}</details>` : `<p class="muted">Crea la primera rutina.</p>`}
  <details class="card-d" ${RE?.openCfg ? "open" : ""}><summary class="card-t" data-a="rCfg">Configuración: ${isRotation(c) ? "rotación de rutinas" : "calendario semanal (qué rutina toca cada día)"} y cardio</summary>  <div>${schedCfg(c, routines, sessions, sched)}
  <div class="cardio-ed"><div class="card-t">Cardio</div><div class="cardio-row"><label class="cw-n">Veces/semana<input type="number" min="0" value="${c.cardio?.perWeek || ""}" data-a-change="cardioSet" data-k="perWeek"></label><label class="grow">Tipo<input value="${esc(c.cardio?.type || "")}" data-a-change="cardioSet" data-k="type" placeholder="Ej: Intervalos en bicicleta estática"></label><label class="cw-n">Minutos<input type="number" value="${c.cardio?.minutes || ""}" data-a-change="cardioSet" data-k="minutes"></label><label class="cw-m">Intensidad<input value="${esc(c.cardio?.intensity || "")}" data-a-change="cardioSet" data-k="intensity" placeholder="7–8/10"></label></div>
  <label>Descripción (la ve completa al tocar Cardio)<textarea rows="4" data-a-change="cardioSet" data-k="desc" placeholder="Ej: 1 min de entrada en calor suave. Luego 4 rondas de 30 s intenso (8/10) + 60 s suave. Al terminar, 1 min de vuelta a la calma.">${esc(c.cardio?.desc || "")}</textarea></label></div>
  <div class="row gap small">Días sugeridos de cardio: ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="ck"><input type="checkbox" ${(c.cardio?.days || []).includes(d) ? "checked" : ""} data-a-change="cardioDay" data-d="${d}">${DAYS[d].slice(0, 3)}</label>`).join("")}</div></div>
</details>

  <datalist id="exlib">${lib.map((e) => `<option value="${esc(e.name)}">`).join("")}</datalist>`;
}
act("rvSame", async (el) => { await db.set("clients/" + CW.cid, { rutReview: { week: el.dataset.w, same: true, at: Date.now() } }); resetAlerts(); toast("Listo: la rutina sigue igual"); refresh(); });
act("rvUndo", async (el) => { await db.set("clients/" + CW.cid, { rutReview: null }); for (const r of await getRoutines(CW.cid)) if (r.review?.week === el.dataset.w) await db.set(`clients/${CW.cid}/routines/${r.id}`, { review: null }); resetAlerts(); refresh(); });
// Una rutina sin cambios para la semana que viene; si ya están todas revisadas, la semana queda revisada
async function reviewDone(w, cid = CW.cid) { const c = await getClient(cid), rv = reviewWindow(c, await getRoutines(cid), await getSessions(cid)); if (rv?.list?.every((x) => x.done)) await db.set("clients/" + cid, { rutReview: { week: w, same: rv.list.every((x) => x.same), at: Date.now() } }); resetAlerts(); }
act("rSameOne", async (el) => { await db.set(`clients/${CW.cid}/routines/${el.dataset.id}`, { review: { week: el.dataset.w, same: true, at: Date.now() } }); await reviewDone(el.dataset.w); toast("Sin cambios para la próxima semana ✓"); refresh(); });
// Días fijos (schedule) o rotación (c.rotation: el cliente alterna las rutinas sin días fijos)
const ROT_DEF = { perWeek: 3, days: [1, 3, 5], minRest: 1 };
function schedCfg(c, routines, sessions, sched) {
  const rot = isRotation(c), R = { ...ROT_DEF, ...(c.rotation || {}) }, order = (R.order || []).filter((id) => routines.some((r) => r.id === id));
  const nm = (id) => esc(routines.find((r) => r.id === id)?.name || "Rutina");
  const modes = `<div class="row gap tmode"><label class="ck"><input type="radio" name="tmode" value="fixed" ${rot ? "" : "checked"} data-a-change="tMode"><b>Días fijos</b></label><label class="ck"><input type="radio" name="tmode" value="rot" ${rot ? "checked" : ""} data-a-change="tMode"><b>Rotación</b></label><span class="muted small">${rot ? "Alterna las rutinas en orden, sin días fijos: le toca la que sigue a la última que hizo." : "Cada rutina tiene su día de la semana."}</span></div>`;
  if (!rot) {
    // Calendario solo para una semana (ej. semana con menos tiempo): esta semana o la siguiente; después vuelve el de siempre
    const wk = weekInfo(c, [ymd(), appStart(c) || ymd()].sort().pop()), nxt = weekInfo(c, addDays(wk.first, 7)), WS = c.weekSched || {};
    const opts = (cur) => `<option value="">Descanso</option>${routines.map((r) => `<option value="${r.id}" ${cur === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}`;
    const one = (w) => WS[w.key] ? `<div class="wsched"><div class="row between"><b>Solo la semana ${w.n}</b> <span class="muted small">(${fmtDate(w.first)} – ${fmtDate(w.last)})</span><button class="btn tiny ghost red" data-a="wsDel" data-w="${w.key}">Quitar: vuelve el calendario de siempre</button></div>
      <div class="sched">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label>${DAYS[d]}<select data-a-change="wsSet" data-w="${w.key}" data-d="${d}">${opts(WS[w.key][d])}</select></label>`).join("")}</div></div>` : "";
    return modes + `<div class="small muted">Calendario de siempre</div><div class="sched">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label>${DAYS[d]}<select data-a-change="schedSet" data-d="${d}">${opts(sched[d])}</select></label>`).join("")}</div>
      ${one(wk)}${one(nxt)}<div class="row gap mt">${WS[wk.key] ? "" : `<button class="btn small" data-a="wsAdd" data-w="${wk.key}">＋ Calendario distinto solo esta semana (semana ${wk.n})</button>`}${WS[nxt.key] ? "" : `<button class="btn small ghost" data-a="wsAdd" data-w="${nxt.key}">＋ Solo la semana ${nxt.n}</button>`}</div>
      <p class="muted small">Para una semana con menos tiempo o un viaje: el cliente ve ese calendario solo esa semana y igual puede hacer cualquiera de sus rutinas (si ese día hace otra, cuenta como hecho).</p>`;
  }
  const nx = order.length ? nextInRotation({ ...c, rotation: { ...R, order } }, sessions) : null, rest = routines.filter((r) => !order.includes(r.id));
  return modes + `<div class="rotcfg">
    <div><div class="small muted">Orden de la rotación</div><ol class="rot-order">${order.map((id, i) => `<li><b>${i + 1}. ${nm(id)}</b><span class="row gap"><button class="btn tiny ghost" data-a="rotMove" data-i="${i}" data-d="-1" ${i ? "" : "disabled"}>▲</button><button class="btn tiny ghost" data-a="rotMove" data-i="${i}" data-d="1" ${i < order.length - 1 ? "" : "disabled"}>▼</button><button class="btn tiny ghost" data-a="rotDel" data-i="${i}" title="Sacar de la rotación">✕</button></span></li>`).join("")}</ol>
      ${rest.length ? `<select data-a-change="rotAdd"><option value="">＋ Agregar rutina…</option>${rest.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select>` : ""}
      ${nx ? `<p class="small">Próximo entrenamiento: <b>${nm(nx.rid)}</b>${nx.lastDate ? ` <span class="muted">(el último fue el ${fmtDate(nx.lastDate)})</span>` : ` <span class="muted">(aún no entrena: parte con la primera)</span>`}</p>` : `<p class="small muted">Agrega al menos una rutina.</p>`}</div>
    <div class="rot-nums"><label>${R.everyOther ? "Objetivo mínimo por semana (puede hacer más)" : "Entrenamientos por semana"}<input type="number" min="1" max="7" value="${R.perWeek}" data-a-change="rotSet" data-k="perWeek"></label>
      <label>Días de descanso mínimo entre entrenos<input type="number" min="0" max="3" value="${R.minRest}" data-a-change="rotSet" data-k="minRest"></label></div>
    <label class="chk"><input type="checkbox" ${R.everyOther ? "checked" : ""} data-a-change="rotEO"> Sugerir día por medio, sin días fijos (al cumplir el objetivo siguen sugerencias opcionales)</label>
    <div class="small" ${R.everyOther ? "hidden" : ""}>Días sugeridos: ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="ck"><input type="checkbox" ${R.days.map(Number).includes(d) ? "checked" : ""} data-a-change="rotDay" data-d="${d}">${DAYS[d].slice(0, 3)}</label>`).join("")}
      <p class="muted small">Si se salta un día sugerido, la app le corre los que quedan (respetando el descanso) y le avisa si ya no alcanzan los días de la semana.</p></div></div>`;
}
async function rotSave(patch) { const c = await getClient(CW.cid); await db.set("clients/" + CW.cid, { rotation: { ...ROT_DEF, ...(c.rotation || {}), ...patch } }); resetAlerts(); refresh(); }
act("tMode", async (el) => {
  const c = await getClient(CW.cid), on = el.value === "rot";
  if (on) { const order = (c.rotation?.order || []).length ? c.rotation.order : (await getRoutines(CW.cid)).map((r) => r.id); await rotSave({ on: true, order }); toast("Rotación activada: revisa el orden y los días sugeridos"); }
  else { await rotSave({ on: false }); toast("Días fijos: elige qué rutina toca cada día"); }
});
act("rotMove", async (el) => { const c = await getClient(CW.cid), o = [...(c.rotation?.order || [])], i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; await rotSave({ order: o }); });
act("rotEO", async (el) => { await rotSave({ everyOther: el.checked, ...(el.checked ? { minRest: 1 } : {}) }); toast(el.checked ? "Día por medio: sin días fijos" : "Vuelven los días sugeridos"); });
act("rotDel", async (el) => { const c = await getClient(CW.cid), o = [...(c.rotation?.order || [])]; o.splice(+el.dataset.i, 1); await rotSave({ order: o }); });
act("rotAdd", async (el) => { if (!el.value) return; const c = await getClient(CW.cid); await rotSave({ order: [...(c.rotation?.order || []), el.value] }); });
act("rotSet", async (el) => { const k = el.dataset.k, v = Math.max(k === "perWeek" ? 1 : 0, Math.min(k === "perWeek" ? 7 : 3, +el.value || 0)); await rotSave({ [k]: v }); toast("Guardado"); });
act("rotDay", async (el) => { const c = await getClient(CW.cid), s = new Set((c.rotation?.days || ROT_DEF.days).map(Number)); el.checked ? s.add(+el.dataset.d) : s.delete(+el.dataset.d); await rotSave({ days: [...s].sort() }); });
act("wsAdd", async (el) => { const c = await getClient(CW.cid); await db.set("clients/" + CW.cid, { weekSched: { ...(c.weekSched || {}), [el.dataset.w]: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, (c.schedule || {})[d] || null])) } }); resetAlerts(); refresh(); });
act("wsSet", async (el) => { const c = await getClient(CW.cid), W = c.weekSched?.[el.dataset.w] || {}; await db.set("clients/" + CW.cid, { weekSched: { ...(c.weekSched || {}), [el.dataset.w]: { ...W, [el.dataset.d]: el.value || null } } }); resetAlerts(); toast("Guardado (solo esa semana)"); });
act("wsDel", async (el) => { const c = await getClient(CW.cid), W = { ...(c.weekSched || {}) }; W[el.dataset.w] = null; await db.set("clients/" + CW.cid, { weekSched: W }); resetAlerts(); toast("Vuelve el calendario de siempre"); refresh(); });
act("schedSet", async (el) => { const c = await getClient(CW.cid); await db.set("clients/" + CW.cid, { schedule: { ...(c.schedule || {}), [el.dataset.d]: el.value || null } }); toast("Calendario guardado"); });
act("cardioSet", async (el) => { const c = await getClient(CW.cid); await db.set("clients/" + CW.cid, { cardio: { ...(c.cardio || {}), [el.dataset.k]: el.type === "number" ? num(el.value) : el.value } }); toast("Guardado"); });
act("cardioDay", async (el) => { const c = await getClient(CW.cid); const s = new Set(c.cardio?.days || []); el.checked ? s.add(+el.dataset.d) : s.delete(+el.dataset.d); await db.set("clients/" + CW.cid, { cardio: { ...(c.cardio || {}), days: [...s] } }); });
act("rEdit", async (el) => { const r = await db.get(`clients/${CW.cid}/routines/${el.dataset.id}`); RE = { cid: CW.cid, r: JSON.parse(JSON.stringify({ id: el.dataset.id, ...r })), orig: JSON.stringify(r.exercises || []), origNote: r.note || "" }; refresh(); });
// Importar rutinas (ima-rutinas.json armado desde la planilla del cliente): reemplaza sus rutinas actuales
const nkx = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
act("rImport", async (el) => {
  let data; try { data = JSON.parse(await el.files[0].text()); } catch { return toast("El archivo no es válido"); } el.value = "";
  if (data.type !== "ima-rutinas" || !Array.isArray(data.routines)) return toast("Este archivo no es de rutinas de IMA");
  const c = await getClient(CW.cid), old = await getRoutines(CW.cid);
  if (data.client && nkx(data.client).split(" ")[0] !== nkx(c.name).split(" ")[0] && !(await confirmBox(`Este archivo es de ${data.client} y estás en la ficha de ${c.name}. ¿Importarlo igual?`))) return;
  if (!(await confirmBox(`Se reemplazan las ${old.length} rutinas actuales de ${c.name} (${old.map((r) => r.name).join(", ") || "ninguna"}) por: ${data.routines.map((r) => r.name).join(", ")}. Los entrenamientos ya registrados no se tocan.`))) return;
  const lib = (await db.get("library/exercises"))?.items || []; let libNew = 0;
  forget("rutina"); // que el guardado automático no vuelva a crear una rutina recién borrada
  for (const r of old) await db.del(`clients/${CW.cid}/routines/${r.id}`);
  const sched = {}, ids = [];
  for (const r of data.routines) {
    const id = uid(); ids.push(id);
    const exercises = (r.exercises || []).map((e) => {
      let l = lib.find((x) => nkx(x.name) === nkx(e.name));
      if (!l) { l = { id: uid(), name: e.name.trim(), group: "", video: "", alts: [], tips: e.notes || "" }; lib.push(l); libNew++; } else if (!l.tips && e.notes) l.tips = e.notes;
      return { id: uid(), name: l.name, libId: l.id, sets: (e.sets || []).map((x) => ({ reps: String(x.reps ?? ""), rir: x.rir ?? "" })), notes: e.notes || l.tips || "", video: e.video || l.video || "", alts: (l.alts || []).map((a) => ({ name: a.name, video: a.video || "", tips: a.tips || "" })), wSug: e.wSug ?? "", ...(e.weekNote ? { weekNote: e.weekNote } : {}) };
    });
    await db.set(`clients/${CW.cid}/routines/${id}`, { name: r.name, note: r.note || "", exercises, importedAt: Date.now() }, false);
    for (const d of r.days || []) sched[d] = id;
  }
  if (libNew || lib.length) await db.set("library/exercises", { items: lib }, false);
  // Si el archivo trae "rotation" ({perWeek, days, minRest}), las rutinas quedan en rotación en el orden del archivo
  const rotation = data.rotation ? { ...ROT_DEF, ...data.rotation, on: true, order: ids } : c.rotation?.on ? { ...c.rotation, order: ids } : null;
  await db.set("clients/" + CW.cid, { schedule: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, sched[d] || null])), rutReview: null, ...(rotation ? { rotation } : {}) }); // null explícito: Firestore mezcla mapas
  RE = null; resetAlerts(); toast(`Listo: ${data.routines.length} rutinas importadas${rotation ? " en rotación" : Object.keys(sched).length ? " con sus días" : ""}`, 4000); refresh();
});
act("rNew", () => { RE = { cid: CW.cid, r: { id: uid(), name: "Nueva rutina", exercises: [], isNew: true }, orig: "[]" }; refresh(); });
// Vista del bloque: lo indicado y lo hecho semana a semana, y la próxima semana editable en la misma tabla
function blockGrid(c, r, sessions, rv) {
  const B = routineBlock(r, sessions), weeks = B.weeks.slice(-5);
  // Semana a la que van los cambios (igual que al guardar): la siguiente si ya se abrió la revisión; si no, la actual (o la 1 si aún no parte)
  const nextN = rv?.open ? rv.next.n : Math.max(1, weekInfo(c, [ymd(), appStart(c) || ymd()].sort().pop()).n), revN = rv?.next?.n;
  migrateWSug(r);
  const prog = (y, p) => { if (!y || !p) return ""; const dw = (+y.w || 0) - (+p.w || 0), dr = (+y.r || 0) - (+p.r || 0); return dw > 0 || (dw === 0 && dr > 0) ? "up" : dw < 0 || (dw === 0 && dr < 0) ? "down" : ""; };
  const repsTxt = (e) => (e.sets || []).map((x) => x.reps ?? "").join(", "), rirTxt = (e) => [...new Set((e.sets || []).map((x) => x.rir ?? ""))].join(", ");
  const dirty = exDiff(r.exercises, RE.orig) || (r.note || "") !== (RE.origNote || "") || r.isNew;
  const st = rv?.list?.find((x) => x.r.id === r.id);
  return `<div class="card blk" data-rdirty><div class="row between"><div class="card-t">${esc(r.name)} · semana a semana</div><span class="row gap"><span class="muted small" title="Cada cambio se guarda solo. Si te equivocas usa ↶ Deshacer (Ctrl+Z)">Se guarda solo</span>${st && !st.done ? `<button class="btn" data-a="rSameOne" data-id="${r.id}" data-w="${rv.next.key}" title="La semana ${revN} esta rutina queda igual">Sin cambios para la semana ${revN}</button>` : st?.done ? `<span class="badge g">${st.same ? "Semana " + revN + ": sin cambios" : "Semana " + revN + ": con ajustes"} ✓</span>` : ""}</span></div>
  <label>Comentario general de la rutina (lo ve al empezarla)<textarea rows="2" data-a-change="rNote" placeholder="Ej: Esta semana sube un poco el peso en los multiarticulares y cuida la bajada en todo.">${esc(r.note || "")}</textarea></label>
  <div class="scroll-x"><table class="tbl blk-t"><tr><th rowspan="2">Ejercicio</th>${weeks.map((wk) => `<th class="wkh">Semana ${+wk.slice(1)}</th>`).join("")}<th rowspan="2" class="vs1h">vs 1ª vez</th><th class="nxh" colspan="3">Semana ${nextN} · lo que va a hacer</th></tr>
  <tr>${weeks.map(() => `<th class="sub">indicado · hecho (kg×reps)</th>`).join("")}<th class="sub nx">Series</th><th class="sub nx">Cada serie: reps · RIR · kg sugerido</th><th class="sub nx">Comentario del ejercicio</th></tr>
  ${r.exercises.map((e, k) => { const cs = B.exs.find((x) => x.e.id === e.id)?.cells || {};
    return `<tr><td class="exc"><b>${k + 1}. ${esc(e.name || "—")}</b></td>${weeks.map((wk, i) => { const cl = cs[wk], pv = i ? cs[weeks[i - 1]] : null; if (!cl) return `<td class="muted center">—</td>`;
      const pl = planStr(cl.plan), chg = pv && planStr(pv.plan) !== pl;
      return `<td class="wkc"><div class="pl ${chg ? "chg" : ""}">${esc(pl || "libre")}${cl.tech ? ` <span class="badge tech-${cl.tech}" title="Técnica ${cl.tech}">${{ mejor: "↑", igual: "=", peor: "↓" }[cl.tech] || ""}</span>` : ""}${cl.notes.length ? ` <span class="nt" title="${esc(cl.notes.join(" · "))}">💬</span>` : ""}${cl.replaced ? ` <span class="nt" title="Usó un reemplazo">⇄</span>` : ""}</div>${cl.sets.map((y, j) => `<div class="dn ${prog(y, pv?.sets?.[j])}">${esc(setStr(y))}${y.rir !== "" && y.rir != null ? `<small> @${esc(y.rir)}</small>` : ""}</div>`).join("") || '<div class="muted small">sin datos</div>'}</td>`; }).join("")}
      ${(() => { const ks = B.weeks.filter((wk) => cs[wk]?.sets?.length); if (ks.length < 2) return `<td class="vs1 muted center">—</td>`; const f = cs[ks[0]].sets, l = cs[ks[ks.length - 1]].sets;
        return `<td class="vs1">${l.slice(0, 2).map((y, j) => { const a = f[j]; if (!a) return ""; const dw = r1((+y.w || 0) - (+a.w || 0)), dr = (+y.r || 0) - (+a.r || 0); return `<div><small class="muted">S${j + 1}</small> <b class="${dw > 0 ? "g" : dw < 0 ? "r" : ""}">${dw > 0 ? "+" : ""}${String(dw).replace(".", ",")} kg</b> <span class="${dr > 0 ? "g" : dr < 0 ? "r" : "muted"}">${dr > 0 ? "+" : ""}${dr} reps</span></div>`; }).join("")}</td>`; })()}
      <td class="nx"><input type="number" min="0" max="10" value="${(e.sets || []).length}" data-a-change="gSets" data-k="${k}" style="width:52px"></td>
      <td class="nx"><div class="psets">${(e.sets || []).map((x, j) => `<span class="ps"><small>S${j + 1}</small><input value="${esc(x.reps ?? "")}" data-a-change="setF" data-k="${k}" data-j="${j}" data-f="reps" placeholder="8-10" title="Repeticiones de la serie ${j + 1}"><select data-a-change="setF" data-k="${k}" data-j="${j}" data-f="rir" title="RIR de la serie ${j + 1}">${["", "F", 0, 1, 2, 3, 4, 5].map((v) => `<option value="${v}" ${String(x.rir ?? "") === String(v) ? "selected" : ""}>${v === "" ? "RIR –" : v === "F" ? "Fallo" : "RIR " + v}</option>`).join("")}</select><input class="kgs" value="${esc(x.w ?? "")}" data-a-change="setF" data-k="${k}" data-j="${j}" data-f="w" placeholder="kg" inputmode="decimal" title="Kg sugerido de la serie ${j + 1} (opcional)"></span>`).join("") || '<span class="muted small">Pon cuántas series</span>'}</div></td>
      <td class="nx"><input value="${esc(e.weekNote || "")}" data-a-change="exF" data-k="${k}" data-f="weekNote" placeholder="Ej: controla la bajada" style="min-width:200px"></td></tr>`; }).join("")}</table></div>
  <p class="muted small">Cada semana muestra lo indicado (series×reps @RIR; en rojo si cambió respecto de la semana anterior) y lo hecho por serie (verde = subió peso o reps, rojo = bajó). En reps puedes poner una por serie separadas por coma (“8, 6”) o una sola para todas. ${weeks.length ? "" : "Aún no hay entrenamientos de esta rutina."}</p></div>`;
}
act("rDetail", (el) => { RE.openDetail = !el.parentElement.open; });
act("rCfg", (el) => { if (RE) RE.openCfg = !el.parentElement.open; });
act("rNote", (el) => { RE.r.note = el.value; });
act("gSets", (el) => { const e = RE.r.exercises[+el.dataset.k], n = Math.max(0, Math.min(10, num(el.value) || 0)); e.sets ||= []; while (e.sets.length < n) e.sets.push({ ...(e.sets[e.sets.length - 1] || { reps: "8-10", rir: 1 }) }); e.sets.length = n; refresh(); });
act("gReps", (el) => { const e = RE.r.exercises[+el.dataset.k], v = el.value.split(",").map((x) => x.trim()).filter(Boolean); if (!v.length) return; (e.sets || []).forEach((x, j) => (x.reps = v[Math.min(j, v.length - 1)])); refresh(); });
act("gRir", (el) => { const e = RE.r.exercises[+el.dataset.k], v = el.value.split(",").map((x) => x.trim()); if (!v.length) return; (e.sets || []).forEach((x, j) => { const t = v[Math.min(j, v.length - 1)]; x.rir = t === "" ? "" : t.toUpperCase() === "F" ? "F" : +t; }); refresh(); });
function routineEditor(r, lib) {
  const T = ["Excéntrica", "Pausa abajo", "Concéntrica", "Pausa arriba"];
  return `<div class="card" data-rdirty><p class="muted small">Lo fijo de cada ejercicio (no cambia semana a semana): nombre y orden, video, tips de ejecución, tempo, descanso y reemplazos. Las series, reps, RIR, kg sugerido y comentarios de cada semana van en la tabla de arriba.</p><div class="row gap"><input class="h-in" value="${esc(r.name)}" data-a-change="rName" placeholder="Nombre de la rutina"><button class="btn ghost" data-a="rDup">Duplicar</button><button class="btn danger" data-a="rDel">Eliminar</button></div>
  ${r.exercises.map((e, k) => { const tp = String(e.tempo || "").split("-"); return `<div class="exed"><div class="row gap"><b class="exn">${k + 1}</b><input class="grow exname" list="exlib" value="${esc(e.name)}" data-a-change="exF" data-k="${k}" data-f="name" placeholder="Ejercicio (escribe y elige de la biblioteca)">
    <button class="icon-btn" data-a="exMove" data-k="${k}" data-n="-1" title="Subir">↑</button><button class="icon-btn" data-a="exMove" data-k="${k}" data-n="1" title="Bajar">↓</button><button class="icon-btn" data-a="exDel" data-k="${k}" title="Quitar">✕</button></div>
    <div class="exgrid"><div><label>Descanso sugerido (s)<input type="number" value="${e.rest || ""}" data-a-change="exF" data-k="${k}" data-f="rest" placeholder="180"></label>
      <div class="small muted">Tempo (segundos)</div><div class="tempo">${T.map((l, i) => `<label>${l}<input type="number" min="0" value="${esc(tp[i] ?? "")}" data-a-change="tempoF" data-k="${k}" data-i="${i}" placeholder="–"></label>`).join("")}</div></div></div>
    <label>Link del video (YouTube, Drive, Instagram…)<input value="${esc(e.video || "")}" data-a-change="exF" data-k="${k}" data-f="video"></label>
    <label>Tips de ejecución (uno por línea; el cliente los ve como punteo)<textarea rows="3" data-a-change="exF" data-k="${k}" data-f="notes">${esc(String(e.notes || "").split(/\s*(?:\n|•)\s*/).filter(Boolean).join("\n"))}</textarea></label>
    <details ${e.alts?.length ? "open" : ""}><summary class="small"><b>Reemplazos de emergencia (${(e.alts || []).length})</b> · si la máquina está ocupada</summary>
      ${(e.alts || []).map((x, j) => `<div class="alt"><div class="row gap"><input class="grow" list="exlib" value="${esc(x.name)}" data-a-change="altF" data-k="${k}" data-j="${j}" data-f="name" placeholder="Ejercicio de reemplazo"><input class="grow" value="${esc(x.video || "")}" data-a-change="altF" data-k="${k}" data-j="${j}" data-f="video" placeholder="Link del video"><button class="icon-btn" data-a="altDel" data-k="${k}" data-j="${j}">✕</button></div>
        <textarea rows="2" data-a-change="altF" data-k="${k}" data-j="${j}" data-f="tips" placeholder="Tips de este reemplazo (uno por línea)">${esc(x.tips || "")}</textarea></div>`).join("")}
      <button class="btn tiny" data-a="altAdd" data-k="${k}">＋ Reemplazo</button></details></div>`; }).join("")}
  <button class="btn" data-a="exAdd">＋ Añadir ejercicio</button></div>`;
}
act("setF", (el) => { const x = RE.r.exercises[+el.dataset.k].sets[+el.dataset.j]; const v = el.value.trim(), f = el.dataset.f; if (f === "w") { if (v === "") delete x.w; else x.w = v.replace(",", "."); } else x[f] = f === "rir" ? (v === "" ? "" : v.toUpperCase() === "F" ? "F" : +v) : v; const d = $("#rDirty"); if (d) d.hidden = false; });
// ¿Hay cambios sin guardar en los ejercicios? Compara el contenido (sin importar el orden de las claves, números vs texto,
// campos vacíos ni la marca interna "changed"): Firestore puede devolver los mismos datos con otra forma.
const canonX = (v) => Array.isArray(v) ? v.map(canonX) : v && typeof v === "object" ? Object.keys(v).sort().filter((k) => k !== "changed" && v[k] !== "" && v[k] != null && !(Array.isArray(v[k]) && !v[k].length)).map((k) => [k, canonX(v[k])]) : String(v);
const exDiff = (list, orig) => JSON.stringify(canonX(list || [])) !== JSON.stringify(canonX(JSON.parse(orig || "[]")));
// Antes el kg sugerido era uno por ejercicio (e.wSug, ej. "43 / 48"): se pasa a cada serie (sets[j].w) sin marcarlo como cambio
function migrateWSug(r) {
  const mig = (list) => (list || []).forEach((e) => { if (!e.wSug) return; const v = String(e.wSug).split("/").map((x) => x.trim().replace(",", ".")).filter(Boolean); if (!(e.sets || []).some((x) => x.w)) (e.sets || []).forEach((x, j) => (x.w = v[Math.min(j, v.length - 1)])); delete e.wSug; });
  if (!(r.exercises || []).some((e) => e.wSug)) return;
  mig(r.exercises); if (RE?.r === r) { const o = JSON.parse(RE.orig || "[]"); mig(o); RE.orig = JSON.stringify(o); }
}
act("setAdd", (el) => { const e = RE.r.exercises[+el.dataset.k]; const l = e.sets[e.sets.length - 1] || { reps: "8-10", rir: 1 }; e.sets.push({ ...l }); refresh(); });
act("setDel", (el) => { RE.r.exercises[+el.dataset.k].sets.splice(+el.dataset.j, 1); refresh(); });
act("tempoF", (el) => { const e = RE.r.exercises[+el.dataset.k], t = String(e.tempo || "---").split("-"); while (t.length < 4) t.push(""); t[+el.dataset.i] = el.value; e.tempo = t.some((x) => x !== "") ? t.join("-") : ""; });
act("altF", async (el) => {
  const a = RE.r.exercises[+el.dataset.k].alts[+el.dataset.j]; a[el.dataset.f] = el.value;
  if (el.dataset.f === "name") { const l = ((await db.get("library/exercises"))?.items || []).find((x) => x.name === el.value); if (l) { a.video = a.video || l.video || ""; a.tips = a.tips || l.tips || ""; refresh(); } }
});
act("altAdd", (el) => { const e = RE.r.exercises[+el.dataset.k]; (e.alts ||= []).push({ name: "", video: "", tips: "" }); refresh(); });
act("altDel", (el) => { RE.r.exercises[+el.dataset.k].alts.splice(+el.dataset.j, 1); refresh(); });
const parseSets = (s) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).map((x) => { const [reps, rir] = x.split("@"); return { reps: reps.trim(), rir: rir == null ? "" : rir.trim() === "F" ? "F" : +rir }; });
act("rName", (el) => (RE.r.name = el.value));
act("exF", async (el) => {
  const e = RE.r.exercises[+el.dataset.k], f = el.dataset.f;
  if (f === "sets") e.sets = parseSets(el.value);
  else if (f === "alts") e.alts = el.value.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const [name, video] = x.split("|").map((y) => y.trim()); return { name, video: video || "" }; });
  else if (f === "rest") e[f] = num(el.value);
  else e[f] = el.value;
  if (f === "name") { const lib = (await db.get("library/exercises"))?.items || []; const l = lib.find((x) => x.name === el.value); if (l) { e.video = e.video || l.video || ""; e.notes = e.notes || l.tips || ""; e.alts = e.alts?.length ? e.alts : (l.alts || []).map((a) => ({ name: a.name, video: a.video || "", tips: a.tips || "" })); e.libId = l.id; refresh(); } }
});
act("exAdd", () => { RE.r.exercises.push({ id: uid(), name: "", sets: [{ reps: "8-10", rir: 1 }, { reps: "8-10", rir: 1 }], alts: [] }); refresh(); });
act("exDel", (el) => { RE.r.exercises.splice(+el.dataset.k, 1); refresh(); });
act("exMove", (el) => { const a = RE.r.exercises, k = +el.dataset.k, n = k + +el.dataset.n; if (n < 0 || n >= a.length) return; [a[k], a[n]] = [a[n], a[k]]; refresh(); });
// Guardar la rutina en edición. silent = guardado automático (sin re-dibujar ni avisar).
// Los cambios que ve el cliente se calculan contra cómo estaba la rutina ANTES de los cambios de esa semana (changes.base),
// así el guardado automático no apila pasos intermedios ("8 → 9", "9 → 10"): queda "8 → 10". Si deshaces todo, no queda aviso.
async function saveRoutine(R, silent) {
  const cid = R.cid, r = R.r;
  const c = await getClient(cid), rv0 = reviewWindow(c, await getRoutines(cid), await getSessions(cid)), w = rv0?.open ? rv0.next : weekInfo(c, ymd());
  const sameWk = r.changes?.week === w.key, hasBase = sameWk && r.changes.base != null;
  const old = JSON.parse(hasBase ? r.changes.base : R.orig), oldNote = hasBase ? r.changes.baseNote || "" : R.origNote || "";
  const pre = hasBase ? r.changes.pre || [] : sameWk ? r.changes.list || [] : []; // avisos guardados con la versión anterior (sin base)
  let list = [];
  if (!r.isNew) { const m = modsBetween(old, r.exercises); list = m.list; r.exercises.forEach((e) => (e.changed = m.ids.has(e.id))); }
  const all = [...pre, ...list];
  const data = { name: r.name, exercises: r.exercises, note: r.note || "", order: r.order ?? 0, updatedAt: Date.now() };
  if (all.length) data.changes = { week: w.key, list: all, pre, base: JSON.stringify(old), baseNote: oldNote, at: Date.now() };
  else if (sameWk) data.changes = null; // deshiciste todo: el cliente no ve aviso de modificaciones
  await db.set(`clients/${cid}/routines/${r.id}`, data);
  if (data.changes !== undefined) r.changes = data.changes;
  if (rv0?.open) { await db.set(`clients/${cid}/routines/${r.id}`, { review: { week: rv0.next.key, same: !all.length, at: Date.now() } }); await reviewDone(rv0.next.key, cid); }
  R.orig = JSON.stringify(r.exercises); R.origNote = r.note || ""; r.isNew = false;
  if (!silent) { toast(all.length ? `Guardado · ${all.length} cambio(s) marcados para el cliente` : "Guardado"); refresh(); }
  else resetAlerts();
}
act("rSave", () => saveRoutine(RE, false));
// Guardado automático y Deshacer (undo.js): la rutina que está abierta en Entrenamiento
undoSource("rutina", {
  ctx: () => (RE?.r && document.querySelector("[data-rdirty]") ? RE : null),
  key: (R) => `${R.cid}|${R.r.id}`,
  snap: (R) => ({ name: R.r.name, note: R.r.note || "", exercises: R.r.exercises }),
  apply: (R, x) => { R.r.name = x.name; R.r.note = x.note; R.r.exercises = JSON.parse(JSON.stringify(x.exercises)); refresh(); },
  save: (R) => saveRoutine(R, true)
});
afterActs.push(() => track());
act("rDup", async () => { const id = uid(); await db.set(`clients/${CW.cid}/routines/${id}`, { name: RE.r.name + " (copia)", exercises: RE.r.exercises.map((e) => ({ ...e, id: uid(), changed: false })) }); toast("Duplicada"); refresh(); });
act("rDel", async () => { if (!(await confirmBox("¿Eliminar la rutina " + RE.r.name + "? Los entrenamientos ya registrados se mantienen."))) return; forget("rutina"); await db.del(`clients/${CW.cid}/routines/${RE.r.id}`); RE = null; refresh(); });

// ---------- Alimentación de la semana
async function foodView(c0, w) {
  const c = applyStage(c0, w.first);
  const days = await getDays(w.first, w.last, c.id);
  const photos = (await db.list(`clients/${c.id}/photos`)).filter((p) => p.kind === "comida" && p.week === w.key);
  // Resumen de la semana (19-nov): macros del día a día vs meta, cuánto comió de cada grupo en la semana,
  // lo más consumido y lo que comió que NO está en su plan (para ver si es habitual y ajustar el plan)
  const regDays = w.days.filter((d) => Object.values(days[d]?.meals || {}).some((m) => m.length));
  const grp = {}, freq = {};
  const stripN = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const planItems = []; for (const mn of c.menus || []) for (const m of mn.meals || []) for (const it of m.items || []) planItems.push({ n: stripN(it.name), cat: it.cat || "" });
  const inPlan = (it) => { const n = stripN(it.name), w0 = n.split(" ")[0]; return planItems.some((p) => p.n === n || n.startsWith(p.n + " ") || p.n.startsWith(n + " ") || (p.cat && p.cat === it.cat && p.n.split(" ")[0] === w0)); };
  for (const d of regDays) for (const items of Object.values(days[d].meals || {})) for (const it of items) {
    const f = (freq[it.name] ||= { n: 0, days: new Set(), g: 0, kcal: 0, it }); f.n++; f.days.add(d); f.g += +it.g || 0; f.kcal += itemMacros(it).kcal;
    if (it.cat && GROUPS[it.cat]?.[4]) { const x = (grp[it.cat] ||= { g: 0, por: 0 }); x.g += +it.g || 0; if (it.por) x.por += (+it.g || 0) / it.por; }
  }
  const n = regDays.length || 1, meta = { kcal: c.kcal, cho: c.cho, fat: c.fat, prot: c.prot };
  const cls = (v, m, k) => { if (!m) return ""; const e = Math.abs(v - m) / m; if (k === "prot" && v > m) return "okc"; return e <= 0.05 ? "okc" : e <= 0.1 ? "lowc" : "hic"; };
  const tot = regDays.map((d) => [d, dayTotals(days[d])]), avgT = {}; for (const k of ["kcal", "cho", "fat", "prot"]) avgT[k] = tot.reduce((a, [, t]) => a + t[k], 0) / n;
  const macroT = `<table class="tbl"><tr><th>Día</th><th>Kcal</th><th>CHO</th><th>Lípidos</th><th>Proteína</th></tr>
    ${tot.map(([d, t]) => `<tr><td>${fmtDate(d, true)}</td>${["kcal", "cho", "fat", "prot"].map((k) => `<td class="${cls(t[k], meta[k], k)}">${r0(t[k])}</td>`).join("")}</tr>`).join("")}
    <tr><td><b>Promedio</b></td>${["kcal", "cho", "fat", "prot"].map((k) => `<td class="${cls(avgT[k], meta[k], k)}"><b>${r0(avgT[k])}</b></td>`).join("")}</tr>
    <tr class="muted"><td>Meta</td>${["kcal", "cho", "fat", "prot"].map((k) => `<td>${meta[k] || "–"}</td>`).join("")}</tr></table>
    <p class="muted small">Verde ±5 % · amarillo 6–10 % · rojo más de 10 % de la meta (proteína sobre la meta cuenta como bien).</p>`;
  const groups = Object.keys(GROUPS).filter((g) => GROUPS[g][4] && (grp[g] || c.pauta?.[g]));
  const grpT = `<table class="tbl"><tr><th>Grupo</th><th>En la semana</th><th>≈ Porc./día</th><th>Pauta/día</th></tr>${groups.map((g) => { const x = grp[g] || { g: 0, por: 0 }, v = x.por / n, pp = +(c.pauta?.[g] || 0), dd = v - pp;
    return `<tr><td>${esc(g)}</td><td>${x.g >= 1000 ? r1(x.g / 1000).toLocaleString("es-CL") + " kg" : r0(x.g) + " g"}</td><td class="${pp ? (Math.abs(dd) <= 0.5 ? "okc" : Math.abs(dd) <= 1.5 ? "lowc" : "hic") : ""}">${r1(v)}</td><td class="muted">${pp || "—"}</td></tr>`; }).join("")}</table>
    <p class="muted small">Gramos reales registrados. Las porciones son aproximadas (el aporte real no siempre calza con la porción de intercambio). El cliente no ve esto.</p>`;
  const fl = Object.entries(freq).map(([k, v]) => ({ k, ...v, d: v.days.size }));
  const top = fl.sort((a, b) => b.d - a.d || b.n - a.n).slice(0, 12);
  const out = fl.filter((x) => !inPlan(x.it)).sort((a, b) => b.d - a.d || b.kcal - a.kcal).slice(0, 15);
  const summary = regDays.length ? `<div class="card"><div class="card-t">Resumen de la semana · ${regDays.length} días con registro</div><div class="fsum">
    <div><h4>Macros del día a día</h4>${macroT}</div>
    <div><h4>Cuánto comió de cada grupo</h4>${grpT}</div></div>
    <div class="fsum mt">
    <div><h4>Lo más consumido</h4>${top.map((x) => `<div class="li row between small"><span>${esc(x.k)}</span><b>${x.d} día${x.d === 1 ? "" : "s"} · ${r0(x.g / x.n)} g</b></div>`).join("")}</div>
    <div><h4>No está en su plan${(c.menus || []).length ? "" : " (aún no tiene opciones)"}</h4>${out.map((x) => `<div class="li row between small"><span>${esc(x.k)}${x.d >= 3 ? ' <span class="badge y">habitual</span>' : ""}</span><b>${x.d} día${x.d === 1 ? "" : "s"} · ${r0(x.kcal / x.d)} kcal/día</b></div>`).join("") || '<p class="muted small">Todo lo que registró está en su plan.</p>'}
    <p class="muted small">"Habitual" = lo comió 3 días o más: puede valer la pena sumarlo a su plan.</p></div></div></div>` : "";
  return summary + w.days.map((d) => {
    const x = days[d] || {}, t = dayTotals(x), has = Object.values(x.meals || {}).some((m) => m.length);
    return `<details class="card" ${has ? "" : ""}><summary class="row between"><b>${fmtDate(d, true)}</b><span class="small">${has ? `${r0(t.kcal)} / ${c.kcal || "–"} kcal · C ${r0(t.cho)} · L ${r0(t.fat)} · P ${r0(t.prot)}` : '<span class="muted">Sin registro</span>'}</span></summary>
    ${mealList(x).map((m) => { const it = x.meals?.[m] || [], ph = photos.filter((p) => p.date === d && p.meal === m); if (!it.length && !x.mealNotes?.[m] && !ph.length) return ""; return `<div class="mt"><b>${m}</b>${it.map((i) => `<div class="li row between small"><span>${esc(i.name)} · ${r0(i.g)} g${i.quick ? " (rápido)" : ""}</span><span>${r0(itemMacros(i).kcal)} kcal</span></div>`).join("")}${x.mealNotes?.[m] ? `<div class="note">📝 ${esc(x.mealNotes[m])}</div>` : ""}${ph.length ? `<div class="thumbs">${ph.map((p) => `<img src="${p.data}">`).join("")}</div>` : ""}</div>`; }).join("")}</details>`;
  }).join("");
}

// ---------- Progreso
let cmp = {};
async function progView(c) {
  const today = ymd(), days = await getDays(addDays(today, -120), today, c.id);
  const keys = Object.keys(days).sort(), vals = keys.map((k) => days[k].weight ?? null);
  const photos = (await db.list(`clients/${c.id}/photos`)).filter((p) => !["comida", "equipo"].includes(p.kind));
  const weeks = [...new Set(photos.map((p) => p.week))].sort();
  if (cmp.cid !== c.id) cmp = { cid: c.id, a: weeks[0], b: weeks[weeks.length - 1] };
  const pick = (wk, t) => photos.filter((p) => p.week === wk && p.kind === t).sort((a, b) => b.at - a.at)[0];
  const meas = (await db.list(`clients/${c.id}/measures`)).sort((a, b) => a.id.localeCompare(b.id));
  const equip = (await db.list(`clients/${c.id}/photos`)).filter((p) => p.kind === "equipo");
  const sess = (await getSessions(c.id)).filter((x) => x.status === "fin").sort((a, b) => a.startedAt - b.startedAt);
  // Progreso por rutina (20-nov): cada ejercicio de cada rutina, serie 1 y serie 2: primera vez · semana anterior · esta semana
  const routines = await getRoutines(c.id);
  const dd = (a, b, u) => { if (a == null || b == null || a === "" || b === "") return ""; const d = r1((+a || 0) - (+b || 0)); return d ? `<b class="${d > 0 ? "g" : "r"}">${d > 0 ? "+" : ""}${String(d).replace(".", ",")}${u}</b>` : '<span class="muted">=</span>'; };
  const cellS = (y) => (y ? `${y.w || "–"}×${y.r || "–"}${y.w2 !== undefined ? `<small class="muted"> | ${y.w2 || "–"}×${y.r2 || "–"}</small>` : ""}` : '<span class="muted">—</span>');
  const progCards = routines.map((r) => {
    const B = routineBlock(r, sess); if (!B.weeks.length) return "";
    const W = B.weeks, wf = W[0], wl = W[W.length - 1], wp = W.length > 2 ? W[W.length - 2] : null;
    const rows = B.exs.map(({ e, cells }) => {
      const ks = W.filter((w) => cells[w]?.sets?.length); if (!ks.length) return "";
      const f = cells[ks[0]], l = cells[ks[ks.length - 1]], p = ks.length > 2 ? cells[ks[ks.length - 2]] : null, n = Math.max(1, Math.min(2, l.sets.length));
      return Array.from({ length: n }, (_, j) => { const a = f.sets[j], b = l.sets[j], m = p?.sets?.[j];
        return `<tr>${j === 0 ? `<td rowspan="${n}" class="exc"><b>${esc(e.name)}</b></td>` : ""}<td class="muted">S${j + 1}</td><td>${cellS(a)}</td>${wp ? `<td>${cellS(m)}</td>` : ""}<td><b>${cellS(b)}</b></td>
          <td>${ks.length > 1 ? `${dd(b?.w, a?.w, " kg")} <span class="muted">·</span> ${dd(b?.r, a?.r, " reps")}` : ""}</td>${wp ? `<td>${m ? `${dd(b?.w, m?.w, " kg")} <span class="muted">·</span> ${dd(b?.r, m?.r, " reps")}` : ""}</td>` : ""}</tr>`; }).join("");
    }).join("");
    return rows ? `<div class="card prog-r"><div class="card-t">${esc(r.name)}</div><table class="tbl prog-t"><tr><th>Ejercicio</th><th></th><th>1ª vez <small>(sem. ${+wf.slice(1)})</small></th>${wp ? `<th>Sem. ${+wp.slice(1)}</th>` : ""}<th>Sem. ${+wl.slice(1)}</th><th>vs 1ª vez</th>${wp ? `<th>vs sem. ${+wp.slice(1)}</th>` : ""}</tr>${rows}</table></div>` : "";
  }).join("");
  return `<div class="card"><div class="card-t">Peso (120 días)</div>${lineChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), [{ vals, color: "var(--muted)", dots: true, w: 1 }, { vals: trend(vals), color: "var(--acc)" }], { h: 240, unit: " kg" })}</div>
  <div class="card"><div class="card-t">Progreso de entrenamiento</div><p class="small muted">Está en <b>Entrenamiento</b>: cada rutina muestra semana a semana lo indicado y lo hecho, y la columna “vs 1ª vez”.</p>
  <details><summary class="small">Ver el resumen por rutina aquí (1ª vez · semana anterior · última)</summary>${progCards ? `<div class="prog-grid">${progCards}</div>` : `<p class="muted">Sin entrenamientos registrados.</p>`}</details></div>
  <div class="card"><div class="row between"><div class="card-t">Fotos</div><div class="row gap">${["a", "b"].map((k) => `<select data-a-change="cmpSel" data-k="${k}">${weeks.map((x) => `<option ${x === cmp[k] ? "selected" : ""} value="${x}">Semana ${+x.slice(1)}</option>`).join("")}</select>`).join(" vs ")}</div></div>
  ${weeks.length ? `<div class="cmp-grid">${PHOTO_TYPES.map(([t, l]) => { const a = pick(cmp.a, t), b = pick(cmp.b, t); return a || b ? `<div class="cmp"><div>${a ? `<img src="${a.data}">` : "—"}</div><div>${b ? `<img src="${b.data}">` : "—"}</div><small>${l}</small></div>` : ""; }).join("")}</div>` : `<p class="muted">Sin fotos aún.</p>`}</div>
  <div class="card scroll-x"><div class="card-t">Medidas (cm)</div>${meas.length ? `<table class="tbl"><tr><th>Zona</th>${meas.map((m) => `<th>${fmtDate(m.id)}</th>`).join("")}<th>Cambio</th></tr>${MEASURE_ZONES.map(([k, l]) => { const v = meas.map((m) => m[k]).filter((x) => x != null); return `<tr><td>${l}</td>${meas.map((m) => `<td>${m[k] ?? "—"}</td>`).join("")}<td>${v.length > 1 ? r1(v[v.length - 1] - v[0]) : ""}</td></tr>`; }).join("")}</table>` : `<p class="muted">Sin mediciones.</p>`}</div>
  ${equip.length ? `<div class="card"><div class="card-t">Equipamiento disponible</div><div class="thumbs big">${equip.map((p) => `<img src="${p.data}">`).join("")}</div></div>` : ""}`;
}
act("cmpSel", (el) => { cmp[el.dataset.k] = el.value; refresh(); });

// ---------- Check-ins
async function checkinsView(c) {
  const [list0, fbs] = await Promise.all([db.list(`clients/${c.id}/checkins`), db.list(`clients/${c.id}/feedbacks`)]);
  const list = list0.sort((a, b) => b.id.localeCompare(a.id));
  const head = `<div class="card"><div class="card-t">Check-in</div><p class="small">Día de check-in: <b>${checkinDayTxt(c)}</b>${c.checkinForm ? " · lo responde por <b>Google Forms</b> (sus respuestas no aparecen aquí)" : " · lo responde en la app"}. Se marca como respondido cuando publicas su retroalimentación de esa semana o tocas “Marcar respondido”.</p></div>`;
  if (!list.length) return head + `<p class="muted">Sin check-ins.</p>`;
  const v = (x) => Array.isArray(x) ? x.join(", ") : x;
  const ans = (id) => fbs.find((f) => f.id === id && (f.at || f.answered));
  const box = (ci) => { const it = [["Seguimiento de su foco", ci.accionFoco ? `${ci.accionFoco} → ${ci.accion || "sin responder"}${ci.accionDet ? ` · ${ci.accionDet}` : ""}` : ""], ["Progreso (qué se le hace más fácil)", ci.facil], ["Barreras", ci.barrera], ["De qué está orgulloso", ci.orgullo], ["La próxima semana", ci.proxSemana], ["Foco que propone", ci.foco]].filter(([, v]) => v);
    return it.length ? `<div class="ci-key">${it.map(([l, v]) => `<div class="qa"><span class="muted">${l}</span><b>${esc(v)}</b></div>`).join("")}<p class="muted small">Antes de responder: busca el progreso, las barreras y lo que viene, y acuerda <b>una sola acción</b> para la semana. En la próxima le preguntamos cómo le fue.</p></div>` : ""; };
  const shown = new Set(CHECKIN.flatMap((x) => x.q.map(([k]) => k)).concat(["facil", "barrera", "orgullo", "proxSemana", "foco", "accion", "accionDet", "accionFoco", "top1", "top2", "top3"]));
  const legacy = (ci) => Object.entries(CHECKIN_OLD).filter(([k]) => !shown.has(k) && ci[k] != null && ci[k] !== "").map(([k, l]) => `<div class="qa"><span class="muted">${esc(l)}</span><b>${esc(v(ci[k]))}${ci[k + "Det"] ? ` · ${esc(ci[k + "Det"])}` : ""}</b></div>`).join("");
  return head + list.map((ci, k) => `<details class="card ci-view" ${k === 0 ? "open" : ""}><summary class="row between"><h3>Semana ${+ci.id.slice(1)} <small class="muted">${ci.date ? fmtDate(ci.date) : ""}</small> ${ans(ci.id) ? '<span class="badge g">Respondido ✓</span>' : '<span class="badge r">Sin responder</span>'}</h3><span class="row gap small"><span class="muted">Días con registro de comida: ${ci.diasRegistrados ?? "—"}/7</span>${ans(ci.id) ? "" : `<button class="btn tiny primary" data-a="ciAnswer" data-n="${+ci.id.slice(1)}">Responder</button><button class="btn tiny" data-a="ciMark" data-w="${ci.id}">Marcar respondido</button>`}</span></summary>
  ${box(ci)}${ci.entrenos ? `<p class="small">Entrenamientos: <b>${ci.entrenos}</b></p>` : ""}
  <div class="grid3">${CHECKIN.filter((sec) => !sec.open).map((sec) => { const qs = sec.q.flatMap((x) => (x[2] === "list3" ? [1, 2, 3].map((n) => [x[0] + n, `${x[1].replace(/^Top 3/, "Top")} · ${n}`]) : [x])).filter(([key]) => ci[key] != null && ci[key] !== "" && !(Array.isArray(ci[key]) && !ci[key].length)); if (!qs.length) return ""; return `<div><h4>${esc(sec.t)}</h4>${qs.map(([key, label]) => `<div class="qa"><span class="muted">${esc(label || (key.startsWith("top") ? "Top " + key.slice(3) : ""))}</span><b>${esc(v(ci[key]))}${ci[key + "Det"] ? ` · ${esc(ci[key + "Det"])}` : ""}</b></div>`).join("")}</div>`; }).join("")}
  ${legacy(ci) ? `<div><h4>Otras respuestas (versión anterior)</h4>${legacy(ci)}</div>` : ""}
  ${ci.ciclo ? `<div><h4>Ciclo</h4><div class="qa"><span class="muted">En ciclo menstrual</span><b>${esc(ci.ciclo)}</b></div></div>` : ""}</div></details>`).join("");
}

act("ciAnswer", (el) => { CW.n = +el.dataset.n; go(`coach/c/${CW.cid}/feedback`); });
act("ciMark", async (el) => { await db.set(`clients/${CW.cid}/feedbacks/${el.dataset.w}`, { answered: true, answeredAt: Date.now() }); resetAlerts(); toast("Marcado como respondido"); refresh(); });
// ---------- Retroalimentación semanal
// Preanálisis: lo que vale la pena decir en el video (y lo que se puede omitir), en el orden en que conviene decirlo
async function preanalysis(c0, w) {
  const c = applyStage(c0, w.first), ph = c.phase || "", pw = weekInfo(c, addDays(w.first, -7));
  const [days, pdays, routines, sessions, ci, pci] = await Promise.all([getDays(w.first, w.last, c.id), getDays(pw.first, pw.last, c.id), getRoutines(c.id), getSessions(c.id), db.get(`clients/${c.id}/checkins/${w.key}`), pw.n >= 1 ? db.get(`clients/${c.id}/checkins/${pw.key}`) : null]);
  const D = w.days.map((d) => days[d] || {}), P = pw.days.map((d) => pdays[d] || {});
  const A = (arr, f) => avg(arr.map(f).filter((v) => v != null && v !== 0));
  const food = D.filter((d) => Object.values(d.meals || {}).some((m) => m.length)), T = (k) => avg(food.map((d) => dayTotals(d)[k]));
  const plan = weekPlan(c, routines, sessions, w.first);
  const wk = sessions.filter((x) => x.status === "fin" && x.weekKey === w.key);
  let up = 0, comp = 0; const gains = [];
  for (const x of wk) { const pv = prevFor(sessions, x); for (const e of x.exercises) { const pg = exProgress(e, pv); if (pg && pg.k !== "new") { comp++; if (pg.k === "up") { up++; gains.push(e.name); } } } }
  const good = [], work = [], answer = [], skip = [];
  const wA = A(D, (d) => weightCorr(d)), wP = A(P, (d) => weightCorr(d)), kcal = T("kcal"), prot = T("prot"), steps = A(D, (d) => d.steps), sl = A(D, (d) => sleepHours(d.sleep)), water = A(D, (d) => sum(d.water || [], (y) => y.ml));
  // entrenamiento
  if (plan.total) (plan.doneCount >= plan.total ? good : work).push(`Entrenamientos: <b>${plan.doneCount} de ${plan.total}</b>`);
  if (comp) (up / comp >= 0.3 ? good : skip).push(`Progresó en <b>${up} de ${comp}</b> ejercicios vs la semana pasada${gains.length ? ` (${[...new Set(gains)].slice(0, 3).map(esc).join(", ")})` : ""}`);
  if (wk.some((x) => x.survey?.articular === "si") || /Moderado|Alto/.test(ci?.articular || "")) work.push(`Molestia articular: ${esc(ci?.articularDet || wk.find((x) => x.survey?.articularDet)?.survey?.articularDet || "revisar")}`);
  if (wk.some((x) => x.exercises.some((e) => e.tech === "peor" || e.sets.some((y) => y.tech === "peor")))) work.push("Técnica peor en algún ejercicio: revisa sus videos");
  // nutrición y hábitos
  if (food.length) {
    const jk = judge("kcal", kcal, c.kcal, ph);
    (jk === "okc" ? skip : jk === "hic" ? work : skip).push(`Calorías: <b>${r0(kcal)}</b> de ${c.kcal || "—"} en promedio (${food.length} días registrados)`);
    if (c.prot) (prot >= c.prot * 0.9 ? good : prot < c.prot * 0.75 ? work : skip).push(`Proteína: <b>${r0(prot)} g</b> de ${c.prot}`);
  }
  const dm = Object.fromEntries(w.days.map((d) => [d, days[d] || {}])), Fq = regSoFar(c, w, dm, hasFood), Wq = regSoFar(c, w, dm, (d) => d.weight); // proporcional a lo que va de la semana
  if (Fq.n) (Fq.k / Fq.n >= 0.7 ? good : Fq.k / Fq.n < 0.4 ? work : skip).push(`Registró su comida <b>${Fq.k} de ${Fq.n}</b> días`);
  if (Wq.n >= 3 && Wq.k < Math.ceil((Wq.n * 3) / 7)) work.push(`Se pesó <b>${Wq.k} de ${Wq.n}</b> días`);
  if (wA && wP) { const d = r1(wA - wP), cut = /Déficit|Mini cut/.test(ph), bulk = /Superávit|reversa/.test(ph); const t = `Peso: <b>${r1(wA)} kg</b> (${d > 0 ? "+" : ""}${d} vs semana pasada)`; ((cut && d > 0.2) || (bulk && d < -0.2)) ? work.push(t + " · va en contra de la etapa") : ((cut && d < 0) || (bulk && d > 0) ? good : skip).push(t); }
  if (steps && c.steps) (steps >= c.steps ? good : steps < c.steps * 0.7 ? work : skip).push(`Pasos: <b>${r0(steps).toLocaleString("es-CL")}</b> de ${c.steps.toLocaleString("es-CL")}`);
  if (sl) (sl < (c.sleep || 8) - 1 ? work : skip).push(`Sueño: <b>${r1(sl)} h</b> en promedio`);
  if (water && c.water) (water < c.water * 0.7 ? work : skip).push(`Agua: <b>${r1(water / 1000)} L</b> de ${r1(c.water / 1000)} L`);
  // check-in
  if (ci) {
    if (ci.accionFoco) (ci.accion === "Lo logré" ? good : work).push(`Su foco “${esc(ci.accionFoco)}”: <b>${esc(ci.accion || "sin responder")}</b>${ci.accionDet ? ` · ${esc(ci.accionDet)}` : ""}`);
    if (ci.orgullo) good.push(`Está orgulloso de: ${esc(ci.orgullo)}`);
    if (ci.facil) good.push(`Más fácil que hace un mes: ${esc(ci.facil)}`);
    if (ci.barrera) work.push(`Barreras: ${esc(ci.barrera)}`);
    if (/Alto|Muy alto/.test(ci.estGen || "")) work.push(`Estrés general ${esc(ci.estGen).toLowerCase()}${ci.comEst ? `: ${esc(ci.comEst)}` : ""}`);
    if (/^(Malo|Muy malo|Mala|Muy mala)$/.test(ci.digest || "") || ci.comDig) work.push(`Digestión ${esc(ci.digest || "").toLowerCase()}${ci.comDig ? `: ${esc(ci.comDig)}` : ""}`);
    if (/^(Bajo|Muy bajo|Baja|Muy baja)$/.test(ci.enerSes || "")) work.push(`Energía en las sesiones ${esc(ci.enerSes).toLowerCase()}`);
    // Respuestas negativas con su "por qué" (las preguntas lo piden solo en esos casos)
    for (const [k, l] of [["entGeneral", "Entrenamientos"], ["motivEnt", "Disposición a entrenar"], ["fuerza", "Fuerza y rendimiento"], ["articular", "Dolor articular"], ["suenoVs", "Sueño vs la semana anterior"]]) if (ci[k + "Det"]) work.push(`${l} ${esc(ci[k] || "").toLowerCase()}: ${esc(ci[k + "Det"])}`);
    if (ci.nutDificil) work.push(`Lo que más le costó del plan: ${esc(ci.nutDificil)}`);
    if (ci.nutMejorar) answer.push(`Qué cree que podría mejorar: ${esc(ci.nutMejorar)}`);
    if (ci.consultas) answer.push(`Pregunta: ${esc(ci.consultas)}`);
    if (ci.proxSemana) answer.push(`La próxima semana: ${esc(ci.proxSemana)}`);
    if (ci.sugerencia) answer.push(`Sugerencia: ${esc(ci.sugerencia)}`);
  }
  const li = (arr) => arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p class="muted small">Nada que destacar.</p>`;
  return `<div class="card pre"><div class="card-t">Preanálisis · semana ${w.n} ${ci ? "" : '<span class="badge y">sin check-in</span>'}</div>
  <div class="pre-g"><div><h4 class="g">1 · Destacar (parte por aquí)</h4>${li(good)}</div><div><h4 class="r">2 · A trabajar (elige 1 o 2)</h4>${li(work)}</div>
  <div><h4 class="b">3 · Responder</h4>${li(answer)}${ci?.foco ? `<h4>4 · Foco de la semana</h4><p><b>${esc(ci.foco)}</b> <small class="muted">(lo propuso en su check-in)</small></p>` : ""}</div>
  <div><h4 class="muted">Puedes omitirlo (está normal)</h4>${li(skip)}</div></div>
  <p class="small muted">Guion para un video de 3–4 min: <b>1)</b> saludo y su logro principal · <b>2)</b> 1 o 2 cosas a trabajar, mostrando el dato (Timeline o entrenamiento) · <b>3)</b> responde sus preguntas y lo que viene · <b>4)</b> cierra con un solo foco para la semana. Lo demás, si está normal, no hace falta mencionarlo.</p></div>`;
}

async function feedbackView(c, w) {
  const pre = await preanalysis(c, w);
  const fb = c.feedback?.week === w.key ? c.feedback : (await db.get(`clients/${c.id}/feedbacks/${w.key}`)) || {};
  const ciW = await db.get(`clients/${c.id}/checkins/${w.key}`), goals = c.feedback?.week === w.key ? c.weeklyGoals || [] : ciW?.foco ? [ciW.foco] : c.weeklyGoals || [];
  const L = LASTREC?.cid === c.id && LASTREC.week === w.key ? LASTREC : null;
  const reply = await db.get(`clients/${c.id}/fbreplies/${w.key}`);
  const vids = (await db.list(`clients/${c.id}/videos`).catch(() => [])).sort((a, b) => (b.at || 0) - (a.at || 0));
  const sent = vids.length ? `<div class="card"><div class="card-t">🎥 Videos que le mandaste</div>${vids.map((x) => `<div class="li row between"><span><b>${esc(x.title || "Video")}</b> <small class="muted">${fmtDate(ymd(new Date(x.at)))}${x.secs ? ` · ${Math.floor(x.secs / 60)}:${String(x.secs % 60).padStart(2, "0")}` : ""}</small></span><span class="row gap">${x.seen ? `<span class="badge g">Visto${x.seenAt ? " el " + fmtDate(ymd(new Date(x.seenAt))) : ""} ✓</span>` : `<span class="badge">Aún no lo ve</span>`}<a class="btn tiny ghost" target="_blank" href="${esc(x.url)}">Abrir</a><button class="btn tiny ghost red" data-a="vidDelSent" data-id="${esc(x.id)}">Quitar</button></span></div>`).join("")}</div>` : "";
  const rec = sent + replyCard(reply && { ...reply, id: w.key }) + `<div class="card recc"><div class="row between"><div class="card-t">🎥 Video de retroalimentación</div>${recSupported() ? `<button class="btn primary" data-a="recStart" data-w="${w.key}">● Grabar</button>` : ""}</div>
  ${recSupported() ? `<p class="muted small">Al apretar Grabar se abre una ventanita flotante con los controles y tu preanálisis (no sale en el video). En la página solo queda este cliente: se ocultan la lista de clientes y tus pendientes. Tu cara aparece en una burbuja que puedes arrastrar; hay cuenta regresiva 3-2-1, pausa y lápiz para marcar. Al compartir elige <b>“Esta pestaña”</b>.</p>` : `<p class="muted small">Para grabar usa Chrome en el computador.</p>`}
  <label class="btn ghost small upfile">⬆ Subir un video que ya tengo<input type="file" accept="video/*" hidden data-a-change="vidFile"></label> <span id="upF" class="small muted"></span>
  ${L ? `<div class="recout"><video src="${L.url}" controls></video><div><p class="small">Duración <b>${Math.floor(L.secs / 60)}:${String(L.secs % 60).padStart(2, "0")}</b> · ${(L.blob.size / 1048576).toFixed(1)} MB</p>
    ${driveReady() ? `<button class="btn primary block" data-a="recUpload">Subir a mi Drive y poner el link</button>` : `<p class="small"><span class="badge y">Falta conectar Google Drive</span> Mientras, descárgalo y súbelo tú (o pídeme que te guíe para conectarlo).</p>`}
    <button class="btn block" data-a="recDownload">Descargar video</button><button class="btn ghost block" data-a="recDiscard">Descartar</button><div id="upP" class="small muted"></div></div></div>
    <label>Transcripción (lo que dijiste)<textarea id="fbTr" rows="5">${esc(L.transcript || "")}</textarea></label><button class="btn small" data-a="trPoints">Pasar a puntos clave</button>` : ""}</div>`;
  return `${pre}${rec}<div class="card"><div class="card-t">Retroalimentación · Semana ${w.n}</div><p class="muted small">Le aparece en el inicio como “Tu coach respondió tu check-in” durante 9 días.</p>
  <label>Link del video (YouTube no listado, Drive, Loom…)<input id="fbV" value="${esc(fb.videoUrl || "")}"></label>
  <label>Resumen del video (opcional, uno por línea · el cliente lo ve debajo del video)<textarea id="fbP" rows="5">${esc((fb.points || []).join("\n"))}</textarea></label>
  <label>Capítulos del video (uno por línea: <i>1:20 Sentadilla</i>) · el cliente toca uno y salta a esa parte<textarea id="fbCh" rows="3" placeholder="0:00 Lo mejor de tu semana&#10;1:15 Sentadilla">${esc(chaptersTxt(fb, L))}</textarea></label>
  <label>Mensaje tuyo (opcional · aparece arriba en su Progreso)<textarea id="fbT" rows="4">${esc(fb.text || "")}</textarea></label>
  ${ciW?.foco ? `<p class="small">Foco que propuso en su check-in: <b>${esc(ciW.foco)}</b></p>` : ""}
  <label>Foco de la semana (la primera línea es la acción que le preguntamos en el próximo check-in)<textarea id="fbG" rows="3">${esc(goals.join("\n"))}</textarea></label>
  <button class="btn primary" data-a="fbSave" data-w="${w.key}">Publicar al cliente</button></div>`;
}
let FBREC = null;
act("fbDictate", async () => {
  const { listen, speechSupported } = await import("./voice.js");
  if (FBREC) { FBREC.stop(); FBREC = null; $("#fbDic").textContent = "🎙 Dictar mensaje"; return; }
  if (!speechSupported()) return toast("Este navegador no permite dictar (usa Chrome)");
  const ta = $("#fbT"), base = ta.value ? ta.value.trim() + " " : "";
  $("#fbDic").textContent = "■ Detener";
  FBREC = listen({ onText: (fin, int) => { ta.value = base + fin + (int ? " " + int : ""); }, onEnd: () => { FBREC = null; const b = $("#fbDic"); if (b) b.textContent = "🎙 Dictar mensaje"; }, onError: () => toast("No se pudo usar el micrófono") });
});
act("fbPoints", () => {
  const t = $("#fbT").value.trim(); if (!t) return toast("Primero escribe o dicta el mensaje");
  const pts = t.split(/(?<=[.!?])\s+|\n+|,\s*(?:y |además |también |otra cosa )/i).map((x) => x.trim().replace(/^(y|además|también|otra cosa)[, ]+/i, "")).filter((x) => x.split(/\s+/).length >= 4).map((x) => x[0].toUpperCase() + x.slice(1).replace(/[.,;]+$/, ""));
  const cur = $("#fbP").value.trim(); $("#fbP").value = (cur ? cur + "\n" : "") + pts.join("\n"); toast(`${pts.length} puntos agregados: revísalos y edítalos`);
});
let LASTREC = null;
const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`;
function chaptersTxt(fb, L) {
  if (fb.chapters?.length) return fb.chapters.map((c) => `${mmss(c.s)} ${c.t}`).join("\n");
  if (L?.marks?.length) return ["0:00 Inicio", ...L.marks.map((m, i) => `${mmss(m)} Tema ${i + 2}`)].join("\n");
  return "";
}
function parseChapters(t) {
  return t.split("\n").map((l) => l.trim().match(/^(\d{1,2}):(\d{2})\s+(.+)$/)).filter(Boolean).map((m) => ({ s: +m[1] * 60 + +m[2], t: m[3].trim() })).sort((a, b) => a.s - b.s);
}
// Lo que respondió el cliente al terminar de ver el video
function replyCard(r) {
  if (!r || !(r.rating || r.duda || r.falto)) return "";
  return `<div class="card fbreply ${r.seen ? "" : "new"}"><div class="row between"><div class="card-t">💬 Respuesta del cliente a tu retro</div>${r.seen ? `<span class="badge">Leída</span>` : `<button class="btn small" data-a="replySeen" data-w="${r.id}">Marcar leída</button>`}</div>
  ${r.rating ? `<p>Calificación: <b class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</b></p>` : ""}
  ${r.duda ? `<p><b>Duda o consulta:</b> ${esc(r.duda)}</p>` : ""}${r.falto ? `<p><b>Sintió que faltó:</b> ${esc(r.falto)}</p>` : ""}
  ${r.viewed ? `<p class="small muted">Vio el ${Math.round(r.viewed)} % del video</p>` : ""}</div>`;
}
act("replySeen", async (el) => { await db.set(`clients/${CW.cid}/fbreplies/${el.dataset.w}`, { seen: true }); resetAlerts(); refresh(); });
act("recStart", async (el) => {
  const cid = CW.cid, week = el.dataset.w;
  await startRecording({ guideHtml: document.querySelector(".pre")?.outerHTML || "", onDone: ({ blob, secs, transcript, cues, marks }) => { if (LASTREC?.url) URL.revokeObjectURL(LASTREC.url); LASTREC = { cid, week, blob, secs, transcript, cues, marks, url: URL.createObjectURL(blob) }; refresh(); toast("Grabación lista ✓"); } });
});
// ---------- Grabar en cualquier momento (no solo la retro semanal): ej. un video de bienvenida mostrando la app con "Ver como cliente".
// Al terminar: subir a Drive y mandárselo al cliente (clients/{id}/videos: le aparece en el inicio hasta que lo vea y queda en Más → Videos de tu coach),
// o solo copiar el link, o descargarlo.
let FREEREC = null;
act("recFree", async (el) => {
  const cid = el.dataset.cid || S.preview?.cid || CW?.cid || null;
  await startRecording({ guideHtml: "", onDone: ({ blob, secs }) => { if (FREEREC?.url) URL.revokeObjectURL(FREEREC.url); FREEREC = { cid, blob, secs, url: URL.createObjectURL(blob) }; freeRecSheet(); } });
});
// Un video que ya tiene (archivo): mismo flujo; la subida parte con el clic en "Subir…" (si parte sola, Chrome bloquea la ventana de permiso de Drive)
act("frFile", async (el) => {
  const f = el.files?.[0]; el.value = ""; if (!f) return;
  const url = URL.createObjectURL(f), secs = await new Promise((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => res(Math.round(isFinite(v.duration) ? v.duration : 0)); v.onerror = () => res(0); v.src = url; });
  if (FREEREC?.url) URL.revokeObjectURL(FREEREC.url);
  FREEREC = { cid: el.dataset.cid || CW?.cid || null, blob: f, secs, url, name: f.name }; freeRecSheet();
});
async function freeRecSheet() {
  const F = FREEREC; if (!F) return; const c = F.cid ? await getClient(F.cid) : null, first = (c?.name || "").split(" ")[0];
  sheet("Tu grabación", `<video class="setvid" src="${F.url}" controls playsinline style="width:100%;border-radius:12px"></video>
    <p class="small muted">Duración ${Math.floor(F.secs / 60)}:${String(F.secs % 60).padStart(2, "0")} · ${(F.blob.size / 1048576).toFixed(1)} MB</p>
    ${c ? `<label>Título que verá ${esc(first)}<input id="frT" value="Video de tu coach"></label>` : ""}
    ${driveReady() ? `${c ? `<button class="btn primary big" data-a="frSend">Subir a mi Drive y mandárselo a ${esc(first)}</button>` : ""}<button class="btn block" data-a="frLink">Solo subir a mi Drive y copiar el link</button>` : `<p class="small"><span class="badge y">Falta conectar Google Drive</span> Descárgalo y súbelo tú.</p>`}
    <button class="btn block" data-a="frDown">Descargar video</button><button class="btn ghost block red" data-a="frDiscard">Descartar</button><div id="frP" class="small muted center"></div>`, { wide: true });
}
async function frUpload(name) {
  const p = $("#frP"); $$('[data-a^="fr"]').forEach((b) => (b.disabled = true));
  try { return await uploadToDrive(FREEREC.blob, name, (x) => { if (p) p.textContent = `Subiendo… ${Math.round(x * 100)} %`; }); }
  catch (e) { toast("No se pudo subir: " + e.message); $$('[data-a^="fr"]').forEach((b) => (b.disabled = false)); if (p) p.textContent = ""; return null; }
}
act("frSend", async () => {
  const c = await getClient(FREEREC.cid), title = ($("#frT")?.value || "Video de tu coach").trim();
  const ext = (FREEREC.name || "").match(/\.\w+$/)?.[0] || ".webm", url = await frUpload(`${title} · ${c.name} · ${ymd()}${ext}`); if (!url) return;
  await db.set(`clients/${FREEREC.cid}/videos/${uid()}`, { title, url, secs: FREEREC.secs, at: Date.now(), seen: false });
  closeSheet(); toast(`Listo: se lo mandaste a ${c.name.split(" ")[0]} ✓ (le aparece en su inicio). Lo ves en Retroalimentación → Videos que le mandaste`, 5000); URL.revokeObjectURL(FREEREC.url); FREEREC = null; refresh();
});
act("frLink", async () => {
  const url = await frUpload(`Video ${ymd()}.webm`); if (!url) return;
  try { await navigator.clipboard.writeText(url); } catch {}
  const p = $("#frP"); if (p) p.innerHTML = `Subido ✓ · link copiado:<br><a target="_blank" href="${esc(url)}">${esc(url)}</a>`;
});
act("vidDelSent", async (el) => { if (!(await confirmBox("¿Quitar este video de su app? (el archivo sigue en tu Drive)"))) return; await db.del(`clients/${CW.cid}/videos/${el.dataset.id}`); refresh(); });
act("frDown", () => { const a = document.createElement("a"); a.href = FREEREC.url; a.download = `Video ${ymd()}.webm`; a.click(); });
act("frDiscard", async () => { if (!(await confirmBox("¿Descartar esta grabación?"))) return; URL.revokeObjectURL(FREEREC.url); FREEREC = null; closeSheet(); });
act("recDownload", () => { if (!LASTREC) return; const a = document.createElement("a"); a.href = LASTREC.url; a.download = `Retro ${new Date().toISOString().slice(0, 10)}.webm`; a.click(); });
act("recDiscard", async () => { if (!(await confirmBox("¿Descartar esta grabación?"))) return; URL.revokeObjectURL(LASTREC.url); LASTREC = null; refresh(); });
act("recUpload", async (el) => {
  const c = await getClient(CW.cid); el.disabled = true;
  try {
    const link = await uploadToDrive(LASTREC.blob, `Retro ${c.name} · semana ${+LASTREC.week.slice(1)}.webm`, (p) => { const u = $("#upP"); if (u) u.textContent = `Subiendo… ${Math.round(p * 100)} %`; });
    $("#fbV").value = link; toast("Video subido ✓ · revisa y publica"); $("#upP").textContent = "Subido ✓ · el link quedó puesto abajo";
  } catch (e) { toast("No se pudo subir: " + e.message); el.disabled = false; }
});
act("vidFile", async (el) => {
  const f = el.files?.[0]; el.value = ""; if (!f) return;
  if (!driveReady()) return toast("Falta conectar Google Drive");
  VIDF = f; const out = $("#upF"); if (out) out.innerHTML = `${esc(f.name)} · ${(f.size / 1048576).toFixed(1)} MB <button class="btn tiny primary" data-a="vidFileGo">Subir a mi Drive</button>`;
});
let VIDF = null;
act("vidFileGo", async () => { // con clic directo, para que Chrome no bloquee la ventana de permiso de Drive
  const f = VIDF; if (!f) return;
  const c = await getClient(CW.cid), out = $("#upF");
  try {
    const link = await uploadToDrive(f, `Retro ${c.name} · ${f.name}`, (p) => { if (out) out.textContent = `Subiendo… ${Math.round(p * 100)} %`; });
    $("#fbV").value = link; if (out) out.textContent = "Subido ✓ · el link quedó puesto abajo"; toast("Video subido ✓ · revisa y publica"); VIDF = null;
  } catch (e) { toast("No se pudo subir: " + e.message); if (out) out.textContent = ""; }
});
act("trPoints", () => {
  const t = ($("#fbTr")?.value || "").trim(); if (!t) return;
  const pts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim().replace(/[.]+$/, "")).filter((x) => x.split(/\s+/).length >= 5);
  const cur = $("#fbP").value.trim(); $("#fbP").value = (cur ? cur + "\n" : "") + pts.join("\n"); toast(`${pts.length} frases agregadas: deja solo las clave`);
});
act("fbSave", async (el) => {
  const L = LASTREC?.cid === CW.cid && LASTREC.week === el.dataset.w ? LASTREC : null;
  const fb = { week: el.dataset.w, videoUrl: $("#fbV").value.trim(), chapters: parseChapters($("#fbCh")?.value || ""), ...(L?.cues?.length && $("#fbV").value.trim() ? { cues: L.cues } : {}), points: $("#fbP").value.split("\n").map((x) => x.trim()).filter(Boolean), text: $("#fbT").value.trim(), at: Date.now() };
  await db.set(`clients/${CW.cid}/feedbacks/${fb.week}`, { ...fb, answered: true });
  resetAlerts();
  await db.set("clients/" + CW.cid, { feedback: fb, weeklyGoals: $("#fbG").value.split("\n").map((x) => x.trim()).filter(Boolean) });
  toast("Publicado ✓");
});

// ---------- Datos y objetivos
async function dataView(c) {
  if (!PAYD) PAYD = (await db.get("library/payment").catch(() => null)) || {};
  const f = (k, l, type = "text", extra = "") => `<label>${l}<input name="${k}" type="${type}" value="${esc(c[k] ?? "")}" ${extra}></label>`;
  const acc = c.email ? await db.get("access/" + emailKey(c.email)).catch(() => null) : null;
  const legacy = !!(await db.get("users/" + c.id).catch(() => null)); // cuenta creada con el sistema antiguo
  return `<div class="card acc"><div class="card-t">Acceso a la app</div>
  ${c.example ? `<p class="small muted">Cliente de ejemplo: no tiene cuenta. Míralo con “Ver como cliente”.</p>` : legacy ? `<p class="small"><span class="badge g">Cuenta activa</span> (creada con el sistema anterior).</p>` : !c.email ? `<p class="small"><span class="badge y">Falta su correo</span> Anótalo abajo y guarda.</p>`
    : `<p class="small">${acc?.ok ? '<span class="badge g">Con acceso</span> Puede crear su cuenta y entrar con su correo.' : '<span class="badge">Sin acceso</span> Si crea su cuenta, verá un mensaje de que aún no le das acceso.'}</p>
    <div class="row gap">${acc?.ok ? `<button class="btn" data-a="accSet" data-v="0">Quitar acceso</button><button class="btn primary" data-a="copyInvite">Copiar invitación para WhatsApp</button>` : `<button class="btn primary" data-a="accSet" data-v="1">Dar acceso</button>`}</div>`}</div>
  <form class="card" id="dataF" data-a-change="dataAuto"><div class="row between"><div class="card-t">Asesoría</div><span class="muted small">Se guarda solo al cambiar cada campo</span></div><div class="grid3">
  <label>Tipo de asesoría<select name="service"><option value="">— Definir —</option>${Object.entries(SERVICES).map(([k, l]) => `<option value="${k}" ${c.service === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  ${f("startDate", "Inicio del servicio (define el inicio de cada semana)", "date")}${f("appFrom", "Empieza a usar la app (si parte después del inicio de la semana 1)", "date")}${f("endDate", "Fin del servicio (si tiene)", "date")}
  <label>Día de check-in<select name="checkinDay"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${c.checkinDay !== "" && c.checkinDay != null && +c.checkinDay === d ? "selected" : ""}>${DAYS[d]}</option>`).join("")}</select></label>
  ${f("city", "Ciudad / país (zona horaria)")}
  ${f("payDate", "Próximo pago", "date")}<label>Se renueva cada<select name="payEvery">${[["", "—"], ["30", "1 mes"], ["90", "3 meses"], ["180", "6 meses"]].map(([v, l]) => `<option value="${v}" ${String(c.payEvery ?? "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  ${c.payDate ? `<label>Pago${(() => { const ps = payState(c); return ps === "vencido" ? ' <span class="badge r">vencido</span>' : ps === "hoy" ? ' <span class="badge y">hoy</span>' : ps === "pospuesto" ? ` <span class="badge">pospuesto al ${fmtDate(c.payGrace)}</span>` : ""; })()}<span class="row gap"><button type="button" class="btn small" data-a="payDone" title="Registra el pago y pasa la fecha al próximo período">✓ Pagó</button><button type="button" class="btn small ghost" data-a="payLater" title="Mueve la fecha del pago (no le aparece el aviso hasta ese día)">Posponer…</button></span></label>` : ""}
  ${c.sheetUrl ? `<label>Planilla anterior<a class="btn small" target="_blank" href="${esc(c.sheetUrl)}">Abrir planilla</a></label>` : ""}</div>
  ${c.payDate ? `<div class="note small"><b>Así le llega el recordatorio de pago</b> (le aparece en el inicio el mismo día; si pasa la fecha, le sale el segundo en rojo). A ti te avisa 3 días antes. Tus datos para transferir se editan en Biblioteca → Datos para transferir:<div class="paycard mt">${payMsg(c, PAYD)}</div><div class="paycard late mt">${payMsg(c, PAYD, true)}</div></div>` : ""}
  <label>Pendientes (uno por línea · empieza con <b>!</b> si es urgente) — aparecen en amarillo o rojo<textarea name="todo" rows="3">${esc((c.todo || []).join("\n"))}</textarea></label>
  <label>Notas internas (solo las ves tú)<textarea name="notes" rows="3">${esc(c.notes || "")}</textarea></label>
  <div class="card-t mt">Información personal</div><div class="grid3">
  ${f("name", "Nombre")}${f("email", "Correo (con el que crea su cuenta)", "email", legacy ? "readonly" : "")}${f("birth", "Fecha de nacimiento", "date")}
  <label>Sexo<select name="sex"><option value="">—</option><option value="M" ${c.sex === "M" ? "selected" : ""}>Masculino</option><option value="F" ${c.sex === "F" ? "selected" : ""}>Femenino</option></select></label>
  ${f("height", "Estatura (cm)", "number")}</div>
  <label>Objetivos (del formulario de ingreso)<textarea name="goal" rows="2">${esc(c.goal || "")}</textarea></label>
  <div class="card-t mt">Objetivos diarios</div>
  ${c.service === "entrenamiento" ? `<p class="small muted">Solo entrenamiento: sus calorías y macros los define él en su calculadora (resumen más abajo). Los de aquí se usan solo mientras no la use.</p>` : ""}${c.service === "entrenamiento" ? "" : (() => { const a = applyStage(c); return a.stage ? `<p class="small">Vigentes hoy por su etapa <b style="color:${phaseColor(a.phase)}">${esc(a.phase)}</b> (semanas ${a.stage.from}–${a.stage.to}): <b>${a.kcal || "—"} kcal</b> · C ${a.cho || "—"} · L ${a.fat || "—"} · P ${a.prot || "—"} · ${(a.steps || 0).toLocaleString("es-CL")} pasos. Se cambian en <a href="#coach/c/${c.id}/etapas">Etapas</a>; los de abajo se usan solo cuando no hay etapa.</p>` : `<p class="muted small">No tiene etapas: se usan estos. Para planificar por semanas usa <a href="#coach/c/${c.id}/etapas">Etapas</a>.</p>`; })()}
  <div class="grid3">${c.service === "entrenamiento" ? "" : `<label>Etapa (si no hay etapas definidas)<select name="phase">${Object.keys(PHASES).map((p) => `<option ${c.phase === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>`}
  ${f("kcal", "Calorías", "number")}${f("cho", "CHO (g)", "number")}${f("fat", "Lípidos (g)", "number")}${f("prot", "Proteína (g)", "number")}
  ${f("steps", "Pasos", "number")}${f("water", "Agua (ml)", "number")}${f("sleep", "Sueño (h)", "number", 'step="0.5"')}${f("rest", "Descanso entre series por defecto (s)", "number")}</div>
  <p class="muted small">Agua: si la dejas en blanco es <b>automática</b> (40 ml por kg del último peso registrado): hoy sería <b id="wSug">—</b>.</p>
  ${c.service === "entrenamiento" ? `<div class="card-t mt">Alimentación</div>` : `<div class="card-t mt">Plan de alimentación</div><label>Link al PDF del plan (respaldo en Drive; el plan se arma en “Plan alimentación”)<input name="planUrl" value="${esc(c.plan?.pdfUrl || "")}"></label>`}
  <label>${c.service === "entrenamiento" ? "Indicaciones de alimentación (las ve en su calculadora de macros; vacío = nada)" : "Indicaciones del plan (las ve el cliente abajo de su plan; déjalo vacío para no mostrar nada)"}<textarea name="planNotes" rows="2">${esc(c.plan?.notes || "")}</textarea></label>
  ${c.service === "entrenamiento" ? `<div class="card-t mt">Calculadora de macros del cliente (solo entrenamiento)</div>
  ${c.selfCalc?.kcal ? `<p class="small">Su cálculo (${fmtDate(ymd(new Date(c.selfCalc.at)))}, ${String(c.selfCalc.kg).replace(".", ",")} kg): <b>${esc(c.selfCalc.goalName || "")}</b> · mantención ${c.selfCalc.maint} kcal → <b>${c.selfCalc.kcal} kcal</b> · P ${c.selfCalc.prot} g (${String(c.selfCalc.protKg).replace(".", ",")} g/kg) · G ${c.selfCalc.fat} g (${String(c.selfCalc.fatKg).replace(".", ",")} g/kg) · C ${c.selfCalc.cho} g. <b>Estas son sus metas</b> (mandan sobre calorías y macros de arriba).</p>` : `<p class="small muted">Aún no usa su calculadora: mientras, su meta es la de arriba o el punto medio de los rangos.</p>`}
  <p class="muted small">Rangos sugeridos que puede mover con las flechas (g por kg de peso). Los carbohidratos son el resto.</p>
  <div class="grid3">${[["prot", "Proteína"], ["fat", "Grasas"]].map(([k, l]) => { const v = c.ranges?.[k] || DEFAULT_RANGES[k]; return `<label>${l} (g/kg)<span class="row gap"><input type="number" step="0.1" data-rng="${k}" data-i="0" value="${v[0]}"><span>a</span><input type="number" step="0.1" data-rng="${k}" data-i="1" value="${v[1]}"></span></label>`; }).join("")}</div>` : ""}
  ${c.service === "entrenamiento" ? "" : `<details><summary class="card-t">Pauta por porciones (la ve el cliente en su plan · día normal / día con legumbres)</summary><p class="muted small">Si llenas la del día con legumbres, el cliente la ve en “Mi plan” como “Día con legumbres” (o la usa la opción del plan marcada como día con legumbres).</p>
  <table class="tbl"><tr><th>Grupo</th><th>Día normal</th><th>Día con legumbres</th></tr>${Object.entries(GROUPS).filter(([, g]) => g[4]).map(([g]) => `<tr><td>${g}</td><td><input type="number" step="0.25" data-pauta="${esc(g)}" value="${c.pauta?.[g] ?? ""}" style="width:90px"></td><td><input type="number" step="0.25" data-pauta-leg="${esc(g)}" value="${c.pautaLeg?.[g] ?? ""}" style="width:90px"></td></tr>`).join("")}</table></details>`}
  <div class="card-t mt">Fechas de interés (una por línea: AAAA-MM-DD Texto)</div><textarea name="dates" rows="3">${esc((c.dates || []).map((d) => d.date + " " + d.label).join("\n"))}</textarea>
  <div class="row gap mt"><button type="button" class="btn primary" data-a="dataSave">Guardar</button><button type="button" class="btn danger ghost" data-a="archive">Archivar cliente</button></div></form>
  <div class="card"><div class="card-t">Empezar de cero</div><p class="small muted">Para que empiece a usar la app desde una fecha con todo limpio: borra sus registros diarios, entrenamientos, check-ins, retroalimentaciones, fotos, medidas y audios, y deja la semana 1 desde la fecha que elijas. Se mantienen su ficha, sus rutinas, sus planes de alimentación y su acceso.</p>
  <button type="button" class="btn danger" data-a="resetOpen">Empezar de cero…</button></div>`;
}
document.addEventListener("rendered", async () => {
  const el = $("#wSug"); if (!el || !CW) return;
  const days = await getDays(addDays(ymd(), -14), ymd(), CW.cid); const w = Object.values(days).map((d) => d.weight).filter(Boolean).pop();
  el.textContent = w ? waterAuto(w) + " ml" : "sin pesajes"; el.dataset.v = w ? waterAuto(w) : "";
});
act("waterSug", () => { const v = $("#wSug").dataset.v; if (v) $('#dataF [name="water"]').value = v; });
act("dataSave", () => saveData(true));
// Se guarda solo al cambiar cualquier campo (antes había que bajar hasta "Guardar" y era fácil olvidarlo)
act("dataAuto", (el, e) => { if (e?.target?.closest("[data-a-change]") !== el) return; clearTimeout(DSV); DSV = setTimeout(() => saveData(false), 300); });
let DSV = null;
async function saveData(redraw) {
  const F = $("#dataF"); if (!F) return;
  try {
  const fd = Object.fromEntries(new FormData(F)), c0 = await getClient(CW.cid);
  if (fd.startDate && fd.startDate !== c0.startDate && c0.startDate) toast(`Inicio cambiado al ${fmtDate(fd.startDate)}: la semana 1 parte ese día y las semanas y etapas se cuentan desde ahí`, 4000);
  const n = ["height", "kcal", "cho", "fat", "prot", "steps", "water", "sleep", "rest", "checkinDay", "payEvery"];
  const data = {};
  for (const [k, v] of Object.entries(fd)) if (!["planUrl", "planNotes", "dates", "email", "todo", "checkinForm"].includes(k)) data[k] = n.includes(k) ? num(v) : v;
  data.todo = (fd.todo || "").split("\n").map((x) => x.trim()).filter(Boolean);
  // Correo: mueve su permiso de acceso al correo nuevo
  const old = await getClient(CW.cid), ne = emailKey(fd.email), oe = emailKey(old.email);
  if (fd.email !== undefined && ne !== oe) {
    const acc = oe ? await db.get("access/" + oe) : null;
    if (oe) await db.del("access/" + oe);
    if (ne) await db.set("access/" + ne, { cid: CW.cid, name: fd.name, ok: !!acc?.ok, at: Date.now() });
    data.email = ne;
  }
  data.plan = { ...(c0.plan || {}), pdfUrl: fd.planUrl, ...(fd.planNotes !== undefined ? { notes: fd.planNotes.trim() } : {}) };
  data.dates = fd.dates.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ date: l.slice(0, 10), label: l.slice(11) }));
  data.pauta = {}; $$("[data-pauta]").forEach((i) => { if (i.value !== "") data.pauta[i.dataset.pauta] = num(i.value); });
  data.pautaLeg = {}; $$("[data-pauta-leg]").forEach((i) => { if (i.value !== "") data.pautaLeg[i.dataset.pautaLeg] = num(i.value); });
  if ($("[data-rng]")) { data.ranges = {}; $$("[data-rng]").forEach((i) => { (data.ranges[i.dataset.rng] ||= [null, null])[+i.dataset.i] = num(i.value); }); }
  await db.set("clients/" + CW.cid, data); resetAlerts(); if (!(fd.startDate && fd.startDate !== c0.startDate && c0.startDate)) toast("Guardado ✓"); if (redraw) refresh();
  } catch (err) { console.error(err); toast("No se pudo guardar: " + (err.message || err)); }
}
// Empezar de cero (ej. primer día real en la app): borra lo registrado y reinicia semanas y etapas
// Pago: "Pagó" avanza la fecha al próximo período (o la borra si no se renueva); "Posponer" la mueve (el aviso al cliente se va hasta ese día)
act("payDone", async () => {
  const c = await getClient(CW.cid), every = +c.payEvery || 0;
  // La fecha es fija: avanza exactamente un período desde la fecha que tocaba (aunque haya pagado atrasado)
  const next = every ? (every === 30 ? addMonths(c.payDate, 1) : addDays(c.payDate, every)) : null;
  await db.set("clients/" + CW.cid, { payDate: next, payGrace: null, paidAt: Date.now(), lastPaid: c.payDate }); resetAlerts();
  toast(next ? `Pago registrado. Próximo pago: ${fmtDate(next)}` : "Pago registrado (sin próxima fecha)", 3500); refresh();
});
act("payLater", async () => {
  const c = await getClient(CW.cid);
  const b = sheet("Posponer pago", `<p class="small">La fecha de pago sigue siendo el <b>${fmtDate(c.payDate)}</b> (la próxima se cuenta desde ahí). Hasta el día que elijas, ${esc((c.name || "").split(" ")[0])} no ve el aviso de pago y a ti no te aparece como vencido.</p><label>Plazo para pagar hasta<input type="date" id="plD" value="${addDays(ymd(), 7)}" min="${addDays(ymd(), 1)}"></label><button class="btn primary big" id="plOk">Posponer</button>`);
  b.querySelector("#plOk").onclick = async () => { const d = b.querySelector("#plD").value; if (!d) return; await db.set("clients/" + CW.cid, { payGrace: d }); closeSheet(); resetAlerts(); toast(`Plazo de pago hasta el ${fmtDate(d)}`); refresh(); };
});
const addMonths = (d, n) => { const x = new Date(d + "T12:00"); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() !== day) x.setDate(0); return ymd(x); };
act("resetOpen", async () => {
  const c = await getClient(CW.cid), tm = addDays(ymd(), 1);
  sheet("Empezar de cero", `<p class="small">Se borra todo lo registrado de <b>${esc(c.name)}</b> (días, entrenamientos, check-ins, retroalimentaciones, fotos, medidas y audios). Se mantienen su ficha, rutinas, planes de alimentación y acceso. <b>No se puede deshacer.</b></p>
  <div class="grid2"><label>Semana 1 desde<input type="date" id="rzD" value="${tm}"><small class="muted">Define el inicio de cada semana (ej. domingo si sus semanas van de domingo a sábado)</small></label>
  <label>Empieza a usar la app el<input type="date" id="rzA" value="${tm}"><small class="muted">Si es después: los días antes no cuentan (ni entrenos atrasados ni registros pendientes)</small></label></div>
  <div class="grid3"><label class="span2">Etapa con la que parte<select id="rzP">${Object.keys(PHASES).map((p) => `<option ${p === "Mantención" ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label><label>Durante (semanas)<input type="number" id="rzN" value="8" min="1" max="52"></label></div>
  <label>Para confirmar, escribe su nombre<input id="rzC" placeholder="${esc((c.name || "").split(" ")[0])}"></label>
  <button class="btn danger big" data-a="resetDo">Borrar y empezar de cero</button>`);
});
act("resetDo", async () => {
  const c = await getClient(CW.cid), first = (c.name || "").split(" ")[0].toLowerCase();
  if (($("#rzC").value || "").trim().toLowerCase() !== first) return toast(`Escribe "${(c.name || "").split(" ")[0]}" para confirmar`);
  const start = $("#rzD").value, from = $("#rzA").value, phase = $("#rzP").value, n = Math.max(1, +$("#rzN").value || 8); if (!start) return toast("Elige la fecha");
  if (from && (from < start || from > addDays(start, 6))) return toast("El día en que empieza a usar la app tiene que caer dentro de la semana 1");
  closeSheet(); toast("Borrando…");
  let k = 0;
  for (const sub of ["days", "sessions", "checkins", "feedbacks", "fbreplies", "photos", "measures", "audios"]) for (const d of await db.list(`clients/${CW.cid}/${sub}`).catch(() => [])) { await db.del(`clients/${CW.cid}/${sub}/${d.id}`); k++; }
  // Rutinas: sin marcas de cambios ni revisiones de semanas antiguas
  for (const r of await getRoutines(CW.cid)) await db.set(`clients/${CW.cid}/routines/${r.id}`, { changes: null, review: null, exercises: (r.exercises || []).map((e) => ({ ...e, changed: false })) });
  await db.set("clients/" + CW.cid, { startDate: start, appFrom: from && from > start ? from : null, stages: [{ phase, from: 1, to: n }], phase, rutReview: null, feedback: null, weeklyGoals: [], seen: {}, resetAt: Date.now() });
  const c2 = await getClient(CW.cid); await stStore(c2, validSt(c2));
  CW = null; RE = null; resetAlerts(); toast(`Listo: ${k} registros borrados. Semana 1 desde el ${fmtDate(start)}${from > start ? `, usa la app desde el ${fmtDate(from)}` : ""} (${phase}).`, 5000); refresh();
});
act("accSet", async (el) => {
  const c = await getClient(CW.cid), e = emailKey(c.email); if (!e) return toast("Primero anota su correo");
  const ok = el.dataset.v === "1";
  if (ok && !(await confirmBox(`¿Dar acceso a ${c.name}? Podrá crear su cuenta con ${e} y ver su plan.`))) return;
  await db.set("access/" + e, { cid: CW.cid, name: c.name, ok, at: Date.now() });
  resetAlerts(); toast(ok ? "Acceso activado ✓" : "Acceso quitado"); refresh();
  if (ok) sheet("Invitación", `<p>Mándale esto por WhatsApp:</p><div class="pre" id="inv">${esc(inviteTxt(c))}</div><button class="btn primary" data-a="copyInv">Copiar mensaje</button>`);
});
act("copyInvite", async () => { const c = await getClient(CW.cid); sheet("Invitación", `<div class="pre" id="inv">${esc(inviteTxt(c))}</div><button class="btn primary" data-a="copyInv">Copiar mensaje</button>`); });
act("archive", async () => {
  if (!(await confirmBox("¿Archivar este cliente? Dejará de aparecer en tu lista y pierde el acceso a la app (sus datos se mantienen)."))) return;
  const c = await getClient(CW.cid); if (c.email) await db.set("access/" + emailKey(c.email), { ok: false });
  await db.set("clients/" + CW.cid, { archived: true }); resetAlerts(); go("coach");
});

// ================================================================ IMPORTAR CLIENTES (archivo .json que se prepara aparte; no queda en el código público)
act("importOpen", () => sheet("Importar clientes", `<p class="muted small">Sube el archivo <b>ima-clientes.json</b>. Si un cliente ya existe (mismo correo o mismo nombre) se actualiza su ficha; si no, se crea. A nadie se le da acceso: eso lo haces tú después, cliente por cliente.</p>
  <label class="btn primary big">Elegir archivo<input type="file" accept=".json,application/json" hidden data-a-change="importFile"></label><div id="impOut"></div>`));
act("importFile", async (el) => {
  let data; try { data = JSON.parse(await el.files[0].text()); } catch { return toast("El archivo no es válido"); }
  if (data.type !== "ima-import" || !Array.isArray(data.clients)) return toast("Este archivo no es una importación de IMA");
  const existing = await db.list("clients"), lib = (await db.get("library/exercises"))?.items || [], libNames = new Set(lib.map((e) => e.name.toLowerCase()));
  const log = [];
  for (const it of data.clients) {
    const d = it.doc, em = emailKey(d.email);
    const found = existing.find((c) => !c.archived && ((em && emailKey(c.email) === em) || (c.name || "").trim().toLowerCase() === d.name.trim().toLowerCase()));
    const id = found?.id || uid();
    await db.set("clients/" + id, { ...d, email: em, todo: [...new Set([...(found?.todo || []), ...(it.todo || [])])], importedAt: Date.now() });
    if (em && !(await db.get("access/" + em).catch(() => null))) await db.set("access/" + em, { cid: id, name: d.name, ok: false, at: Date.now() });
    for (const r of it.routines || []) { const { id: rid, ...rest } = r; await db.set(`clients/${id}/routines/${rid}`, rest, false); for (const e of r.exercises) { const l = lib.find((x) => x.name.toLowerCase() === e.name.toLowerCase()); if (!l) { libNames.add(e.name.toLowerCase()); lib.push({ id: uid(), name: e.name, group: "", video: "", alts: [], tips: e.notes || "" }); } else if (!l.tips && e.notes) l.tips = e.notes; } }
    for (const x of it.sessions || []) { const { id: sid, ...rest } = x; await db.set(`clients/${id}/sessions/${sid}`, rest, false); }
    for (const [exId, text] of Object.entries(it.exnotes || {})) await db.set(`clients/${id}/exnotes/${exId}`, { text });
    log.push(`${found ? "Actualizado" : "Creado"}: <b>${esc(d.name)}</b> · ${(it.routines || []).length} rutinas · ${(it.sessions || []).length} entrenamientos anteriores`);
  }
  await db.set("library/exercises", { items: lib }, false);
  resetAlerts(); $("#impOut").innerHTML = `<div class="pendlist">${log.map((l) => `<div class="li small">${l}</div>`).join("")}</div><button class="btn primary" data-a="closeSheet">Listo</button>`; refresh();
});

// ================================================================ CLIENTE DE EJEMPLO (para ver cómo se ve la app con semanas llenas)
act("exampleClient", () => sheet("Clientes de ejemplo", `<p class="muted small">Crea un cliente ficticio con 4 semanas de registros, entrenamientos, check-in y retroalimentación, para ver cómo se ve la app. Después toca “Ver como cliente”.</p>
  ${Object.entries(SERVICES).map(([k, l]) => `<button class="btn big" data-a="exampleMake" data-s="${k}">${l}</button>`).join("")}`));
act("exampleMake", async (el) => {
  const sv = el.dataset.s, label = { completa: "Ejemplo · Coaching 1-1", entrenamiento: "Ejemplo · Entrenamiento", nutricion: "Ejemplo · Nutrición" }[sv];
  const old = (await db.list("clients")).filter((c) => c.example && c.service === sv && !c.archived);
  for (const o of old) await db.set("clients/" + o.id, { archived: true });
  closeSheet(); toast("Creando cliente de ejemplo…");
  const { seedClient } = await import("./demo.js"), id = "ejemplo-" + sv + "-" + uid();
  await seedClient((p, d) => db.set(p, d, false), id, { name: label, email: "", example: true, service: sv });
  resetAlerts(); go(`coach/c/${id}/resumen`);
});

// ================================================================ BIBLIOTECA
async function library() {
  const ex = (await db.get("library/exercises"))?.items || [], gd = (await db.get("library/guides"))?.items || [], fd = await db.get("library/foods");
  const MXc = await loadMatrix(true);
  const val = (k, sv) => MXc[k]?.[sv] ?? defaultOf(k, sv);
  let grp = "";
  const svcTable = `<div class="card"><div class="card-t">Servicios: qué incluye cada asesoría</div><p class="muted small">Marca qué ve el cliente según su tipo de asesoría. Los cambios se aplican de inmediato a todos los clientes de ese servicio. Para ver el resultado usa “Ver como cliente” o crea un cliente de ejemplo de cada tipo.</p>
  <table class="tbl svct"><tr><th>Función</th>${SVC_COLS.map(([, l]) => `<th class="center">${l}</th>`).join("")}</tr>
  ${FEATURES.map(([g, k, l, d]) => { const h = g !== grp ? `<tr class="svg"><td colspan="4">${esc(g)}</td></tr>` : ""; grp = g; const diff = new Set(SVC_COLS.map(([sv]) => val(k, sv))).size > 1;
    return `${h}<tr class="${diff ? "diff" : ""}"><td><b>${esc(l)}</b><br><small class="muted">${esc(d)}</small></td>${SVC_COLS.map(([sv]) => `<td class="center"><input type="checkbox" class="svck" ${val(k, sv) ? "checked" : ""} data-a-change="svcSet" data-k="${k}" data-s="${sv}"></td>`).join("")}</tr>`; }).join("")}</table>
  <p class="muted small">Las filas marcadas en color son las que cambian entre servicios. <button class="btn tiny ghost" data-a="svcReset">Volver a los valores de fábrica</button></p></div>`;
  const ob = (await db.get("library/onboarding")) || {};
  const pd = (await db.get("library/payment")) || {};
  const payCard = `<div class="card"><div class="card-t">Datos para transferir</div><p class="muted small">Le aparecen al cliente en el recordatorio de pago (el día que le toca y, si pasa la fecha, en "Pago pendiente"). Se guardan en tu base de datos, no en el código.</p>
  <div class="grid3">${PAY_FIELDS.map(([k, l]) => `<label>${l}<input data-a-change="paySet" data-k="${k}" value="${esc(pd[k] || "")}"></label>`).join("")}</div></div>`;
  const obCard = `<div class="card"><div class="card-t">Bienvenida (onboarding de clientes nuevos)</div><p class="muted small">Se abre sola la primera vez que el cliente entra: tu video, tu mensaje y 5–6 pantallas cortas que explican la app según su tipo de asesoría (su servicio, instalar y activar avisos, registrar, entrenar, check-in). Queda en Más → “Bienvenida a IMA” para volver a verla.</p>
  <label>Video de bienvenida (YouTube no listado)<input id="obV" value="${esc(ob.videoUrl || "")}" placeholder="https://youtu.be/…"></label>
  <label>Mensaje de bienvenida<textarea id="obT" rows="3" placeholder="Esta es tu app de asesoría…">${esc(ob.text || "")}</textarea></label>
  <label>Link al manual de uso (opcional)<input id="obM" value="${esc(ob.manualUrl || "")}"></label>
  <div class="row gap"><button class="btn primary" data-a="obSave">Guardar</button><button class="btn" data-a="obOpen">Ver cómo se ve</button></div></div>`;
  return `<h1>Biblioteca</h1>${obCard}${payCard}${svcTable}
  <div class="card"><div class="row between"><div class="card-t">Base de ejercicios (${ex.length}) · ${ex.filter((e) => e.video).length} con video · ${ex.filter((e) => e.tips).length} con tips</div><button class="btn tiny" data-a="libGuess">Asignar grupo muscular automáticamente</button></div>
  <p class="muted small">Al escribir un ejercicio en una rutina se completan solos su video, sus tips y sus reemplazos. Las variantes (agarre en V, recto, sentado…) pueden copiar los tips de la principal.</p>
  <div class="scroll-x"><table class="tbl libt"><tr><th>Ejercicio</th><th>Grupo muscular</th><th>Video</th><th>Tips</th><th>Link del video</th><th>Tips de ejecución (uno por línea)</th><th></th></tr>
  ${[...MUSCLES, ""].map((g) => { const items = ex.map((e, k) => ({ e, k })).filter(({ e }) => (e.group || "") === g); return items.length ? `<tr class="svg"><td colspan="7">${g || "Sin grupo"} (${items.length})</td></tr>` + items.sort((a, b) => a.e.name.localeCompare(b.e.name, "es")).map(({ e, k }) => `<tr><td><input value="${esc(e.name)}" data-a-change="libEx" data-k="${k}" data-f="name"></td>
    <td><select data-a-change="libEx" data-k="${k}" data-f="group"><option value="">—</option>${MUSCLES.map((m) => `<option ${e.group === m ? "selected" : ""}>${m}</option>`).join("")}</select></td>
    <td class="center">${e.video ? '<span class="g">✓</span>' : '<span class="muted">—</span>'}</td><td class="center">${e.tips ? '<span class="g">✓</span>' : '<span class="muted">—</span>'}</td>
    <td><input value="${esc(e.video || "")}" data-a-change="libEx" data-k="${k}" data-f="video"></td><td><textarea rows="1" data-a-change="libEx" data-k="${k}" data-f="tips">${esc(e.tips || "")}</textarea></td><td><button class="icon-btn" data-a="libExDel" data-k="${k}">✕</button></td></tr>`).join("") : ""; }).join("")}</table></div>
  <button class="btn" data-a="libExAdd">＋ Ejercicio</button></div>
  <div class="card"><div class="card-t">Guías para clientes</div>${gd.map((g, k) => `<div class="row gap"><input value="${esc(g.title)}" data-a-change="libG" data-k="${k}" data-f="title" placeholder="Título"><input class="grow" value="${esc(g.url)}" data-a-change="libG" data-k="${k}" data-f="url" placeholder="Link (PDF en Drive)"><input class="grow" value="${esc(g.desc || "")}" data-a-change="libG" data-k="${k}" data-f="desc" placeholder="Descripción"><button class="icon-btn" data-a="libGDel" data-k="${k}">✕</button></div>`).join("")}<button class="btn" data-a="libGAdd">＋ Guía</button></div>
  <div class="card"><div class="card-t">Base de alimentos para el registro</div><p class="muted small">El registro usa el <b>aporte real por 100 g</b>: 600 alimentos de la <b>Tabla de Composición de Alimentos INTA 2018</b> (lo que no trae, del USDA), más 5.076 productos envasados chilenos verificados de Open Food Facts y los que escaneen o creen tus clientes. Cada alimento tiene su grupo de intercambio, así igual se descuentan porciones de la pauta.${fd?.items?.length ? ` Además tienes ${fd.items.length} alimentos propios agregados.` : ""}</p>
  <p class="muted small">Para agregar alimentos propios o <b>corregir uno de la base</b> (si usas exactamente el mismo nombre, tu versión reemplaza a la de la base), sube un CSV con columnas: <b>Alimento, Grupo, Kcal, CHO, Lipidos, Proteina</b> (por 100 g) y opcionalmente <b>Medida</b> y <b>Gramos</b> de la medida casera.</p>
  <label class="btn">Importar CSV<input type="file" accept=".csv,text/csv" hidden data-a-change="foodCsv"></label></div>`;
}
act("svcSet", async (el) => { const m = await loadMatrix(true); m[el.dataset.k] = { ...(m[el.dataset.k] || {}), [el.dataset.s]: el.checked }; await db.set("library/services", { matrix: m, at: Date.now() }, false); await loadMatrix(true); toast("Guardado"); refresh(); });
act("svcReset", async () => { if (!(await confirmBox("¿Volver a los valores de fábrica en todos los servicios?"))) return; await db.set("library/services", { matrix: {}, at: Date.now() }, false); await loadMatrix(true); refresh(); });
act("paySet", async (el) => { await db.set("library/payment", { [el.dataset.k]: el.value.trim(), at: Date.now() }); PAYD = null; toast("Guardado"); });
act("obSave", async () => { await db.set("library/onboarding", { videoUrl: $("#obV").value.trim(), text: $("#obT").value.trim(), manualUrl: $("#obM").value.trim(), at: Date.now() }, false); toast("Bienvenida guardada ✓"); });
const libSave = async (doc, items) => { await db.set("library/" + doc, { items }, false); };
act("libEx", async (el) => {
  const items = (await db.get("library/exercises"))?.items || [], e = items[+el.dataset.k], f = el.dataset.f;
  if (f === "alts") e.alts = el.value.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const [name, video] = x.split("|").map((y) => y.trim()); return { name, video: video || "" }; });
  else e[f] = f === "inc" ? num(el.value) : el.value;
  await libSave("exercises", items); toast("Guardado");
});
const MUSCLES = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazos", "Cuádriceps", "Isquiotibiales", "Glúteos", "Aductores", "Abductores", "Pantorrillas", "Abdomen", "Cardio", "Otro"];
const GUESS = [[/pantorr|gemel|calf/i, "Pantorrillas"], [/abduct/i, "Abductores"], [/aduct/i, "Aductores"], [/abdom|crunch|plancha|core/i, "Abdomen"], [/hip thrust|gl[uú]te|patada|kickback/i, "Glúteos"], [/leg curl|curl femoral|femoral|rdl|rumano|isquio|nordic/i, "Isquiotibiales"], [/leg ext|extensi[oó]n de cu[aá]d|sentadilla|squat|prensa|hack|zancada|estocada|bulgar/i, "Cuádriceps"], [/tr[ií]cep|dip|fondos|press franc/i, "Tríceps"], [/b[ií]cep|curl|preacher|martillo/i, "Bíceps"], [/elevaci|lateral|militar|deltoid|face pull|hombro|overhead/i, "Hombros"], [/jal[oó]n|remo|dominad|pull ?up|pull ?over|espalda|row/i, "Espalda"], [/press|pec ?fly|pecfly|apertura|pecho|chest|banca|cruce/i, "Pecho"], [/bici|trote|cinta|el[ií]ptic|cardio/i, "Cardio"]];
export const guessMuscle = (n) => (GUESS.find(([re]) => re.test(n || "")) || [])[1] || "";
act("libGuess", async () => { const items = (await db.get("library/exercises"))?.items || []; let n = 0; items.forEach((e) => { if (!e.group) { const g = guessMuscle(e.name); if (g) { e.group = g; n++; } } }); await libSave("exercises", items); toast(`${n} ejercicios con grupo asignado (revísalos)`); refresh(); });
act("libExAdd", async () => { const items = (await db.get("library/exercises"))?.items || []; items.push({ id: uid(), name: "", group: "", video: "", alts: [] }); await libSave("exercises", items); refresh(); });
act("libExDel", async (el) => { const items = (await db.get("library/exercises"))?.items || []; items.splice(+el.dataset.k, 1); await libSave("exercises", items); refresh(); });
act("libG", async (el) => { const items = (await db.get("library/guides"))?.items || []; items[+el.dataset.k][el.dataset.f] = el.value; await libSave("guides", items); toast("Guardado"); });
act("libGAdd", async () => { const items = (await db.get("library/guides"))?.items || []; items.push({ title: "", url: "" }); await libSave("guides", items); refresh(); });
act("libGDel", async (el) => { const items = (await db.get("library/guides"))?.items || []; items.splice(+el.dataset.k, 1); await libSave("guides", items); refresh(); });
act("foodCsv", async (el) => {
  const text = await el.files[0].text();
  const rows = parseCsv(text); const h = rows.shift().map((x) => x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const col = (n) => h.findIndex((x) => x.startsWith(n));
  const iN = col("alimento"), iG = col("grupo"), iK = col("kcal") >= 0 ? col("kcal") : col("calor"), iC = col("cho"), iL = col("lip"), iP = col("prot"), iM = col("medida"), iMg = col("gramos");
  if (iN < 0 || iK < 0) return toast("Faltan columnas: Alimento y Kcal (por 100 g)");
  const n = (v) => num(String(v ?? "").replace(",", ".")) || 0;
  const KEY = { "Cereales": ["cho", 30], "Legumbres": ["cho", 30], "Frutas": ["cho", 15], "Verduras generales": ["cho", 5], "Verduras libre consumo": ["cho", 2.5], "Lácteos altos en grasa": ["cho", 9], "Lácteos medios en grasa": ["cho", 9], "Lácteos bajos en grasa": ["cho", 10], "Carnes magras": ["prot", 11], "Carnes grasas": ["prot", 11], "Huevo": ["prot", 6], "Aceites y grasas": ["fat", 20], "Alimentos ricos en lípidos": ["fat", 15], "Azúcar": ["cho", 5] };
  const items = [];
  for (const r of rows) {
    const name = r[iN]?.trim(); if (!name) continue;
    const f = { id: "l" + items.length, name, cat: iG >= 0 ? r[iG].trim() : "", kcal: n(r[iK]), cho: n(r[iC]), fat: n(r[iL]), prot: n(r[iP]), medida: iM >= 0 ? r[iM] : "", medidaG: iMg >= 0 ? n(r[iMg]) || null : null };
    const k = KEY[f.cat]; f.portion = k && f[k[0]] > 0 ? Math.round((100 * k[1]) / f[k[0]]) : null;
    items.push(f);
  }
  await db.set("library/foods", { items, at: Date.now() }, false); resetFoodCache(); toast(`${items.length} alimentos agregados ✓`); refresh();
});
function parseCsv(t) {
  const out = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; } else cur += ch; }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter((r) => r.some((x) => x !== ""));
}


// ---------- Etapas: calendario para pintar semanas + cálculo por fórmula
let STB = { brush: "Mantención", month: null };
const validSt = (c) => (c.stages || []).filter((x) => +x.from >= 1 && +x.to >= +x.from).sort((a, b) => a.from - b.from);
async function lastWeight(cid) { const d = await getDays(addDays(ymd(), -45), ymd(), cid); return Object.keys(d).sort().map((k) => weightCorr(d[k])).filter(Boolean).pop() || null; }
async function stagesView(c) {
  const st = validSt(c), now = weekInfo(c, ymd()).n, kg = (await lastWeight(c.id)) || c.weightStart || null;
  const def = (await db.get("library/phases")) || {}, pctDef = (p) => def.pct?.[p] ?? PHASE_PCT[p] ?? 0;
  const maint = c.kcalMaint || null;
  if (!STB.month) STB.month = ymd().slice(0, 7);
  const nextM = (m) => { const [y, mm] = m.split("-").map(Number); return `${mm === 12 ? y + 1 : y}-${String(mm === 12 ? 1 : mm + 1).padStart(2, "0")}`; };
  const inp = (k, i, v, w = 70, ph = "", step = "any") => `<input type="number" step="${step}" data-a-change="stF" data-i="${i}" data-k="${k}" value="${esc(v ?? "")}" placeholder="${esc(ph)}" style="width:${w}px">`;
  return `<div class="card"><div class="row between"><div class="card-t">Calendario de etapas · semana actual ${now}</div><span class="muted small">Elige una etapa y toca los días: se pinta la semana completa de ese día.</span></div>
  <div class="chips">${Object.keys(PHASES).map((p) => `<button class="chip ${STB.brush === p ? "on" : ""}" style="${STB.brush === p ? `background:${phaseColor(p)};border-color:${phaseColor(p)}` : `box-shadow:inset 3px 0 0 ${phaseColor(p)}`}" data-a="stBrush" data-p="${esc(p)}">${p}</button>`).join("")}<button class="chip ${STB.brush === "" ? "on" : ""}" data-a="stBrush" data-p="">Borrar</button></div>
  <div class="st-cals"><div>${monthCal(c, { month: STB.month, nav: "stMonth", act: "stPaint", selWeek: now })}</div><div>${monthCal(c, { month: nextM(STB.month), act: "stPaint", selWeek: now })}</div></div></div>
  ${reqCard(c, kg)}
  <div class="card scroll-x"><table class="tbl stt"><tr><th>Etapa</th><th>Semanas</th><th>Plan de alimentación y metas</th><th>Pasos</th><th>Cardio</th><th>Nota para el cliente</th></tr>
  ${st.map((x, i) => { const P = c.plans?.[x.phase], T = P?.targets || {}, soon = x.from - now;
    return `<tr><td><span class="dotc" style="background:${phaseColor(x.phase)}"></span><b>${esc(x.phase)}</b></td>
    <td class="small">S${x.from}–S${x.to}<br><span class="muted">${fmtDate(addDays(c.startDate || ymd(), (x.from - 1) * 7))} – ${fmtDate(addDays(c.startDate || ymd(), x.to * 7 - 1))}</span></td>
    <td>${P ? `<span class="badge g">Plan listo</span> <span class="small">${T.kcal ? `${T.kcal} kcal · C ${T.cho ?? "–"} · L ${T.fat ?? "–"} · P ${T.prot ?? "–"}` : '<span class="muted">sin metas</span>'}</span>` : `<span class="badge ${x.to >= now && soon <= 2 ? "r" : "y"}">Falta el plan</span>`} <a class="btn tiny" href="#coach/c/${c.id}/plan">${P ? "Ver" : "Armarlo"}</a></td>
    <td>${inp("steps", i, x.steps, 76, c.steps || "")}</td><td><input value="${esc(x.cardio || "")}" data-a-change="stF" data-i="${i}" data-k="cardio" placeholder="ej: 3×25 min" style="width:96px"></td>
    <td><input value="${esc(x.note || "")}" data-a-change="stF" data-i="${i}" data-k="note" style="width:220px" placeholder="La ve en su Timeline y en su plan"></td></tr>`; }).join("") || `<tr><td colspan="6" class="muted">Pinta semanas en el calendario para crear etapas.</td></tr>`}</table>
  <p class="muted small">Cada etapa usa su propio plan de alimentación (con sus metas de calorías y macros), que se arma en <b>Plan alimentación</b>. Las semanas que ya pasaron quedan como se planificaron.</p></div>
  <div class="card"><details><summary class="small muted">% por defecto de cada etapa (aplica a todos tus clientes)</summary><div class="grid4">${Object.keys(PHASES).map((p) => `<label>${p}<input type="number" step="1" value="${pctDef(p)}" data-a-change="stPctDef" data-p="${esc(p)}"></label>`).join("")}</div></details></div>`;
}
// Requerimientos: gasto en reposo (Mifflin-St Jeor, Harris-Benedict revisada o Katch-McArdle con % de grasa) × factor de actividad
const ACT_F = [[1.2, "Sedentario (poco movimiento, < 5.000 pasos)"], [1.375, "Ligero (5.000–7.500 pasos o entrena 1–3 días)"], [1.55, "Moderado (7.500–10.000 pasos y entrena 3–5 días)"], [1.725, "Alto (> 10.000 pasos y entrena 5–6 días)"], [1.9, "Muy alto (trabajo físico + entrenamiento)"]];
const ageOf = (b) => { if (!b) return null; const d = new Date(b + "T12:00"), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
function reqCalc(c, kg) {
  const age = ageOf(c.birth), h = +c.height, sex = c.sex, bf = +c.bodyFat, f = c.reqFormula || "mifflin", act = +c.actFactor || 1.55;
  if (!kg) return { miss: "peso" };
  let geb = null;
  if (f === "katch") { if (!bf) return { miss: "% de grasa" }; geb = 370 + 21.6 * kg * (1 - bf / 100); }
  else { if (!age || !h || !sex) return { miss: [!sex && "sexo", !age && "fecha de nacimiento", !h && "estatura"].filter(Boolean).join(", ") };
    geb = f === "harris" ? (sex === "M" ? 88.362 + 13.397 * kg + 4.799 * h - 5.677 * age : 447.593 + 9.247 * kg + 3.098 * h - 4.33 * age) : 10 * kg + 6.25 * h - 5 * age + (sex === "M" ? 5 : -161); }
  return { geb: Math.round(geb), get: Math.round(geb * act), age, act };
}
function reqCard(c, kg) {
  const R = reqCalc(c, kg);
  return `<div class="card"><div class="card-t">Cálculo de requerimientos</div><div class="grid4">
    <label>Sexo<select data-a-change="reqF" data-k="sex"><option value="">—</option><option value="M" ${c.sex === "M" ? "selected" : ""}>Masculino</option><option value="F" ${c.sex === "F" ? "selected" : ""}>Femenino</option></select></label>
    <label>Fecha de nacimiento${R.age ? ` · ${R.age} años` : ""}<input type="date" value="${esc(c.birth || "")}" data-a-change="reqF" data-k="birth"></label>
    <label>Estatura (cm)<input type="number" value="${esc(c.height || "")}" data-a-change="reqF" data-k="height"></label>
    <label>Peso<input disabled value="${kg ? r1(kg) + " kg (último registrado)" : "sin pesajes"}"></label>
    <label>Fórmula<select data-a-change="reqF" data-k="reqFormula">${[["mifflin", "Mifflin-St Jeor"], ["harris", "Harris-Benedict (revisada)"], ["katch", "Katch-McArdle (usa % de grasa)"]].map(([v, l]) => `<option value="${v}" ${(c.reqFormula || "mifflin") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label>% de grasa (opcional)<input type="number" step="0.1" value="${esc(c.bodyFat || "")}" data-a-change="reqF" data-k="bodyFat"></label>
    <label class="span2">Factor de actividad<select data-a-change="reqF" data-k="actFactor">${ACT_F.map(([v, l]) => `<option value="${v}" ${(+c.actFactor || 1.55) === v ? "selected" : ""}>${v} · ${l}</option>`).join("")}</select></label></div>
    ${R.miss ? `<p class="muted small">Falta: ${esc(R.miss)}.</p>` : `<div class="req-out"><div><small>Gasto en reposo</small><b>${R.geb} kcal</b></div><div><small>Gasto total (× ${R.act})</small><b>${R.get} kcal</b></div>
      <button class="btn primary" data-a="reqUse" data-v="${R.get}">Usar ${R.get} kcal como mantención</button>${c.kcalMaint ? `<span class="muted small">Mantención actual: ${c.kcalMaint} kcal</span>` : ""}</div>`}
    <p class="muted small">Es un punto de partida: ajústalo con lo que pasa con su peso en 2–3 semanas.</p></div>`;
}
act("reqF", async (el) => { const k = el.dataset.k, v = ["height", "bodyFat", "actFactor"].includes(k) ? num(el.value) : el.value; await db.set("clients/" + CW.cid, { [k]: v }); refresh(); });
act("reqUse", async (el) => { await db.set("clients/" + CW.cid, { kcalMaint: +el.dataset.v }); const c = await getClient(CW.cid); await stStore(c, validSt(c)); toast("Mantención actualizada: las etapas se recalcularon"); });
function stageCalc(c, x, kg, pctDef) {
  const m = +x.maint || +c.kcalMaint || +c.kcal || null; if (!m) return {};
  const pct = x.pct !== "" && x.pct != null ? +x.pct : pctDef(x.phase), kcal = Math.round(m * (1 + pct / 100));
  if (!kg) return { kcal };
  const prot = Math.round((+x.protKg || +c.protKg || 2) * kg), fat = Math.round((+x.fatKg || +c.fatKg || 0.8) * kg);
  return { kcal, prot, fat, cho: Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4)) };
}
// Guarda las etapas y deja calculados sus objetivos (los usa la app del cliente)
async function stStore(c, st) {
  const kg = (await lastWeight(CW.cid)) || c.weightStart || null, def = (await db.get("library/phases")) || {}, pctDef = (p) => def.pct?.[p] ?? PHASE_PCT[p] ?? 0;
  st.forEach((x) => { x.auto = stageCalc(c, x, kg, pctDef); if (kg) x.auto.water = waterAuto(kg); });
  await db.set("clients/" + CW.cid, { stages: st }); resetAlerts(); refresh();
}
const stSave = async (fn) => { const c = await getClient(CW.cid); const st = validSt(c); fn(st); await stStore(c, st); };
act("stBrush", (el) => { STB.brush = el.dataset.p; refresh(); });
act("stMonth", (el) => { STB.month = el.dataset.m; refresh(); });
act("stPaint", async (el) => {
  const c = await getClient(CW.cid), n = +el.dataset.w, old = validSt(c), map = {};
  old.forEach((x) => { for (let k = +x.from; k <= +x.to; k++) map[k] = x.phase; });
  if (STB.brush) map[n] = STB.brush; else delete map[n];
  const ns = Object.keys(map).map(Number).sort((a, b) => a - b), runs = [];
  for (const k of ns) { const l = runs[runs.length - 1]; if (l && l.phase === map[k] && l.to === k - 1) l.to = k; else runs.push({ phase: map[k], from: k, to: k }); }
  const st = runs.map((r) => { const prev = old.find((x) => x.phase === r.phase && r.from >= +x.from && r.from <= +x.to) || old.find((x) => x.phase === r.phase && r.to >= +x.from && r.to <= +x.to); const { from, to, phase, auto, ...rest } = prev || {}; return { ...rest, phase: r.phase, from: r.from, to: r.to }; });
  await stStore(c, st);
});
act("stBase", async (el) => { await db.set("clients/" + CW.cid, { [el.dataset.k]: num(el.value) }); const c = await getClient(CW.cid); await stStore(c, validSt(c)); });
act("stPctDef", async (el) => { const d = (await db.get("library/phases")) || {}; await db.set("library/phases", { pct: { ...(d.pct || {}), [el.dataset.p]: num(el.value) ?? 0 } }, false); const c = await getClient(CW.cid); await stStore(c, validSt(c)); });
act("stF", (el) => stSave((st) => { const k = el.dataset.k; st[+el.dataset.i][k] = ["phase", "note", "cardio"].includes(k) ? el.value : num(el.value); }));
// Ajuste del plan con los macros de la pauta en vivo
const pautaMacros = (p) => { const t = { kcal: 0, cho: 0, fat: 0, prot: 0 }; for (const [g, n] of Object.entries(p || {})) { const G = GROUPS[g]; if (G) { t.kcal += n * G[0]; t.cho += n * G[1]; t.fat += n * G[2]; t.prot += n * G[3]; } } return t; };
let ADJ = null;
act("stAdj", async (el) => {
  const c = await getClient(CW.cid), st = validSt(c), x = st[+el.dataset.i]; if (!x) return;
  ADJ = { i: +el.dataset.i, pauta: c.pauta || {}, adj: { ...(x.adj || {}) }, target: x.kcal || x.auto?.kcal || null, x };
  const groups = Object.entries(GROUPS).filter(([, g]) => g[4]).map(([g]) => g);
  sheet(`Ajuste del plan · ${x.phase} (semanas ${x.from}–${x.to})`, `<p class="muted small">Porciones que sumas o restas a la pauta en esta etapa (ej. <b>-1</b> Cereales, <b>-0,25</b> Aceites y grasas). En el plan del cliente, los alimentos de ese grupo cambian su gramaje en la misma proporción.</p>
  <div id="adjM"></div>
  <div class="grid3">${groups.map((g) => `<label>${esc(g)}<small class="muted"> · pauta ${ADJ.pauta[g] ?? 0}</small><input type="number" step="0.25" data-adj="${esc(g)}" data-a-input="stAdjLive" value="${ADJ.adj[g] ?? ""}" placeholder="0"></label>`).join("")}</div>
  <button class="btn primary big" data-a="stAdjOk">Guardar ajuste</button>`, { wide: true });
  adjLive();
});
function adjLive() {
  const adj = {}; $$("[data-adj]").forEach((i) => { if (num(i.value)) adj[i.dataset.adj] = num(i.value); });
  const base = pautaMacros(ADJ.pauta), np = { ...ADJ.pauta }; for (const [g, d] of Object.entries(adj)) np[g] = Math.max(0, (+np[g] || 0) + d);
  const now = pautaMacros(np), tg = ADJ.x.auto || {};
  const col = (l, k, u = "g") => `<td><b>${r0(now[k])}</b> ${u}<br><small class="${now[k] - base[k] > 0 ? "g" : now[k] - base[k] < 0 ? "r" : "muted"}">${now[k] - base[k] ? (now[k] - base[k] > 0 ? "+" : "") + r0(now[k] - base[k]) : "sin cambio"}</small>${tg[k] ? `<br><small class="muted">objetivo ${tg[k]}</small>` : ""}</td>`;
  $("#adjM").innerHTML = `<table class="tbl"><tr><th>Pauta actual</th><th>Kcal</th><th>CHO</th><th>Lípidos</th><th>Proteína</th></tr><tr><td class="muted small">${r0(base.kcal)} kcal · C ${r0(base.cho)} · L ${r0(base.fat)} · P ${r0(base.prot)}</td>${col("Kcal", "kcal", "kcal")}${col("CHO", "cho")}${col("Lip", "fat")}${col("Prot", "prot")}</tr></table>`;
}
act("stAdjLive", () => adjLive());
act("stAdjOk", () => { const adj = {}; $$("[data-adj]").forEach((i) => { if (num(i.value)) adj[i.dataset.adj] = num(i.value); }); closeSheet(); stSave((st) => { st[ADJ.i].adj = adj; }); });
