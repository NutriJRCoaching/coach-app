// Entrenamiento del cliente: semana, sesión en curso, encuesta y resumen
import { CONFIG } from "./config.js";
import { db } from "./db.js";
import { S, refresh, go } from "./state.js";
import { act, toast, sheet, closeSheet, chips, beep, notify, confirmBox, $, $$ } from "./ui.js";
import { LS, esc, ymd, fmtDate, weekInfo, r1, num, embedUrl, uid, pad, parseYmd, D3, compressImage } from "./util.js";
import { getRoutines, getSessions, weekPlan, prevSession, refSet, newSession, suggest, splitSides, setProgress } from "./data.js";
import { I } from "./icons.js";

const P = () => "clients/" + S.cid;
const head = (t, back, right = "") => `<header class="ch">${back ? `<a href="#${back}" class="icon-btn">${I.back}</a>` : "<span></span>"}<h2>${esc(t)}</h2><span class="right">${right}</span></header>`;
const STATUS = { hecho: "Hecho", hoy: "Hoy", atrasado: "Atrasado", proximo: "Próximo" };
const TECH = { "": "–", peor: "↓", igual: "=", mejor: "↑" };
const TECH_NEXT = { "": "igual", igual: "mejor", mejor: "peor", peor: "" };
const TECH_L = { "": "Técnica", peor: "↓ Peor", igual: "= Igual", mejor: "↑ Mejor" };
const EXC = ["#e0313b", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#f97316", "#06b6d4"];
const exColor = (i) => EXC[i % EXC.length];
const planTxt = (t) => `${esc(t.reps || "–")} reps${t.rir !== "" && t.rir != null ? ` @RIR ${t.rir}` : ""}`;

// ================================================================ TU SEMANA
export async function trainView() {
  const [routines, sessions] = await Promise.all([getRoutines(S.cid), getSessions(S.cid)]);
  const plan = weekPlan(S.client, routines, sessions);
  const cur = sessions.find((s) => s.status === "curso");
  const changed = routines.filter((r) => r.changes?.week === plan.week.key);
  const today = ymd();
  const day = (d) => { const dt = parseYmd(d); return `<span class="sd2"><b>${D3[dt.getDay()]}</b>${dt.getDate()}</span>`; };
  return `${head("Entrenamiento")}
  <div class="card"><div class="row between"><div><div class="card-t" style="margin:0">Semana ${plan.week.n}</div><div class="muted small">${fmtDate(plan.week.first)} – ${fmtDate(plan.week.last)}</div></div><div class="big">${plan.doneCount}<small>/${plan.planned.length}</small></div></div>
  <div class="progress"><i style="width:${plan.planned.length ? (plan.doneCount / plan.planned.length) * 100 : 0}%"></i></div></div>
  ${cur ? `<div class="card row between" style="border-color:var(--acc)"><span><small class="muted">Sesión en curso${cur.date !== today ? " · desde el " + fmtDate(cur.date) : ""}</small><br><b>${esc(cur.routineName)}</b></span><span class="row gap"><button class="btn tiny ghost" data-a="discardById" data-id="${cur.id}">Descartar</button><a class="btn primary small" href="#sesion/${cur.id}">Continuar</a></span></div>` : ""}
  ${changed.length ? `<div class="card mod"><b>Esta semana hubo modificaciones en tu rutina</b><ul>${changed.flatMap((r) => (r.changes.list || []).map((x) => `<li><b>${esc(r.name)}:</b> ${esc(x)}</li>`)).join("")}</ul></div>` : ""}
  <div class="slots">${plan.slots.map((s) => s.rest
    ? `<div class="slot rest ${s.date === today ? "today" : ""}">${day(s.date)}<span class="rest-t">${s.date === today ? "Hoy · " : ""}Descanso</span></div>`
    : `<div class="slot ${s.status}">${day(s.date)}<span class="grow"><b>${esc(s.name)}</b><span class="badge ${s.status}">${STATUS[s.status]}</span></span>
      ${s.status === "hecho" ? `<a class="btn tiny" href="#resumen/${s.session.id}">Ver</a>` : `<button class="btn tiny ${s.status === "hoy" || s.status === "atrasado" ? "primary" : ""}" data-a="startRoutine" data-r="${s.rid}">Empezar</button>`}</div>`).join("")}</div>
  <div class="card"><div class="card-t">Todas tus rutinas</div>${routines.map((r) => `<div class="li row between"><span><b>${esc(r.name)}</b><small class="muted"> · ${r.exercises?.length || 0} ejercicios${r.changes?.week === plan.week.key ? ' · <span class="red">modificada</span>' : ""}</small></span><button class="btn tiny" data-a="startRoutine" data-r="${r.id}">Empezar</button></div>`).join("") || `<p class="muted small">Tu coach aún no carga tus rutinas.</p>`}</div>`;
}
act("startRoutine", async (el) => {
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
  prev = S.session ? prevSession(sessions, S.session) : null;
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
  <div class="extabs">${s.exercises.map((e, k) => { const done = e.sets.length && e.sets.every((x) => x.done); return `<button class="${k === i ? "on" : ""} ${done ? "done" : ""} ${e.extra ? "extra" : ""} ${e.changed ? "chg" : ""}" style="--exc:${exColor(k)}" data-a="exGo" data-i="${k}">${k + 1}</button>`; }).join("")}</div>
  <div class="card ex ${ex.extra ? "extra" : ""}" style="--exc:${exColor(i)}">
    <div class="ex-h"><h3>${esc(ex.name)}${ex.changed ? ' <span class="badge r">Modificado</span>' : ""}${ex.extra ? ' <span class="badge b">Extra</span>' : ""}</h3><button class="btn tiny ${ex.sides ? "primary" : "ghost"}" data-a="toggleSides" title="Anotar cada lado por separado">Izq / Der</button></div>
    <button class="tips" data-a="tips"><span class="ti-ic">${I.play}</span><span><b>Tips de ejecución</b><small>${[ex.video ? "Video" : "", ex.notes ? "Indicaciones" : "", "Configuración", ex.alts?.length ? "Reemplazos de emergencia" : ""].filter(Boolean).join(" · ")}${exNote.text ? " ●" : ""}</small></span>${I.chev}</button>
    ${ex.target.length ? `<div class="goal"><small>Lo que tienes que hacer hoy${ex.sides ? " · cada lado" : ""}</small><div>${(ex.sides ? ex.target.filter((_, k) => k % 2 === 0) : ex.target).map((t, j) => `<span><b>Serie ${j + 1}</b>${planTxt(t)}</span>`).join("")}</div></div>` : `<div class="goal"><small>Series libres</small></div>`}
    <div class="sets"><div class="sh"><span>Serie</span><span>Peso kg</span><span>Reps</span><span>RIR</span><span>Técnica</span></div>
    ${ex.sets.map((st, j) => setRow(ex, i, j)).join("")}</div>
    <div class="row gap"><button class="btn tiny" data-a="addSet">${I.plus} Serie</button>${ex.sets.length > (ex.target.length || 0) ? `<button class="btn tiny ghost" data-a="delSet">Quitar serie</button>` : ""}<span class="grow"></span><span class="muted small">Técnica vs. semana pasada</span></div>
    <div id="sug-${i}">${sugHtml(ex)}</div>
  </div>
  <div class="row gap pad-x"><button class="btn ghost small grow" data-a="addExtra">${I.plus} Ejercicio extra</button><button class="btn ghost small grow" data-a="sessComment">${I.note} Comentario${s.comment ? " ●" : ""}</button></div>
  <div class="sessbar"><button class="btn" data-a="exGo" data-i="${i - 1}" ${i === 0 ? "disabled" : ""}>${I.back} Anterior</button>
    <button class="rest-btn ${S.rest ? "running" : ""}" data-a="${S.rest ? "restStop" : "restStart"}">${I.timer}<span id="restT">${S.rest ? fmtRest() : "Descanso " + fmtSec(restSec())}</span></button>
    <button class="btn" data-a="exGo" data-i="${i + 1}" ${i >= s.exercises.length - 1 ? "disabled" : ""}>Siguiente ${I.chev}</button></div>`;
}
function setRow(ex, i, j) {
  const st = ex.sets[j], ref = refSet(prev, ex.exId, j), t = ex.target[j] || {};
  const grp = ex.sides && j % 2 === 0 ? `<div class="sgrp"><b>Serie ${j / 2 + 1}</b><span id="diff-${i}-${j / 2}">${pairDiff(ex, j / 2)}</span></div>` : "";
  return `${grp}<div class="set ${st.done ? "done" : ""} ${ex.sides ? "sided" : ""}" id="set-${i}-${j}"><span class="sn">${ex.sides ? `<small class="side ${j % 2 ? "d" : "i"}">– ${j % 2 ? "Der." : "Izq."}</small>` : `<b>${j + 1}</b>`}</span>
  <input type="number" inputmode="decimal" step="0.5" value="${st.w}" placeholder="${ref?.w ?? ""}" data-a-change="setVal" data-j="${j}" data-k="w">
  <input type="number" inputmode="numeric" value="${st.r}" placeholder="${ref?.r ?? (parseInt(t.reps) || "")}" data-a-change="setVal" data-j="${j}" data-k="r">
  <button class="rirb ${st.rir === "" ? "" : "rir" + st.rir}" data-a="rirPick" data-j="${j}">${st.rir === "" ? "–" : st.rir}</button>
  <button class="techb ${st.tech || ""}" data-a="techPick" data-j="${j}">${TECH_L[st.tech || ""]}</button>
  <div class="setinfo" id="si-${i}-${j}">${setInfo(ex, j)}</div></div>`;
}
// Diferencia entre lados de una misma serie
function pairDiff(ex, p) {
  const a = ex.sets[p * 2], b = ex.sets[p * 2 + 1]; if (!a || !b || a.r === "" || b.r === "") return "";
  const dr = b.r - a.r, dw = a.w !== "" && b.w !== "" ? r1(b.w - a.w) : 0;
  if (!dr && !dw) return `<span class="g">Lados parejos ✓</span>`;
  const parts = []; if (dw) parts.push(`${dw > 0 ? "+" : ""}${dw} kg`); if (dr) parts.push(`${dr > 0 ? "+" : ""}${dr} rep${Math.abs(dr) > 1 ? "s" : ""}`);
  return `<span class="${dr < 0 || dw < 0 ? "y" : "b"}">Der. vs Izq.: ${parts.join(" · ")}</span>`;
}
function setInfo(ex, j) {
  const st = ex.sets[j], ref = refSet(prev, ex.exId, j);
  let h = "";
  if (ref) {
    const dw = st.w !== "" && ref.w !== "" ? r1(st.w - ref.w) : null, dr = st.r !== "" && ref.r !== "" ? st.r - ref.r : null;
    h += `<span>Sem. pasada: <b>${ref.w || "–"} × ${ref.r || "–"}</b>${ref.rir !== "" && ref.rir != null ? " RIR " + ref.rir : ""}</span>`;
    if (dw) h += `<span class="${dw > 0 ? "g" : "r"}">${dw > 0 ? "+" : ""}${dw} kg</span>`;
    if (dr) h += `<span class="${dr > 0 ? "g" : "r"}">${dr > 0 ? "+" : ""}${dr} reps</span>`;
  }
  h += `<button class="lnk" data-a="setNote" data-j="${j}">${st.note ? "Nota: " + esc(st.note) : "+ nota"}</button><button class="lnk vid ${st.vid ? "on" : ""}" data-a="setVideo" data-j="${j}">${st.vid ? "🎥 Ver tu video" : "🎥 Subir video de tu serie"}</button>`;
  if (ref?.note) h += `<span class="lastnote">Tu nota de la semana pasada: ${esc(ref.note)}</span>`;
  return h;
}
function sugHtml(ex) {
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
  sheet(`Nota · serie ${j + 1}`, `${ref?.note ? `<div class="note">Semana pasada: ${esc(ref.note)}</div>` : ""}<textarea id="sNt" rows="3" placeholder="Ej: primera serie muy liviana">${esc(cur().sets[j].note || "")}</textarea><button class="btn primary big" data-a="setNoteSave" data-j="${j}">Guardar</button>`);
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
  : st.vid ? `<p class="muted small">Este video se grabó en otro celular o se borró de este.</p>` : `<p class="muted small">Graba tu serie o elígela de la galería. Queda guardada en tu celular junto a la serie y desde aquí se la mandas a tu coach.</p>
    <label class="btn primary big">🎥 Grabar o elegir video<input type="file" accept="video/*" hidden data-a-change="vidPick" data-j="${j}"></label>`}
  <label class="mt">Enlace para tu coach (opcional: Drive o YouTube)<input id="vLk" placeholder="https://…" value="${esc(st.vlink || "")}" data-a-change="vidLink" data-j="${j}"></label>`);
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
  <div class="card-t mt">${I.play}Ejecución</div>
  ${e ? `<div class="video"><iframe src="${e}" allowfullscreen></iframe></div>` : ex.video ? `<a class="btn primary block" target="_blank" href="${esc(ex.video)}">${I.play} Ver video</a>` : `<p class="muted small">Tu coach aún no carga el video de este ejercicio.</p>`}
  <div class="card-t mt">Tips de ejecución</div>
  ${tips.length ? `<ul class="tiplist">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted small">Tu coach aún no carga los tips de este ejercicio.</p>`}
  ${ex.alts?.length ? `<div class="card-t mt">${I.swap}Reemplazos de emergencia</div><p class="muted small">Si la máquina está ocupada o no está disponible (mismo patrón de movimiento):</p>
  ${ex.alts.map((a, k) => `<div class="li row between"><b>${esc(a.name)}</b><span class="row gap">${a.video ? `<a class="btn tiny" target="_blank" href="${esc(a.video)}">Video</a>` : ""}<button class="btn tiny primary" data-a="useAlt" data-k="${k}">Usar</button></span></div>`).join("")}` : ""}`);
});
act("useAlt", (el) => {
  const ex = cur(), a = ex.alts[+el.dataset.k];
  ex.replacedFrom = ex.replacedFrom || ex.name; ex.name = a.name; ex.video = a.video || ""; ex.replaced = true;
  save(); closeSheet(); toast("Reemplazado por " + a.name); refresh();
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
act("addExtra", () => sheet("Ejercicio extra", `<p class="muted small">Quedará marcado en otro color para que tu coach lo vea.</p><input id="xN" placeholder="Nombre del ejercicio"><button class="btn primary big" data-a="addExtraOk">Añadir</button>`));
act("addExtraOk", () => {
  const name = $("#xN").value.trim(); if (!name) return;
  S.session.exercises.push({ exId: "x-" + uid(), name, extra: true, target: [], alts: [], sets: [{ w: "", r: "", rir: "", note: "", tech: "", done: false }], inc: 2.5 });
  S.exIdx = S.session.exercises.length - 1; save(); closeSheet(); refresh();
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
const fmtRest = () => fmtSec(Math.max(0, Math.ceil((S.rest.end - Date.now()) / 1000)));
const restSec = () => { const v = +LS.get("restSec"); return v > 0 ? v : cur()?.rest || S.client.rest || CONFIG.defaultRest; };
act("restStart", () => {
  sheet("Descanso", `<div class="restpick"><button class="btn" data-a="restPickAdj" data-n="-15">−15 s</button><b id="rpT">${fmtSec(restSec())}</b><button class="btn" data-a="restPickAdj" data-n="15">+15 s</button></div>
  <div class="chips">${[60, 90, 120, 150, 180, 240].map((x) => `<button class="chip" data-a="restPickSet" data-n="${x}">${fmtSec(x)}</button>`).join("")}</div>
  <button class="btn primary big" data-a="restGo">Iniciar descanso</button>`);
});
act("restPickAdj", (el) => { const v = Math.max(15, restSec() + +el.dataset.n); LS.set("restSec", v); $("#rpT").textContent = fmtSec(v); });
act("restPickSet", (el) => { LS.set("restSec", +el.dataset.n); $("#rpT").textContent = fmtSec(+el.dataset.n); });
act("restGo", () => { S.rest = { end: Date.now() + restSec() * 1000, fired: false }; closeSheet(); refresh(); });
act("restStop", () => { S.rest = null; refresh(); });
act("restAdj", (el) => { if (S.rest) S.rest.end += +el.dataset.n * 1000; });
export function restBar() {
  if (!S.rest || S.route[0] === "sesion") return "";
  return `<div class="restbar"><button data-a="restAdj" data-n="-15">−15</button><div><small>Descanso</small><b id="restT">${fmtRest()}</b></div><button data-a="restAdj" data-n="15">+15</button><button data-a="restStop">✕</button></div>`;
}
setInterval(() => {
  const c = $("#clock"); if (c && S.session) c.textContent = timeSince(S.session.startedAt);
  if (!S.rest) return;
  const t = $("#restT"); if (t) t.textContent = fmtRest();
  if (Date.now() >= S.rest.end && !S.rest.fired) { S.rest.fired = true; beep(); notify("Terminó tu descanso", "Vamos con la siguiente serie 💪"); setTimeout(() => { S.rest = null; refresh(); }, 1500); }
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
export async function summaryView(id) {
  const s = await loadSession(id); if (!s) return "";
  document.getElementById("app")?.classList.remove("in-session");
  const sv = s.survey || {}, mins = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
  const sets = s.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done || x.w !== "").length, 0);
  const prog = s.exercises.flatMap((e) => e.sets.map((x, j) => setProgress(x, refSet(prev, e.exId, j)))).filter(Boolean);
  const nUp = prog.filter((p) => p.k === "up").length, nComp = prog.filter((p) => p.k !== "new").length;
  const audio = await db.get(`${P()}/audios/${s.id}`);
  return `${head("Resumen de la sesión", "entreno")}
  <div class="card"><h3>${esc(s.routineName)}</h3><div class="muted small">${fmtDate(s.date, true)}${mins ? ` · ${mins} min` : ""}</div>
  <div class="stats3 mt"><div><b>${s.exercises.filter((e) => e.sets.some((x) => x.w !== "" || x.done)).length}</b><small>Ejercicios</small></div><div><b>${sets}</b><small>Series</small></div><div><b>${sv.intensidad ?? sv.dureza ?? "—"}</b><small>Intensidad /10</small></div></div></div>
  ${s.exercises.map((e) => { const done = e.sets.filter((x) => x.w !== "" || x.r !== ""); if (!done.length) return ""; return `<div class="card ${e.extra ? "extra" : ""}"><b>${esc(e.name)}</b>${e.extra ? ' <span class="badge b">Extra</span>' : ""}${e.replaced ? ` <small class="muted">(en vez de ${esc(e.replacedFrom)})</small>` : ""}
    ${e.sets.map((x, j) => { if (x.w === "" && x.r === "") return ""; const ref = refSet(prev, e.exId, j); const dw = ref && x.w !== "" && ref.w !== "" ? r1(x.w - ref.w) : 0, dr = ref && x.r !== "" && ref.r !== "" ? x.r - ref.r : 0;
      return `<div class="li row between small"><span>${e.sides ? `Serie ${Math.floor(j / 2) + 1} ${j % 2 ? "der." : "izq."}` : `Serie ${j + 1}`}: <b>${x.w || "–"} kg × ${x.r || "–"}</b>${x.rir !== "" ? " RIR " + x.rir : ""}${x.tech ? ` <span class="badge tech-${x.tech}">Téc. ${x.tech}</span>` : ""}${(() => { const pg = setProgress(x, ref); return pg ? `<br><span class="prog ${pg.k}">${pg.k === "up" ? "▲" : pg.k === "down" ? "▼" : pg.k === "bad" ? "⚠" : "•"} ${pg.t}</span>` : ""; })()}</span><span>${ref ? `<span class="muted">${ref.w}×${ref.r}</span> ${dw ? `<span class="${dw > 0 ? "g" : "r"}">${dw > 0 ? "+" : ""}${dw}kg</span>` : ""} ${dr ? `<span class="${dr > 0 ? "g" : "r"}">${dr > 0 ? "+" : ""}${dr}r</span>` : ""}` : ""}</span></div>`; }).join("")}</div>`; }).join("")}
  ${nComp ? `<div class="card progcard"><b>${nUp} de ${nComp} series con progreso</b><small class="muted">vs la semana pasada · cuenta subir peso, más reps, o mismas reps con más reserva (si la técnica no empeoró)</small></div>` : ""}
  ${s.comment ? `<div class="card note">${esc(s.comment)}</div>` : ""}
  <div class="card audiofb"><div class="card-t">🎙️ Retroalimentación por audio</div><p class="muted small">Cuéntale a tu coach cómo te sentiste, qué costó, molestias, lo que quieras. Le llega directo a su panel.</p>
    ${audio?.data ? `<audio controls src="${audio.data}"></audio><div class="row gap"><button class="btn grow" data-a="audioRec">Grabar de nuevo</button><button class="btn ghost grow" data-a="audioShare">Enviar por WhatsApp</button></div>` : `<button class="btn primary big" data-a="audioRec" id="recB">● Grabar audio</button>`}</div>
  <div class="pad-x"><button class="btn primary big" data-a="shareImg">Compartir con tu coach (imagen)</button><button class="btn block" data-a="shareCoach">Enviar como texto</button><a class="btn block" href="#entreno">Volver</a></div>`;
}
// ---------- Audio de retroalimentación (se guarda para el coach; máx. 3 min)
let REC = null;
act("audioRec", async () => {
  if (REC) { REC.stop(); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("Activa el permiso de micrófono"); }
  const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
  const mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 }), chunks = [];
  const t0 = Date.now(), btn = () => $('[data-a="audioRec"]');
  mr.ondataavailable = (e) => chunks.push(e.data);
  mr.onstop = async () => {
    clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); REC = null;
    const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
    if (blob.size > 700000) { toast("El audio es muy largo (máx. ~3 min)"); return refresh(); }
    const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    await db.set(`${P()}/audios/${S.session.id}`, { data, secs: Math.round((Date.now() - t0) / 1000), at: Date.now(), routine: S.session.routineName, date: S.session.date }, false);
    S.session.audio = true; save(); toast("Audio guardado · tu coach lo verá en su panel"); refresh();
  };
  mr.start(1000); REC = mr;
  const tick = setInterval(() => { const sec = Math.round((Date.now() - t0) / 1000); const b = btn(); if (b) b.textContent = `■ Detener (${Math.floor(sec / 60)}:${pad(sec % 60)})`; if (sec >= 180) mr.stop(); }, 500);
  const b = btn(); if (b) { b.classList.add("recording"); b.textContent = "■ Detener (0:00)"; }
});
act("audioShare", async () => {
  const a = await db.get(`${P()}/audios/${S.session.id}`); if (!a?.data) return;
  const blob = await (await fetch(a.data)).blob(), file = new File([blob], `Audio ${S.session.routineName}.webm`, { type: blob.type });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] }); } catch (e) { if (e.name === "AbortError") return; }
  toast("Tu celular no permite compartir audio desde aquí");
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
  try { const im = new Image(); im.src = "icons/logo.png"; await im.decode(); g.save(); g.beginPath(); g.roundRect(P, 48, 120, 120, 28); g.clip(); g.drawImage(im, P, 48, 120, 120); g.restore(); } catch {}
  const F = (w, sz) => `${w} ${sz}px Inter, system-ui, sans-serif`;
  g.fillStyle = "#fff"; g.font = F(800, 52); g.fillText(s.routineName, P + 150, 104);
  g.fillStyle = "#a1a1aa"; g.font = F(500, 30); g.fillText(`${fmtDate(s.date, true)}${s.endedAt ? " · " + Math.round((s.endedAt - s.startedAt) / 60000) + " min" : ""}`, P + 150, 150);
  let y = 230;
  if (sv.intensidad) { const st = [["Intensidad", `${sv.intensidad}/10`], ["Fuerza", `${sv.fuerza ?? "–"}/5`], ["Energía", `${sv.energia ?? "–"}/5`], ["DOMS", `${sv.doms ?? "–"}/5`]]; const cw = (W - P * 2 - 30) / 4;
    st.forEach(([l, v], k) => { const x = P + k * (cw + 10); g.fillStyle = "#17171b"; g.beginPath(); g.roundRect(x, y - 40, cw, 86, 18); g.fill(); g.fillStyle = "#fff"; g.font = F(800, 34); g.fillText(v, x + 20, y + 4); g.fillStyle = "#8b8b93"; g.font = F(600, 20); g.fillText(l.toUpperCase(), x + 20, y + 32); });
    y += 90; }
  exs.forEach((e, k) => {
    const col = exColor(s.exercises.indexOf(e)), sets = e.sets.map((x, j) => [x, j]).filter(([x]) => x.w !== "" || x.r !== "");
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
      const pg = setProgress(x, refSet(prev, e.exId, j)); if (pg && pg.k !== "new") { g.fillStyle = { up: "#22c55e", down: "#ef4444", bad: "#f59e0b", same: "#a1a1aa" }[pg.k]; g.font = F(700, 21); const tt = (pg.k === "up" ? "▲ " : pg.k === "down" ? "▼ " : "") + pg.t; g.fillText(tt.length > 26 ? tt.slice(0, 25) + "…" : tt, P + 725, yy - 2); }
      if (x.note) { g.fillStyle = "#a1a1aa"; g.font = F(500, 20); g.fillText("✎", W - P - 40, yy - 2); }
      yy += 46;
    });
    y += h + 24;
  });
  if (s.comment) { g.fillStyle = "#a1a1aa"; g.font = F(500, 26); g.fillText("💬 " + s.comment.slice(0, 70) + (s.comment.length > 70 ? "…" : ""), P, y + 40); y += 100; }
  g.fillStyle = "#55555c"; g.font = F(600, 22); g.fillText("Team JR · Coach Online", P, H - 36);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
act("shareImg", async () => {
  const s = S.session; toast("Preparando imagen…");
  const blob = await sessionImage(s), file = new File([blob], `${s.routineName} ${s.date}.png`.replace(/[\\/:*?"<>|]/g, ""), { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `${s.routineName} · ${fmtDate(s.date, true)}` }); } catch (e) { if (e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); toast("Imagen descargada: adjúntala en WhatsApp");
});
act("shareCoach", () => {
  const s = S.session, sv = s.survey || {};
  let t = `*${s.routineName}* · ${fmtDate(s.date, true)}\n`;
  if (sv.intensidad) t += `Intensidad ${sv.intensidad}/10 · Fuerza ${sv.fuerza ?? "–"}/5 · Energía ${sv.energia ?? "–"}/5 · DOMS ${sv.doms ?? "–"}/5\n`;
  if (sv.articular === "si") t += `⚠ Molestia articular: ${sv.articularDet || "sí"}\n`;
  if (sv.orden === "no") t += `Cambió el orden de la rutina\n`;
  for (const e of s.exercises) {
    const d = e.sets.filter((x) => x.w !== "" || x.r !== ""); if (!d.length) continue;
    t += `\n${e.extra ? "➕ " : ""}${e.name}\n`;
    e.sets.forEach((x, j) => { if (x.w === "" && x.r === "") return; const ref = refSet(prev, e.exId, j); t += `  ${e.sides ? (j % 2 ? "Der " : "Izq ") : ""}${x.w}kg × ${x.r}${x.rir !== "" ? " RIR" + x.rir : ""}${x.tech ? ` (téc. ${x.tech})` : ""}${ref ? `  (sem. pasada ${ref.w}×${ref.r})` : ""}\n`; });
  }
  if (s.comment) t += `\n💬 ${s.comment}`;
  window.open(`https://wa.me/${CONFIG.coachWhatsapp}?text=${encodeURIComponent(t)}`, "_blank");
});
