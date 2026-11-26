// Entrenamiento del cliente: semana, sesión en curso, encuesta y resumen
import { CONFIG } from "./config.js";
import { db } from "./db.js";
import { S, refresh, go } from "./state.js";
import { act, toast, sheet, closeSheet, chips, beep, notify, confirmBox, $, $$ } from "./ui.js";
import { LS, esc, ymd, fmtDate, weekInfo, r1, num, embedUrl, uid, pad, parseYmd, D3, compressImage } from "./util.js";
import { saveAudio, loadAudio, delAudio } from "./audiostore.js";
import { getRoutines, getSessions, weekPlan, prevSession, prevFor, refInfo, nextHint, lastEx, refSet, newSession, suggest, splitSides, setProgress, perfText, repsEff, exProgress, sessionProgress } from "./data.js";
import { I } from "./icons.js";
import { has } from "./features.js";

const P = () => "clients/" + S.cid;
const head = (t, back, right = "") => `<header class="ch">${back ? `<a href="#${back}" class="icon-btn">${I.back}</a>` : "<span></span>"}<h2>${esc(t)}</h2><span class="right">${right}</span></header>`;
const STATUS = { hecho: "Hecho", hoy: "Hoy", atrasado: "Atrasado", proximo: "Próximo" };
const TECH = { "": "–", peor: "↓", igual: "=", mejor: "↑" };
const TECH_NEXT = { "": "igual", igual: "mejor", mejor: "peor", peor: "" };
const TECH_L = { "": "Técnica", peor: "↓ Peor", igual: "= Igual", mejor: "↑ Mejor" };
const EXC = ["#e0313b", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#f97316", "#06b6d4"];
const exColor = (i) => EXC[i % EXC.length];
// Número del ejercicio dentro de la rutina (los extras no cuentan) y color: el extra toma el color del ejercicio que lo antecede
const exNum = (list, k) => list.slice(0, k + 1).filter((e) => !e.extra).length;
const exCol = (list, k) => list[k]?.extra ? "var(--b)" : exColor(exNum(list, k) - 1);
const kgTxt = (w) => String(w).replace(".", ",");
const planTxt = (t) => `${esc(t.reps || "–")} reps${t.rir !== "" && t.rir != null ? ` @RIR ${t.rir}` : ""}${t.w ? ` · ${esc(kgTxt(t.w))} kg` : ""}`;

// ================================================================ TU SEMANA
export async function trainView() {
  const [routines, sessions] = await Promise.all([getRoutines(S.cid), getSessions(S.cid)]);
  const plan = weekPlan(S.client, routines, sessions);
  const cur = sessions.find((s) => s.status === "curso");
  const changed = routines.filter((r) => r.changes?.week === plan.week.key);
  const today = ymd();
  const day = (d) => { const dt = parseYmd(d); return `<span class="sd2"><b>${D3[dt.getDay()]}</b>${dt.getDate()}</span>`; };
  return `${head("Entrenamiento")}
  <div class="card"><div class="row between"><div><div class="card-t" style="margin:0">Semana ${plan.week.n}</div><div class="muted small">${fmtDate(plan.week.first)} – ${fmtDate(plan.week.last)}</div></div><div class="big">${plan.doneCount}<small>/${plan.total}</small></div></div>
  <div class="progress"><i style="width:${plan.total ? Math.min(100, (plan.doneCount / plan.total) * 100) : 0}%"></i></div></div>
  ${cur ? `<div class="card row between" style="border-color:var(--acc)"><span><small class="muted">Sesión en curso${cur.date !== today ? " · desde el " + fmtDate(cur.date) : ""}</small><br><b>${esc(cur.routineName)}</b></span><span class="row gap"><button class="btn tiny ghost" data-a="discardById" data-id="${cur.id}">Descartar</button><a class="btn primary small" href="#sesion/${cur.id}">Continuar</a></span></div>` : ""}
  ${changed.length ? `<div class="card mod"><b>Esta semana hubo modificaciones en tu rutina</b><ul>${changed.flatMap((r) => (r.changes.list || []).map((x) => `<li><b>${esc(r.name)}:</b> ${esc(x)}</li>`)).join("")}</ul></div>` : ""}
  ${plan.rotation ? rotCard(plan, today) : ""}
  <div class="slots">${plan.slots.map((s) => s.rest
    ? `<div class="slot rest ${s.date === today ? "today" : ""}">${day(s.date)}<span class="rest-t">${s.date === today ? "Hoy · " : ""}Descanso${s.freeToday ? " <small>(puedes entrenar si quieres)</small>" : ""}</span>${s.freeToday && plan.next ? `<button class="btn tiny" data-a="startRoutine" data-r="${plan.next.rid}">Empezar</button>` : ""}</div>`
    : `<div class="slot ${s.status}">${day(s.date)}<span class="grow"><b>${esc(s.name)}</b><span class="badge ${s.status}${s.rot && s.status === "proximo" ? " sugd" : ""}">${s.extra && s.status !== "hecho" ? "Opcional" : s.rot && s.status === "proximo" ? (s.sug ? "Sugerido" : "Para completar") : STATUS[s.status]}</span></span>
      ${s.status === "hecho" ? `<a class="btn tiny" href="#resumen/${s.session.id}">Ver</a>` : `<span class="row gap"><button class="btn tiny ghost" data-a="viewRoutine" data-r="${s.rid}">Ver</button><button class="btn tiny ${s.status === "hoy" || s.status === "atrasado" ? "primary" : ""}" data-a="startRoutine" data-r="${s.rid}">Empezar</button></span>`}</div>`).join("")}</div>
  ${has("train_self")
    ? `<div class="card"><div class="card-t">Mis rutinas</div><p class="muted small">Tu asesoría es de nutrición: tú diseñas tus rutinas con los ejercicios de la biblioteca y sus tips. Elige qué días toca cada una y registra tus entrenamientos aquí.</p>
      ${routines.map((r) => `<div class="li row between"><span><b>${esc(r.name)}</b><small class="muted"> · ${r.exercises?.length || 0} ejercicios${(r.days || []).length ? " · " + r.days.map((d) => D3[d]).join(", ") : ""}</small></span><span class="row gap"><button class="btn tiny ghost" data-a="myRoutine" data-r="${r.id}">Editar</button><button class="btn tiny" data-a="startRoutine" data-r="${r.id}">Empezar</button></span></div>`).join("") || `<p class="muted small">Aún no tienes rutinas.</p>`}
      <button class="btn primary block mt" data-a="myRoutine">${I.plus} Crear rutina</button></div>`
    : `<div class="card"><div class="card-t">Todas tus rutinas</div>${routines.map((r) => `<div class="li row between"><span><b>${esc(r.name)}</b><small class="muted"> · ${r.exercises?.length || 0} ejercicios${r.changes?.week === plan.week.key ? ' · <span class="red">modificada</span>' : ""}</small></span><span class="row gap"><button class="btn tiny ghost" data-a="viewRoutine" data-r="${r.id}">Ver</button><button class="btn tiny" data-a="startRoutine" data-r="${r.id}">Empezar</button></span></div>`).join("") || `<p class="muted small">Tu coach aún no carga tus rutinas.</p>`}</div>`}`;
}
// Rotación (ej. Fullbody A/B sin días fijos): qué le toca la próxima vez y la regla de descanso
function rotCard(plan, today) {
  const R = S.client.rotation || {}, gap = +R.minRest || 1, left = plan.total - plan.doneCount;
  const sugDays = R.everyOther ? "" : (R.days || []).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => D3[d]).join(", ");
  const nextSlot = plan.slots.find((x) => !x.rest && (x.status === "hoy" || x.status === "proximo"));
  const canToday = plan.slots.some((x) => x.date === today && (x.status === "hoy" || x.freeToday));
  return `<div class="card rotnext"><div class="row between"><div><small class="muted">${left > 0 ? "Próximo entrenamiento" : "Semana completa ✓ · el próximo"}</small><div class="big2">${esc(plan.next?.name || "")}</div>
    <small class="muted">${left > 0 ? (nextSlot ? (nextSlot.date === today ? "Te toca hoy" : `Sugerido: ${fmtDate(nextSlot.date, true)}`) : "") : nextSlot ? `Ya cumpliste tu objetivo. Si quieres entrenar más: ${nextSlot.date === today ? "hoy" : fmtDate(nextSlot.date, true)} (opcional)` : "La próxima semana sigues con esta"}</small></div>
    ${canToday && plan.next && !plan.slots.some((x) => x.date === today && x.status === "hecho") ? `<button class="btn primary small" data-a="startRoutine" data-r="${plan.next.rid}">Empezar</button>` : ""}</div>
    <p class="small muted mt">${R.everyOther ? `Alternas tus rutinas en orden: te toca la contraria de la última que hiciste. Tu objetivo es entrenar <b>al menos ${plan.total} veces por semana</b>, idealmente día por medio. Puedes hacer más: los días marcados “Opcional” también sirven. Si te saltas un día, la sugerencia se corre sola.` : `Alternas tus rutinas en orden: te toca la contraria de la última que hiciste. ${plan.total} por semana${sugDays ? `, idealmente ${sugDays}` : ""}, con al menos ${gap} día${gap > 1 ? "s" : ""} de descanso entre entrenamientos. Si te saltas un día, los que quedan se corren solos.`}</p>
    ${plan.missing ? `<p class="small red">Te ${plan.missing > 1 ? "faltan" : "falta"} ${plan.missing} entrenamiento${plan.missing > 1 ? "s" : ""} y ya no alcanzan los días con descanso entremedio. Habla con tu coach.</p>` : ""}</div>`;
}
// ---------- Solo nutrición: el cliente arma sus propias rutinas
let MR = null;
act("myRoutine", async (el) => {
  const r = el.dataset.r ? (await getRoutines(S.cid)).find((x) => x.id === el.dataset.r) : null;
  MR = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: "", days: [], exercises: [], own: true, isNew: true };
  openMR();
});
async function openMR() {
  const lib = (await db.get("library/exercises"))?.items || [];
  sheet(MR.isNew ? "Nueva rutina" : "Editar rutina", `<label>Nombre<input id="mrN" value="${esc(MR.name)}" placeholder="Ej: Tren inferior"></label>
  <div class="small muted">¿Qué días la haces?</div><div class="row gap wrap mt">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip ${MR.days.includes(d) ? "on" : ""}" data-a="mrDay" data-d="${d}">${D3[d]}</button>`).join("")}</div>
  <div class="card-t mt">Ejercicios</div>
  ${MR.exercises.map((e, k) => `<div class="row gap mrx"><b>${k + 1}</b><span class="grow">${esc(e.name)}</span><span class="stepper-s"><button data-a="mrSets" data-k="${k}" data-n="-1">−</button><b>${e.sets.length}</b><button data-a="mrSets" data-k="${k}" data-n="1">+</button></span><small class="muted">series</small><button class="icon-btn" data-a="mrDel" data-k="${k}">✕</button></div>`).join("") || `<p class="muted small">Agrega ejercicios desde la biblioteca.</p>`}
  <div class="row gap mt"><input id="mrE" list="mrLib" placeholder="Buscar ejercicio…"><button class="btn" data-a="mrAdd">Agregar</button></div>
  <datalist id="mrLib">${lib.map((e) => `<option value="${esc(e.name)}">`).join("")}</datalist>
  <button class="btn primary big" data-a="mrSave">Guardar rutina</button>${MR.isNew ? "" : `<button class="btn ghost block red" data-a="mrRemove">Eliminar rutina</button>`}`);
}
const mrName = () => { const n = $("#mrN"); if (n) MR.name = n.value; };
act("mrDay", (el) => { mrName(); const d = +el.dataset.d; MR.days = MR.days.includes(d) ? MR.days.filter((x) => x !== d) : [...MR.days, d]; openMR(); });
act("mrSets", (el) => { mrName(); const e = MR.exercises[+el.dataset.k]; const n = Math.max(1, Math.min(8, e.sets.length + +el.dataset.n)); e.sets = Array.from({ length: n }, () => ({ reps: "", rir: "" })); openMR(); });
act("mrDel", (el) => { mrName(); MR.exercises.splice(+el.dataset.k, 1); openMR(); });
act("mrAdd", async () => {
  mrName(); const name = $("#mrE").value.trim(); if (!name) return;
  const l = ((await db.get("library/exercises"))?.items || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  MR.exercises.push({ id: l?.id || "x-" + uid(), name: l?.name || name, sets: [{ reps: "", rir: "" }, { reps: "", rir: "" }], notes: l?.tips || "", alts: (l?.alts || []).map((a) => ({ name: a.name })), inc: l?.inc || 2.5 });
  openMR();
});
act("mrSave", async () => {
  mrName(); if (!MR.name.trim()) return toast("Ponle un nombre a la rutina"); if (!MR.exercises.length) return toast("Agrega al menos un ejercicio");
  const { id, isNew, ...data } = MR; await db.set(`${P()}/routines/${id}`, { ...data, name: MR.name.trim(), own: true, updatedAt: Date.now() }, false);
  closeSheet(); toast("Rutina guardada ✓"); refresh();
});
act("mrRemove", async () => { if (!(await confirmBox("¿Eliminar esta rutina? Tus entrenamientos ya registrados se mantienen."))) return; await db.del(`${P()}/routines/${MR.id}`); closeSheet(); refresh(); });
// Ver la rutina sin empezarla: ejercicios, series, reps, RIR e indicaciones
act("viewRoutine", async (el) => {
  const r = (await getRoutines(S.cid)).find((x) => x.id === el.dataset.r); if (!r) return;
  const sessions = await getSessions(S.cid), last = sessions.filter((x) => x.routineId === r.id && x.status === "fin").sort((a, b) => b.startedAt - a.startedAt)[0];
  sheet(r.name, `${r.note ? `<div class="coachnote rnote"><b>Tu coach:</b> ${esc(r.note)}</div>` : ""}${(r.exercises || []).map((e, k) => {
    const lx = lastEx(sessions, { id: "", startedAt: Infinity }, { exId: e.id, name: e.name })?.ex, done = (lx?.sets || []).filter((x) => x.w !== "" || x.r !== "");
    return `<div class="rvx" style="--exc:${exColor(k)}"><b>${k + 1}. ${esc(e.name)}</b>${e.changed ? ' <span class="badge r">Modificado</span>' : ""}
    <div class="small">${(e.sets || []).map((t, j) => `<span class="rvset">S${j + 1}: ${planTxt(t)}</span>`).join("") || '<span class="muted">Series libres</span>'}</div>
    ${e.notes ? `<ul class="tiplist small">${String(e.notes).split(/\n|•/).map((x) => x.trim()).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${e.weekNote || e.wSug ? `<div class="coachnote small">${e.weekNote ? esc(e.weekNote) : ""}${e.wSug ? ` · Peso sugerido ${esc(e.wSug)} kg` : ""}</div>` : ""}
    ${done.length ? `<div class="muted small">Última vez: ${done.map((x) => `${x.w || "–"}×${x.r || "–"}`).join(" · ")}</div>` : ""}</div>`;
  }).join("") || `<p class="muted">Esta rutina aún no tiene ejercicios.</p>`}
  <button class="btn primary big" data-a="startRoutine" data-r="${r.id}">Empezar esta rutina</button>`);
});
act("startRoutine", async (el) => {
  closeSheet();
  const sessions = await getSessions(S.cid);
  const cur = sessions.find((s) => s.status === "curso");
  if (cur && !(await confirmBox(`Tienes "${cur.routineName}" en curso. ¿Empezar otra igual?`, "Empezar otra"))) return go("sesion/" + cur.id);
  const r = (await getRoutines(S.cid)).find((x) => x.id === el.dataset.r);
  const s = newSession(S.client, r);
  await db.set(`${P()}/sessions/${s.id}`, s);
  S.session = s; S.exIdx = 0; go("sesion/" + s.id);
});

// ================================================================ SESIÓN
let prev = null;
async function loadSession(id) {
  if (S.session?.id !== id) { S.session = await db.get(`${P()}/sessions/${id}`); S.exIdx = 0; if (S.session) S.session.id = id; }
  const sessions = await getSessions(S.cid);
  S.allSess = sessions; prev = S.session ? prevFor(sessions, S.session) : null;
  return S.session;
}
const save = () => db.set(`${P()}/sessions/${S.session.id}`, S.session, false);
const timeSince = (t) => { const s = Math.floor((Date.now() - t) / 1000); return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };

export async function sessionView(id) {
  const s = await loadSession(id); if (!s) return `${head("Sesión", "entreno")}<p class="pad muted">No se encontró la sesión.</p>`;
  if (s.status === "fin") { go("resumen/" + id); return ""; }
  document.getElementById("app")?.classList.add("in-session");
  const i = Math.min(S.exIdx || 0, s.exercises.length - 1), ex = s.exercises[i];
  const exNote = (await db.get(`${P()}/exnotes/${ex.exId}`)) || {};
  const hasTips = ex.video || ex.notes || ex.alts?.length || exNote.text || exNote.photos?.length;
  return `<header class="ch sess"><a href="#entreno" class="icon-btn">${I.back}</a><h2>${esc(s.routineName)}</h2><span class="row"><span class="clock" id="clock">${timeSince(s.startedAt)}</span><button class="btn tiny primary" data-a="finishAsk">Terminar</button></span></header>
  ${s.coachNote && i === 0 ? `<div class="coachnote rnote"><b>Tu coach para hoy:</b> ${esc(s.coachNote)}</div>` : ""}
  <div class="extabs">${s.exercises.map((e, k) => { const done = e.sets.length && e.sets.every((x) => x.done); return `<button class="${k === i ? "on" : ""} ${done ? "done" : ""} ${e.extra ? "extra" : ""} ${e.changed ? "chg" : ""}" style="--exc:${exCol(s.exercises, k)}" data-a="exGo" data-i="${k}" title="${e.extra ? "Ejercicio extra (fuera de tu rutina)" : ""}">${e.extra ? "+" : exNum(s.exercises, k)}</button>`; }).join("")}</div>
  <div class="card ex ${ex.extra ? "extra" : ""}" style="--exc:${exCol(s.exercises, i)}">
    <div class="ex-h"><h3>${esc(ex.name)}${ex.changed ? ' <span class="badge r">Modificado</span>' : ""}${ex.extra ? ' <span class="badge b">Extra · fuera de la rutina</span>' : ""}${ex.replaced ? `<br><span class="badge y">SOS · en vez de ${esc(ex.replacedFrom)}</span>` : ""}</h3><button class="btn tiny ${ex.sides ? "primary" : "ghost"}" data-a="toggleSides" title="Anotar cada lado por separado">Izq / Der</button></div>
    <button class="tips" data-a="tips"><span class="ti-ic">${I.play}</span><span><b>Tips de ejecución</b><small>${[ex.video && has("train_videos") ? "Video" : "", ex.notes ? "Indicaciones" : "", "Configuración", ex.alts?.length ? "Reemplazos de emergencia" : ""].filter(Boolean).join(" · ")}${exNote.text ? " ●" : ""}</small></span>${I.chev}</button>
    ${ex.extra ? "" : `<button class="sosbtn" data-a="sosOpen">${I.swap} ${ex.replaced ? `Volver a ${esc(ex.replacedFrom)} o cambiar el reemplazo` : "¿Ocupada o no está? Reemplazo SOS"}</button>`}
    ${ex.weekNote || ex.wSug ? `<div class="coachnote">${ex.weekNote ? `<b>Tu coach:</b> ${esc(ex.weekNote)}` : ""}${ex.wSug ? `${ex.weekNote ? "<br>" : ""}<b>Peso sugerido:</b> ${esc(ex.wSug)} kg` : ""}</div>` : ""}
    ${!has("train_targets") ? `<div class="goal"><small>Registra el peso y las repeticiones de cada serie</small></div>` : ex.target.length ? `<div class="goal"><small>Lo que tienes que hacer hoy${ex.sides ? " · cada lado" : ""}</small><div>${(ex.sides ? ex.target.filter((_, k) => k % 2 === 0) : ex.target).map((t, j) => `<span><b>Serie ${j + 1}</b>${planTxt(t)}</span>`).join("")}</div>${ex.tempo || ex.rest ? `<small class="muted">${ex.tempo ? `Tempo ${esc(ex.tempo)} (bajada-pausa-subida-pausa)` : ""}${ex.tempo && ex.rest ? " · " : ""}${ex.rest ? `Descanso ${Math.floor(ex.rest / 60)}:${String(ex.rest % 60).padStart(2, "0")}` : ""}</small>` : ""}</div>` : `<div class="goal"><small>Series libres</small></div>`}
    <div class="sets"><div class="sh"><span>Serie</span><span>Peso kg</span><span>Reps</span><span>RIR</span>${has("train_tech") ? "<span>Técnica</span>" : ""}</div>
    ${ex.sets.map((st, j) => setRow(ex, i, j)).join("")}</div>
    <div class="row gap"><button class="btn tiny" data-a="addSet">${I.plus} Serie</button>${ex.sets.length > (ex.target.length || 0) ? `<button class="btn tiny ghost" data-a="delSet">Quitar serie</button>` : ""}<span class="grow"></span>${has("train_tech") ? '<span class="muted small">Técnica vs. semana pasada</span>' : ""}</div>
    ${has("train_setvideo") ? `<div class="vidrem">🎥 Recuerda mandarle a tu coach el video de tu ejecución por WhatsApp, para asegurarte de que estás cumpliendo con la técnica e intensidad programada.</div>` : ""}
    <div id="sug-${i}">${sugHtml(ex)}</div>
  </div>
  <div class="row gap pad-x"><button class="btn ghost small grow" data-a="addExtra">${I.plus} Ejercicio extra</button><button class="btn ghost small grow" data-a="sessComment">${I.note} Comentario${s.comment ? " ●" : ""}</button></div>
  <div class="sessbar"><button class="btn" data-a="exGo" data-i="${i - 1}" ${i === 0 ? "disabled" : ""}>${I.back} Anterior</button>
    <button class="rest-btn ${S.rest ? (S.rest.fired ? "over" : "running") : ""}" data-a="${S.rest ? "restStop" : "restStart"}">${I.timer}<span id="restT">${S.rest ? fmtRest() : "Descanso " + fmtSec(restSec())}</span></button>
    <button class="btn" data-a="exGo" data-i="${i + 1}" ${i >= s.exercises.length - 1 ? "disabled" : ""}>Siguiente ${I.chev}</button></div>`;
}
function setRow(ex, i, j) {
  const st = ex.sets[j], ref = refSet(prev, ex.exId, j), t = ex.target[j] || {};
  const grp = ex.sides && j % 2 === 0 ? `<div class="sgrp"><b>Serie ${j / 2 + 1}</b><span id="diff-${i}-${j / 2}">${pairDiff(ex, j / 2)}</span></div>` : "";
  return `${grp}<div class="set ${st.done ? "done" : ""} ${ex.sides ? "sided" : ""}" id="set-${i}-${j}"><span class="sn">${ex.sides ? `<small class="sidel ${j % 2 ? "d" : "i"}">– ${j % 2 ? "Der." : "Izq."}</small>` : `<b>${j + 1}</b>`}</span>
  <input type="number" inputmode="decimal" step="0.5" value="${st.w}" placeholder="${t.w ?? ref?.w ?? ""}" data-a-change="setVal" data-j="${j}" data-k="w">
  <label class="repbox ${t.reps ? "" : "free"}">${t.reps ? `<span class="rt" title="Reps de tu plan">${esc(t.reps)}</span>` : ""}<input type="number" inputmode="numeric" value="${st.r}" placeholder="${ref?.r ?? (parseInt(t.reps) || "")}" data-a-change="setVal" data-j="${j}" data-k="r"></label>
  <button class="rirb ${st.rir === "" ? "" : "rir" + st.rir}" data-a="rirPick" data-j="${j}">${st.rir === "" ? "–" : st.rir}</button>
  ${!has("train_tech") ? "" : `<button class="techb ${st.tech || ""}" data-a="techPick" data-j="${j}">${TECH_L[st.tech || ""]}</button>`}
  <div class="setinfo" id="si-${i}-${j}">${setInfo(ex, j)}</div></div>`;
}
// Diferencia entre lados de una misma serie: se comparan las reps "efectivas" (reps + RIR).
// Ej.: izq. 7 reps RIR 1 (= 8) vs der. 7 reps RIR 7 (= 14) → 6 reps de diferencia, NO están parejos. Hasta 1 rep de diferencia cuenta como parejo.
function pairDiff(ex, p) {
  const a = ex.sets[p * 2], b = ex.sets[p * 2 + 1]; if (!a || !b || a.r === "" || b.r === "") return "";
  const ea = repsEff(a), eb = repsEff(b), dr = eb - ea, dw = a.w !== "" && b.w !== "" ? r1(b.w - a.w) : 0;
  if (!dw && Math.abs(dr) <= 1) return `<span class="g">Lados parejos ✓</span>`;
  const t = a.w !== "" && b.w !== "" ? perfText(b, a).t : `${dr > 0 ? "+" : ""}${dr} reps`;
  return `<span class="${Math.abs(dr) >= 3 || dw ? "y" : "b"}">Derecha vs izquierda: ${t.charAt(0).toLowerCase() + t.slice(1)}</span>`;
}
function setInfo(ex, j) {
  const st = ex.sets[j], ref = refSet(prev, ex.exId, j), ri = refInfo(prev, ex.exId), t = ex.target[j] || {};
  const okRef = ref && (ref.w !== "" || ref.r !== "");
  let h = "";
  if (okRef) {
    h += `<div class="lastv"><small>Última vez${ri?.date ? " · " + fmtDate(ri.date) : ""}</small><b>${ref.w || "–"} kg × ${ref.r || "–"}</b>${ref.rir !== "" && ref.rir != null ? `<span class="rir">${ref.rir === "F" ? "Fallo" : "RIR " + ref.rir}</span>` : ""}${ref.tech ? `<span class="badge tech-${ref.tech}">Téc. ${ref.tech}</span>` : ""}</div>`;
    if (st.w !== "" && st.r !== "" && has("train_suggest")) { const pg = setProgress(st, ref); if (pg && pg.k !== "new") h += `<div class="prog ${pg.k}">${{ up: "▲", down: "▼", bad: "⚠", same: "•" }[pg.k] || "•"} Hoy: ${esc(pg.t.charAt(0).toLowerCase() + pg.t.slice(1))}</div>`; }
    else if (has("train_suggest") && !(ex.sides && j % 2)) { const hn = nextHint(ref, t); if (hn) h += `<div class="hint ${hn.k}">💡 ${esc(hn.t)}</div>`; }
    if (ref.note) h += `<div class="lastnote">📝 <b>Tu nota de la última vez:</b> ${esc(ref.note)}</div>`;
  }
  if (st.rir === "F" && t.rir !== "F" && t.rir != null && t.rir !== "") h += `<div class="hint y">Tu plan no pedía llegar al fallo: la próxima vez deja al menos 1 rep en reserva</div>`;
  h += `<button class="notebtn ${st.note ? "on" : ""}" data-a="setNote" data-j="${j}">✎ ${st.note ? "Tu nota: " + esc(st.note) : "Agregar nota a esta serie"}</button>`;
  return h;
}
function sugHtml(ex) {
  if (!has("train_suggest")) return ""; // p. ej. solo nutrición: sin sugerencias de carga
  let last = null; ex.sets.forEach((s, j) => { if (s.w !== "" && s.r !== "") last = j; });
  if (last == null) return "";
  const sg = suggest(ex, last); if (!sg) return "";
  return sg.last
    ? `<div class="sug ${sg.a}"><b>${sg.text}</b>${sg.items.map((x) => `<span>${x}</span>`).join("")}${sg.why ? `<span class="why">${sg.why}</span>` : ""}</div>`
    : `<div class="sug ${sg.a}"><b>${sg.text}</b>${sg.why ? `<span class="why">${sg.why}</span>` : ""}</div>`;
}
const cur = () => S.session.exercises[S.exIdx || 0];
function updateSet(j) {
  const i = S.exIdx || 0, ex = cur();
  const el = $(`#si-${i}-${j}`); if (el) el.innerHTML = setInfo(ex, j);
  if (ex.sides) { const d = $(`#diff-${i}-${Math.floor(j / 2)}`); if (d) d.innerHTML = pairDiff(ex, Math.floor(j / 2)); }
  const sg = $(`#sug-${i}`); if (sg) sg.innerHTML = sugHtml(ex);
}
act("exGo", (el) => { const n = +el.dataset.i; if (n < 0 || n >= S.session.exercises.length) return; S.exIdx = n; refresh(); });
act("setVal", (el) => { const j = +el.dataset.j, st = cur().sets[j]; st[el.dataset.k] = el.value === "" ? "" : +el.value; st.done = st.w !== "" && st.r !== ""; $(`#set-${S.exIdx || 0}-${j}`)?.classList.toggle("done", st.done); save(); updateSet(j); });
act("techPick", (el) => {
  const j = +el.dataset.j;
  sheet("Técnica · serie " + (j + 1), `<p class="muted small">¿Cómo estuvo tu técnica comparada con la semana pasada?</p><div class="techgrid">${[["mejor", "↑ Mejor"], ["igual", "= Igual"], ["peor", "↓ Peor"], ["", "Sin marcar"]].map(([v, l]) => `<button class="techb ${v}" data-a="techSet2" data-j="${j}" data-v="${v}">${l}</button>`).join("")}</div>`);
});
act("techSet2", (el) => { cur().sets[+el.dataset.j].tech = el.dataset.v; save(); closeSheet(); refresh(); });
act("rirPick", (el) => {
  const j = +el.dataset.j;
  sheet("RIR de la serie " + (j + 1), `<p class="muted small">Repeticiones que te quedaban en reserva. F = llegaste al fallo.</p><div class="rirgrid">${["", "F", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<button class="rirb ${v === "" ? "" : "rir" + v}" data-a="rirSet" data-j="${j}" data-v="${v}">${v === "" ? "–" : v}</button>`).join("")}</div>`);
});
act("rirSet", (el) => { const j = +el.dataset.j, v = el.dataset.v; cur().sets[j].rir = v === "" ? "" : v === "F" ? "F" : +v; save(); closeSheet(); refresh(); });
act("techSet", (el) => {
  const j = +el.dataset.j, st = cur().sets[j]; st.tech = TECH_NEXT[st.tech || ""];
  el.className = "techb " + st.tech; el.textContent = TECH[st.tech]; save(); updateSet(j);
});
act("setDone", (el) => {
  const j = +el.dataset.j, ex = cur(), st = ex.sets[j];
  if (!st.done && st.w === "" && st.r === "") { const ref = refSet(prev, ex.exId, j); if (!ref) return toast("Anota peso y repeticiones"); st.w = ref.w; st.r = ref.r; }
  st.done = !st.done; save(); refresh();
});
act("addSet", () => {
  const ex = cur(), l = ex.sets[ex.sets.length - 1] || {}, mk = (side) => ({ w: l.w ?? "", r: "", rir: "", note: "", tech: "", done: false, ...(side ? { side } : {}) });
  if (ex.sides) ex.sets.push(mk("I"), mk("D")); else ex.sets.push(mk()); save(); refresh();
});
act("delSet", () => { const ex = cur(); ex.sets.splice(-(ex.sides ? 2 : 1)); save(); refresh(); });
act("toggleSides", () => {
  const ex = cur(), blank = () => ({ w: "", r: "", rir: "", note: "", tech: "", done: false });
  if (ex.sides) { ex.sets = ex.sets.filter((_, k) => k % 2 === 0).map(({ side, ...x }) => x); ex.target = ex.target.filter((_, k) => k % 2 === 0).map(({ side, ...x }) => x); ex.sides = false; toast("Series sin separar por lado"); }
  else { ex.sets = splitSides(ex.sets, () => ({ ...blank(), w: "" })); ex.target = splitSides(ex.target); ex.sides = true; toast("Ahora anotas izquierda y derecha"); }
  save(); refresh();
});
act("setNote", (el) => {
  const j = +el.dataset.j, ref = refSet(prev, cur().exId, j);
  sheet(`Nota · serie ${j + 1}`, `${ref?.note ? `<div class="lastnote">📝 <b>Tu nota de la última vez:</b> ${esc(ref.note)}</div>` : ""}<textarea id="sNt" rows="3" placeholder="Ej: primera serie muy liviana">${esc(cur().sets[j].note || "")}</textarea><button class="btn primary big" data-a="setNoteSave" data-j="${j}">Guardar</button>`);
});
act("setNoteSave", (el) => { cur().sets[+el.dataset.j].note = $("#sNt").value; save(); closeSheet(); updateSet(+el.dataset.j); });

// ---------- Video de cada serie (queda guardado en el celular; se envía al coach por WhatsApp)
const vdb = () => new Promise((res, rej) => { const r = indexedDB.open("teamjr-videos", 1); r.onupgradeneeded = () => r.result.createObjectStore("v"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const vPut = async (k, blob) => { const d = await vdb(); return new Promise((res, rej) => { const t = d.transaction("v", "readwrite"); blob ? t.objectStore("v").put(blob, k) : t.objectStore("v").delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
const vGet = async (k) => { try { const d = await vdb(); return await new Promise((res) => { const q = d.transaction("v").objectStore("v").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } };
const vKey = (j) => `${S.session.id}|${S.exIdx || 0}|${j}`;
let vUrl = null;
act("setVideo", async (el) => {
  const j = +el.dataset.j, ex = cur(), st = ex.sets[j], blob = st.vid ? await vGet(vKey(j)) : null;
  if (vUrl) URL.revokeObjectURL(vUrl); vUrl = blob ? URL.createObjectURL(blob) : null;
  const lbl = ex.sides ? `Serie ${Math.floor(j / 2) + 1} ${j % 2 ? "derecha" : "izquierda"}` : `Serie ${j + 1}`;
  sheet(`Video · ${lbl}`, `${vUrl ? `<video class="setvid" src="${vUrl}" controls playsinline></video>
    <button class="btn primary big" data-a="vidShare" data-j="${j}">Enviar a tu coach (WhatsApp)</button>
    <div class="row gap"><label class="btn grow">Cambiar video<input type="file" accept="video/*" hidden data-a-change="vidPick" data-j="${j}"></label><button class="btn ghost grow red" data-a="vidDel" data-j="${j}">Eliminar</button></div>`
  : st.vid ? `<p class="muted small">Este video se grabó en otro celular o se borró de este.</p>` : `<p class="muted small">Graba tu serie (o elígela de la galería) y mándasela a tu coach por WhatsApp desde aquí: se abre el menú de compartir del celular con el video y los datos de la serie.</p>
    <label class="btn primary big">🎥 Grabar o elegir video<input type="file" accept="video/*" hidden data-a-change="vidPick" data-j="${j}"></label>`}
`);
});
act("vidPick", async (el) => {
  const f = el.files[0], j = +el.dataset.j; if (!f) return;
  try { await vPut(vKey(j), f); cur().sets[j].vid = true; save(); toast("Video guardado"); closeSheet(); updateSet(j); $(`[data-a="setVideo"][data-j="${j}"]`)?.click(); }
  catch { toast("No se pudo guardar el video (¿muy pesado?)"); }
});
act("vidLink", (el) => { cur().sets[+el.dataset.j].vlink = el.value.trim(); save(); });
act("vidDel", async (el) => { const j = +el.dataset.j; if (!(await confirmBox("¿Eliminar el video de esta serie?"))) return; await vPut(vKey(j), null); cur().sets[j].vid = false; save(); closeSheet(); updateSet(j); });
act("vidShare", async (el) => {
  const j = +el.dataset.j, ex = cur(), st = ex.sets[j], blob = await vGet(vKey(j)); if (!blob) return;
  const file = new File([blob], `${ex.name} - serie ${j + 1}.mp4`.replace(/[\\/:*?"<>|]/g, ""), { type: blob.type || "video/mp4" });
  const text = `${ex.name} · ${ex.sides ? `serie ${Math.floor(j / 2) + 1} ${j % 2 ? "der." : "izq."}` : "serie " + (j + 1)}: ${st.w || "–"} kg × ${st.r || "–"}${st.rir !== "" ? " RIR " + st.rir : ""}`;
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text }); } catch (e) { if (e.name === "AbortError") return; }
  toast("Tu celular no permite compartir el video desde aquí; envíalo desde la galería");
});

// Tips de ejecución: video, indicaciones, configuración y reemplazos en un solo lugar
act("tips", async () => {
  const ex = cur(), n = (await db.get(`${P()}/exnotes/${ex.exId}`)) || {}, e = embedUrl(ex.video);
  const tips = String(ex.notes || "").split(/\n|•|·/).map((x) => x.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
  sheet(ex.name, `<div class="card-t">${I.gear}Tu configuración</div><p class="muted small">Altura del asiento, apoyos, agarre, distancia a la polea… Queda guardado para la próxima vez.</p>
  <textarea id="suT" rows="2" placeholder="Ej: asiento 3, respaldo 5, a 10 cm de la polea">${esc(n.text || "")}</textarea>
  <div class="thumbs">${(n.photos || []).map((p, k) => `<img src="${p}" data-a="setupPhotoDel" data-k="${k}">`).join("")}<label class="padd">＋<input type="file" accept="image/*" hidden data-a-change="setupPhoto"></label></div>
  <button class="btn primary block mt" data-a="setupSave">Guardar configuración</button>
  ${!has("train_videos") ? "" : `<div class="card-t mt">${I.play}Ejecución</div>
  ${e ? `<div class="video"><iframe src="${e}" allowfullscreen></iframe></div>` : ex.video ? `<a class="btn primary block" target="_blank" href="${esc(ex.video)}">${I.play} Ver video</a>` : `<p class="muted small">Tu coach aún no carga el video de este ejercicio.</p>`}`}
  <div class="card-t mt">Tips de ejecución</div>
  ${tips.length ? `<ul class="tiplist">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted small">Tu coach aún no carga los tips de este ejercicio.</p>`}
  ${ex.alts?.length ? `<div class="card-t mt">${I.swap}Reemplazos de emergencia</div><p class="muted small">Si la máquina está ocupada o no está disponible (mismo patrón de movimiento):</p>
  ${ex.alts.map((a, k) => `<div class="li row between"><b>${esc(a.name)}</b><span class="row gap">${a.video ? `<a class="btn tiny" target="_blank" href="${esc(a.video)}">Video</a>` : ""}<button class="btn tiny primary" data-a="useAlt" data-k="${k}">Usar</button></span></div>`).join("")}` : ""}`);
});
// ---------- Reemplazo SOS: la rutina no cambia; solo hoy se hace otro ejercicio en su lugar.
// La próxima vez vuelve el original con SU última vez; el reemplazo guarda su propia historia (por nombre).
function sosUsed(ex) {
  const orig = ex.replaced ? ex.replacedFrom : ex.name, seen = new Map();
  for (const x of (S.allSess || []).filter((y) => y.status === "fin").sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)))
    for (const y of x.exercises || []) if (y.replaced && (y.exId === ex.exId || y.replacedFrom === orig) && !seen.has(y.name.toLowerCase())) seen.set(y.name.toLowerCase(), { name: y.name, date: x.date });
  return [...seen.values()];
}
act("sosOpen", () => {
  const ex = cur(), used = sosUsed(ex).filter((u) => !(ex.alts || []).some((a) => a.name.toLowerCase() === u.name.toLowerCase()));
  const line = (name, extra, attrs) => `<div class="li row between"><span><b>${esc(name)}</b>${extra ? `<br><small class="muted">${extra}</small>` : ""}</span><button class="btn tiny primary" ${attrs}>${ex.replaced && ex.name === name ? "Usando" : "Usar"}</button></div>`;
  sheet("Reemplazo SOS", `<p class="muted small">Solo para hoy, si <b>${esc(ex.replaced ? ex.replacedFrom : ex.name)}</b> está ocupado o no está disponible. Tu rutina no cambia: la próxima vez vuelve el original con lo que hiciste la última vez que lo hiciste.</p>
  ${ex.replaced ? `<button class="btn block mt" data-a="sosBack">↩ Volver a ${esc(ex.replacedFrom)}</button>` : ""}
  ${(ex.alts || []).length ? `<div class="card-t mt">Reemplazos de tu coach</div>${ex.alts.map((a, k) => line(a.name, a.video ? `<a target="_blank" href="${esc(a.video)}">Ver video</a>` : "", `data-a="useAlt" data-k="${k}"`)).join("")}` : ""}
  ${used.length ? `<div class="card-t mt">Reemplazos que ya usaste</div>${used.map((u) => line(u.name, "Última vez: " + fmtDate(u.date), `data-a="useAltName" data-n="${esc(u.name)}"`)).join("")}` : ""}
  <div class="card-t mt">Otro ejercicio</div><div class="row gap"><input id="sosN" placeholder="Ej: Curl con apoyo en tríceps"><button class="btn primary" data-a="useAltFree">Usar</button></div>
  <p class="muted small">Elige uno del mismo patrón de movimiento. Tu coach verá que lo reemplazaste.</p>`);
});
function doReplace(a) {
  const ex = cur();
  if (!ex.replaced) { ex.orig = { name: ex.name, video: ex.video || "", notes: ex.notes || "" }; ex.replacedFrom = ex.name; }
  ex.name = a.name; ex.video = a.video || ""; ex.notes = a.tips || ""; ex.replaced = true;
  save(); closeSheet(); toast("Hoy: " + a.name); refresh();
}
act("useAlt", (el) => doReplace(cur().alts[+el.dataset.k]));
act("useAltName", (el) => doReplace({ name: el.dataset.n }));
act("useAltFree", () => { const n = $("#sosN").value.trim(); if (!n) return toast("Escribe el nombre del ejercicio"); doReplace({ name: n }); });
act("sosBack", () => {
  const ex = cur(), o = ex.orig || { name: ex.replacedFrom };
  ex.name = o.name; ex.video = o.video ?? ex.video; ex.notes = o.notes ?? ex.notes; ex.replaced = false; delete ex.replacedFrom; delete ex.orig;
  save(); closeSheet(); toast("Volviste a " + ex.name); refresh();
});
act("setupSave", async () => { await db.set(`${P()}/exnotes/${cur().exId}`, { text: $("#suT").value }); closeSheet(); toast("Guardado"); refresh(); });
act("setupPhoto", async (el) => {
  const f = el.files[0]; if (!f) return;
  const n = (await db.get(`${P()}/exnotes/${cur().exId}`)) || {};
  await db.set(`${P()}/exnotes/${cur().exId}`, { text: $("#suT")?.value ?? n.text ?? "", photos: [...(n.photos || []), await compressImage(f, 700, 0.6)] });
  closeSheet(); $('[data-a="tips"]')?.click();
});
act("setupPhotoDel", async (el) => {
  if (!(await confirmBox("¿Eliminar foto?"))) return; const n = await db.get(`${P()}/exnotes/${cur().exId}`);
  n.photos.splice(+el.dataset.k, 1); await db.set(`${P()}/exnotes/${cur().exId}`, { photos: n.photos }); $('[data-a="tips"]')?.click();
});
act("addExtra", () => sheet("Ejercicio extra", `<p class="muted small">Se agrega justo después de <b>${esc(cur().name)}</b> y queda marcado como extra (fuera de tu rutina) para que tu coach lo vea.</p><input id="xN" placeholder="Nombre del ejercicio"><button class="btn primary big" data-a="addExtraOk">Añadir</button>`));
act("addExtraOk", () => {
  const name = $("#xN").value.trim(); if (!name) return;
  // Va justo después del ejercicio en que estás (y de los extras que ya le hayas agregado), no al final
  const L = S.session.exercises; let at = (S.exIdx || 0) + 1; while (at < L.length && L[at].extra) at++;
  L.splice(at, 0, { exId: "x-" + uid(), name, extra: true, after: L[S.exIdx || 0]?.exId || null, target: [], alts: [], sets: [{ w: "", r: "", rir: "", note: "", tech: "", done: false }], inc: 2.5 });
  S.exIdx = at; save(); closeSheet(); refresh();
});
act("sessComment", () => sheet("Comentario de la sesión", `<textarea id="cmT" rows="3" placeholder="Ej: tuve que cambiar el orden de los ejercicios porque…">${esc(S.session.comment || "")}</textarea><button class="btn primary big" data-a="sessCommentOk">Guardar</button>`));
act("sessCommentOk", () => { S.session.comment = $("#cmT").value; save(); closeSheet(); refresh(); });
act("finishAsk", () => {
  const pend = S.session.exercises.filter((e) => e.sets.some((s) => s.w === "" || s.r === "")).length;
  sheet("¿Quieres terminar tu sesión?", `${pend ? `<p class="warn">Hay ${pend} ejercicio(s) con series sin anotar.</p>` : ""}<div class="row gap"><button class="btn grow" data-a="closeSheet">Seguir</button><button class="btn primary grow" data-a="finishOk">Terminar entrenamiento</button></div>
  <div class="row gap mt"><button class="btn ghost grow" data-a="sessReset">Reiniciar desde cero</button><button class="btn ghost grow red" data-a="sessDiscard">Descartar sesión</button></div>`);
});
act("discardById", async (el) => {
  if (!(await confirmBox("La sesión en curso se elimina y no queda registrada. ¿Descartar?", "Descartar"))) return;
  await db.del(`${P()}/sessions/${el.dataset.id}`); if (S.session?.id === el.dataset.id) S.session = null; toast("Sesión descartada"); refresh();
});
act("sessReset", async () => {
  if (!(await confirmBox("Se borran todas las series anotadas y el reloj parte de cero. ¿Reiniciar?", "Reiniciar"))) return;
  S.session.exercises.forEach((e) => { e.sets = e.target.length ? e.target.map(() => ({ w: "", r: "", rir: "", note: "", tech: "", done: false })) : [{ w: "", r: "", rir: "", note: "", tech: "", done: false }]; });
  S.session.exercises = S.session.exercises.filter((e) => !e.extra); S.session.startedAt = Date.now(); S.exIdx = 0; S.rest = null;
  save(); closeSheet(); toast("Sesión reiniciada"); refresh();
});
act("sessDiscard", async () => {
  if (!(await confirmBox("La sesión se elimina por completo y no queda registrada. ¿Descartar?", "Descartar"))) return;
  await db.del(`${P()}/sessions/${S.session.id}`); S.session = null; S.rest = null; closeSheet();
  document.getElementById("app")?.classList.remove("in-session"); toast("Sesión descartada"); go("entreno");
});
act("finishOk", () => { closeSheet(); S.session.endedAt = Date.now(); save(); S.rest = null; document.getElementById("app")?.classList.remove("in-session"); go("encuesta/" + S.session.id); });

// ---------- Temporizador de descanso (se inicia a mano)
const fmtSec = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
// Al terminar el descanso sigue contando en positivo: "+0:12" = segundos que llevas después del descanso
const restLeft = () => Math.ceil((S.rest.end - Date.now()) / 1000);
const fmtRest = () => { const l = restLeft(); return l > 0 ? fmtSec(l) : "+" + fmtSec(-l); };
const restSec = () => { const v = +LS.get("restSec"); return v > 0 ? v : cur()?.rest || S.client.rest || CONFIG.defaultRest; };
act("restStart", () => {
  sheet("Descanso", `<div class="restpick"><button class="btn" data-a="restPickAdj" data-n="-15">−15 s</button><b id="rpT">${fmtSec(restSec())}</b><button class="btn" data-a="restPickAdj" data-n="15">+15 s</button></div>
  <div class="chips">${[60, 90, 120, 150, 180, 240].map((x) => `<button class="chip" data-a="restPickSet" data-n="${x}">${fmtSec(x)}</button>`).join("")}</div>
  <button class="btn primary big" data-a="restGo">Iniciar descanso</button>`);
});
act("restPickAdj", (el) => { const v = Math.max(15, restSec() + +el.dataset.n); LS.set("restSec", v); $("#rpT").textContent = fmtSec(v); });
act("restPickSet", (el) => { LS.set("restSec", +el.dataset.n); $("#rpT").textContent = fmtSec(+el.dataset.n); });
// El audio y la pantalla encendida se piden al tocar "Iniciar" (el celular solo los permite tras un toque)
let AC = null, WL = null;
const keepAwake = async (on) => { try { if (on && !WL && navigator.wakeLock) { WL = await navigator.wakeLock.request("screen"); WL.addEventListener("release", () => (WL = null)); } else if (!on && WL) { await WL.release(); WL = null; } } catch {} };
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.rest) keepAwake(true); });
act("restGo", () => {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); } catch {}
  S.rest = { end: Date.now() + restSec() * 1000, fired: false }; keepAwake(true); closeSheet(); refresh();
});
act("restStop", () => { S.rest = null; keepAwake(false); refresh(); });
// Fin del descanso: pantalla completa que suena y vibra hasta que la toques (máx. ~20 s)
function restAlarm() {
  $("#restDone")?.remove();
  const o = document.createElement("div"); o.id = "restDone"; o.className = "restdone";
  o.innerHTML = `<div class="rd-in"><div class="rd-ic">⏱️</div><h2>¡Se acabó el descanso!</h2><p>Vamos con la siguiente serie 💪</p><button class="btn primary big">Listo</button></div>`;
  document.body.appendChild(o);
  let n = 0; const ring = () => { beep(AC); }; ring();
  const iv = setInterval(() => { if (++n >= 8) return stop(); ring(); }, 2500);
  const stop = () => { clearInterval(iv); navigator.vibrate?.(0); o.remove(); keepAwake(false); };
  o.onclick = stop;
}
act("restAdj", (el) => { if (!S.rest) return; S.rest.end += +el.dataset.n * 1000; if (S.rest.fired && restLeft() > 0) { S.rest.fired = false; refresh(); } });
export function restBar() {
  if (!S.rest || S.route[0] === "sesion") return "";
  return `<div class="restbar ${S.rest.fired ? "over" : ""}"><div>${S.rest.fired ? "" : "<small>Descanso</small>"}<b id="restT">${fmtRest()}</b></div><button data-a="restStop">✕</button></div>`;
}
setInterval(() => {
  const c = $("#clock"); if (c && S.session) c.textContent = timeSince(S.session.startedAt);
  if (!S.rest) return;
  const t = $("#restT"); if (t) t.textContent = fmtRest();
  if (Date.now() >= S.rest.end && !S.rest.fired) { S.rest.fired = true; restAlarm(); if (document.hidden) notify("Terminó tu descanso", "Vamos con la siguiente serie 💪"); refresh(); }
  else if (S.rest.fired && restLeft() < -600) { S.rest = null; refresh(); } // a los 10 min se apaga solo
}, 500);

// ================================================================ ENCUESTA
const SURVEY = [["intensidad", "Intensidad de la sesión", 10], ["fuerza", "Fuerza y rendimiento", 5], ["energia", "Energía", 5], ["doms", "Dolor muscular (DOMS)", 5], ["general", "¿Cómo estuvo el entrenamiento en general?", 5]];
export async function surveyView(id) {
  const s = await loadSession(id); if (!s) return "";
  const sv = s.survey || {};
  return `${head("¿Cómo te fue?", "sesion/" + id)}<div class="card">
  ${SURVEY.map(([k, l, n]) => `<div class="card-t">${l} <span class="muted">(1–${n})</span></div>${chips(k, Array.from({ length: n }, (_, i) => [i + 1, i + 1]), sv[k], "svChip")}`).join("")}
  <div class="card-t">¿Tuviste dolor o molestia articular?</div>${chips("articular", [["no", "No"], ["si", "Sí", "r"]], sv.articular, "svChip")}
  <div id="artBox" ${sv.articular === "si" ? "" : "hidden"}><input id="artD" placeholder="¿Dónde y en qué ejercicio?" value="${esc(sv.articularDet || "")}"></div>
  <div class="card-t">¿Pudiste seguir el orden de la rutina tal cual?</div>${chips("orden", [["si", "Sí"], ["no", "No"]], sv.orden, "svChip")}
  <label>Comentario (opcional)<textarea id="svC" rows="2">${esc(s.comment || "")}</textarea></label>
  <button class="btn primary big" data-a="svSave">Guardar y ver resumen</button><button class="btn ghost small block" data-a="svSkip">Omitir</button></div>`;
}
act("svChip", (el) => {
  const s = S.session; s.survey = s.survey || {}; s.survey[el.dataset.name] = isNaN(+el.dataset.v) ? el.dataset.v : +el.dataset.v;
  $$(`[data-a="svChip"][data-name="${el.dataset.name}"]`).forEach((b) => b.classList.toggle("on", b === el));
  if (el.dataset.name === "articular") $("#artBox").hidden = el.dataset.v !== "si";
});
const finish = () => { const s = S.session; s.status = "fin"; s.endedAt = s.endedAt || Date.now(); save(); go("resumen/" + s.id); };
act("svSave", () => { const s = S.session; s.survey = s.survey || {}; s.survey.articularDet = $("#artD")?.value || ""; s.comment = $("#svC").value; finish(); });
act("svSkip", finish);

// ================================================================ RESUMEN
// Una serie en el comparador: "18 kg × 7 · RIR 1". Si se pasa ref, lo que cambió se pinta (verde mejor / rojo peor).
function setCell(x, ref) {
  const c = (d) => (!ref || !d ? "" : d > 0 ? "g" : "r");
  const rn = (v) => (v === "F" ? 0 : v === "" || v == null ? null : +v);
  const dw = ref && x.w !== "" && ref.w !== "" ? +x.w - +ref.w : 0, dr = ref && x.r !== "" && ref.r !== "" ? +x.r - +ref.r : 0;
  const da = ref && rn(x.rir) != null && rn(ref.rir) != null ? rn(x.rir) - rn(ref.rir) : 0;
  return `<span class="scmp-v"><b class="${c(dw)}">${x.w || "–"} kg</b> × <b class="${c(dr)}">${x.r || "–"}</b>${x.rir !== "" && x.rir != null ? ` <span class="rir ${c(da)}">${x.rir === "F" ? "Fallo" : "RIR " + x.rir}</span>` : ""}</span>`;
}
export async function summaryView(id) {
  const s = await loadSession(id); if (!s) return "";
  document.getElementById("app")?.classList.remove("in-session");
  const sv = s.survey || {}, mins = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
  const sets = s.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done || x.w !== "").length, 0);
  const SP = sessionProgress(s, prev), nUp = SP.up.length, nComp = SP.comp;
  const PGI = { up: "▲", down: "▼", bad: "⚠", part: "▲", mix: "↕", same: "•", new: "•" };
  const audio = await loadAudio(`${P()}/audios`, s.id);
  return `${head("Resumen de la sesión", "entreno")}
  <div class="card"><h3>${esc(s.routineName)}</h3><div class="muted small">${fmtDate(s.date, true)}${mins ? ` · ${mins} min` : ""}</div>
  <div class="stats3 mt"><div><b>${s.exercises.filter((e) => e.sets.some((x) => x.w !== "" || x.done)).length}</b><small>Ejercicios</small></div><div><b>${sets}</b><small>Series</small></div><div><b>${sv.intensidad ?? sv.dureza ?? "—"}</b><small>Intensidad /10</small></div></div></div>
  ${s.exercises.map((e) => { const done = e.sets.filter((x) => x.w !== "" || x.r !== ""); if (!done.length) return ""; const xp = has("train_suggest") ? exProgress(e, prev) : null; return `<div class="card ${e.extra ? "extra" : ""}"><b>${esc(e.name)}</b>${e.extra ? ' <span class="badge b">Extra</span>' : ""}${xp && xp.k !== "new" ? ` <span class="prog ${xp.k}">${PGI[xp.k]} ${xp.t}</span>` : ""}${e.replaced ? ` <small class="muted">(en vez de ${esc(e.replacedFrom)})</small>` : ""}
    ${xp?.note ? `<div class="muted small" style="margin-top:4px">${esc(xp.note)}</div>` : ""}
    ${e.sets.map((x, j) => { if (x.w === "" && x.r === "") return ""; const ref = has("train_suggest") ? refSet(prev, e.exId, j) : null; const pg = has("train_suggest") ? setProgress(x, ref) : null;
      const lab = e.sides ? `Serie ${Math.floor(j / 2) + 1} ${j % 2 ? "der." : "izq."}` : `Serie ${j + 1}`;
      const okRef = ref && ref.w !== "" && ref.r !== "";
      return `<div class="scmp"><div class="row between"><b class="small">${lab}</b>${x.tech ? `<span class="badge tech-${x.tech}">Téc. ${x.tech}</span>` : ""}</div>
        <div class="scmp-g${okRef ? "" : " solo"}">${okRef ? `<div class="scmp-c prev"><small>Última vez${refInfo(prev, e.exId)?.date ? " · " + fmtDate(refInfo(prev, e.exId).date) : ""}</small>${setCell(ref)}</div><div class="scmp-sep"></div>` : ""}<div class="scmp-c"><small>${okRef ? "Hoy" : "Primera vez"}</small>${setCell(x, ref)}</div></div>
        ${pg && pg.k !== "new" ? `<div class="prog ${pg.k}">${PGI[pg.k]} ${esc(pg.t)}</div>` : ""}
        ${x.rir === "F" && e.target?.[j] && e.target[j].rir !== "F" && e.target[j].rir !== "" && e.target[j].rir != null ? `<div class="hint y">Tu plan no pedía llegar al fallo: la próxima vez deja al menos 1 rep en reserva</div>` : ""}</div>`; }).join("")}</div>`; }).join("")}
  ${nComp ? `<div class="card progcard"><b>${nUp} de ${nComp} ejercicio${nComp > 1 ? "s" : ""} con progreso</b><small class="muted">${[SP.part.length && `${SP.part.length} ejercicio${SP.part.length > 1 ? "s" : ""} con progreso en una serie`, SP.mix.length && `${SP.mix.length} mixto${SP.mix.length > 1 ? "s" : ""} (técnica peor en una serie)`, SP.same.length && `${SP.same.length} se mantuvo${SP.same.length > 1 ? "ron" : ""}`, SP.down.length && `${SP.down.length} bajó${SP.down.length > 1 ? "ron" : ""}`, SP.bad.length && `${SP.bad.length} con técnica peor`].filter(Boolean).join(" · ")}${SP.part.length || SP.mix.length || SP.same.length || SP.down.length || SP.bad.length ? "<br>" : ""}Comparado con la última vez que hiciste cada ejercicio. Un ejercicio progresa si mejora la primera serie (más peso, más reps o las mismas reps con más en reserva) sin empeorar la técnica.</small></div>` : ""}
  ${s.comment ? `<div class="card note">${esc(s.comment)}</div>` : ""}
  ${has("train_audio") ? `<div class="card audiofb"><div class="card-t">🎙️ Retroalimentación por audio</div><p class="muted small">Cuéntale a tu coach cómo te sentiste, qué costó, molestias, lo que quieras. Al terminar se abre WhatsApp para mandárselo (y queda guardado en su panel).</p>
    ${audio?.data ? `<audio controls src="${audio.data}"></audio><button class="btn primary big" data-a="audioShare">Enviar audio por WhatsApp</button><button class="btn ghost block" data-a="audioRec">Grabar de nuevo</button>` : `<button class="btn primary big" data-a="audioRec" id="recB">● Grabar audio</button>`}</div>` : ""}
  <div class="pad-x"><button class="btn primary big" data-a="shareImg">Compartir con tu coach</button><a class="btn block" href="#entreno">Volver</a><button class="btn ghost block red" data-a="sessDelete">Eliminar este entrenamiento</button>
  <p class="muted small center">Se abre el menú para compartir: elige WhatsApp y el chat de tu coach. Después de la primera vez, su chat aparece arriba como acceso directo.</p></div>`;
}
// Borrar una sesión ya terminada (ej. una de prueba): se elimina con su audio y el día vuelve a quedar pendiente
act("sessDelete", async () => {
  const s = S.session; if (!s) return;
  if (!(await confirmBox(`Se elimina "${s.routineName}" del ${fmtDate(s.date)} con todas sus series y su audio. No se puede deshacer. ¿Eliminar?`, "Eliminar"))) return;
  await db.del(`${P()}/sessions/${s.id}`); delAudio(`${P()}/audios`, s.id);
  S.session = null; toast("Entrenamiento eliminado"); go("entreno");
});
// ---------- Audio de retroalimentación (se guarda para el coach; máx. 3 min)
let REC = null;
act("audioRec", async () => {
  if (REC) { REC.stop(); return; }
  // Calidad: antes se grababa a 24 kbps (sonaba distorsionado). Ahora 64 kbps en m4a (o 48 kbps en Opus), mono, sin cancelación de eco (no hay llamada)
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); } catch { return toast("Activa el permiso de micrófono"); }
  const type = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: /mp4/.test(type) ? 64000 : 48000 }), chunks = [];
  const t0 = Date.now(), btn = () => $('[data-a="audioRec"]');
  mr.ondataavailable = (e) => chunks.push(e.data);
  mr.onstop = async () => {
    clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); REC = null;
    const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
    if (blob.size > 2600000) { toast("El audio es muy largo (máx. ~3 min)"); return refresh(); }
    const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    // 1) se guarda solo en el panel del coach  2) se abre WhatsApp para mandarlo sí o sí
    await saveAudio(`${P()}/audios`, S.session.id, data, { secs: Math.round((Date.now() - t0) / 1000), at: Date.now(), routine: S.session.routineName, date: S.session.date });
    S.session.audio = true; save();
    lastAudio = { id: S.session.id, blob };
    toast("Audio guardado ✓ Ahora toca “Enviar audio por WhatsApp”"); refresh();
  };
  mr.start(1000); REC = mr;
  const tick = setInterval(() => { const sec = Math.round((Date.now() - t0) / 1000); const b = btn(); if (b) b.textContent = `■ Detener (${Math.floor(sec / 60)}:${pad(sec % 60)})`; if (sec >= 180) mr.stop(); }, 500);
  const b = btn(); if (b) { b.classList.add("recording"); b.textContent = "■ Detener (0:00)"; }
});
// Android solo deja compartir ciertos tipos de archivo: el tipo debe ir "limpio" (sin ";codecs=…") y con la extensión correcta
let lastAudio = null;
function audioFile(blob, name) {
  const mp4 = /mp4|m4a|aac/.test(blob.type);
  return new File([blob], `${name}.${mp4 ? "m4a" : "weba"}`.replace(/[\\/:*?"<>|]/g, ""), { type: mp4 ? "audio/x-m4a" : "audio/webm" });
}
act("audioShare", async () => {
  let blob = lastAudio?.id === S.session.id ? lastAudio.blob : null;
  if (!blob) { const a = await loadAudio(`${P()}/audios`, S.session.id); if (!a?.data) return; blob = await (await fetch(a.data)).blob(); lastAudio = { id: S.session.id, blob }; }
  const file = audioFile(blob, `Audio ${S.session.routineName} ${S.session.date}`);
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `🎙️ ${S.session.routineName} · ${fmtDate(S.session.date, true)}` }); }
  catch (e) { if (e.name === "AbortError") return; }
  // Último recurso: lo descarga para adjuntarlo a mano (igual ya quedó guardado en el panel de tu coach)
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  toast("Audio descargado: adjúntalo en WhatsApp (tu coach igual ya lo tiene en su panel)", 3500);
});

// Resumen como imagen (para mandarlo por WhatsApp como una captura ordenada)
const TECHC = { igual: "#22c55e", mejor: "#3b82f6", peor: "#ef4444" };
async function sessionImage(s) {
  const W = 1080, P = 56, sv = s.survey || {};
  const exs = s.exercises.filter((e) => e.sets.some((x) => x.w !== "" || x.r !== ""));
  const lines = exs.reduce((t, e) => t + 1.6 + e.sets.filter((x) => x.w !== "" || x.r !== "").length, 0);
  const H = Math.round(330 + lines * 46 + exs.length * 28 + (s.comment ? 120 : 0) + 90);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  g.fillStyle = "#0b0b0d"; g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W / 2, -100, 50, W / 2, -100, 900); grd.addColorStop(0, "rgba(160,15,25,.45)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, 0, W, 600);
  try { const im = new Image(); im.src = "icons/logo.png?v=ima2"; await im.decode(); g.save(); g.beginPath(); g.roundRect(P, 48, 120, 120, 28); g.clip(); g.drawImage(im, P, 48, 120, 120); g.restore(); } catch {}
  const F = (w, sz) => `${w} ${sz}px Inter, system-ui, sans-serif`;
  g.fillStyle = "#fff"; g.font = F(800, 52); g.fillText(s.routineName, P + 150, 104);
  g.fillStyle = "#a1a1aa"; g.font = F(500, 30); g.fillText(`${fmtDate(s.date, true)}${s.endedAt ? " · " + Math.round((s.endedAt - s.startedAt) / 60000) + " min" : ""}`, P + 150, 150);
  let y = 230;
  if (sv.intensidad) { const st = [["Intensidad", `${sv.intensidad}/10`], ["Fuerza", `${sv.fuerza ?? "–"}/5`], ["Energía", `${sv.energia ?? "–"}/5`], ["DOMS", `${sv.doms ?? "–"}/5`]]; const cw = (W - P * 2 - 30) / 4;
    st.forEach(([l, v], k) => { const x = P + k * (cw + 10); g.fillStyle = "#17171b"; g.beginPath(); g.roundRect(x, y - 40, cw, 86, 18); g.fill(); g.fillStyle = "#fff"; g.font = F(800, 34); g.fillText(v, x + 20, y + 4); g.fillStyle = "#8b8b93"; g.font = F(600, 20); g.fillText(l.toUpperCase(), x + 20, y + 32); });
    y += 90; }
  exs.forEach((e, k) => {
    const col = e.extra ? "#3b82f6" : exColor(exNum(s.exercises, s.exercises.indexOf(e)) - 1), sets = e.sets.map((x, j) => [x, j]).filter(([x]) => x.w !== "" || x.r !== "");
    const h = 64 + sets.length * 46;
    g.fillStyle = "#141418"; g.beginPath(); g.roundRect(P, y, W - P * 2, h, 22); g.fill();
    g.fillStyle = col; g.beginPath(); g.roundRect(P, y, 10, h, [22, 0, 0, 22]); g.fill();
    g.fillStyle = "#fff"; g.font = F(800, 32); g.fillText((e.extra ? "+ " : "") + e.name, P + 34, y + 46);
    let yy = y + 92;
    sets.forEach(([x, j]) => {
      const lab = e.sides ? `S${Math.floor(j / 2) + 1} ${j % 2 ? "Der" : "Izq"}` : `S${j + 1}`;
      g.fillStyle = "#8b8b93"; g.font = F(700, 26); g.fillText(lab, P + 34, yy);
      g.fillStyle = "#fff"; g.font = F(700, 30); g.fillText(`${x.w || "–"} kg × ${x.r || "–"}`, P + 170, yy);
      if (x.rir !== "") { g.fillStyle = "#e0313b"; g.font = F(800, 26); g.fillText(`RIR ${x.rir}`, P + 450, yy); }
      if (x.tech) { const tc = TECHC[x.tech]; g.fillStyle = tc + "33"; g.beginPath(); g.roundRect(P + 560, yy - 28, 150, 38, 19); g.fill(); g.fillStyle = tc; g.font = F(700, 21); g.fillText(`Téc. ${x.tech}`, P + 578, yy - 2); }
      const pg = setProgress(x, refSet(prev, e.exId, j)); if (pg && pg.k !== "new") { g.fillStyle = ({ up: "#22c55e", down: "#ef4444", bad: "#f59e0b", same: "#a1a1aa" }[pg.k] || "#a1a1aa"); g.font = F(700, 21); const tt = (pg.k === "up" ? "▲ " : pg.k === "down" ? "▼ " : "") + (pg.s || pg.t); g.fillText(tt.length > 26 ? tt.slice(0, 25) + "…" : tt, P + 725, yy - 2); }
      if (x.note) { g.fillStyle = "#a1a1aa"; g.font = F(500, 20); g.fillText("✎", W - P - 40, yy - 2); }
      yy += 46;
    });
    y += h + 24;
  });
  if (s.comment) { g.fillStyle = "#a1a1aa"; g.font = F(500, 26); g.fillText("💬 " + s.comment.slice(0, 70) + (s.comment.length > 70 ? "…" : ""), P, y + 40); y += 100; }
  g.fillStyle = "#55555c"; g.font = F(600, 22); g.fillText("IMA · Inteligencia Muscular Aplicada", P, H - 36);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
act("shareImg", async () => {
  const s = S.session; toast("Preparando imagen…");
  const blob = await sessionImage(s), file = new File([blob], `${s.routineName} ${s.date}.png`.replace(/[\\/:*?"<>|]/g, ""), { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `${s.routineName} · ${fmtDate(s.date, true)}` }); } catch (e) { if (e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); toast("Imagen descargada: adjúntala en WhatsApp");
});
