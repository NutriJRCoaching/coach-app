import { LS } from "./util.js";
// Panel del coach (escritorio)
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, refresh, go } from "./state.js";
import { act, toast, sheet, closeSheet, confirmBox, promptBox, bar, lineChart, $, $$ } from "./ui.js";
import { esc, ymd, addDays, fmtDate, weekInfo, dayTotals, itemMacros, sleepHours, sleepColor, r0, r1, num, avg, sum, uid, trend, DAYS, embedUrl, pad } from "./util.js";
import { getDays, getRoutines, getSessions, getClient, weekPlan, prevSession, refSet, MEASURE_ZONES, PHOTO_TYPES, resetFoodCache, applyStage, stagesBar, phaseColor, PHASES, CHECKIN } from "./data.js";
import { weeksTable } from "./client.js";
import { GROUPS } from "./foods.js";

const TABS = [["resumen", "Timeline semanal"], ["etapas", "Etapas"], ["entrenos", "Entrenamientos"], ["rutinas", "Rutinas"], ["comida", "Alimentación"], ["progreso", "Progreso"], ["checkins", "Check-ins"], ["feedback", "Retroalimentación"], ["datos", "Datos y objetivos"]];
let CW = null; // semana que está viendo el coach

export async function coachView() {
  const [, sec, cid, tab] = S.route;
  const clients = (await db.list("clients")).filter((c) => !c.archived).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  let main;
  if (sec === "c" && cid) main = await clientPanel(cid, tab || "resumen");
  else if (sec === "lib") main = await library();
  else main = await overview(clients);
  return `<aside class="side"><div class="brand"><img src="icons/logo.png" class="logo-sm" alt="">${esc(CONFIG.appName)}</div>
  <a href="#coach" class="${!sec ? "on" : ""}">Clientes</a>
  ${clients.map((c) => `<a href="#coach/c/${c.id}/${tab || "resumen"}" class="sub ${cid === c.id ? "on" : ""}">${esc(c.name || "Sin nombre")}</a>`).join("")}
  <a href="#coach/lib" class="${sec === "lib" ? "on" : ""}">Biblioteca</a>
  <button class="btn small" data-a="asClient">Mi registro (vista cliente)</button>
  <button class="btn small" data-a="newClient">＋ Nuevo cliente</button>
  <div class="grow"></div>
  <button class="btn ghost small" data-a="theme" data-v="${(LS.get("theme") || "dark") === "dark" ? "light" : "dark"}">Tema ${(LS.get("theme") || "dark") === "dark" ? "claro" : "oscuro"}</button>
  <button class="btn ghost small" data-a="logout">Cerrar sesión</button>${DEMO ? `<small class="muted">MODO DEMO</small>` : ""}<p class="ver">v${CONFIG.appVersion}</p></aside>
  <section class="cpanel">${main}</section>`;
}

