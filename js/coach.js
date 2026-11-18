import { LS } from "./util.js";
// Panel del coach (escritorio)
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, refresh, go } from "./state.js";
import { I } from "./icons.js";
import { act, toast, sheet, closeSheet, confirmBox, promptBox, bar, lineChart, $, $$ } from "./ui.js";
import { esc, ymd, addDays, fmtDate, weekInfo, dayTotals, itemMacros, sleepHours, sleepColor, r0, r1, num, avg, sum, uid, trend, DAYS, embedUrl, pad } from "./util.js";
import { DEFAULT_RANGES, adjTxt } from "./data.js";
import "./onboarding.js";
import { FEATURES, SVC_COLS, loadMatrix, has, defaultOf } from "./features.js";
import { mealList, getDays, getRoutines, getSessions, getClient, weekPlan, prevSession, refSet, setProgress, MEASURE_ZONES, PHOTO_TYPES, resetFoodCache, applyStage, stagesBar, phaseColor, PHASES, CHECKIN } from "./data.js";
import { weeksTable } from "./client.js";
import { GROUPS } from "./foods.js";
import { menusEditor } from "./menus.js";
import { loadCtx, alertsFor, levelOf, SERVICES, emailKey, checkinDayTxt } from "./alerts.js";

// Pendientes de todos los clientes (se recalculan como máximo cada 30 s o al guardar algo)
let AL = { at: 0, map: {} };
export const resetAlerts = () => (AL.at = 0);
async function allAlerts(clients) {
  if (Date.now() - AL.at < 30000 && clients.every((c) => AL.map[c.id])) return AL.map;
  const out = {};
  await Promise.all(clients.map(async (c) => { const x = await loadCtx(c); out[c.id] = { x, A: alertsFor(c, x) }; }));
  AL = { at: Date.now(), map: out }; return out;
}
const chip = (a, cid) => `<a class="badge ${a.c === "i" ? "" : a.c}" href="#coach/c/${cid}/${a.tab}">${esc(a.t)}</a>`;

const TABS = [["resumen", "Timeline semanal"], ["etapas", "Etapas"], ["entrenos", "Entrenamientos"], ["rutinas", "Rutinas"], ["comida", "Alimentación"], ["plan", "Plan alimentación"], ["progreso", "Progreso"], ["checkins", "Check-ins"], ["feedback", "Retroalimentación"], ["datos", "Datos y objetivos"]];
let CW = null; // semana que está viendo el coach

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
  ${clients.map((c) => `<a href="#coach/c/${c.id}/${tab || "resumen"}" class="sub ${cid === c.id ? "on" : ""}"><span class="lv ${levelOf(ALL[c.id]?.A || [])}"></span>${esc(c.name || "Sin nombre")}</a>`).join("")}
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
    const d7 = Object.values(x.days || {});
    const foodDays = d7.filter((d) => Object.values(d.meals || {}).some((m) => m.length)).length, wDays = d7.filter((d) => d.weight).length;
    const lastCi = [...x.checkins].sort((a, b) => b.id.localeCompare(a.id))[0];
    return { c, x, A, w, plan, foodDays, wDays, lastCi, lv: levelOf(A) };
  }).sort((a, b) => "ryg".indexOf(a.lv) - "ryg".indexOf(b.lv) || a.c.name.localeCompare(b.c.name));
  const nR = rows.filter((r) => r.lv === "r").length, nY = rows.filter((r) => r.lv === "y").length;
  const active = (r) => r.x.access?.ok || r.c.example;
  return `<div class="row between"><h1>Clientes</h1><div class="row gap"><button class="btn small" data-a="exampleClient">Crear cliente de ejemplo</button></div></div>
  <div class="ov-sum"><div class="ov r"><b>${nR}</b><span>con algo urgente</span></div><div class="ov y"><b>${nY}</b><span>con pendientes</span></div><div class="ov g"><b>${rows.length - nR - nY}</b><span>al día</span></div><div class="ov"><b>${rows.filter(active).length}/${rows.length}</b><span>con acceso a la app</span></div></div>
  <p class="muted small">${fmtDate(today, true)} · <span class="badge r">rojo</span> urgente · <span class="badge y">amarillo</span> pendiente · <span class="badge">gris</span> informativo. Toca un pendiente para ir directo a resolverlo.</p>
  <table class="tbl big ovt"><tr><th></th><th>Cliente</th><th>Asesoría</th><th>Semana</th><th>Check-in</th><th>Entrenos</th><th>Comida</th><th>Pesajes</th><th>Pendientes</th></tr>
  ${rows.map(({ c, x, A, w, plan, foodDays, wDays, lastCi, lv }) => `<tr><td><span class="lv ${lv}"></span></td><td><a href="#coach/c/${c.id}/resumen"><b>${esc(c.name)}</b></a>${c.example ? ' <span class="badge">ejemplo</span>' : ""}<br><small class="muted">${x.access?.ok ? "✓ con acceso" : c.email ? "sin acceso aún" : "sin correo"}</small></td>
    <td>${c.service ? esc(SERVICES[c.service]) : '<span class="badge r">Definir</span>'}${c.modalidad ? `<br><small class="muted">${esc(c.modalidad)}</small>` : ""}</td>
    <td>${w ? `${w.n}<br><small style="color:${phaseColor(applyStage(c).phase)}">${esc(applyStage(c).phase || "")}</small>` : "—"}</td>
    <td>${checkinDayTxt(c)}${c.checkinForm ? '<br><small class="muted">formulario</small>' : ""}${lastCi ? `<br><small class="muted">últ. sem. ${+lastCi.id.slice(1)}</small>` : ""}</td>
    <td>${active({ x, c }) && plan && plan.planned.length ? `<span class="pill ${plan.doneCount >= plan.planned.length ? "g" : ""}">${plan.doneCount}/${plan.planned.length}</span>` : "—"}</td>
    <td>${active({ x, c }) && c.service !== "entrenamiento" ? `<span class="pill ${foodDays >= 5 ? "g" : foodDays >= 3 ? "y" : "r"}">${foodDays}/7</span>` : "—"}</td><td>${active({ x, c }) ? `<span class="pill ${wDays >= 5 ? "g" : wDays >= 3 ? "y" : "r"}">${wDays}/7</span>` : "—"}</td>
    <td class="ovchips">${A.map((a) => chip(a, c.id)).join(" ") || '<span class="badge g">Al día</span>'}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">Aún no tienes clientes. Crea uno con “＋ Nuevo cliente” o usa “Importar clientes”.</td></tr>`}</table>`;
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
  if (tab === "entrenos") db.set("clients/" + cid, { seen: { ...(c.seen || {}), entrenos: Date.now() } });
  const A = (AA?.A || []).filter((a) => a.c !== "i"), info = (AA?.A || []).filter((a) => a.c === "i");
  const now = weekInfo(c, ymd());
  if (!CW || CW.cid !== cid) CW = { cid, n: now.n };
  const wDate = addDays(c.startDate || ymd(), (CW.n - 1) * 7);
  const w = weekInfo(c, wDate);
  const views = { resumen: tlView, etapas: stagesView, entrenos: sessionsView, rutinas: routinesView, comida: foodView, plan: (c) => { S._coachClient = c; return menusEditor(c); }, progreso: progView, checkins: checkinsView, feedback: feedbackView, datos: dataView };
  const weekNav = ["resumen", "entrenos", "comida", "feedback"].includes(tab);
  return `<div class="row between"><h1>${esc(c.name)} <small class="muted">· ${c.service ? esc(SERVICES[c.service]) : "Asesoría sin definir"}${c.startDate ? ` · Semana ${now.n}` : ""} · <span style="color:${phaseColor(applyStage(c).phase)}">${esc(applyStage(c).phase || "")}</span></small></h1>
  <button class="btn small" data-a="previewClient" data-id="${cid}">Ver como cliente</button></div>
  ${A.length || info.length ? `<div class="alertbar">${A.map((a) => chip(a, cid)).join("")}${info.map((a) => chip(a, cid)).join("")}</div>` : `<div class="alertbar"><span class="badge g">Todo al día ✓</span></div>`}
  <div class="row between">
  ${weekNav ? `<div class="row gap"><button class="btn small" data-a="cwShift" data-n="-1">‹</button><b>Semana ${w.n}</b> <span class="muted small">${fmtDate(w.first)} – ${fmtDate(w.last)}</span><button class="btn small" data-a="cwShift" data-n="1" ${w.n >= now.n ? "disabled" : ""}>›</button></div>` : "<span></span>"}</div>
  <nav class="ctabs">${TABS.filter(([k]) => !(k === "plan" && !has("plan_menus", c))).map(([k, l]) => `<a href="#coach/c/${cid}/${k}" class="${k === tab ? "on" : ""}">${k === "rutinas" && c.service === "nutricion" ? "Rutinas (las arma el cliente)" : l}</a>`).join("")}</nav>
  <div class="cbody">${await (views[tab] || tlView)(c, w)}</div>`;
}
act("cwShift", (el) => { CW.n += +el.dataset.n; refresh(); });