// ================================================================ RESUMEN GENERAL
async function overview(clients) {
  const today = ymd();
  const rows = await Promise.all(clients.map(async (c) => {
    const [routines, sessions, days, ci] = await Promise.all([getRoutines(c.id), getSessions(c.id), getDays(addDays(today, -6), today, c.id), db.list(`clients/${c.id}/checkins`)]);
    const plan = weekPlan(c, routines, sessions);
    const w = plan.week;
    const d7 = Object.values(days);
    const foodDays = d7.filter((d) => Object.values(d.meals || {}).some((m) => m.length)).length;
    const wDays = d7.filter((d) => d.weight).length;
    const lastCi = ci.sort((a, b) => b.id.localeCompare(a.id))[0];
    const alerts = [];
    const last = sessions.filter((s) => s.status === "fin" && s.weekKey === w.key);
    if (last.some((s) => s.survey?.articular === "si")) alerts.push("Molestia articular");
    if (last.some((s) => s.exercises.some((e) => e.tech === "peor" || e.sets.some((x) => x.tech === "peor")))) alerts.push("Técnica peor");
    if (last.some((s) => s.exercises.some((e) => e.extra))) alerts.push("Ejercicio extra");
    if (plan.slots.some((s) => s.status === "atrasado")) alerts.push("Entreno atrasado");
    return { c, w, plan, foodDays, wDays, lastCi, alerts };
  }));
  return `<h1>Clientes</h1><p class="muted">Últimos 7 días · ${fmtDate(today, true)}</p>
  <table class="tbl big"><tr><th>Cliente</th><th>Semana</th><th>Etapa</th><th>Entrenos</th><th>Días con comida</th><th>Pesajes</th><th>Último check-in</th><th>Alertas</th></tr>
  ${rows.map(({ c, w, plan, foodDays, wDays, lastCi, alerts }) => `<tr class="click" onclick="location.hash='coach/c/${c.id}/resumen'"><td><b>${esc(c.name)}</b></td><td>${w.n}</td><td><span class="dotc" style="background:${phaseColor(applyStage(c).phase)}"></span>${esc(applyStage(c).phase || "—")}</td>
    <td><span class="pill ${plan.doneCount >= plan.planned.length ? "g" : ""}">${plan.doneCount}/${plan.planned.length}</span></td>
    <td><span class="pill ${foodDays >= 5 ? "g" : foodDays >= 3 ? "y" : "r"}">${foodDays}/7</span></td><td><span class="pill ${wDays >= 5 ? "g" : wDays >= 3 ? "y" : "r"}">${wDays}/7</span></td>
    <td>${lastCi ? `Semana ${+lastCi.id.slice(1)}${lastCi.id === w.key ? " ✓" : ""}` : "—"}</td><td>${alerts.map((a) => `<span class="badge r">${a}</span>`).join(" ")}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">Aún no tienes clientes. Crea uno con “＋ Nuevo cliente”.</td></tr>`}</table>`;
}

act("newClient", () => sheet("Nuevo cliente", `<p class="muted small">Se crea la cuenta del cliente. Después le mandas el link de la app, su correo y la contraseña temporal.</p>
  <label>Nombre<input id="ncN"></label><label>Correo<input id="ncE" type="email"></label><label>Contraseña temporal<input id="ncP" value="${Math.random().toString(36).slice(2, 10)}"></label>
  <label>Fecha de inicio<input id="ncS" type="date" value="${ymd()}"></label><button class="btn primary big" data-a="newClientOk">Crear</button>`));
act("newClientOk", async () => {
  const name = $("#ncN").value.trim(), email = $("#ncE").value.trim(), pass = $("#ncP").value;
  if (!name || !email || pass.length < 6) return toast("Completa nombre, correo y una contraseña de 6+ caracteres");
  try {
    const id = await db.createClientAccount(email, pass, name);
    await db.set("clients/" + id, { name, email, startDate: $("#ncS").value, kcal: 2200, cho: 250, fat: 70, prot: 150, steps: 8000, water: 2500, sleep: 8, phase: "Mantención", schedule: {} });
    closeSheet();
    sheet("Cliente creado ✓", `<p>Envíale esto a ${esc(name)}:</p><div class="pre" id="inv">Hola ${esc(name.split(" ")[0])}! Esta es tu app de asesoría:\n${location.origin + location.pathname}\n\nCorreo: ${esc(email)}\nContraseña: ${esc(pass)}\n\nÁbrela en Chrome y toca "Agregar a la pantalla de inicio" para instalarla.</div><button class="btn primary" data-a="copyInv">Copiar mensaje</button>`);
    go(`coach/c/${id}/datos`);
  } catch (e) { toast("Error: " + (e.code || e.message)); }
});
act("copyInv", () => { navigator.clipboard.writeText($("#inv").innerText); toast("Copiado"); });