// ---------- Timeline semanal (equivalente a tu hoja Timeline)
async function tlView(c0, w) {
  const c = applyStage(c0, w.first);
  const prevW = weekInfo(c, addDays(w.first, -7));
  const [days, pdays, sessions, routines] = await Promise.all([getDays(w.first, w.last, c.id), getDays(prevW.first, prevW.last, c.id), getSessions(c.id), getRoutines(c.id)]);
  const plan = weekPlan(c, routines, sessions, w.first);
  const row = (d) => { const x = days[d] || {}, t = dayTotals(x), sl = sleepHours(x.sleep); return { d, x, t, sl, water: sum(x.water || [], (y) => y.ml), cardio: sum(x.cardio || [], (y) => y.min) }; };
  const R = w.days.map(row);
  const agg = (dd, f) => avg(dd.map(f).filter((v) => v != null && v !== 0));
  const pR = prevW.days.map((d) => { const x = pdays[d] || {}; return { x, t: dayTotals(x), sl: sleepHours(x.sleep) }; });
  const cmp = (a, b, dec = 1, neutral) => a == null || b == null ? "" : `<small class="${neutral ? "muted" : a - b > 0 ? "g" : "r"}">${a - b > 0 ? "+" : ""}${dec ? r1(a - b) : r0(a - b)}</small>`;
  const cell = (v, goal, fmt = r0, tol = 0.1) => v == null || v === 0 ? `<td class="muted">—</td>` : `<td class="${goal ? (Math.abs(v - goal) / goal <= tol ? "okc" : v < goal ? "lowc" : "hic") : ""}">${fmt(v)}</td>`;
  const lines = [
    ["Peso (kg)", (r) => r.x.weight, null, r1, (r) => r.x.weight],
    ["Calorías", (r) => r.t.kcal, c.kcal, r0, (r) => r.t.kcal],
    ["CHO (g)", (r) => r.t.cho, c.cho, r0, (r) => r.t.cho],
    ["Lípidos (g)", (r) => r.t.fat, c.fat, r0, (r) => r.t.fat],
    ["Proteína (g)", (r) => r.t.prot, c.prot, r0, (r) => r.t.prot],
    ["Pasos", (r) => r.x.steps, c.steps, (v) => r0(v).toLocaleString("es-CL"), (r) => r.x.steps],
    ["Agua (ml)", (r) => r.water, c.water, r0, (r) => sum(r.x.water || [], (y) => y.ml)],
    ["Sueño (h)", (r) => r.sl, c.sleep, r1, (r) => r.sl],
    ["Cardio (min)", (r) => r.cardio, null, r0, (r) => sum(r.x.cardio || [], (y) => y.min)]
  ];
  return `<div class="card"><div class="card-t">Etapa de esta semana: <span style="color:${phaseColor(c.phase)}">${esc(c.phase || "—")}</span></div>${stagesBar(c0, w.n)}</div><div class="grid-cards">
  <div class="card"><div class="card-t">Entrenamientos</div><div class="big">${plan.doneCount}/${plan.planned.length}</div>${plan.slots.filter((s) => !s.rest).map((s) => `<div class="small"><span class="badge ${s.status}">${s.status}</span> ${esc(s.name)} · ${fmtDate(s.date)}</div>`).join("")}</div>
  <div class="card"><div class="card-t">Peso promedio</div><div class="big">${r1(agg(R, (r) => r.x.weight)) || "—"} kg</div>${cmp(agg(R, (r) => r.x.weight), agg(pR, (r) => r.x.weight), 1, true)} <small class="muted">vs semana anterior</small></div>
  <div class="card"><div class="card-t">Adherencia de registro</div><div class="small">Comida: <b>${R.filter((r) => Object.values(r.x.meals || {}).some((m) => m.length)).length}/7</b> · Peso: <b>${R.filter((r) => r.x.weight).length}/7</b> · Sueño: <b>${R.filter((r) => r.sl).length}/7</b> · Pasos: <b>${R.filter((r) => r.x.steps).length}/7</b></div></div>
  </div>
  <div class="card scroll-x"><table class="tbl tl"><tr><th></th>${R.map((r) => `<th>${fmtDate(r.d)}</th>`).join("")}<th>Promedio</th><th>Objetivo</th><th>vs sem. ant.</th></tr>
  ${lines.map(([l, f, goal, fmt, pf]) => { const a = agg(R, f), pa = agg(pR, pf); return `<tr><td><b>${l}</b></td>${R.map((r) => cell(f(r), goal, fmt)).join("")}<td><b>${a != null ? fmt(a) : "—"}</b></td><td class="muted">${goal ? fmt(goal) : ""}</td><td>${cmp(a, pa, l.startsWith("Peso") || l.startsWith("Sueño"), l.startsWith("Peso"))}</td></tr>`; }).join("")}
  <tr><td><b>Peso en ayunas</b></td>${R.map((r) => `<td>${r.x.weight ? (r.x.weightFast === false ? '<span class="r">No</span>' : '<span class="g">Sí</span>') : "—"}</td>`).join("")}<td colspan="3"></td></tr>
  <tr><td><b>Peso después del baño</b></td>${R.map((r) => `<td>${r.x.weight && r.x.weightBath != null ? (r.x.weightBath ? '<span class="g">Sí</span>' : '<span class="r">No</span>') : "—"}</td>`).join("")}<td colspan="3"></td></tr>
  <tr><td><b>Calidad sueño</b></td>${R.map((r) => `<td>${r.x.sleep?.quality || "—"}</td>`).join("")}<td colspan="3"></td></tr>
  </table><div class="legend small"><span><i class="okc"></i>±10% del objetivo</span><span><i class="lowc"></i>bajo</span><span><i class="hic"></i>sobre</span></div></div>
  <div class="card"><div class="card-t">Timeline por semanas (como en la planilla)</div>${weeksTable(c0, await getDays(c0.startDate || addDays(ymd(), -120), ymd(), c0.id), routines, sessions)}</div>`;
}

// ---------- Entrenamientos de la semana
async function sessionsView(c, w) {
  const all = await getSessions(c.id);
  const list = all.filter((s) => s.weekKey === w.key && s.status === "fin").sort((a, b) => a.startedAt - b.startedAt);
  const [exnotes, audios] = await Promise.all([db.list(`clients/${c.id}/exnotes`), db.list(`clients/${c.id}/audios`)]);
  if (!list.length) return `<p class="muted">Sin entrenamientos registrados esta semana.</p>`;
  return list.map((s) => {
    const prev = prevSession(all, s), sv = s.survey || {};
    return `<div class="card"><div class="row between"><h3>${esc(s.routineName)} <small class="muted">${fmtDate(s.date, true)} · ${s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) + " min" : ""}</small></h3>
    <div class="row gap small">${sv.intensidad ?? sv.dureza ? `<span class="pill">Intensidad ${sv.intensidad ?? sv.dureza}/10</span>` : ""}${sv.fuerza ? `<span class="pill">Fuerza ${sv.fuerza}/5</span>` : ""}${sv.energia ? `<span class="pill">Energía ${sv.energia}/5</span>` : ""}${sv.doms ? `<span class="pill">DOMS ${sv.doms}/5</span>` : ""}${sv.general ? `<span class="pill">General ${sv.general}/5</span>` : ""}${sv.articular === "si" ? `<span class="badge r">Molestia articular: ${esc(sv.articularDet || "")}</span>` : ""}${sv.orden === "no" ? `<span class="badge y">No siguió el orden</span>` : ""}</div></div>
    ${s.comment ? `<div class="note">💬 ${esc(s.comment)}</div>` : ""}
    ${audios.find((a) => a.id === s.id)?.data ? `<div class="note">🎙️ Audio del cliente (${audios.find((a) => a.id === s.id).secs || "?"} s)<br><audio controls src="${audios.find((a) => a.id === s.id).data}"></audio></div>` : ""}
    <table class="tbl"><tr><th>Ejercicio</th><th>Serie</th><th>Esta semana</th><th>Semana anterior</th><th>Δ</th><th>Nota</th></tr>
    ${s.exercises.map((e) => e.sets.map((x, j) => { const ref = refSet(prev, e.exId, j); const dw = ref && x.w !== "" && ref.w !== "" ? r1(x.w - ref.w) : null, dr = ref && x.r !== "" && ref.r !== "" ? x.r - ref.r : null;
      return `<tr class="${e.extra ? "extra-row" : ""}">${j === 0 ? `<td rowspan="${e.sets.length}"><b>${esc(e.name)}</b>${e.extra ? ' <span class="badge extra">Extra</span>' : ""}${e.replaced ? `<br><small class="muted">reemplazó a ${esc(e.replacedFrom)}</small>` : ""}${e.tech ? `<br><span class="badge tech-${e.tech}">Técnica ${e.tech}</span>` : ""}${exnotes.find((n) => n.id === e.exId)?.text ? `<br><small class="muted">⚙ ${esc(exnotes.find((n) => n.id === e.exId).text)}</small>` : ""}</td>` : ""}
      <td>${j + 1}${e.target?.[j] ? `<br><small class="muted">plan ${esc(e.target[j].reps)}${e.target[j].rir !== "" && e.target[j].rir != null ? "@" + e.target[j].rir : ""}</small>` : ""}</td><td><b>${x.w || "–"} × ${x.r || "–"}</b>${x.rir !== "" ? ` RIR ${x.rir}` : ""}${x.tech ? ` <span class="badge tech-${x.tech}">téc. ${x.tech}</span>` : ""}</td><td class="muted">${ref ? `${ref.w}×${ref.r}${ref.rir !== "" ? " RIR " + ref.rir : ""}` : "—"}</td>
      <td>${(() => { const pg = setProgress(x, ref); return pg ? `<span class="prog ${pg.k}">${pg.k === "up" ? "▲" : pg.k === "down" ? "▼" : pg.k === "bad" ? "⚠" : "•"} ${pg.t}</span>` : ""; })()}</td><td class="small">${esc(x.note || "")}</td></tr>`; }).join("")).join("")}</table></div>`;
  }).join("");
}