// ================================================================ PANEL DE UN CLIENTE
async function clientPanel(cid, tab) {
  const c = { id: cid, ...(await getClient(cid)) };
  const now = weekInfo(c, ymd());
  if (!CW || CW.cid !== cid) CW = { cid, n: now.n };
  const wDate = addDays(c.startDate || ymd(), (CW.n - 1) * 7);
  const w = weekInfo(c, wDate);
  const views = { resumen: tlView, etapas: stagesView, entrenos: sessionsView, rutinas: routinesView, comida: foodView, progreso: progView, checkins: checkinsView, feedback: feedbackView, datos: dataView };
  const weekNav = ["resumen", "entrenos", "comida", "feedback"].includes(tab);
  return `<div class="row between"><h1>${esc(c.name)} <small class="muted">· Semana ${now.n} · <span style="color:${phaseColor(applyStage(c).phase)}">${esc(applyStage(c).phase || "")}</span></small></h1>
  ${weekNav ? `<div class="row gap"><button class="btn small" data-a="cwShift" data-n="-1">‹</button><b>Semana ${w.n}</b> <span class="muted small">${fmtDate(w.first)} – ${fmtDate(w.last)}</span><button class="btn small" data-a="cwShift" data-n="1" ${w.n >= now.n ? "disabled" : ""}>›</button></div>` : ""}</div>
  <nav class="ctabs">${TABS.map(([k, l]) => `<a href="#coach/c/${cid}/${k}" class="${k === tab ? "on" : ""}">${l}</a>`).join("")}</nav>
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
  <tr><td><b>Calidad sueño</b></td>${R.map((r) => `<td>${r.x.sleep?.quality || "—"}</td>`).join("")}<td colspan="3"></td></tr>
  </table><div class="legend small"><span><i class="okc"></i>±10% del objetivo</span><span><i class="lowc"></i>bajo</span><span><i class="hic"></i>sobre</span></div></div>
  <div class="card"><div class="card-t">Timeline por semanas (como en la planilla)</div>${weeksTable(c0, await getDays(c0.startDate || addDays(ymd(), -120), ymd(), c0.id), routines, sessions)}</div>`;
}