// ---------- Rutinas (editor)
let RE = null; // rutina en edición
async function routinesView(c) {
  const routines = await getRoutines(c.id), lib = (await db.get("library/exercises"))?.items || [];
  const sched = c.schedule || {};
  const ed = RE && RE.cid === c.id ? RE.r : null;
  return `<div class="card"><div class="card-t">Calendario semanal (qué rutina toca cada día)</div><div class="sched">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label>${DAYS[d]}<select data-a-change="schedSet" data-d="${d}"><option value="">Descanso</option>${routines.map((r) => `<option value="${r.id}" ${sched[d] === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`).join("")}</div>
  <div class="row gap"><label>Cardio: veces/semana<input type="number" value="${c.cardio?.perWeek || ""}" data-a-change="cardioSet" data-k="perWeek"></label><label>Tipo<input value="${esc(c.cardio?.type || "")}" data-a-change="cardioSet" data-k="type"></label><label>Minutos<input type="number" value="${c.cardio?.minutes || ""}" data-a-change="cardioSet" data-k="minutes"></label><label>Intensidad<input value="${esc(c.cardio?.intensity || "")}" data-a-change="cardioSet" data-k="intensity"></label></div>
  <div class="row gap small">Días sugeridos de cardio: ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="ck"><input type="checkbox" ${(c.cardio?.days || []).includes(d) ? "checked" : ""} data-a-change="cardioDay" data-d="${d}">${DAYS[d].slice(0, 3)}</label>`).join("")}</div></div>
  <div class="row gap"><div class="routine-list">${routines.map((r) => `<button class="btn ${ed?.id === r.id ? "primary" : ""}" data-a="rEdit" data-id="${r.id}">${esc(r.name)}</button>`).join("")}<button class="btn ghost" data-a="rNew">＋ Nueva rutina</button></div></div>
  ${ed ? routineEditor(ed, lib) : `<p class="muted">Elige una rutina para editarla.</p>`}
  <datalist id="exlib">${lib.map((e) => `<option value="${esc(e.name)}">`).join("")}</datalist>`;
}
act("schedSet", async (el) => { const c = await getClient(CW.cid); await db.set("clients/" + CW.cid, { schedule: { ...(c.schedule || {}), [el.dataset.d]: el.value || null } }); toast("Calendario guardado"); });
act("cardioSet", async (el) => { const c = await getClient(CW.cid); await db.set("clients/" + CW.cid, { cardio: { ...(c.cardio || {}), [el.dataset.k]: el.type === "number" ? num(el.value) : el.value } }); toast("Guardado"); });
act("cardioDay", async (el) => { const c = await getClient(CW.cid); const s = new Set(c.cardio?.days || []); el.checked ? s.add(+el.dataset.d) : s.delete(+el.dataset.d); await db.set("clients/" + CW.cid, { cardio: { ...(c.cardio || {}), days: [...s] } }); });
act("rEdit", async (el) => { const r = await db.get(`clients/${CW.cid}/routines/${el.dataset.id}`); RE = { cid: CW.cid, r: { id: el.dataset.id, ...r }, orig: JSON.stringify(r.exercises || []) }; refresh(); });
act("rNew", () => { RE = { cid: CW.cid, r: { id: uid(), name: "Nueva rutina", exercises: [], isNew: true }, orig: "[]" }; refresh(); });
function routineEditor(r, lib) {
  return `<div class="card"><div class="row gap"><input class="h-in" value="${esc(r.name)}" data-a-change="rName" placeholder="Nombre de la rutina"><button class="btn primary" data-a="rSave">Guardar cambios</button><button class="btn ghost" data-a="rDup">Duplicar</button><button class="btn danger" data-a="rDel">Eliminar</button></div>
  <p class="muted small">Series: escribe una por línea o separadas por coma, con formato <b>reps@RIR</b>. Ej: <code>8@1, 6@0</code> o <code>6-8@1, 6-8@1</code>.</p>
  ${r.exercises.map((e, k) => `<div class="exed"><div class="row gap"><b>${k + 1}</b><input class="grow" list="exlib" value="${esc(e.name)}" data-a-change="exF" data-k="${k}" data-f="name" placeholder="Ejercicio">
    <input value="${esc((e.sets || []).map((s) => s.reps + (s.rir !== "" && s.rir != null ? "@" + s.rir : "")).join(", "))}" data-a-change="exF" data-k="${k}" data-f="sets" placeholder="8@1, 6@0" style="width:150px">
    <input type="number" value="${e.rest || ""}" data-a-change="exF" data-k="${k}" data-f="rest" placeholder="Desc. s" style="width:80px" title="Descanso (segundos)">
    <input type="number" step="0.5" value="${e.inc || ""}" data-a-change="exF" data-k="${k}" data-f="inc" placeholder="Salto kg" style="width:80px" title="Salto de carga disponible (kg)">
    <button class="icon-btn" data-a="exMove" data-k="${k}" data-n="-1">↑</button><button class="icon-btn" data-a="exMove" data-k="${k}" data-n="1">↓</button><button class="icon-btn" data-a="exDel" data-k="${k}">✕</button></div>
    <div class="row gap"><input class="grow" value="${esc(e.video || "")}" data-a-change="exF" data-k="${k}" data-f="video" placeholder="Link del video (YouTube no listado)"><input class="grow" value="${esc(e.notes || "")}" data-a-change="exF" data-k="${k}" data-f="notes" placeholder="Indicaciones para el cliente"></div>
    <div class="row gap"><input class="grow" value="${esc((e.alts || []).map((a) => a.name + (a.video ? " | " + a.video : "")).join("; "))}" data-a-change="exF" data-k="${k}" data-f="alts" placeholder="Reemplazos: Nombre | link; Nombre | link"></div></div>`).join("")}
  <button class="btn" data-a="exAdd">＋ Añadir ejercicio</button></div>`;
}
const parseSets = (s) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).map((x) => { const [reps, rir] = x.split("@"); return { reps: reps.trim(), rir: rir == null ? "" : rir.trim() === "F" ? "F" : +rir }; });
act("rName", (el) => (RE.r.name = el.value));
act("exF", async (el) => {
  const e = RE.r.exercises[+el.dataset.k], f = el.dataset.f;
  if (f === "sets") e.sets = parseSets(el.value);
  else if (f === "alts") e.alts = el.value.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const [name, video] = x.split("|").map((y) => y.trim()); return { name, video: video || "" }; });
  else if (f === "rest" || f === "inc") e[f] = num(el.value);
  else e[f] = el.value;
  if (f === "name") { const lib = (await db.get("library/exercises"))?.items || []; const l = lib.find((x) => x.name === el.value); if (l) { e.video = e.video || l.video || ""; e.alts = e.alts?.length ? e.alts : l.alts || []; e.inc = e.inc || l.inc; e.libId = l.id; refresh(); } }
});
act("exAdd", () => { RE.r.exercises.push({ id: uid(), name: "", sets: [{ reps: "8", rir: 1 }, { reps: "8", rir: 1 }], alts: [] }); refresh(); });
act("exDel", (el) => { RE.r.exercises.splice(+el.dataset.k, 1); refresh(); });
act("exMove", (el) => { const a = RE.r.exercises, k = +el.dataset.k, n = k + +el.dataset.n; if (n < 0 || n >= a.length) return; [a[k], a[n]] = [a[n], a[k]]; refresh(); });
act("rSave", async () => {
  const c = await getClient(CW.cid), w = weekInfo(c, ymd());
  const old = JSON.parse(RE.orig), r = RE.r, list = [];
  const fmtS = (s) => (s || []).map((x) => x.reps + (x.rir !== "" ? "@" + x.rir : "")).join(", ");
  if (!r.isNew) {
    r.exercises.forEach((e, k) => {
      const o = old.find((x) => x.id === e.id); e.changed = false;
      if (!o) { list.push(`Nuevo ejercicio: ${e.name}`); e.changed = true; return; }
      if (o.name !== e.name) { list.push(`${o.name} → ${e.name}`); e.changed = true; }
      if (fmtS(o.sets) !== fmtS(e.sets)) { list.push(`${e.name}: series ${fmtS(o.sets)} → ${fmtS(e.sets)}`); e.changed = true; }
      if (old.indexOf(o) !== k) { list.push(`${e.name}: cambió de orden`); e.changed = true; }
    });
    old.filter((o) => !r.exercises.find((e) => e.id === o.id)).forEach((o) => list.push(`Se quitó: ${o.name}`));
  }
  const prevCh = r.changes?.week === w.key ? r.changes.list : [];
  const data = { name: r.name, exercises: r.exercises, order: r.order ?? 0, updatedAt: Date.now() };
  if (list.length) data.changes = { week: w.key, list: [...prevCh, ...list], at: Date.now() };
  await db.set(`clients/${CW.cid}/routines/${r.id}`, data);
  RE.orig = JSON.stringify(r.exercises); r.isNew = false;
  toast(list.length ? `Guardado · ${list.length} cambio(s) marcados para el cliente` : "Guardado"); refresh();
});
act("rDup", async () => { const id = uid(); await db.set(`clients/${CW.cid}/routines/${id}`, { name: RE.r.name + " (copia)", exercises: RE.r.exercises.map((e) => ({ ...e, id: uid(), changed: false })) }); toast("Duplicada"); refresh(); });
act("rDel", async () => { if (!(await confirmBox("¿Eliminar la rutina " + RE.r.name + "? Los entrenamientos ya registrados se mantienen."))) return; await db.del(`clients/${CW.cid}/routines/${RE.r.id}`); RE = null; refresh(); });

// ---------- Alimentación de la semana
async function foodView(c, w) {
  const days = await getDays(w.first, w.last, c.id);
  const photos = (await db.list(`clients/${c.id}/photos`)).filter((p) => p.kind === "comida" && p.week === w.key);
  return w.days.map((d) => {
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
  return `<div class="card"><div class="card-t">Peso (120 días)</div>${lineChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), [{ vals, color: "var(--muted)", dots: true, w: 1 }, { vals: trend(vals), color: "var(--acc)" }], { h: 240, unit: " kg" })}</div>
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
  return head + list.map((ci, k) => `<details class="card ci-view" ${k === 0 ? "open" : ""}><summary class="row between"><h3>Semana ${+ci.id.slice(1)} <small class="muted">${ci.date ? fmtDate(ci.date) : ""}</small> ${ans(ci.id) ? '<span class="badge g">Respondido ✓</span>' : '<span class="badge r">Sin responder</span>'}</h3><span class="row gap small"><span class="muted">Días con registro de comida: ${ci.diasRegistrados ?? "—"}/7</span>${ans(ci.id) ? "" : `<button class="btn tiny primary" data-a="ciAnswer" data-n="${+ci.id.slice(1)}">Responder</button><button class="btn tiny" data-a="ciMark" data-w="${ci.id}">Marcar respondido</button>`}</span></summary>
  <div class="grid3">${CHECKIN.map((sec) => { const qs = sec.q.filter(([key]) => ci[key] != null && ci[key] !== "" && !(Array.isArray(ci[key]) && !ci[key].length)); if (!qs.length) return ""; return `<div><h4>${esc(sec.t)}</h4>${qs.map(([key, label]) => `<div class="qa"><span class="muted">${esc(label)}</span><b>${esc(v(ci[key]))}${ci[key + "Det"] ? ` · ${esc(ci[key + "Det"])}` : ""}</b></div>`).join("")}</div>`; }).join("")}
  ${ci.ciclo ? `<div><h4>Ciclo</h4><div class="qa"><span class="muted">En ciclo menstrual</span><b>${esc(ci.ciclo)}</b></div></div>` : ""}</div></details>`).join("");
}