// ---------- Entrenamientos de la semana
async function sessionsView(c, w) {
  const all = await getSessions(c.id);
  const list = all.filter((s) => s.weekKey === w.key && s.status === "fin").sort((a, b) => a.startedAt - b.startedAt);
  const exnotes = await db.list(`clients/${c.id}/exnotes`);
  if (!list.length) return `<p class="muted">Sin entrenamientos registrados esta semana.</p>`;
  return list.map((s) => {
    const prev = prevSession(all, s), sv = s.survey || {};
    return `<div class="card"><div class="row between"><h3>${esc(s.routineName)} <small class="muted">${fmtDate(s.date, true)} · ${s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) + " min" : ""}</small></h3>
    <div class="row gap small">${sv.intensidad ?? sv.dureza ? `<span class="pill">Intensidad ${sv.intensidad ?? sv.dureza}/10</span>` : ""}${sv.fuerza ? `<span class="pill">Fuerza ${sv.fuerza}/5</span>` : ""}${sv.energia ? `<span class="pill">Energía ${sv.energia}/5</span>` : ""}${sv.doms ? `<span class="pill">DOMS ${sv.doms}/5</span>` : ""}${sv.general ? `<span class="pill">General ${sv.general}/5</span>` : ""}${sv.articular === "si" ? `<span class="badge r">Molestia articular: ${esc(sv.articularDet || "")}</span>` : ""}${sv.orden === "no" ? `<span class="badge y">No siguió el orden</span>` : ""}</div></div>
    ${s.comment ? `<div class="note">💬 ${esc(s.comment)}</div>` : ""}
    <table class="tbl"><tr><th>Ejercicio</th><th>Serie</th><th>Esta semana</th><th>Semana anterior</th><th>Δ</th><th>Nota</th></tr>
    ${s.exercises.map((e) => e.sets.map((x, j) => { const ref = refSet(prev, e.exId, j); const dw = ref && x.w !== "" && ref.w !== "" ? r1(x.w - ref.w) : null, dr = ref && x.r !== "" && ref.r !== "" ? x.r - ref.r : null;
      return `<tr class="${e.extra ? "extra-row" : ""}">${j === 0 ? `<td rowspan="${e.sets.length}"><b>${esc(e.name)}</b>${e.extra ? ' <span class="badge extra">Extra</span>' : ""}${e.replaced ? `<br><small class="muted">reemplazó a ${esc(e.replacedFrom)}</small>` : ""}${e.tech ? `<br><span class="badge tech-${e.tech}">Técnica ${e.tech}</span>` : ""}${exnotes.find((n) => n.id === e.exId)?.text ? `<br><small class="muted">⚙ ${esc(exnotes.find((n) => n.id === e.exId).text)}</small>` : ""}</td>` : ""}
      <td>${j + 1}${e.target?.[j] ? `<br><small class="muted">plan ${esc(e.target[j].reps)}${e.target[j].rir !== "" && e.target[j].rir != null ? "@" + e.target[j].rir : ""}</small>` : ""}</td><td><b>${x.w || "–"} × ${x.r || "–"}</b>${x.rir !== "" ? ` RIR ${x.rir}` : ""}${x.tech ? ` <span class="badge tech-${x.tech}">téc. ${x.tech}</span>` : ""}</td><td class="muted">${ref ? `${ref.w}×${ref.r}${ref.rir !== "" ? " RIR " + ref.rir : ""}` : "—"}</td>
      <td>${dw ? `<span class="${dw > 0 ? "g" : "r"}">${dw > 0 ? "+" : ""}${dw}kg</span> ` : ""}${dr ? `<span class="${dr > 0 ? "g" : "r"}">${dr > 0 ? "+" : ""}${dr}r</span>` : ""}</td><td class="small">${esc(x.note || "")}</td></tr>`; }).join("")).join("")}</table></div>`;
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
    ${CONFIG.meals.map((m) => { const it = x.meals?.[m] || [], ph = photos.filter((p) => p.date === d && p.meal === m); if (!it.length && !x.mealNotes?.[m] && !ph.length) return ""; return `<div class="mt"><b>${m}</b>${it.map((i) => `<div class="li row between small"><span>${esc(i.name)} · ${r0(i.g)} g${i.quick ? " (rápido)" : ""}</span><span>${r0(itemMacros(i).kcal)} kcal</span></div>`).join("")}${x.mealNotes?.[m] ? `<div class="note">📝 ${esc(x.mealNotes[m])}</div>` : ""}${ph.length ? `<div class="thumbs">${ph.map((p) => `<img src="${p.data}">`).join("")}</div>` : ""}</div>`; }).join("")}</details>`;
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
  const list = (await db.list(`clients/${c.id}/checkins`)).sort((a, b) => b.id.localeCompare(a.id));
  if (!list.length) return `<p class="muted">Sin check-ins.</p>`;
  const v = (x) => Array.isArray(x) ? x.join(", ") : x;
  return list.map((ci, k) => `<details class="card ci-view" ${k === 0 ? "open" : ""}><summary class="row between"><h3>Semana ${+ci.id.slice(1)} <small class="muted">${ci.date ? fmtDate(ci.date) : ""}</small></h3><span class="small muted">Días con registro de comida: ${ci.diasRegistrados ?? "—"}/7</span></summary>
  <div class="grid3">${CHECKIN.map((sec) => { const qs = sec.q.filter(([key]) => ci[key] != null && ci[key] !== "" && !(Array.isArray(ci[key]) && !ci[key].length)); if (!qs.length) return ""; return `<div><h4>${esc(sec.t)}</h4>${qs.map(([key, label]) => `<div class="qa"><span class="muted">${esc(label)}</span><b>${esc(v(ci[key]))}${ci[key + "Det"] ? ` · ${esc(ci[key + "Det"])}` : ""}</b></div>`).join("")}</div>`; }).join("")}
  ${ci.ciclo ? `<div><h4>Ciclo</h4><div class="qa"><span class="muted">En ciclo menstrual</span><b>${esc(ci.ciclo)}</b></div></div>` : ""}</div></details>`).join("");
}

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
  await db.set(`clients/${CW.cid}/feedbacks/${fb.week}`, fb);
  await db.set("clients/" + CW.cid, { feedback: fb, weeklyGoals: $("#fbG").value.split("\n").map((x) => x.trim()).filter(Boolean) });
  toast("Publicado ✓");
});

// ---------- Datos y objetivos
async function dataView(c) {
  const f = (k, l, type = "text", extra = "") => `<label>${l}<input name="${k}" type="${type}" value="${esc(c[k] ?? "")}" ${extra}></label>`;
  return `<form class="card" id="dataF"><div class="card-t">Información personal</div><div class="grid3">
  ${f("name", "Nombre")}${f("email", "Correo", "email", "readonly")}${f("birth", "Fecha de nacimiento", "date")}
  <label>Sexo<select name="sex"><option value="">—</option><option value="M" ${c.sex === "M" ? "selected" : ""}>Masculino</option><option value="F" ${c.sex === "F" ? "selected" : ""}>Femenino</option></select></label>
  ${f("height", "Estatura (cm)", "number")}${f("startDate", "Inicio de la asesoría (define el inicio de cada semana)", "date")}${f("goal", "Objetivo")}</div>
  <div class="card-t mt">Etapa y objetivos diarios</div><div class="grid3">
  <label>Etapa (si no hay etapas definidas)<select name="phase">${Object.keys(PHASES).map((p) => `<option ${c.phase === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
  ${f("kcal", "Calorías", "number")}${f("cho", "CHO (g)", "number")}${f("fat", "Lípidos (g)", "number")}${f("prot", "Proteína (g)", "number")}
  ${f("steps", "Pasos", "number")}${f("water", "Agua (ml)", "number")}${f("sleep", "Sueño (h)", "number", 'step="0.5"')}${f("rest", "Descanso entre series por defecto (s)", "number")}</div>
  <p class="muted small">Agua sugerida según peso (35 ml/kg): <b id="wSug">—</b> <button type="button" class="btn tiny" data-a="waterSug">Usar</button></p>
  <div class="card-t mt">Plan de alimentación</div>${`<label>Link al PDF del plan (Drive)<input name="planUrl" value="${esc(c.plan?.pdfUrl || "")}"></label><label>Notas del plan<textarea name="planNotes" rows="3">${esc(c.plan?.notes || "")}</textarea></label>`}
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
  const n = ["height", "kcal", "cho", "fat", "prot", "steps", "water", "sleep", "rest"];
  const data = {};
  for (const [k, v] of Object.entries(fd)) if (!["planUrl", "planNotes", "dates", "email"].includes(k)) data[k] = n.includes(k) ? num(v) : v;
  data.plan = { pdfUrl: fd.planUrl, notes: fd.planNotes };
  data.dates = fd.dates.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ date: l.slice(0, 10), label: l.slice(11) }));
  data.pauta = {}; $$("[data-pauta]").forEach((i) => { if (i.value !== "") data.pauta[i.dataset.pauta] = num(i.value); });
  await db.set("clients/" + CW.cid, data); toast("Guardado ✓"); refresh();
});
act("archive", async () => { if (!(await confirmBox("¿Archivar este cliente? Dejará de aparecer en tu lista (sus datos se mantienen)."))) return; await db.set("clients/" + CW.cid, { archived: true }); go("coach"); });

// ================================================================ BIBLIOTECA
async function library() {
  const ex = (await db.get("library/exercises"))?.items || [], gd = (await db.get("library/guides"))?.items || [], fd = await db.get("library/foods");
  return `<h1>Biblioteca</h1>
  <div class="card"><div class="card-t">Base de ejercicios (${ex.length})</div><p class="muted small">Al escribir un ejercicio en una rutina, se completan solos su video, reemplazos y salto de carga.</p>
  <table class="tbl"><tr><th>Ejercicio</th><th>Grupo / patrón</th><th>Video</th><th>Salto (kg)</th><th>Reemplazos (Nombre | link; …)</th><th></th></tr>
  ${ex.map((e, k) => `<tr><td><input value="${esc(e.name)}" data-a-change="libEx" data-k="${k}" data-f="name"></td><td><input value="${esc(e.group || "")}" data-a-change="libEx" data-k="${k}" data-f="group"></td><td><input value="${esc(e.video || "")}" data-a-change="libEx" data-k="${k}" data-f="video"></td><td><input type="number" step="0.5" value="${e.inc || ""}" data-a-change="libEx" data-k="${k}" data-f="inc" style="width:70px"></td><td><input value="${esc((e.alts || []).map((a) => a.name + (a.video ? " | " + a.video : "")).join("; "))}" data-a-change="libEx" data-k="${k}" data-f="alts"></td><td><button class="icon-btn" data-a="libExDel" data-k="${k}">✕</button></td></tr>`).join("")}</table>
  <button class="btn" data-a="libExAdd">＋ Ejercicio</button></div>
  <div class="card"><div class="card-t">Guías para clientes</div>${gd.map((g, k) => `<div class="row gap"><input value="${esc(g.title)}" data-a-change="libG" data-k="${k}" data-f="title" placeholder="Título"><input class="grow" value="${esc(g.url)}" data-a-change="libG" data-k="${k}" data-f="url" placeholder="Link (PDF en Drive)"><input class="grow" value="${esc(g.desc || "")}" data-a-change="libG" data-k="${k}" data-f="desc" placeholder="Descripción"><button class="icon-btn" data-a="libGDel" data-k="${k}">✕</button></div>`).join("")}<button class="btn" data-a="libGAdd">＋ Guía</button></div>
  <div class="card"><div class="card-t">Base de alimentos para el registro</div><p class="muted small">El registro usa el <b>aporte real por 100 g</b>: 250 alimentos de la base USDA (SR28) con nombres en español, más productos envasados vía Open Food Facts y los que creen tus clientes. Cada alimento tiene su grupo de intercambio, así igual se descuentan porciones de la pauta.${fd?.items?.length ? ` Además tienes ${fd.items.length} alimentos propios agregados.` : ""}</p>
  <p class="muted small">Para agregar alimentos propios (ej: chilenos o de etiqueta), sube un CSV con columnas: <b>Alimento, Grupo, Kcal, CHO, Lipidos, Proteina</b> (por 100 g) y opcionalmente <b>Medida</b> y <b>Gramos</b> de la medida casera.</p>
  <label class="btn">Importar CSV<input type="file" accept=".csv,text/csv" hidden data-a-change="foodCsv"></label></div>`;
}
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
  <div class="card"><p class="muted small">Define cada etapa por número de semana. Mientras dure una etapa, sus objetivos reemplazan a los de "Datos y objetivos" (deja en blanco lo que no cambie). El cliente lo ve en su Timeline y sus metas cambian solas al pasar de etapa.</p>
  <table class="tbl"><tr><th>Etapa</th><th>Desde sem.</th><th>Hasta sem.</th><th>Kcal</th><th>CHO</th><th>Lípidos</th><th>Proteína</th><th>Pasos</th><th>Agua (ml)</th><th>Nota para el cliente</th><th></th></tr>
  ${st.map((x, i) => `<tr><td><div class="row"><span class="dotc" style="background:${phaseColor(x.phase)}"></span><select data-a-change="stF" data-i="${i}" data-k="phase">${Object.keys(PHASES).map((p) => `<option ${p === x.phase ? "selected" : ""}>${p}</option>`).join("")}</select></div></td>
    <td>${inp("from", i, x.from, 64)}</td><td>${inp("to", i, x.to, 64)}</td><td>${inp("kcal", i, x.kcal)}</td><td>${inp("cho", i, x.cho, 64)}</td><td>${inp("fat", i, x.fat, 64)}</td><td>${inp("prot", i, x.prot, 64)}</td><td>${inp("steps", i, x.steps, 80)}</td><td>${inp("water", i, x.water, 80)}</td>
    <td>${inp("note", i, x.note, 220, "text")}</td><td><button class="icon-btn" data-a="stDel" data-i="${i}">✕</button></td></tr>`).join("")}</table>
  <button class="btn" data-a="stAdd">＋ Agregar etapa</button></div>`;
}
const stSave = async (fn) => { const c = await getClient(CW.cid); const st = [...(c.stages || [])].sort((a, b) => a.from - b.from); fn(st); await db.set("clients/" + CW.cid, { stages: st }); refresh(); };
act("stF", (el) => stSave((st) => { const k = el.dataset.k; st[+el.dataset.i][k] = ["phase", "note"].includes(k) ? el.value : num(el.value); }));
act("stAdd", () => stSave((st) => { const last = st[st.length - 1]; const from = last ? +last.to + 1 : 1; st.push({ phase: "Mantención", from, to: from + 3 }); }));
act("stDel", async (el) => { if (await confirmBox("¿Eliminar esta etapa?")) stSave((st) => st.splice(+el.dataset.i, 1)); });