act("ciAnswer", (el) => { CW.n = +el.dataset.n; go(`coach/c/${CW.cid}/feedback`); });
act("ciMark", async (el) => { await db.set(`clients/${CW.cid}/feedbacks/${el.dataset.w}`, { answered: true, answeredAt: Date.now() }); resetAlerts(); toast("Marcado como respondido"); refresh(); });
// ---------- Retroalimentación semanal
async function feedbackView(c, w) {
  const fb = c.feedback?.week === w.key ? c.feedback : (await db.get(`clients/${c.id}/feedbacks/${w.key}`)) || {};
  return `<div class="card"><div class="card-t">Retroalimentación · Semana ${w.n}</div><p class="muted small">Aparece como mensaje grande en la pantalla de inicio del cliente durante esa semana.</p>
  <label>Link del video (YouTube no listado, Drive, Loom…)<input id="fbV" value="${esc(fb.videoUrl || "")}"></label>
  <label>Puntos clave (uno por línea)<textarea id="fbP" rows="5">${esc((fb.points || []).join("\n"))}</textarea></label>
  <label>Mensaje (opcional)<textarea id="fbT" rows="3">${esc(fb.text || "")}</textarea></label>
  <label>Metas de la semana (una por línea)<textarea id="fbG" rows="3">${esc((c.weeklyGoals || []).join("\n"))}</textarea></label>
  <button class="btn primary" data-a="fbSave" data-w="${w.key}">Publicar al cliente</button></div>`;
}
act("fbSave", async (el) => {
  const fb = { week: el.dataset.w, videoUrl: $("#fbV").value.trim(), points: $("#fbP").value.split("\n").map((x) => x.trim()).filter(Boolean), text: $("#fbT").value.trim(), at: Date.now() };
  await db.set(`clients/${CW.cid}/feedbacks/${fb.week}`, { ...fb, answered: true });
  resetAlerts();
  await db.set("clients/" + CW.cid, { feedback: fb, weeklyGoals: $("#fbG").value.split("\n").map((x) => x.trim()).filter(Boolean) });
  toast("Publicado ✓");
});

// ---------- Datos y objetivos
async function dataView(c) {
  const f = (k, l, type = "text", extra = "") => `<label>${l}<input name="${k}" type="${type}" value="${esc(c[k] ?? "")}" ${extra}></label>`;
  const acc = c.email ? await db.get("access/" + emailKey(c.email)).catch(() => null) : null;
  const legacy = !!(await db.get("users/" + c.id).catch(() => null)); // cuenta creada con el sistema antiguo
  return `<div class="card acc"><div class="card-t">Acceso a la app</div>
  ${c.example ? `<p class="small muted">Cliente de ejemplo: no tiene cuenta. Míralo con “Ver como cliente”.</p>` : legacy ? `<p class="small"><span class="badge g">Cuenta activa</span> (creada con el sistema anterior).</p>` : !c.email ? `<p class="small"><span class="badge y">Falta su correo</span> Anótalo abajo y guarda.</p>`
    : `<p class="small">${acc?.ok ? '<span class="badge g">Con acceso</span> Puede crear su cuenta y entrar con su correo.' : '<span class="badge">Sin acceso</span> Si crea su cuenta, verá un mensaje de que aún no le das acceso.'}</p>
    <div class="row gap">${acc?.ok ? `<button class="btn" data-a="accSet" data-v="0">Quitar acceso</button><button class="btn primary" data-a="copyInvite">Copiar invitación para WhatsApp</button>` : `<button class="btn primary" data-a="accSet" data-v="1">Dar acceso</button>`}</div>`}</div>
  <form class="card" id="dataF"><div class="card-t">Asesoría</div><div class="grid3">
  <label>Tipo de asesoría<select name="service"><option value="">— Definir —</option>${Object.entries(SERVICES).map(([k, l]) => `<option value="${k}" ${c.service === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  ${f("modalidad", "Modalidad (ej: Liviana, Completa)")}
  <label>Día de check-in<select name="checkinDay"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${c.checkinDay !== "" && c.checkinDay != null && +c.checkinDay === d ? "selected" : ""}>${DAYS[d]}</option>`).join("")}</select></label>
  <label class="chkrow"><input type="checkbox" name="checkinForm" ${c.checkinForm ? "checked" : ""}> Hace el check-in por Google Forms</label>
  ${f("endDate", "Fin del servicio (si tiene)", "date")}${f("city", "Ciudad / país (zona horaria)")}
  <label class="span2">Planilla anterior (link)<input name="sheetUrl" value="${esc(c.sheetUrl || "")}"></label>${c.sheetUrl ? `<a class="btn small" target="_blank" href="${esc(c.sheetUrl)}">Abrir planilla</a>` : ""}</div>
  <label>Pendientes (uno por línea · empieza con <b>!</b> si es urgente) — aparecen en amarillo o rojo<textarea name="todo" rows="3">${esc((c.todo || []).join("\n"))}</textarea></label>
  <label>Notas internas (solo las ves tú)<textarea name="notes" rows="3">${esc(c.notes || "")}</textarea></label>
  <div class="card-t mt">Información personal</div><div class="grid3">
  ${f("name", "Nombre")}${f("email", "Correo (con el que crea su cuenta)", "email", legacy ? "readonly" : "")}${f("birth", "Fecha de nacimiento", "date")}
  <label>Sexo<select name="sex"><option value="">—</option><option value="M" ${c.sex === "M" ? "selected" : ""}>Masculino</option><option value="F" ${c.sex === "F" ? "selected" : ""}>Femenino</option></select></label>
  ${f("height", "Estatura (cm)", "number")}${f("startDate", "Inicio de la asesoría (define el inicio de cada semana)", "date")}${f("goal", "Objetivo")}</div>
  <div class="card-t mt">Etapa y objetivos diarios</div><div class="grid3">
  <label>Etapa (si no hay etapas definidas)<select name="phase">${Object.keys(PHASES).map((p) => `<option ${c.phase === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
  ${f("kcal", "Calorías", "number")}${f("cho", "CHO (g)", "number")}${f("fat", "Lípidos (g)", "number")}${f("prot", "Proteína (g)", "number")}
  ${f("steps", "Pasos", "number")}${f("water", "Agua (ml)", "number")}${f("sleep", "Sueño (h)", "number", 'step="0.5"')}${f("rest", "Descanso entre series por defecto (s)", "number")}</div>
  <p class="muted small">Agua sugerida según peso (35 ml/kg): <b id="wSug">—</b> <button type="button" class="btn tiny" data-a="waterSug">Usar</button></p>
  <div class="card-t mt">Plan de alimentación</div>${`<label>Link al PDF del plan (Drive)<input name="planUrl" value="${esc(c.plan?.pdfUrl || "")}"></label><label>Notas del plan<textarea name="planNotes" rows="3">${esc(c.plan?.notes || "")}</textarea></label>`}
  ${c.service === "entrenamiento" ? `<div class="card-t mt">Guía de macros (solo entrenamiento · el cliente ve rangos en vez de un plan)</div><p class="muted small">Gramos por kg de peso. Si dejas en blanco calorías y macros de arriba, su meta diaria es el punto medio de estos rangos.</p>
  <div class="grid3">${[["prot", "Proteína"], ["cho", "Carbohidratos"], ["fat", "Grasas"]].map(([k, l]) => { const v = c.ranges?.[k] || DEFAULT_RANGES[k]; return `<label>${l} (g/kg)<span class="row gap"><input type="number" step="0.1" data-rng="${k}" data-i="0" value="${v[0]}"><span>a</span><input type="number" step="0.1" data-rng="${k}" data-i="1" value="${v[1]}"></span></label>`; }).join("")}</div>` : ""}
  <details><summary class="card-t">Pauta por porciones (opcional · descuenta porciones al registrar)</summary><div class="grid4">${Object.entries(GROUPS).filter(([, g]) => g[4]).map(([g]) => `<label>${g}<input type="number" step="0.5" data-pauta="${esc(g)}" value="${c.pauta?.[g] ?? ""}"></label>`).join("")}</div></details>
  <div class="card-t mt">Fechas de interés (una por línea: AAAA-MM-DD Texto)</div><textarea name="dates" rows="3">${esc((c.dates || []).map((d) => d.date + " " + d.label).join("\n"))}</textarea>
  <div class="row gap mt"><button type="button" class="btn primary" data-a="dataSave">Guardar</button><button type="button" class="btn danger ghost" data-a="archive">Archivar cliente</button></div></form>`;
}
document.addEventListener("rendered", async () => {
  const el = $("#wSug"); if (!el || !CW) return;
  const days = await getDays(addDays(ymd(), -14), ymd(), CW.cid); const w = Object.values(days).map((d) => d.weight).filter(Boolean).pop();
  el.textContent = w ? Math.round((w * 35) / 100) * 100 + " ml" : "sin pesajes"; el.dataset.v = w ? Math.round((w * 35) / 100) * 100 : "";
});
act("waterSug", () => { const v = $("#wSug").dataset.v; if (v) $('#dataF [name="water"]').value = v; });
act("dataSave", async () => {
  const fd = Object.fromEntries(new FormData($("#dataF")));
  const n = ["height", "kcal", "cho", "fat", "prot", "steps", "water", "sleep", "rest", "checkinDay"];
  const data = {};
  for (const [k, v] of Object.entries(fd)) if (!["planUrl", "planNotes", "dates", "email", "todo", "checkinForm"].includes(k)) data[k] = n.includes(k) ? num(v) : v;
  data.checkinForm = !!fd.checkinForm;
  data.todo = (fd.todo || "").split("\n").map((x) => x.trim()).filter(Boolean);
  // Correo: mueve su permiso de acceso al correo nuevo
  const old = await getClient(CW.cid), ne = emailKey(fd.email), oe = emailKey(old.email);
  if (fd.email !== undefined && ne !== oe) {
    const acc = oe ? await db.get("access/" + oe) : null;
    if (oe) await db.del("access/" + oe);
    if (ne) await db.set("access/" + ne, { cid: CW.cid, name: fd.name, ok: !!acc?.ok, at: Date.now() });
    data.email = ne;
  }
  data.plan = { pdfUrl: fd.planUrl, notes: fd.planNotes };
  data.dates = fd.dates.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ date: l.slice(0, 10), label: l.slice(11) }));
  data.pauta = {}; $$("[data-pauta]").forEach((i) => { if (i.value !== "") data.pauta[i.dataset.pauta] = num(i.value); });
  if ($("[data-rng]")) { data.ranges = {}; $$("[data-rng]").forEach((i) => { (data.ranges[i.dataset.rng] ||= [null, null])[+i.dataset.i] = num(i.value); }); }
  await db.set("clients/" + CW.cid, data); resetAlerts(); toast("Guardado ✓"); refresh();
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
  ${Object.entries(SERVICES).map(([k, l]) => `<button class="btn big" data-a="exampleMake" data-s="${k}">${k === "completa" ? "Asesoría 1-1 (todo)" : l}</button>`).join("")}`));
act("exampleMake", async (el) => {
  const sv = el.dataset.s, label = { completa: "Ejemplo · Asesoría 1-1", entrenamiento: "Ejemplo · Solo entrenamiento", nutricion: "Ejemplo · Solo nutrición" }[sv];
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
  const obCard = `<div class="card"><div class="card-t">Bienvenida (onboarding de clientes nuevos)</div><p class="muted small">Se abre sola la primera vez que el cliente entra: tu video, tu mensaje y 5–6 pantallas cortas que explican la app según su tipo de asesoría (su servicio, instalar y activar avisos, registrar, entrenar, check-in). Queda en Más → “Bienvenida a IMA” para volver a verla.</p>
  <label>Video de bienvenida (YouTube no listado)<input id="obV" value="${esc(ob.videoUrl || "")}" placeholder="https://youtu.be/…"></label>
  <label>Mensaje de bienvenida<textarea id="obT" rows="3" placeholder="Esta es tu app de asesoría…">${esc(ob.text || "")}</textarea></label>
  <label>Link al manual de uso (opcional)<input id="obM" value="${esc(ob.manualUrl || "")}"></label>
  <div class="row gap"><button class="btn primary" data-a="obSave">Guardar</button><button class="btn" data-a="obOpen">Ver cómo se ve</button></div></div>`;
  return `<h1>Biblioteca</h1>${obCard}${svcTable}
  <div class="card"><div class="card-t">Base de ejercicios (${ex.length})</div><p class="muted small">Al escribir un ejercicio en una rutina, se completan solos su video, reemplazos y salto de carga.</p>
  <table class="tbl"><tr><th>Ejercicio</th><th>Grupo / patrón</th><th>Video</th><th>Salto (kg)</th><th>Reemplazos (Nombre | link; …)</th><th>Tips (los ven tus clientes de nutrición)</th><th></th></tr>
  ${ex.map((e, k) => `<tr><td><input value="${esc(e.name)}" data-a-change="libEx" data-k="${k}" data-f="name"></td><td><input value="${esc(e.group || "")}" data-a-change="libEx" data-k="${k}" data-f="group"></td><td><input value="${esc(e.video || "")}" data-a-change="libEx" data-k="${k}" data-f="video"></td><td><input type="number" step="0.5" value="${e.inc || ""}" data-a-change="libEx" data-k="${k}" data-f="inc" style="width:70px"></td><td><input value="${esc((e.alts || []).map((a) => a.name + (a.video ? " | " + a.video : "")).join("; "))}" data-a-change="libEx" data-k="${k}" data-f="alts"></td><td><textarea rows="1" data-a-change="libEx" data-k="${k}" data-f="tips">${esc(e.tips || "")}</textarea></td><td><button class="icon-btn" data-a="libExDel" data-k="${k}">✕</button></td></tr>`).join("")}</table>
  <button class="btn" data-a="libExAdd">＋ Ejercicio</button></div>
  <div class="card"><div class="card-t">Guías para clientes</div>${gd.map((g, k) => `<div class="row gap"><input value="${esc(g.title)}" data-a-change="libG" data-k="${k}" data-f="title" placeholder="Título"><input class="grow" value="${esc(g.url)}" data-a-change="libG" data-k="${k}" data-f="url" placeholder="Link (PDF en Drive)"><input class="grow" value="${esc(g.desc || "")}" data-a-change="libG" data-k="${k}" data-f="desc" placeholder="Descripción"><button class="icon-btn" data-a="libGDel" data-k="${k}">✕</button></div>`).join("")}<button class="btn" data-a="libGAdd">＋ Guía</button></div>
  <div class="card"><div class="card-t">Base de alimentos para el registro</div><p class="muted small">El registro usa el <b>aporte real por 100 g</b>: 600 alimentos de la <b>Tabla de Composición de Alimentos INTA 2018</b> (lo que no trae, del USDA), más 5.076 productos envasados chilenos verificados de Open Food Facts y los que escaneen o creen tus clientes. Cada alimento tiene su grupo de intercambio, así igual se descuentan porciones de la pauta.${fd?.items?.length ? ` Además tienes ${fd.items.length} alimentos propios agregados.` : ""}</p>
  <p class="muted small">Para agregar alimentos propios o <b>corregir uno de la base</b> (si usas exactamente el mismo nombre, tu versión reemplaza a la de la base), sube un CSV con columnas: <b>Alimento, Grupo, Kcal, CHO, Lipidos, Proteina</b> (por 100 g) y opcionalmente <b>Medida</b> y <b>Gramos</b> de la medida casera.</p>
  <label class="btn">Importar CSV<input type="file" accept=".csv,text/csv" hidden data-a-change="foodCsv"></label></div>`;
}
act("svcSet", async (el) => { const m = await loadMatrix(true); m[el.dataset.k] = { ...(m[el.dataset.k] || {}), [el.dataset.s]: el.checked }; await db.set("library/services", { matrix: m, at: Date.now() }, false); await loadMatrix(true); toast("Guardado"); refresh(); });
act("svcReset", async () => { if (!(await confirmBox("¿Volver a los valores de fábrica en todos los servicios?"))) return; await db.set("library/services", { matrix: {}, at: Date.now() }, false); await loadMatrix(true); refresh(); });
act("obSave", async () => { await db.set("library/onboarding", { videoUrl: $("#obV").value.trim(), text: $("#obT").value.trim(), manualUrl: $("#obM").value.trim(), at: Date.now() }, false); toast("Bienvenida guardada ✓"); });
const libSave = async (doc, items) => { await db.set("library/" + doc, { items }, false); };
act("libEx", async (el) => {
  const items = (await db.get("library/exercises"))?.items || [], e = items[+el.dataset.k], f = el.dataset.f;
  if (f === "alts") e.alts = el.value.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const [name, video] = x.split("|").map((y) => y.trim()); return { name, video: video || "" }; });
  else e[f] = f === "inc" ? num(el.value) : el.value;
  await libSave("exercises", items); toast("Guardado");
});
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


// ---------- Etapas nutricionales (calendario)
async function stagesView(c) {
  const st = [...(c.stages || [])].sort((a, b) => a.from - b.from);
  const now = weekInfo(c, ymd()).n;
  const inp = (k, i, v, w = 80, type = "number") => `<input type="${type}" data-a-change="stF" data-i="${i}" data-k="${k}" value="${esc(v ?? "")}" style="width:${w}px">`;
  return `<div class="card"><div class="card-t">Calendario nutricional · semana actual ${now}</div>${stagesBar(c, now)}</div>
  <div class="card"><p class="muted small">Define cada etapa por número de semana. Los bloques duran lo que necesiten; no hay descargas automáticas. Mientras dure una etapa, sus objetivos reemplazan a los de "Datos y objetivos" (deja en blanco lo que no cambie). El cliente lo ve en su Timeline y sus metas cambian solas al pasar de etapa.</p>
  <table class="tbl"><tr><th>Etapa</th><th>Desde sem.</th><th>Hasta sem.</th><th>Kcal</th><th>CHO</th><th>Lípidos</th><th>Proteína</th><th>Pasos</th><th>Agua (ml)</th><th>Ajuste del plan</th><th>Nota para el cliente</th><th></th></tr>
  ${st.map((x, i) => `<tr><td><div class="row"><span class="dotc" style="background:${phaseColor(x.phase)}"></span><select data-a-change="stF" data-i="${i}" data-k="phase">${Object.keys(PHASES).map((p) => `<option ${p === x.phase ? "selected" : ""}>${p}</option>`).join("")}</select></div></td>
    <td>${inp("from", i, x.from, 64)}</td><td>${inp("to", i, x.to, 64)}</td><td>${inp("kcal", i, x.kcal)}</td><td>${inp("cho", i, x.cho, 64)}</td><td>${inp("fat", i, x.fat, 64)}</td><td>${inp("prot", i, x.prot, 64)}</td><td>${inp("steps", i, x.steps, 80)}</td><td>${inp("water", i, x.water, 80)}</td>
    <td><button class="btn tiny" data-a="stAdj" data-i="${i}">${adjTxt(x.adj) ? esc(adjTxt(x.adj)) : "Sin cambios"}</button></td>
    <td>${inp("note", i, x.note, 220, "text")}</td><td><button class="icon-btn" data-a="stDel" data-i="${i}">✕</button></td></tr>`).join("")}</table>
  <button class="btn" data-a="stAdd">＋ Agregar etapa</button></div>`;
}
const stSave = async (fn) => { const c = await getClient(CW.cid); const st = [...(c.stages || [])].sort((a, b) => a.from - b.from); fn(st); await db.set("clients/" + CW.cid, { stages: st }); refresh(); };
act("stF", (el) => stSave((st) => { const k = el.dataset.k; st[+el.dataset.i][k] = ["phase", "note"].includes(k) ? el.value : num(el.value); }));
act("stAdj", async (el) => {
  const c = await getClient(CW.cid), st = [...(c.stages || [])].sort((a, b) => a.from - b.from), x = st[+el.dataset.i]; if (!x) return;
  const groups = Object.entries(GROUPS).filter(([, g]) => g[4]).map(([g]) => g);
  sheet(`Ajuste del plan · ${x.phase} (sem. ${x.from}–${x.to})`, `<p class="muted small">Porciones que sumas o restas a la pauta en esta etapa (ej. <b>-1</b> Cereales, <b>-0.5</b> Aceites y grasas). En el plan del cliente, los alimentos de ese grupo bajan su gramaje en la misma proporción. Si dejaste en blanco las calorías y macros de la etapa, se recalculan solas.</p>
  <div class="grid3">${groups.map((g) => `<label>${esc(g)}<small class="muted"> · pauta ${c.pauta?.[g] ?? 0}</small><input type="number" step="0.25" data-adj="${esc(g)}" value="${x.adj?.[g] ?? ""}" placeholder="0"></label>`).join("")}</div>
  <button class="btn primary big" data-a="stAdjOk" data-i="${el.dataset.i}">Guardar ajuste</button>`, { wide: true });
});
act("stAdjOk", (el) => { const adj = {}; $$("[data-adj]").forEach((i) => { if (num(i.value)) adj[i.dataset.adj] = num(i.value); }); closeSheet(); stSave((st) => { st[+el.dataset.i].adj = adj; }); });
act("stAdd", () => stSave((st) => { const last = st[st.length - 1]; const from = last ? +last.to + 1 : 1; st.push({ phase: "Mantención", from, to: from + 3 }); }));
act("stDel", async (el) => { if (await confirmBox("¿Eliminar esta etapa?")) stSave((st) => st.splice(+el.dataset.i, 1)); });
