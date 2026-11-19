// Vistas del cliente (celular)
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, refresh, go } from "./state.js";
import { act, toast, sheet, closeSheet, bar, lineChart, chips, confirmBox, promptBox, notify, $, $$ } from "./ui.js";
import { diffDays } from "./util.js";
import { esc, ymd, addDays, fmtDate, weekInfo, dayTotals, itemMacros, sleepHours, sleepColor, r0, r1, num, avg, sum, uid, hm, compressImage, trend, D1, D3, MONTHS, embedUrl, parseYmd, pad, LS } from "./util.js";
import { mealList, getDay, setDay, getDays, getRoutines, getSessions, weekPlan, getFoodBase, getOffCL, foodCheck, MEASURE_ZONES, PHOTO_TYPES, applyStage, stageAt, stagesBar, phaseColor, CHECKIN } from "./data.js";
import { trainView, sessionView, surveyView, summaryView, restBar } from "./train.js";
import { I } from "./icons.js";
import { macroGuide, adjTxt, judge, weightCorr, waterAuto, payMsg } from "./data.js";
import { has, loadMatrix } from "./features.js";
import { maybeOnboard } from "./onboarding.js";
import { pushReady, enablePush, pushOn, refreshPush } from "./push.js";
import { parseMeal, describe, medidaInfo, estimateGrams, speechSupported, listen } from "./voice.js";
import { menusHtml, shoppingView } from "./menus.js";

const P = () => "clients/" + S.cid;

export function clientTabs() {
  const r = S.route[0];
  const t = [["inicio", "Inicio", I.home], ["comida", "Comida", I.food], ["entreno", "Entreno", I.dumbbell], ["progreso", "Progreso", I.chart], ["mas", "Más", I.menu]].filter(([k]) => (k !== "comida" || has("food_log")) && (k !== "entreno" || has("train_tab")));
  const active = { sesion: "entreno", encuesta: "entreno", resumen: "entreno", peso: "progreso", sueno: "progreso", fotos: "progreso", medidas: "progreso", timeline: "progreso", plan: "mas", compras: "mas", checkin: "mas", guias: "mas", equipo: "mas", info: "mas", ajustes: "mas", agua: "comida" }[r] || r;
  return `${restBar()}<nav class="tabs">${t.map(([k, l, i]) => `<a href="#${k}" class="${active === k ? "on" : ""}">${i}${l}</a>`).join("")}</nav>`;
}

export async function clientView() {
  const [r, a] = S.route;
  S.client = applyStage(S.raw || {}, S.date); // objetivos de la etapa vigente
  await loadMatrix();
  // Agua automática: 40 ml por kg del último peso (si el coach no fijó una meta a mano)
  if (!S.raw?.water && !(S.client.stage?.water)) { const dd = await getDays(addDays(ymd(), -30), ymd()); const kg = Object.keys(dd).sort().map((k) => weightCorr(dd[k])).filter(Boolean).pop() || S.raw?.weightStart; if (kg) S.client.water = waterAuto(kg); }
  S.feat = { macroGuide: has("macro_guide"), selfTrain: has("train_self") };
  // Solo entrenamiento: si el coach no fijó metas exactas, las metas del día son el punto medio de su guía de macros
  if (S.feat.macroGuide && !S.client.kcal) { const g = macroGuide(S.client, S.client.weightStart); if (g) Object.assign(S.client, { prot: Math.round((g.prot[0] + g.prot[1]) / 2), fat: Math.round((g.fat[0] + g.fat[1]) / 2), cho: Math.round((g.cho[0] + g.cho[1]) / 2), kcal: Math.round((g.kcal[0] + g.kcal[1]) / 2) }); }
  // Solo nutrición: el calendario sale de los días que el cliente le puso a cada rutina suya
  if (S.feat.selfTrain) { const rs = await getRoutines(S.cid); S.client.schedule = {}; rs.forEach((r) => (r.days || []).forEach((d) => (S.client.schedule[d] = r.id))); }
  if (["inicio", "comida", "agua", "peso", "sueno", undefined, ""].includes(r)) S.rtNames = Object.fromEntries((await getRoutines(S.cid)).map((x) => [x.id, x.name]));
  const views = { inicio: home, comida: food, agua: waterView, entreno: trainView, sesion: () => sessionView(a), encuesta: () => surveyView(a), resumen: () => summaryView(a),
    progreso: progress, timeline: timelineView, peso: weightView, sueno: sleepView, fotos: photosView, medidas: measuresView,
    mas: more, plan: planView, compras: () => shoppingView(head), checkin: checkinView, guias: guidesView, equipo: equipView, info: infoView, ajustes: settingsView };
  return (views[r] || home)();
}

const head = (title, back, right = "") => `<header class="ch">${back ? `<a href="#${back}" class="icon-btn">${I.back}</a>` : "<span></span>"}<h2>${esc(title)}</h2><span class="right">${right}</span></header>`;

// Qué toca cada día (debajo del número): rutina abreviada o descanso
function dayTag(dow) {
  const rid = (S.client?.schedule || {})[dow];
  if (!rid) return `<i class="dtag rest">Desc.</i>`;
  const n = S.rtNames?.[rid] || "";
  const short = (n.match(/\(([^)]+)\)/) || [])[1] || n.split(" ")[0].slice(0, 4) || "Entr.";
  return `<i class="dtag">${esc(short)}</i>`;
}
// Tira de días de la semana del cliente
function dayStrip() {
  const w = weekInfo(S.client, S.date), today = ymd();
  return `<div class="strip"><button class="icon-btn" data-a="shiftDay" data-n="-7">${I.back}</button>${w.days.map((d) => { const dt = parseYmd(d); return `<button class="sd ${d === S.date ? "on" : ""} ${d === today ? "today" : ""}" data-a="pickDay" data-d="${d}"><small>${D1[dt.getDay()]}</small>${dt.getDate()}${dayTag(dt.getDay())}</button>`; }).join("")}<button class="icon-btn" data-a="shiftDay" data-n="7">${I.chev}</button></div>
  ${S.date !== today
    ? `<div class="otherday" data-a="pickDay" data-d="${today}"><span>Estás registrando el <b>${fmtDate(S.date, true)}</b>${S.date > today ? " (futuro)" : ""}</span><b>Volver a hoy</b></div>`
    : `<div class="strip-sub"><span>${fmtDate(S.date, true)} · Semana ${w.n}</span></div>`}`;
}
act("pickDay", (el) => { S.date = el.dataset.d; refresh(); });
act("shiftDay", (el) => { S.date = addDays(S.date, +el.dataset.n); refresh(); });

const mini = (v, goal, cls = "") => `<div class="minibar ${cls}"><i style="width:${goal ? Math.min(100, (v / goal) * 100) : 0}%"></i></div>`;
const done = (v, goal, tol = 0.05) => (!goal || !v ? "" : v >= goal * (1 - tol) ? `<span class="badge g">✓ Cumplido</span>` : `<span class="badge y">Faltan ${goal - v >= 1000 ? (Math.round((goal - v) / 100) / 10).toLocaleString("es-CL") + (goal > 5000 ? " mil" : " L") : Math.round(goal - v)}</span>`);
const status = (v, goal, tol = 0.1) => { if (!goal) return ""; if (!v) return ""; const d = (v - goal) / goal; return Math.abs(d) <= tol ? `<span class="badge g">En meta</span>` : d < 0 ? `<span class="badge y">Bajo</span>` : `<span class="badge r">Alto</span>`; };
const pctTxt = (v, goal) => (goal && v ? `<div class="muted small">Llevas el <b class="pctv">${Math.round((v / goal) * 100)} %</b></div>` : "");
const fmtH = (h) => `${Math.floor(h)}h ${pad(Math.round((h % 1) * 60))}m`;

// ================================================================ INICIO: lo que hay que registrar hoy
async function home() {
  const c = S.client, date = S.date, today = ymd();
  const [day, routines, sessions] = await Promise.all([getDay(date), getRoutines(S.cid), getSessions(S.cid)]);
  const w = weekInfo(c, date);
  const plan = weekPlan(c, routines, sessions, date);
  const tot = dayTotals(day);
  const water = sum(day.water || [], (x) => x.ml), waterGoal = c.water || 2500;
  const sl = sleepHours(day.sleep);
  const slot = plan.slots.find((s) => s.date === date);
  const pend = date === today ? await pendings(day, plan, w) : [];
  const cardioDone = await cardioWeek(w);
  const inProgress = sessions.find((s) => s.status === "curso");
  const cdays = c.cardio?.days || [];
  const trainTxt = inProgress ? `<small class="muted">Sesión en curso</small><b>${esc(inProgress.routineName)}</b>` : slot && !slot.rest ? `<small class="muted">${slot.status === "hecho" ? "Completado" : date === today ? "Hoy te toca" : "Este día toca"}</small><b>${esc(slot.name)}</b>` : `<small class="muted">Hoy</small><b>Descanso</b>`;
  if (date === today) { setTimeout(maybeOnboard, 400); setTimeout(askYesterdaySteps, 1200); }
  return `<header class="topbar ima"><img src="icons/logo.png?v=ima2" class="hdr-logo" alt="IMA"><div class="brand-t">INTELIGENCIA MUSCULAR APLICADA</div>${bellBtn(pend)}</header>${dayStrip()}
  ${date === today ? `<details class="pendbox ${pend.length ? "" : "ok"}"><summary>${pend.length ? I.info : I.check}${pend.length ? `Tienes ${pend.length} pendiente${pend.length > 1 ? "s" : ""}` : "Todo al día"}${pend.length ? I.chevDown : ""}</summary>
    ${pend.length ? `<div class="pendlist">${pend.map((p) => `<a class="pend ${p.c}" href="#${p.to}"><span class="dot"></span>${esc(p.t)}${I.chev}</a>`).join("")}</div>` : ""}</details>` : ""}
  ${date === today && c.payDate && diffDays(c.payDate, today) === 0 ? `<div class="card paycard">${payMsg(c)}</div>` : ""}
  ${date === today && c.payDate && diffDays(c.payDate, today) < 0 ? `<div class="card paycard late"><b>Pago pendiente</b><br>Tu asesoría se renovaba el ${fmtDate(c.payDate, true)} y aún no tengo registrado el pago. Si ya pagaste, ignora este mensaje 🙌 Si tienes algún problema, escríbeme y lo vemos.</div>` : ""}
  ${date === today && has("feedback") && freshFb(c) ? `<a class="card fbmini" href="#progreso"><div class="card-t">${I.info}Tu coach respondió tu check-in · Semana ${+freshFb(c).week.slice(1)}</div><div class="small muted">${freshFb(c).videoUrl ? "Tienes un video nuevo · toca para verlo" : "Toca para ver tu retroalimentación"}</div></a>` : ""}
  <div class="grid2">
    ${has("home_kcal") ? `<a class="card tile" href="#comida"><div class="card-t">${I.fire}Calorías ${status(tot.kcal, c.kcal)}</div><div class="big">${r0(tot.kcal).toLocaleString("es-CL")} <small>/ ${(c.kcal || 0).toLocaleString("es-CL")} kcal</small></div><div class="foot grow">${mini(tot.kcal, c.kcal, "k")}</div>${pctTxt(tot.kcal, c.kcal)}</a>
    <a class="card tile" href="#comida"><div class="card-t">${I.macros}Macros</div>
      ${[["C", tot.cho, c.cho, "y"], ["L", tot.fat, c.fat, "b"], ["P", tot.prot, c.prot, "g"]].map(([l, v, g, cl]) => `<div class="mrow"><b>${l}</b>${mini(v, g, cl)}<span>${r0(v)}/${g || "–"}${g && v >= g * 0.95 ? " ✓" : ""}</span></div>`).join("")}</a>` : ""}
    ${has("home_water") ? `<a class="card tile" href="#agua"><div class="card-t">${I.drop}Agua ${done(water, waterGoal)}</div><div class="big">${r1(water / 1000)} <small>/ ${r1(waterGoal / 1000)} L</small></div>${pctTxt(water, waterGoal)}<div class="foot"><button class="btn tiny" data-a="water" data-ml="200">+200</button><button class="btn tiny" data-a="water" data-ml="500">+500</button></div></a>` : ""}
    ${has("home_steps") ? `<div class="card tile" data-a="stepsEdit"><div class="card-t">${I.steps}Pasos ${done(day.steps, c.steps)}</div><div class="big">${(day.steps || 0).toLocaleString("es-CL")}</div><div class="foot grow">${mini(day.steps || 0, c.steps || 8000, "g")}</div><div class="muted small">${day.steps ? `Llevas el <b class="pctv">${Math.round((day.steps / (c.steps || 8000)) * 100)} %</b> · ` : ""}Meta ${(c.steps || 8000).toLocaleString("es-CL")}</div></div>` : ""}
    ${has("home_sleep") ? `<a class="card tile" href="#sueno"><div class="card-t">${I.moon}Sueño</div><div class="big" style="color:${sl != null ? sleepColor(sl) : "inherit"}">${sl != null ? fmtH(sl) : "—"}</div><div class="muted small">${day.sleep?.quality ? "Calidad " + day.sleep.quality + "/5" : "Registrar"} · meta ${c.sleep || 8} h</div></a>` : ""}
    ${has("home_weight") ? `<a class="card tile" href="#peso"><div class="card-t">${I.scale}Peso</div><div class="big">${day.weight ? r1(day.weight) + " <small>kg</small>" : "—"}</div><div class="muted small">${day.weight ? [day.weightFast === false ? "Sin ayuno" : "Ayunas ✓", day.weightBath === false ? "sin baño" : day.weightBath ? "baño ✓" : ""].filter(Boolean).join(" · ") : "En ayunas"}</div></a>` : ""}
    ${has("home_cardio") ? `<div class="card tile"><div class="card-t">${I.run}Cardio <span class="badge ${Object.keys(cardioDone).length >= (c.cardio?.perWeek || 0) && c.cardio?.perWeek ? "g" : ""}">${Object.keys(cardioDone).length}/${c.cardio?.perWeek || 0}</span></div>
      <div class="cweek">${w.days.map((d) => { const dw = new Date(d + "T12:00").getDay(); return `<span class="${cardioDone[d] ? "ok" : cdays.includes(dw) ? "plan" : ""} ${d === today ? "today" : ""}">${D1[dw]}</span>`; }).join("")}</div>
      <div class="legend-mini"><span>● hecho</span><span>○ sugerido</span></div><div class="foot"><button class="btn tiny" data-a="cardioAdd">Registrar</button></div></div>` : ""}
    ${has("home_digest") ? `<div class="card tile"><div class="card-t">${I.gut}Digestión</div><div class="row between"><span class="small muted">Deposiciones</span><div class="stepper-s"><button data-a="depo" data-n="-1">−</button><b>${day.depos ?? 0}</b><button data-a="depo" data-n="1">+</button></div></div>
      <div class="foot"><button class="btn tiny" data-a="gutNote">${day.gut ? "Molestias ●" : "¿Molestias?"}</button></div></div>` : ""}
    ${has("home_train") && has("train_tab") ? `<a class="card tile wide train-tile" href="#${inProgress ? "sesion/" + inProgress.id : "entreno"}"><div class="card-t" style="margin:0">${I.dumbbell}</div><div class="tt">${trainTxt}<span class="muted small">${plan.doneCount} de ${plan.planned.length} entrenamientos esta semana</span></div>${slot && !slot.rest && slot.status !== "hecho" || inProgress ? `<span class="btn primary small">${inProgress ? "Continuar" : "Empezar"}</span>` : I.chev}</a>` : ""}
  </div>`;
}

async function cardioWeek(w) {
  const days = await getDays(w.first, w.last);
  const out = {}; for (const [d, v] of Object.entries(days)) if ((v.cardio || []).length) out[d] = true; return out;
}
function bellBtn(pend) {
  S.pend = pend;
  const urgent = pend.filter((p) => p.c === "r" || p.to === "checkin" || p.c === "b").length;
  return `<button class="icon-btn bell ${urgent ? "ring" : ""}" data-a="bellOpen" title="Pendientes">${I.bell}${pend.length ? `<i class="bdg">${pend.length}</i>` : ""}</button>`;
}
act("bellOpen", () => {
  const pend = S.pend || [];
  sheet("Pendientes de hoy", pend.length ? `<div class="pendlist">${pend.map((p) => `<a class="pend ${p.c}" href="#${p.to}" data-a="closeSheet"><span class="dot"></span>${esc(p.t)}${I.chev}</a>`).join("")}</div>` : `<p class="muted center">Todo al día ✓</p>`);
});
async function pendings(day, plan, w) {
  const out = [], h = new Date().getHours();
  if (!day.weight) out.push({ t: "Registrar tu peso de hoy", to: "peso", c: "y" });
  const meals = Object.values(day.meals || {}).filter((m) => m.length).length;
  if (h >= 11 && meals === 0) out.push({ t: "Aún no registras comidas hoy", to: "comida", c: "r" });
  else if (h >= 20 && meals < 3) out.push({ t: "Completa tus comidas de hoy", to: "comida", c: "y" });
  if (h >= 15 && sum(day.water || [], (x) => x.ml) < (S.client.water || 2500) / 2) out.push({ t: "Vas atrasado con el agua", to: "agua", c: "y" });
  if (!day.sleep) out.push({ t: "Registrar cómo dormiste", to: "sueno", c: "y" });
  for (const s of plan.slots) if (s.status === "atrasado") out.push({ t: `Entrenamiento atrasado: ${s.name} (${fmtDate(s.date)})`, to: "entreno", c: "y" });
  const hoy = plan.slots.find((s) => s.status === "hoy"); if (hoy) out.push({ t: `Hoy te toca ${hoy.name}`, to: "entreno", c: "b" });
  const photos = (await db.list(P() + "/photos")).filter((p) => p.week === w.key && !["comida", "equipo"].includes(p.kind));
  if (!photos.length) out.push({ t: "Sube tus fotos de esta semana", to: "fotos", c: "y" });
  if (ymd() >= addDays(w.last, -1) && !(await db.get(P() + "/checkins/" + w.key))) out.push({ t: "Completa tu check-in semanal", to: "checkin", c: "r" });
  return out;
}

act("depo", async (el) => { const d = await getDay(S.date); await setDay(S.date, { depos: Math.max(0, (d.depos || 0) + +el.dataset.n) }); refresh(); });
act("gutNote", async () => {
  const d = await getDay(S.date);
  sheet("Digestión de hoy", `<p class="muted small">¿Tuviste molestias o síntomas intestinales? (hinchazón, gases, dolor, diarrea, estreñimiento…)</p><textarea id="gN" rows="3">${esc(d.gut || "")}</textarea><button class="btn primary big" data-a="gutSave">Guardar</button>`);
});
act("gutSave", async () => { await setDay(S.date, { gut: $("#gN").value.trim() }); closeSheet(); refresh(); });
act("stepsEdit", async () => {
  const day = await getDay(S.date);
  const b = sheet("Pasos del día", `<p class="muted small">Anótalos desde tu app de pasos o reloj.</p><input id="stepsI" type="number" inputmode="numeric" class="bignum" value="${day.steps || ""}" placeholder="Ej: 10.000"><button class="btn primary big" data-a="stepsSave">Guardar</button>`);
  setTimeout(() => $("#stepsI", b)?.focus(), 250);
});
act("stepsSave", async () => {
  const st = num($("#stepsI").value) || 0; await setDay(S.date, { steps: st }); closeSheet(); refresh();
  const m = stepsMsg(st, S.client?.steps || 8000); if (m) setTimeout(() => sheet(m.title, `<div class="nightbox"><div class="nb-ic">${m.ic}</div><p>${m.body}</p><button class="btn primary big" data-a="closeSheet">${m.btn}</button></div>`), 350);
});
// Cuánto te falta y una caminata sugerida (~100 pasos por minuto)
export function stepsMsg(st, goal) {
  if (!goal) return null;
  const left = goal - st, pct = st / goal, min = Math.max(5, Math.round(left / 100 / 5) * 5), n = (x) => Math.round(x).toLocaleString("es-CL");
  if (left <= 0) return { ic: "🏆", title: "¡Meta de pasos cumplida!", body: `Llevas ${n(st)} pasos de ${n(goal)}. Excelente trabajo.`, btn: "¡Vamos!" };
  if (pct < 0.5) return { ic: "🚶", title: "Te falta más de la mitad", body: `Llevas ${n(st)} de ${n(goal)} pasos. ¿Y si hacemos una caminata? Con unos <b>${min} minutos</b> caminando a buen ritmo llegas a tu meta.`, btn: "¡Vamos a caminar!" };
  if (pct < 0.8) return { ic: "👟", title: "Vas bien, sigue así", body: `Llevas ${n(st)} pasos; te faltan <b>${n(left)}</b>. Una caminata de unos <b>${min} minutos</b> y lo logras.`, btn: "Dale" };
  return { ic: "💪", title: "¡Ya casi!", body: `Te faltan solo <b>${n(left)}</b> pasos. Unos ${min} minutos más y meta cumplida.`, btn: "Dale" };
}
act("cardioAdd", () => {
  const c = S.client.cardio || {};
  sheet("Registrar cardio", `${c.perWeek ? `<div class="note">Tu indicación: ${c.perWeek} veces por semana · ${esc(c.type || "")} · ${c.minutes || ""} min · ${esc(c.intensity || "")}</div>` : ""}<label>Tipo<input id="cT" value="${esc(c.type || "")}" placeholder="Bici, trote, elíptica…"></label><label>Minutos<input id="cM" type="number" inputmode="numeric" value="${c.minutes || ""}"></label>
  <label>Intensidad<select id="cI">${["Baja", "Moderada", "Alta"].map((x) => `<option ${x === c.intensity ? "selected" : ""}>${x}</option>`).join("")}</select></label><button class="btn primary big" data-a="cardioSave">Guardar</button>`);
});
act("cardioSave", async () => {
  const day = await getDay(S.date);
  await setDay(S.date, { cardio: [...(day.cardio || []), { type: $("#cT").value, min: num($("#cM").value), int: $("#cI").value, t: hm(new Date()) }] });
  closeSheet(); toast("Cardio registrado"); refresh();
});


// ================================================================ AGUA
act("water", async (el, e) => {
  e?.preventDefault(); e?.stopPropagation();
  const ml = el.dataset.ml === "custom" ? num($("#wC")?.value) : +el.dataset.ml; if (!ml) return;
  const day = await getDay(S.date);
  await setDay(S.date, { water: [...(day.water || []), { ml, t: hm(new Date()) }] });
  toast(`+${ml} ml`); refresh();
});
act("waterDel", async (el) => { const day = await getDay(S.date); const w = day.water || []; w.splice(+el.dataset.i, 1); await setDay(S.date, { water: w }); refresh(); });
async function waterView() {
  const day = await getDay(S.date), goal = S.client.water || 2500;
  const total = sum(day.water || [], (x) => x.ml);
  const days = await getDays(addDays(ymd(), -29), ymd());
  const totals = Object.values(days).map((d) => sum(d.water || [], (x) => x.ml)).filter((x) => x > 0);
  const p = Math.min(100, (total / goal) * 100);
  return `${head("Agua", "comida")}${dayStrip()}
  <div class="card center"><div class="ring" style="--p:${p}"><div><b>${r1(total / 1000)}</b><small>de ${r1(goal / 1000)} L</small></div></div>
  <div class="muted small">${total >= goal ? "¡Meta cumplida!" : `Te faltan ${r1((goal - total) / 1000)} L`} · Meta fijada por tu coach</div>
  <div class="row gap center-row"><button class="btn" data-a="water" data-ml="200">+200 ml</button><button class="btn" data-a="water" data-ml="500">+500 ml</button></div>
  <div class="row gap center-row"><input id="wC" type="number" inputmode="numeric" placeholder="Otra cantidad (ml)" style="max-width:170px"><button class="btn primary" data-a="water" data-ml="custom">Registrar</button></div></div>
  <div class="card"><div class="card-t">Registros del día</div>${(day.water || []).map((w, i) => `<div class="li row between"><span><b>${w.ml} ml</b> <span class="muted">${w.t}</span></span><button class="icon-btn" data-a="waterDel" data-i="${i}">🗑</button></div>`).join("") || `<div class="muted small">Sin registros</div>`}</div>
  <div class="card stats3"><div><b>${r1((avg(totals.slice(-7)) || 0) / 1000)} L</b><small>Promedio 7 días</small></div><div><b>${totals.filter((t) => t >= goal).length}</b><small>Días en meta (30 d)</small></div><div><b>${totals.length}</b><small>Días registrados</small></div></div>`;
}

// ================================================================ COMIDA
async function food() {
  const c = S.client, day = await getDay(S.date), tot = dayTotals(day);
  const water = sum(day.water || [], (x) => x.ml);
  const pauta = c.pauta && Object.values(c.pauta).some((v) => +v > 0) ? c.pauta : null;
  let used = {};
  if (pauta) for (const items of Object.values(day.meals || {})) for (const it of items) if (it.cat && it.por && pauta[it.cat] != null) used[it.cat] = (used[it.cat] || 0) + (+it.g || 0) / it.por;
  const photos = (await db.list(P() + "/photos")).filter((p) => p.kind === "comida" && p.date === S.date);
  return `${head("Alimentación")}${dayStrip()}
  <div class="card sticky-macros">${bar("Calorías", tot.kcal, c.kcal, "kcal", "c-k")}${bar("CHO", tot.cho, c.cho, "g", "c-c")}${bar("Lípidos", tot.fat, c.fat, "g", "c-l")}${bar("Proteína", tot.prot, c.prot, "g", "c-p")}</div>
  ${pauta ? `<details class="card"><summary class="card-t">Porciones de tu pauta</summary>${Object.entries(pauta).filter(([, v]) => +v > 0).map(([g, v]) => bar(g, r1(used[g] || 0), +v, "porc.")).join("")}<p class="muted small">Los alimentos de grupos fuera de la pauta suman calorías y macros, pero no descuentan porciones.</p></details>` : ""}
  ${mealList(day).map((m) => {
    const items = day.meals?.[m] || [], mt = items.reduce((t, it) => { const x = itemMacros(it); for (const k in t) t[k] += x[k]; return t; }, { kcal: 0, cho: 0, fat: 0, prot: 0 });
    const ph = photos.filter((p) => p.meal === m);
    return `<div class="card meal ${items.length ? "" : "empty"}"><div class="mh"><div><b>${m}</b><small>${r0(mt.kcal)} kcal · C ${r0(mt.cho)} · L ${r0(mt.fat)} · P ${r0(mt.prot)}</small></div>
    <div class="row"><button class="icon-btn" data-a="mealMenu" data-m="${m}">⋯</button><button class="icon-btn add" data-a="addFood" data-m="${m}">${I.plus}</button></div></div>
    ${items.map((it, i) => `<div class="fi" data-a="editItem" data-m="${m}" data-i="${i}">${(() => { const x = itemMacros(it); return `<span>${esc(it.name)}<small>${r0(it.g)} g${it.por ? ` · ${r1(it.g / it.por)} porc.` : ""}</small><small class="imac"><i class="mc">C ${r1(x.cho)}</i><i class="ml">L ${r1(x.fat)}</i><i class="mp">P ${r1(x.prot)}</i></small></span><span>${r0(x.kcal)} kcal</span>`; })()}</div>`).join("")}
    ${day.mealNotes?.[m] ? `<div class="note">📝 ${esc(day.mealNotes[m])}</div>` : ""}
    ${ph.length ? `<div class="thumbs">${ph.map((p) => `<img src="${p.data}" data-a="viewPhoto" data-id="${p.id}">`).join("")}</div>` : ""}</div>`;
  }).join("")}
  <button class="btn block ghost addmeal" data-a="addMeal">${I.plus} Agregar otra comida</button>
  <a class="card row between" href="#agua"><span><b>Agua</b> <span class="muted small">${r1(water / 1000)} / ${r1((c.water || 2500) / 1000)} L</span></span><span class="row gap"><button class="btn tiny" data-a="water" data-ml="200">+200</button><button class="btn tiny" data-a="water" data-ml="500">+500</button></span></a>
  <a class="btn big block" href="#plan">Ver mi plan de alimentación</a>`;
}

act("addMeal", async () => { const d = await getDay(S.date); await setDay(S.date, { mealCount: mealList(d).filter((m) => m.startsWith("Comida ")).length + 1 }); refresh(); });
act("mealMenu", (el) => {
  const m = el.dataset.m;
  sheet(m, `<button class="btn block" data-a="mealNote" data-m="${m}">📝 Añadir nota</button>
  <label class="btn block">📷 Añadir foto<input type="file" accept="image/*" hidden data-a-change="mealPhoto" data-m="${m}"></label>
  <button class="btn block" data-a="mealCopy" data-m="${m}">⧉ Copiar desde ayer</button>
  <button class="btn block" data-a="mealRecipe" data-m="${m}">⭐ Guardar como receta</button>
  <button class="btn block danger" data-a="mealClear" data-m="${m}">Vaciar comida</button>`);
});
act("mealNote", async (el) => {
  const m = el.dataset.m, day = await getDay(S.date);
  sheet("Nota · " + m, `<textarea id="mN" rows="3" placeholder="Ej: preentreno, me cayó pesado">${esc(day.mealNotes?.[m] || "")}</textarea><button class="btn primary big" data-a="mealNoteSave" data-m="${m}">Guardar</button>`);
});
act("mealNoteSave", async (el) => { const day = await getDay(S.date); await setDay(S.date, { mealNotes: { ...(day.mealNotes || {}), [el.dataset.m]: $("#mN").value } }); closeSheet(); refresh(); });
act("mealPhoto", async (el) => {
  const f = el.files[0]; if (!f) return; const data = await compressImage(f, 700, 0.6); const id = uid();
  await db.set(`${P()}/photos/${id}`, { kind: "comida", meal: el.dataset.m, date: S.date, week: weekInfo(S.client, S.date).key, data, at: Date.now() });
  closeSheet(); toast("Foto guardada"); refresh();
});
act("mealCopy", async (el) => {
  const m = el.dataset.m, y = await getDay(addDays(S.date, -1)), d = await getDay(S.date);
  if (!(y.meals?.[m] || []).length) return toast("Ayer no hay nada en " + m);
  await setDay(S.date, { meals: { ...(d.meals || {}), [m]: [...(d.meals?.[m] || []), ...y.meals[m]] } }); closeSheet(); refresh();
});
act("mealClear", async (el) => { if (!(await confirmBox("¿Vaciar " + el.dataset.m + "?"))) return; const d = await getDay(S.date); await setDay(S.date, { meals: { ...(d.meals || {}), [el.dataset.m]: [] } }); closeSheet(); refresh(); });
act("mealRecipe", async (el) => {
  const d = await getDay(S.date), items = d.meals?.[el.dataset.m] || []; if (!items.length) return toast("La comida está vacía");
  const name = await promptBox("Nombre de la receta"); if (!name) return;
  await db.set(`${P()}/foods/${uid()}`, { type: "receta", name, items }); closeSheet(); toast("Receta guardada");
});
act("viewPhoto", async (el) => { const p = await db.get(`${P()}/photos/${el.dataset.id}`); sheet("Foto", `<img class="full" src="${p.data}"><button class="btn danger" data-a="delPhoto" data-id="${el.dataset.id}">Eliminar</button>`); });
act("delPhoto", async (el) => { if (!(await confirmBox("¿Eliminar foto?"))) return; await db.del(`${P()}/photos/${el.dataset.id}`); closeSheet(); refresh(); });


// ---------- Agregar alimento
// Agregar alimento: pantalla completa, buscador siempre arriba (así lo que aparece no queda tapado por el teclado)
let FS = { meal: "", tab: "frec", q: "", sel: null, results: [] };
const FTABS = [["frec", "Frecuentes"], ["fav", "Favoritos"], ["recetas", "Recetas"], ["voz", "🎤 Por voz"], ["rapido", "Añadir rápido"], ["supl", "Suplementos"], ["crear", "Crear"]];
act("addFood", (el) => { rescueScanned(); FS = { meal: el.dataset.m, tab: "frec", q: "", sel: null, results: [] }; openFoodSheet(); });
async function openFoodSheet() {
  sheet(FS.meal, `<div class="fs-top"><div class="row gap"><div class="fsearch grow">${I.search}<input id="fq" type="search" placeholder="Buscar alimento o marca…" value="${esc(FS.q)}" data-a-input="foodSearch" autocomplete="off" enterkeyhint="search"></div><button class="btn" data-a="scan" title="Escanear código de barras">▥</button></div>
    <div class="seg scroll" id="ftabs">${ftabsHtml()}</div></div><div id="fsb"></div>`, { full: true });
  await renderFoodTab();
}
const ftabsHtml = () => FTABS.map(([k, l]) => `<button class="${FS.tab === k ? "on" : ""}" data-a="foodTab" data-t="${k}">${l}</button>`).join("");
act("foodTab", (el) => { FS.tab = el.dataset.t; FS.sel = null; FS.q = ""; const q = $("#fq"); if (q) q.value = ""; $("#ftabs").innerHTML = ftabsHtml(); renderFoodTab(); });
async function renderFoodTab() {
  const box = $("#fsb"); if (!box) return;
  if (FS.sel) return (box.innerHTML = foodDetail(FS.sel), syncFood());
  const custom = await db.list(P() + "/foods");
  if (FS.tab === "voz") {
    box.innerHTML = voiceTab(); if (FS.vitems?.length) drawVoice();
  } else if (FS.tab === "buscar") {
    box.innerHTML = `<div id="fres"></div><button class="btn ghost small block" data-a="offSearch">¿No aparece? Buscar en internet (Open Food Facts)</button>`;
    showResults(custom);
  } else if (FS.tab === "frec") {
    box.innerHTML = `<p class="muted small">Lo que más has registrado en el último mes. Tócalo y queda con la cantidad de la última vez.</p><div id="frecL"></div>`;
    drawFrequent();
  } else if (FS.tab === "rapido") {
    box.innerHTML = `<label>Nombre<input id="qN" placeholder="Ej: avena"></label><label>Gramos consumidos<input id="qG" type="number" inputmode="decimal" placeholder="Opcional"></label>
    <div class="grid4"><label>Kcal<input id="qK" type="number" inputmode="decimal" data-a-input="qCheck"></label><label>CHO<input id="qC" type="number" inputmode="decimal" data-a-input="qCheck"></label><label>Lípidos<input id="qF" type="number" inputmode="decimal" data-a-input="qCheck"></label><label>Proteína<input id="qP" type="number" inputmode="decimal" data-a-input="qCheck"></label></div>
    <div id="qMsg" class="small"></div><button class="btn primary big" data-a="quickAdd">Añadir a ${esc(FS.meal)}</button>`;
  } else if (FS.tab === "fav") {
    const favs = custom.filter((f) => f.fav);
    box.innerHTML = favs.length ? favs.map((f) => resRow(f)).join("") : `<p class="muted center pad">Toca el ♡ en un alimento para guardarlo aquí.</p>`;
    FS.results = favs;
  } else if (FS.tab === "recetas") {
    const rec = custom.filter((f) => f.type === "receta");
    box.innerHTML = rec.length ? rec.map((r) => `<div class="fi" data-a="addRecipe" data-id="${r.id}"><span>${esc(r.name)}<small>${r.items.length} alimentos</small></span><span>${r0(sum(r.items, (it) => itemMacros(it).kcal))} kcal ＋</span></div>`).join("") : `<p class="muted center pad">Arma una comida y usa “⋯ → Guardar como receta”.</p>`;
  } else if (FS.tab === "supl") {
    const sup = custom.filter((f) => f.type === "supl");
    FS.results = sup;
    box.innerHTML = `${sup.map((f) => resRow(f)).join("") || `<p class="muted small">Aún no tienes suplementos.</p>`}<button class="btn block" data-a="foodTab" data-t="crear" data-supl="1">＋ Crear suplemento</button>`;
  } else if (FS.tab === "crear") {
    box.innerHTML = `<label>Tipo<select id="nT"><option value="alimento">Alimento</option><option value="supl">Suplemento</option></select></label>
    <label>Nombre *<input id="nN"></label><label>Marca<input id="nB"></label><div class="row gap"><label class="grow">Código de barras<input id="nCode" inputmode="numeric"></label><button class="btn" data-a="scan" data-into="nCode" style="align-self:end">▥</button></div>
    <label>Tamaño de la porción (g)<input id="nPor" type="number" inputmode="decimal" placeholder="Ej: 30 (1 scoop)"></label>
    <p class="muted small">Aporte por porción indicada (o por 100 g si no indicas porción):</p>
    <div class="grid4"><label>Kcal<input id="nK" type="number" inputmode="decimal"></label><label>CHO<input id="nC" type="number" inputmode="decimal"></label><label>Lípidos<input id="nF" type="number" inputmode="decimal"></label><label>Proteína<input id="nP" type="number" inputmode="decimal"></label></div>
    <button class="btn primary big" data-a="createFood">Crear</button>`;
  }
}
const resRow = (f) => `<div class="fi" data-a="selFood" data-id="${esc(f.id)}"><span>${esc(f.name)}${f.brand ? ` <small>${esc(f.brand)}</small>` : ""}<small>${r0(f.kcal)} kcal · P ${r1(f.prot)} g por 100 g${f.cat ? " · " + esc(f.cat) : ""}</small></span><span class="add">＋</span></div>`;
function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
async function showResults(custom) {
  const box = $("#fres"); if (!box) return;
  const q = norm(FS.q.trim());
  const base = await getFoodBase();
  const shared = (await db.list("barcodes").catch(() => [])).map((f) => ({ ...f, id: "bc-" + f.id, src: "bc" }));
  const mineList = (custom || await db.list(P() + "/foods")).filter((f) => f.type !== "receta"), codes = new Set(mineList.map((f) => f.code).filter(Boolean));
  const off = q ? await getOffCL() : [], seenCodes = new Set([...codes, ...shared.map((f) => f.code)]);
  const pool = [...mineList, ...shared.filter((f) => !codes.has(f.code)), ...base, ...off.filter((f) => !seenCodes.has(f.code))];
  // Orden: primero lo que empieza con lo buscado, y los alimentos genéricos antes que las marcas
  const words = q.split(/\s+/).filter(Boolean);
  const score = (f) => { const n = norm(f.name), b = norm(f.brand || ""), all = n + " " + b; if (!words.every((w) => all.includes(w))) return -1; return ({ custom: 0, base: 0, bc: 1, offcl: 2 }[f.src] ?? 1) * 3 + (n.startsWith(q) ? 0 : n.split(/[\s(/]+/).some((w) => w.startsWith(words[0])) ? 1 : 2); };
  FS.results = q ? pool.map((f) => [score(f), f]).filter(([s]) => s >= 0).sort((a, b) => a[0] - b[0]).slice(0, 50).map(([, f]) => f) : pool.filter((f) => f.src !== "base").slice(0, 15);
  box.innerHTML = FS.results.map(resRow).join("") || (q ? `<p class="muted small pad">Sin resultados en tu base. Prueba “Añadir rápido” o Open Food Facts.</p>` : `<p class="muted small pad">Escribe para buscar en tu base de alimentos.</p>`);
}
act("foodSearch", (el) => {
  FS.q = el.value; FS.sel = null;
  if (FS.q.trim()) { if (FS.tab !== "buscar") { FS.prevTab = FS.tab; FS.tab = "buscar"; $("#ftabs").innerHTML = ftabsHtml(); return renderFoodTab(); } return showResults(); }
  FS.tab = FS.prevTab || "frec"; $("#ftabs").innerHTML = ftabsHtml(); renderFoodTab();
});
// Frecuentes: lo más registrado en los últimos 30 días
async function drawFrequent() {
  const box = $("#frecL"); if (!box) return;
  const days = await getDays(addDays(ymd(), -30), ymd()), cnt = new Map();
  for (const d of Object.keys(days).sort()) for (const items of Object.values(days[d].meals || {})) for (const it of items) { const k = it.name.toLowerCase(); const c = cnt.get(k) || { n: 0 }; cnt.set(k, { n: c.n + 1, it }); }
  FS.freq = [...cnt.values()].sort((a, b) => b.n - a.n).slice(0, 25).map((x) => x.it);
  box.innerHTML = FS.freq.map((it, k) => `<div class="fi" data-a="frecPick" data-k="${k}"><span>${esc(it.name)}<small>${it.per100 === false ? "" : r0(it.g) + " g · "}${r0(itemMacros(it).kcal)} kcal la última vez</small></span><span class="add">＋</span></div>`).join("") || `<p class="muted center pad">Aún no hay registros. Busca arriba tu primer alimento.</p>`;
}
act("frecPick", async (el) => {
  const it = FS.freq[+el.dataset.k]; if (!it) return;
  if (it.per100 === false) return addItems([{ ...it, t: undefined }].map(({ t, ...x }) => x));
  const base = await getFoodBase(), mine = await db.list(P() + "/foods");
  // Se busca por nombre (los números internos de la base cambiaron con la base INTA); si no está, se usan los datos del registro
  const nm = (x) => String(x || "").toLowerCase().trim(), all = [...mine, ...base];
  const f = all.find((x) => x.id === it.fid && nm(x.name) === nm(it.name)) || all.find((x) => nm(x.name) === nm(it.name))
    || { id: "fr-" + it.name, name: it.name, kcal: it.kcal, cho: it.cho, fat: it.fat, prot: it.prot, cat: it.cat || "", portion: it.por || null, src: "recent" };
  pickFood(f, it.g);
});
// Elige un alimento: con medida casera parte en 1 unidad; en gramos parte vacío (salvo que venga de "Frecuentes")
function pickFood(f, grams) {
  FS.sel = f; const mi = medidaInfo(f);
  if (grams) { FS.unit = "g"; FS.qty = grams; FS.selG = grams; }
  else if (mi) { FS.unit = "med"; FS.qty = 1; FS.selG = r1(mi.each); }
  else if (f.portion) { FS.unit = "por"; FS.qty = 1; FS.selG = f.portion; }
  else { FS.unit = "g"; FS.qty = ""; FS.selG = 0; }
  renderFoodTab();
}
act("selFood", (el) => pickFood(FS.results.find((f) => String(f.id) === el.dataset.id)));
const unitOpts = (f) => { const mi = medidaInfo(f); return [["g", "Gramos", 1], ...(mi ? [["med", mi.label, mi.each]] : []), ...(f.portion ? [["por", "Porción de intercambio", f.portion]] : [])]; };
function foodDetail(f) {
  const opts = unitOpts(f), u = opts.find((o) => o[0] === FS.unit) || opts[0];
  return `<button class="btn ghost small" data-a="foodBack">‹ Volver</button><div class="row between"><h3>${esc(f.name)}</h3>${f.src !== "base" ? `<button class="btn tiny" data-a="foodRename">✎ Nombre</button>` : ""}</div><div class="muted small">${f.brand ? esc(f.brand) + " · " : ""}${f.cat ? `Grupo: ${esc(f.cat)} · ` : ""}por 100 g: ${r0(f.kcal)} kcal · C ${r1(f.cho)} · L ${r1(f.fat)} · P ${r1(f.prot)}${f.fuente ? `<br>Fuente: ${esc(f.fuente)}` : ""}</div>
  ${(() => { const w = foodCheck(f); return w.length ? `<div class="warnbox">⚠ Ojo, estos datos parecen raros: ${w.map(esc).join("; ")}. Revisa la etiqueta${f.src !== "base" ? " y corrígelo con ✎" : ""} o avísale a tu coach.</div>` : ""; })()}
  <div class="card-t mt">¿Cómo lo vas a registrar?</div>
  <div class="seg">${opts.map(([k, l]) => `<button class="${u[0] === k ? "on" : ""}" data-a="dUnit" data-u="${k}">${esc(l)}</button>`).join("")}</div>
  <div class="qtyrow"><button class="btn" data-a="dStep" data-n="-1">−</button><label class="grow"><span>${u[0] === "g" ? "Gramos" : "Cantidad (" + esc(u[1]) + ")"}</span><input id="dQ" type="number" inputmode="decimal" step="${u[0] === "g" ? 1 : 0.25}" value="${FS.qty}" placeholder="–" data-a-input="dSync"></label><button class="btn" data-a="dStep" data-n="1">＋</button></div>
  <p class="muted small center" id="dEq">${u[0] === "g" ? "" : `≈ ${r0(FS.selG)} g · 1 ${esc(u[1])} ≈ ${r0(u[2])} g`}</p>
  <div id="dMac" class="macros4"></div>
  <div class="row gap"><button class="btn" data-a="favToggle">${f.fav ? "♥" : "♡"}</button><button class="btn primary big grow" data-a="foodAdd">Añadir a ${esc(FS.meal)}</button></div>`;
}
function qtyToG() { const o = unitOpts(FS.sel).find((x) => x[0] === FS.unit) || ["g", "", 1]; FS.selG = r1((+FS.qty || 0) * o[2]); const e = $("#dEq"); if (e && FS.unit !== "g") e.textContent = `≈ ${r0(FS.selG)} g · 1 ${o[1]} ≈ ${r0(o[2])} g`; syncFood(); }
// Al cambiar de unidad no se convierte el número: medida/porción parte en 1 y gramos queda vacío para anotarlo
act("dUnit", (el) => { FS.unit = el.dataset.u; FS.qty = FS.unit === "g" ? "" : 1; qtyToG(); renderFoodTab(); setTimeout(() => FS.unit === "g" && $("#dQ")?.focus(), 50); });
act("dStep", (el) => { const st = FS.unit === "g" ? 10 : 0.5; FS.qty = Math.max(0, r1((num($("#dQ").value) || 0) + st * +el.dataset.n)); $("#dQ").value = FS.qty; qtyToG(); });
act("dSync", (el) => { FS.qty = el.value === "" ? "" : num(el.value) || 0; qtyToG(); });
function syncFood() {
  const f = FS.sel, m = itemMacros({ ...f, g: FS.selG });
  const el = $("#dMac"); if (el) el.innerHTML = [["Kcal", m.kcal], ["CHO", m.cho], ["Lípidos", m.fat], ["Proteína", m.prot]].map(([l, v]) => `<div><b>${r1(v)}</b><small>${l}</small></div>`).join("");
}
// ---------- Registro por voz
function voiceTab() {
  const ok = speechSupported();
  return `<div class="voice"><button class="micbtn ${FS.rec ? "rec" : ""}" data-a="${FS.rec ? "voiceStop" : "voiceStart"}" ${ok ? "" : "disabled"}>${FS.rec ? "■" : "🎤"}</button>
    <p class="muted small center">${FS.rec ? "Te escucho… toca para terminar" : ok ? "Toca el micrófono y di lo que comiste.<br>Ej: “dos plátanos medianos, una mandarina y una cucharada de mantequilla de maní”" : "Tu navegador no permite dictado; escríbelo abajo (también puedes usar el micrófono del teclado)."}</p>
    <textarea id="vT" rows="3" placeholder="O escríbelo aquí…" data-a-input="voiceText">${esc(FS.vtext || "")}</textarea>
    <button class="btn block" data-a="voiceParse">Interpretar</button><div id="vRes"></div></div>`;
}
act("voiceText", (el) => { FS.vtext = el.value; });
act("voiceStart", () => {
  try {
    FS.rec = listen({
      onText: (fin, interim) => { FS.vtext = fin; const t = $("#vT"); if (t) t.value = fin + (interim ? (fin ? ", " : "") + interim : ""); },
      onEnd: () => { FS.rec = null; renderFoodTab(); if (FS.vtext) parseVoice(); },
      onError: (e) => { FS.rec = null; toast(e === "not-allowed" ? "Activa el permiso de micrófono" : e === "network" ? "El dictado necesita conexión; escríbelo abajo" : "No te escuché bien, intenta de nuevo"); renderFoodTab(); }
    });
    renderFoodTab();
  } catch { toast("No se pudo iniciar el micrófono"); }
});
act("voiceStop", () => { FS.rec?.stop(); });
act("voiceParse", () => { FS.vtext = $("#vT").value; parseVoice(); });
async function parseVoice() {
  const custom = (await db.list(P() + "/foods")).filter((f) => f.type !== "receta");
  const pool = [...custom, ...(await getFoodBase())];
  FS.vitems = parseMeal(FS.vtext || "", pool);
  drawVoice();
}
function drawVoice() {
  const box = $("#vRes"); if (!box) return;
  const it = FS.vitems || [];
  if (!it.length) return (box.innerHTML = `<p class="muted small center">No reconocí alimentos. Prueba con frases cortas separadas por comas.</p>`);
  const tot = it.filter((x) => x.f && x.g).reduce((a, x) => { const m = itemMacros({ ...x.f, g: x.g }); return { kcal: a.kcal + m.kcal, prot: a.prot + m.prot }; }, { kcal: 0, prot: 0 });
  box.innerHTML = `<div class="card-t mt">Revisa y ajusta los gramos</div>${it.map((x, k) => `<div class="vitem ${x.f ? "" : "miss"}">
    <div class="row between"><small class="muted">“${esc(x.chunk)}” · ${esc(describe(x.p))}</small><button class="icon-btn" data-a="vDel" data-k="${k}">✕</button></div>
    ${x.f ? `<div class="row gap"><select data-a-change="vPick" data-k="${k}" class="grow">${x.options.map((o, j) => `<option value="${j}" ${o === x.f ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select>
      <label class="vg"><input type="number" inputmode="decimal" value="${x.g}" data-a-change="vG" data-k="${k}"><span>g</span></label></div>
      <small class="muted">${r0(itemMacros({ ...x.f, g: x.g }).kcal)} kcal · P ${r1(itemMacros({ ...x.f, g: x.g }).prot)} g</small>` : `<small class="warn">No encontré “${esc(x.p.query)}”. Búscalo en “Buscar” o usa “Añadir rápido”.</small>`}</div>`).join("")}
  <div class="row between mt"><b>Total ≈ ${r0(tot.kcal)} kcal</b><span class="muted small">Proteína ${r1(tot.prot)} g</span></div>
  <button class="btn primary big" data-a="vAdd">Añadir todo a ${esc(FS.meal)}</button>`;
}
act("vDel", (el) => { FS.vitems.splice(+el.dataset.k, 1); drawVoice(); });
act("vPick", (el) => { const x = FS.vitems[+el.dataset.k]; x.f = x.options[+el.value]; x.g = estimateGrams(x.p, x.f); drawVoice(); });
act("vG", (el) => { FS.vitems[+el.dataset.k].g = num(el.value) || 0; drawVoice(); });
act("vAdd", async () => {
  const items = (FS.vitems || []).filter((x) => x.f && x.g).map((x) => ({ name: x.f.name, g: x.g, kcal: x.f.kcal, cho: x.f.cho, fat: x.f.fat, prot: x.f.prot, cat: x.f.cat || "", por: x.f.portion || null, fid: x.f.id, est: true, said: describe(x.p) }));
  if (!items.length) return toast("No hay alimentos para añadir");
  FS.vitems = []; FS.vtext = ""; await addItems(items);
});
act("foodBack", () => { FS.sel = null; renderFoodTab(); });
act("foodAdd", async () => {
  const f = FS.sel; if (!FS.selG) return toast("Indica los gramos");
  if (f.code && ["off", "bc", "offcl"].includes(f.src)) saveBarcode(f);
  await addItems([{ name: f.name, g: FS.selG, kcal: f.kcal, cho: f.cho, fat: f.fat, prot: f.prot, cat: f.cat || "", por: f.portion || null, fid: f.id }]);
});
async function addItems(items) {
  const d = await getDay(S.date), t = S.date === ymd() ? hm(new Date()) : null;
  if (t) items = items.map((it) => ({ t, ...it }));
  await setDay(S.date, { meals: { ...(d.meals || {}), [FS.meal]: [...(d.meals?.[FS.meal] || []), ...items] } });
  closeSheet(); toast("Añadido a " + FS.meal); refresh();
}
// Cambiar el nombre de un producto (ej. escaneado con un nombre genérico): queda así en tus alimentos y en la base compartida
act("foodRename", async () => {
  const f = FS.sel, name = await promptBox("Nombre del alimento", f.name); if (!name || name === f.name) return renderFoodTab();
  f.name = name;
  if (f.code) {
    db.set(BC(f.code), { name, code: String(f.code), brand: f.brand || "", portion: f.portion || null, kcal: +f.kcal || 0, cho: +f.cho || 0, fat: +f.fat || 0, prot: +f.prot || 0, by: S.cid, at: Date.now() });
    const mine = (await db.list(P() + "/foods")).find((x) => x.code === String(f.code));
    await db.set(`${P()}/foods/${mine ? mine.id : "bc-" + f.code}`, mine ? { name } : (({ id, src, ...rest }) => ({ ...rest, name, type: "alimento", src: "custom" }))(f));
  } else if (f.src === "custom") await db.set(`${P()}/foods/${f.id}`, { name });
  toast("Nombre actualizado ✓"); renderFoodTab();
});
act("favToggle", async () => {
  const f = FS.sel;
  if (f.src === "base" || f.src === "off") { const id = uid(); await db.set(`${P()}/foods/${id}`, { ...f, id, src: "custom", type: "alimento", fav: true }); FS.sel = { ...f, id, src: "custom", fav: true }; }
  else { f.fav = !f.fav; await db.set(`${P()}/foods/${f.id}`, { fav: f.fav }); }
  toast(FS.sel.fav ? "Guardado en favoritos" : "Quitado de favoritos"); renderFoodTab();
});
act("addRecipe", async (el) => { const r = await db.get(`${P()}/foods/${el.dataset.id}`); await addItems(r.items); });
act("qCheck", () => {
  const k = num($("#qK").value), c = num($("#qC").value) || 0, f = num($("#qF").value) || 0, p = num($("#qP").value) || 0;
  const exp = 4 * c + 4 * p + 9 * f, msg = $("#qMsg"); if (!k || !exp) return (msg.innerHTML = "");
  msg.innerHTML = Math.abs(k - exp) / k <= 0.12 ? `<span class="ok">✓ Los macros cuadran</span>` : `<span class="warn">⚠ Esperadas ~${r0(exp)} kcal a partir de los macros</span>`;
});
act("quickAdd", async () => {
  const name = $("#qN").value.trim() || "Añadido rápido", k = num($("#qK").value);
  if (k == null) return toast("Indica al menos las calorías");
  await addItems([{ name, g: num($("#qG").value) || 0, kcal: k, cho: num($("#qC").value) || 0, fat: num($("#qF").value) || 0, prot: num($("#qP").value) || 0, per100: false, quick: true }]);
});
act("createFood", async () => {
  const name = $("#nN").value.trim(); if (!name) return toast("Falta el nombre");
  const por = num($("#nPor").value), f = por ? 100 / por : 1;
  const food = { type: $("#nT").value, name, brand: $("#nB").value, code: $("#nCode").value, portion: por || null, src: "custom",
    kcal: (num($("#nK").value) || 0) * f, cho: (num($("#nC").value) || 0) * f, fat: (num($("#nF").value) || 0) * f, prot: (num($("#nP").value) || 0) * f };
  const id = uid(); await db.set(`${P()}/foods/${id}`, food); toast("Creado");
  if (food.code) db.set(BC(food.code), { name, brand: food.brand, code: food.code, portion: food.portion, kcal: food.kcal, cho: food.cho, fat: food.fat, prot: food.prot, by: S.cid, at: Date.now() });
  FS.tab = food.type === "supl" ? "supl" : "frec"; $("#ftabs").innerHTML = ftabsHtml(); pickFood({ ...food, id });
});
act("editItem", async (el) => {
  const m = el.dataset.m, i = +el.dataset.i, d = await getDay(S.date), it = d.meals[m][i];
  sheet(it.name, `<label>Nombre<input id="eN" value="${esc(it.name)}"></label>${it.per100 === false ? `<p class="muted small">${r0(it.kcal)} kcal · C${r0(it.cho)} L${r0(it.fat)} P${r0(it.prot)}</p>` : `<label>Gramos<input id="eG" type="number" inputmode="decimal" value="${it.g}"></label>`}
  <div class="row gap"><button class="btn danger grow" data-a="itemDel" data-m="${m}" data-i="${i}">Eliminar</button><button class="btn primary grow" data-a="itemSave" data-m="${m}" data-i="${i}">Guardar</button></div>`);
});
act("itemSave", async (el) => {
  const d = await getDay(S.date), it = d.meals[el.dataset.m][+el.dataset.i], name = $("#eN").value.trim();
  if ($("#eG")) it.g = num($("#eG").value) || 0;
  if (name && name !== it.name) {
    it.name = name;
    // Si venía de un código de barras, el nombre nuevo también queda para buscarlo después
    const code = String(it.fid || "").replace(/^(off-|bc-)/, "");
    if (/^\d{6,}$/.test(code)) { const mine = (await db.list(P() + "/foods")).find((x) => x.code === code); db.set(BC(code), { name, code, kcal: +it.kcal || 0, cho: +it.cho || 0, fat: +it.fat || 0, prot: +it.prot || 0, by: S.cid, at: Date.now() }); db.set(`${P()}/foods/${mine ? mine.id : "bc-" + code}`, mine ? { name } : { name, code, kcal: it.kcal, cho: it.cho, fat: it.fat, prot: it.prot, type: "alimento", src: "custom" }); }
    else if (it.fid) { const mine = (await db.list(P() + "/foods")).find((x) => x.id === it.fid); if (mine) db.set(`${P()}/foods/${mine.id}`, { name }); }
  }
  await setDay(S.date, { meals: d.meals }); closeSheet(); refresh();
});
act("itemDel", async (el) => { const d = await getDay(S.date); d.meals[el.dataset.m].splice(+el.dataset.i, 1); await setDay(S.date, { meals: d.meals }); closeSheet(); refresh(); });

// Código de barras: cámara (Chrome Android) + Open Food Facts
act("scan", async (el) => {
  const into = el.dataset.into;
  if (!("BarcodeDetector" in window)) {
    const code = await promptBox("Tu navegador no puede escanear. Escribe el código de barras:"); if (code) return into ? ($("#" + into).value = code) : lookupCode(code); return;
  }
  const holder = document.createElement("div"); holder.className = "scanner";
  holder.innerHTML = `<video playsinline muted></video><div class="scan-frame"></div><p>Apunta al código de barras</p><button class="btn" id="scanX">Cancelar</button><button class="btn ghost small" id="scanM">Escribir el código</button>`;
  document.body.appendChild(holder);
  const video = holder.querySelector("video"); let stream, stop = false;
  const end = () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); holder.remove(); };
  holder.querySelector("#scanX").onclick = end;
  holder.querySelector("#scanM").onclick = async () => { end(); const c = await promptBox("Código de barras"); if (c) into ? ($("#" + into).value = c) : lookupCode(c); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream; await video.play();
    const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    // Lee una vez y espera al menos 1 segundo mostrando el código antes de cargar los datos

    const loop = async () => {
      if (stop) return;
      try {
        const r = await det.detect(video), v = r[0]?.rawValue || "";
        if (v) {
          stop = true; navigator.vibrate?.(80);
          holder.querySelector(".scan-frame").classList.add("hit"); holder.querySelector("p").innerHTML = `✓ Código detectado<br><b>${esc(v)}</b><br><span class="scan-load">Cargando datos del producto…</span>`;
          await new Promise((ok) => setTimeout(ok, 1100)); end();
          return into ? ($("#" + into).value = v) : lookupCode(v);
        }
      } catch {}
      setTimeout(() => requestAnimationFrame(loop), 120);
    };
    loop();
  } catch { end(); toast("No se pudo abrir la cámara"); }
});
// Una vez: guarda en "tus alimentos" los productos escaneados que ya habías registrado en comidas
async function rescueScanned() {
  if (LS.get("rescue-bc:" + S.cid)) return; LS.set("rescue-bc:" + S.cid, "1");
  const days = await getDays(addDays(ymd(), -60), ymd()), seen = new Set((await db.list(P() + "/foods")).map((f) => f.code));
  for (const d of Object.values(days)) for (const items of Object.values(d.meals || {})) for (const it of items) {
    const code = String(it.fid || "").startsWith("off-") ? it.fid.slice(4) : null;
    if (code && !seen.has(code)) { seen.add(code); saveBarcode({ name: it.name, code, portion: null, kcal: it.kcal, cho: it.cho, fat: it.fat, prot: it.prot }); }
  }
}
// Base compartida de códigos de barras: lo que escanea cualquiera queda guardado para todos
const BC = (code) => "barcodes/" + String(code).replace(/[^0-9A-Za-z]/g, "");
async function saveBarcode(f) {
  if (!f?.code) return;
  const food = { name: f.name, brand: f.brand || "", code: String(f.code), portion: f.portion || null, kcal: +f.kcal || 0, cho: +f.cho || 0, fat: +f.fat || 0, prot: +f.prot || 0, by: S.cid, at: Date.now() };
  db.set(BC(f.code), food);
  const mine = (await db.list(P() + "/foods")).find((x) => x.code === String(f.code));
  if (!mine) db.set(`${P()}/foods/bc-${food.code}`, { ...food, type: "alimento", src: "custom" });
}
async function lookupCode(code) {
  const mine = (await db.list(P() + "/foods")).find((f) => f.code === code);
  if (mine) return pickFood(mine);
  const shared = await db.get(BC(code));
  if (shared) { saveBarcode(shared); toast("Encontrado en la base de IMA ✓"); return pickFood({ ...shared, id: "bc-" + code, src: "bc" }); }
  const cl = (await getOffCL()).find((f) => f.code === String(code));
  if (cl) { saveBarcode(cl); toast("Encontrado ✓"); return pickFood({ ...cl, src: "off" }); }
  if (!navigator.onLine) return toast("Sin conexión: no se puede buscar el código");
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity`).then((r) => r.json());
    if (r.status !== 1) { toast("Producto no encontrado. Puedes crearlo."); FS.tab = "crear"; FS.sel = null; $("#ftabs").innerHTML = ftabsHtml(); await renderFoodTab(); $("#nCode").value = code; return; }
    const f = offToFood(r.product, code); saveBarcode(f); toast("Guardado en la base de alimentos ✓"); pickFood(f);
  } catch { toast("No se pudo consultar Open Food Facts"); }
}
function offToFood(p, code) {
  const n = p.nutriments || {};
  return { id: "off-" + (code || uid()), src: "off", name: p.product_name || "Producto", brand: p.brands || "", code, portion: +p.serving_quantity || null, medida: +p.serving_quantity ? "1 porción (etiqueta)" : "", medidaG: +p.serving_quantity || null,
    kcal: +n["energy-kcal_100g"] || 0, cho: +n.carbohydrates_100g || 0, fat: +n.fat_100g || 0, prot: +n.proteins_100g || 0 };
}
act("offSearch", async () => {
  if (!navigator.onLine) return toast("Necesitas conexión");
  const q = $("#fq")?.value.trim(); if (!q) return toast("Escribe qué buscar");
  $("#fres").innerHTML = `<p class="muted small pad">Buscando…</p>`;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=25&fields=code,product_name,brands,nutriments,serving_quantity&countries_tags_es=chile`).then((r) => r.json());
    FS.results = (r.products || []).filter((p) => p.product_name).map((p) => offToFood(p, p.code));
    $("#fres").innerHTML = FS.results.map(resRow).join("") || `<p class="muted small pad">Sin resultados.</p>`;
  } catch { $("#fres").innerHTML = `<p class="muted small pad">No se pudo buscar.</p>`; }
});


// Miniatura del video (Drive o YouTube); si no carga, queda el botón de play
function thumbUrl(u) {
  const d = (u || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{20,})/); if (d) return `https://drive.google.com/thumbnail?id=${d[1]}&sz=w800`;
  const y = (u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return y ? `https://img.youtube.com/vi/${y[1]}/hqdefault.jpg` : "";
}
// La última retroalimentación del coach se muestra durante 9 días desde que la publica
export const freshFb = (c) => (c.feedback && (c.feedback.points?.length || c.feedback.text || c.feedback.videoUrl) && Date.now() - (c.feedback.at || 0) < 9 * 864e5 ? c.feedback : null);
// ================================================================ PROGRESO
async function progress() {
  const c = S.client, w = weekInfo(c, ymd());
  const fb = freshFb(c);
  const days = await getDays(addDays(ymd(), -60), ymd());
  const keys = Object.keys(days).sort(), wv = keys.map((k) => days[k].weight ?? null);
  return `${head("Progreso")}
  ${has("feedback") && (fb || (c.weeklyGoals || []).length) ? `<div class="card fbcard">
    ${fb ? `<div class="card-t">Tu retroalimentación · Semana ${+fb.week.slice(1)}</div>
    ${fb.videoUrl ? `<button class="fbthumb" data-a="openFeedback">${thumbUrl(fb.videoUrl) ? `<img src="${thumbUrl(fb.videoUrl)}" alt="" onerror="this.remove()">` : ""}<span>${I.play}</span></button>` : ""}
    ${fb.text ? `<p class="fbmsg">${esc(fb.text)}</p>` : ""}
    ${!fb.videoUrl ? `<button class="btn small" data-a="openFeedback">Ver y calificar</button>` : ""}` : ""}
    ${(c.weeklyGoals || []).length ? `<div class="goals-t">Tu foco esta semana</div><ul>${c.weeklyGoals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}</div>` : ""}
  <a class="card" href="#peso"><div class="card-t">${I.scale}Peso corporal</div>${lineChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), [{ vals: wv, color: "var(--dim)", dots: true, w: 1 }, { vals: trend(wv), color: "var(--acc)" }], { h: 130 })}</a>
  <div class="list">${has("prog_timeline") ? `<a href="#timeline"><span>Timeline y etapas<small>Tu calendario nutricional semana a semana</small></span>${I.chev}</a>` : ""}
  <a href="#sueno"><span>Sueño<small>Registro y estadísticas</small></span>${I.chev}</a>
  ${has("prog_photos") ? `<a href="#fotos"><span>Fotos<small>Por semana y comparador</small></span>${I.chev}</a>` : ""}
  ${has("prog_measures") ? `<a href="#medidas"><span>Medidas<small>Una vez al mes</small></span>${I.chev}</a>` : ""}
  ${has("checkin") ? `<a href="#checkin"><span>Check-in semanal<small>Semana ${w.n}</small></span>${I.chev}</a>` : ""}</div>`;
}
act("openFeedback", async () => {
  const fb = S.client.feedback; if (!fb) return;
  const { openFeedbackPlayer } = await import("./player.js");
  openFeedbackPlayer(fb);
});


// ---------- Peso
async function weightView() {
  const today = ymd(), d = await getDay(S.date);
  const days = await getDays(addDays(today, -90), today);
  const keys = Object.keys(days).sort(), vals = keys.map((k) => days[k].weight ?? null), tr = trend(vals);
  const w = weekInfo(S.client, today), pw = weekInfo(S.client, addDays(today, -7));
  const avgW = (wk) => avg(wk.days.map((x) => days[x]?.weight).filter((x) => x != null));
  const a1 = avgW(w), a0 = avgW(pw), regs = w.days.filter((x) => days[x]?.weight != null).length;
  const last = d.weight ?? [...vals].reverse().find((v) => v != null) ?? 70;
  return `${head("Peso", "progreso")}${dayStrip()}
  <div class="card center"><div class="card-t">${fmtDate(S.date, true)}</div><div class="stepper"><button class="btn" data-a="wStep" data-n="-0.1">−</button><input id="wI" type="number" step="0.1" inputmode="decimal" value="${r1(last)}"><button class="btn" data-a="wStep" data-n="0.1">＋</button></div>
  <div class="wq"><span>¿En ayunas?</span>${chips("fast", [["1", "Sí", "g"], ["0", "No", "r"]], WQ.fast ?? (d.weightFast === false ? "0" : d.weight ? "1" : ""), "wQ")}</div>
  <div class="wq"><span>¿Después de ir al baño?</span>${chips("bath", [["1", "Sí", "g"], ["0", "No", "r"]], WQ.bath ?? (d.weightBath === false ? "0" : d.weightBath ? "1" : ""), "wQ")}</div>
  <button class="btn primary big" data-a="wSave">${d.weight ? "Actualizar" : "Guardar"}</button><div class="muted small">Lo ideal: en ayunas y después de ir al baño.</div></div>
  <div class="card stats3"><div><b>${a1 ? r1(a1) : "—"}</b><small>Promedio semana</small></div><div><b class="${a1 && a0 ? (a1 - a0 > 0 ? "up" : "down") : ""}">${a1 && a0 ? (a1 - a0 > 0 ? "+" : "") + r1(a1 - a0) + " kg" : "—"}</b><small>vs semana anterior</small></div><div><b>${regs}/7</b><small>Días registrados</small></div></div>
  <div class="card"><div class="card-t">Tendencia (90 días)</div>${lineChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), [{ vals, color: "var(--muted)", dots: true, w: 1 }, { vals: tr, color: "var(--acc)" }], { unit: " kg" })}
  <div class="muted small">Puntos: pesajes diarios · Línea roja: tendencia (suaviza las subidas y bajadas del día a día).</div></div>`;
}
act("wStep", (el) => { const i = $("#wI"); i.value = r1((num(i.value) || 0) + +el.dataset.n); });
let WQ = {};
act("wQ", (el) => { WQ[el.dataset.name] = el.dataset.v; $$(`[data-a="wQ"][data-name="${el.dataset.name}"]`).forEach((b) => b.classList.toggle("on", b === el)); });
act("wSave", async () => {
  const v = num($("#wI").value); if (!v) return;
  const d = await getDay(S.date);
  const fast = WQ.fast ?? (d.weightFast === false ? "0" : d.weight ? "1" : ""), bath = WQ.bath ?? (d.weightBath === false ? "0" : d.weightBath ? "1" : "");
  if (!fast || !bath) return toast("Responde las dos preguntas (sí o no)");
  await setDay(S.date, { weight: v, weightFast: fast === "1", weightBath: bath === "1" }); WQ = {}; toast("Peso guardado"); refresh();
});


// ---------- Sueño
async function sleepView() {
  const today = ymd(), d = await getDay(S.date), s = d.sleep || {};
  const days = await getDays(addDays(today, -40), today);
  const hrs = (k) => sleepHours(days[k]?.sleep);
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i)).map(hrs).filter((x) => x != null);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).map(hrs).filter((x) => x != null);
  const q7 = avg(Array.from({ length: 7 }, (_, i) => days[addDays(today, -i)]?.sleep?.quality).filter(Boolean));
  const w = weekInfo(S.client, today);
  const now = parseYmd(S.date), first = new Date(now.getFullYear(), now.getMonth(), 1), nd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const off = (first.getDay() + 6) % 7;
  return `${head("Sueño", "progreso")}${dayStrip()}
  <div class="card"><div class="card-t">${I.moon}Noche que terminó el ${fmtDate(S.date)}</div>
  <div class="grid2" style="margin:0"><label>Me acosté a las<input id="sB" type="time" value="${s.bed || "23:00"}"></label><label>Desperté a las<input id="sW" type="time" value="${s.wake || "07:00"}"></label></div>
  <label>Minutos despierto durante la noche<input id="sA" type="number" inputmode="numeric" value="${s.awake || ""}" placeholder="0"></label>
  <div class="card-t">Calidad del sueño (1 a 5)</div>${chips("q", [1, 2, 3, 4, 5].map((n) => [n, n]), s.quality || "", "sleepQ")}
  <div class="card-t">¿Tomaste alguna fuente de cafeína después de las 12:00 el día de ayer?</div>${chips("caf", [["1", "Sí", "r"], ["0", "No", "g"]], d.cafPM == null ? "" : d.cafPM ? "1" : "0", "sleepCaf")}
  <button class="btn primary big" data-a="sleepSave">Guardar</button></div>
  <div class="card stats3"><div><b>${last7.length ? fmtH(avg(last7)) : "—"}</b><small>Prom. 7 días</small></div><div><b>${last30.length ? fmtH(avg(last30)) : "—"}</b><small>Prom. 30 días</small></div><div><b>${q7 ? r1(q7) + "/5" : "—"}</b><small>Calidad 7 días</small></div>
  <div><b>${last30.length ? fmtH(Math.max(...last30)) : "—"}</b><small>Mejor noche</small></div><div><b>${last30.length ? fmtH(Math.min(...last30)) : "—"}</b><small>Peor noche</small></div><div><b>${r1(sum(w.days.map(hrs).filter((x) => x != null)))} h</b><small>Total semana</small></div></div>
  <div class="card"><div class="card-t">${MONTHS[now.getMonth()]} ${now.getFullYear()} · ${last30.length} noches registradas</div>
  <div class="cal"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>${"<i></i>".repeat(off)}${Array.from({ length: nd }, (_, i) => { const k = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i + 1)}`, h = hrs(k); return `<b style="background:${sleepColor(h)};${h == null ? "color:var(--dim)" : ""}" title="${h != null ? fmtH(h) : ""}">${i + 1}</b>`; }).join("")}</div>
  <div class="legend"><span><i style="background:#ef4444"></i>&lt;6 h</span><span><i style="background:#eab308"></i>6–7 h</span><span><i style="background:#22c55e"></i>7–8 h</span><span><i style="background:#3b82f6"></i>8 h o más</span></div></div>`;
}
let sleepQ = null, sleepCaf = null;
act("sleepCaf", (el) => { sleepCaf = el.dataset.v === "1"; $$('[data-a="sleepCaf"]').forEach((b) => b.classList.toggle("on", b === el)); });
act("sleepQ", (el) => { sleepQ = +el.dataset.v; $$('[data-a="sleepQ"]').forEach((b) => b.classList.toggle("on", b === el)); });
act("sleepSave", async () => {
  const d = await getDay(S.date);
  await setDay(S.date, { sleep: { bed: $("#sB").value, wake: $("#sW").value, awake: num($("#sA").value) || 0, quality: sleepQ || d.sleep?.quality || null }, ...(sleepCaf != null ? { cafPM: sleepCaf } : {}) });
  sleepQ = null; sleepCaf = null; toast("Sueño guardado"); refresh();
});

// ---------- Fotos
let photoWeek = null, cmpA = null, cmpB = null;
async function photosView() {
  const w = weekInfo(S.client, ymd());
  const weeks = Array.from({ length: Math.max(1, w.n) }, (_, i) => "S" + pad(i + 1));
  photoWeek = photoWeek || w.key;
  const all = (await db.list(P() + "/photos")).filter((p) => !["comida", "equipo"].includes(p.kind));
  const cur = all.filter((p) => p.week === photoWeek);
  const withPh = [...new Set(all.map((p) => p.week))].sort();
  cmpA = cmpA || withPh[0] || "S01"; cmpB = cmpB || w.key;
  const opt = (sel) => weeks.slice().reverse().map((k) => `<option ${k === sel ? "selected" : ""} value="${k}">Semana ${+k.slice(1)}${withPh.includes(k) ? " ●" : ""}</option>`).join("");
  const pick = (wk, t) => all.filter((p) => p.week === wk && p.kind === t).sort((a, b) => b.at - a.at)[0];
  return `${head("Fotos", "progreso")}
  <div class="card"><label>Semana de las fotos<select data-a-change="photoWeek">${opt(photoWeek)}</select></label>
  <div class="ptypes">${PHOTO_TYPES.map(([t, l]) => { const ps = cur.filter((p) => p.kind === t); return `<div class="pslot">${ps.map((p) => `<img src="${p.data}" data-a="viewPhoto" data-id="${p.id}">`).join("")}<label class="padd">＋<input type="file" accept="image/*" hidden data-a-change="photoUp" data-t="${t}"></label><small>${l}</small></div>`; }).join("")}</div>
  <p class="muted small">Toca ＋ para elegir de tu galería. Misma luz, mismo lugar y misma hora (idealmente en ayunas).</p></div>
  <div class="card"><div class="card-t">Comparar semanas</div><div class="row gap"><select data-a-change="cmp" data-k="a">${opt(cmpA)}</select><span class="muted">vs</span><select data-a-change="cmp" data-k="b">${opt(cmpB)}</select></div>
  ${PHOTO_TYPES.map(([t, l]) => { const a = pick(cmpA, t), b = pick(cmpB, t); return `<div class="cmp"><div>${a ? `<img src="${a.data}">` : "Sin foto"}</div><div>${b ? `<img src="${b.data}">` : "Sin foto"}</div><small>${l}</small></div>`; }).join("")}</div>`;
}
act("photoWeek", (el) => { photoWeek = el.value; refresh(); });
act("cmp", (el) => { el.dataset.k === "a" ? (cmpA = el.value) : (cmpB = el.value); refresh(); });
act("photoUp", async (el) => {
  const f = el.files[0]; if (!f) return; toast("Subiendo…");
  const data = await compressImage(f, 1000, 0.72);
  await db.set(`${P()}/photos/${uid()}`, { kind: el.dataset.t, week: photoWeek, date: ymd(), data, at: Date.now() }); refresh();
});


// ---------- Medidas
async function measuresView() {
  const all = (await db.list(P() + "/measures")).sort((a, b) => b.id.localeCompare(a.id));
  const last = all[0];
  return `${head("Medidas", "progreso")}
  <div class="card"><div class="row between"><div class="card-t">Nueva medición · ${fmtDate(ymd())}</div><button class="btn tiny" data-a="measureGuide">¿Cómo medir?</button></div>
  <p class="muted small">Una vez al mes, en centímetros.${last ? ` Última: ${fmtDate(last.id)}.` : ""}</p>
  <div class="grid2">${MEASURE_ZONES.map(([k, l]) => `<label>${l}<input data-z="${k}" type="number" step="0.1" inputmode="decimal" placeholder="${last?.[k] ?? ""}"></label>`).join("")}</div>
  <button class="btn primary big" data-a="measureSave">Guardar medición</button></div>
  ${all.length ? `<div class="card scroll-x"><table class="tbl"><tr><th>Zona</th>${all.slice(0, 6).map((m) => `<th>${fmtDate(m.id)}</th>`).join("")}</tr>${MEASURE_ZONES.map(([k, l]) => `<tr><td>${l}</td>${all.slice(0, 6).map((m) => `<td>${m[k] ?? "—"}</td>`).join("")}</tr>`).join("")}</table></div>` : ""}`;
}
act("measureGuide", () => sheet("Cómo medir", `<ol class="guide"><li>Usa una cinta métrica flexible.</li><li>Mide sobre la piel, de pie y relajado, sin contraer.</li><li>La cinta firme pero sin apretar ni hundir la piel.</li><li><b>El cero siempre debe quedar bajo la cinta.</b></li><li>Mide dos veces cada zona y anota el promedio.</li><li>Mide siempre a la misma hora, idealmente en ayunas.</li></ol>
  ${MEASURE_ZONES.map(([, l, h]) => `<div class="li"><b>${l}:</b> ${h}</div>`).join("")}`));
act("measureSave", async () => {
  const data = {}; $$("[data-z]").forEach((i) => { const v = num(i.value); if (v != null) data[i.dataset.z] = v; });
  if (!Object.keys(data).length) return toast("Anota al menos una medida");
  await db.set(`${P()}/measures/${ymd()}`, data); toast("Medición guardada"); refresh();
});


// ================================================================ MÁS
async function more() {
  return `${head("Más")}<div class="list">
  ${has("macro_guide") ? `<a href="#plan"><span>Mi guía de macros</span>${I.chev}</a>` : has("plan_menus") || has("plan_pdf") || has("plan_pauta") ? `<a href="#plan"><span>Mi plan de alimentación</span>${I.chev}</a>` : ""}${has("checkin") ? `<a href="#checkin"><span>Check-in semanal</span>${I.chev}</a>` : ""}${has("guides") ? `<a href="#guias"><span>Guías</span>${I.chev}</a>` : ""}${has("equipment") ? `<a href="#equipo"><span>Mi equipamiento</span>${I.chev}</a>` : ""}
  <a href="#info"><span>Información personal</span>${I.chev}</a><a href="#ajustes"><span>Ajustes</span>${I.chev}</a><a data-a="obOpen"><span>Bienvenida a IMA<small>Cómo funciona la app</small></span>${I.chev}</a>
  ${S.role === "coach" ? `<a data-a="asCoach"><span><b>Volver al panel de coach</b></span>${I.chev}</a>` : ""}<a data-a="logout"><span class="red">Cerrar sesión</span></a></div>
  <p class="muted small center">${navigator.onLine ? "Conectado · todo sincronizado" : "Sin conexión · tus datos se guardan y se suben al volver la señal"}${DEMO ? " · MODO DEMO" : ""}</p>`;
}
async function planView() {
  if (has("macro_guide")) return macroGuideView();
  const p = has("plan_pdf") ? S.client.plan || {} : {}, opts = has("plan_menus") ? menusHtml(S.client) : "";
  const st = S.client.stage, aj = adjTxt(st?.adj);
  return `${head("Mi plan de alimentación", "mas")}${aj ? `<div class="card fbmini"><div class="card-t">Etapa: ${esc(st.phase)} · semanas ${st.from}–${st.to}</div><div class="small">Tu plan ya viene ajustado para esta etapa: <b>${esc(aj)}</b> porciones al día. Los gramos de abajo ya incluyen el cambio.</div>${st.note ? `<div class="muted small mt">${esc(st.note)}</div>` : ""}</div>` : ""}${opts}
  ${p.pdfUrl || p.notes || !opts ? `<div class="card">${p.pdfUrl ? `<a class="btn ${opts ? "" : "primary"} big block" target="_blank" href="${esc(p.pdfUrl)}">Abrir mi plan (PDF)</a>` : opts ? "" : `<p class="muted">Tu coach aún no sube tu plan.</p>`}
  ${p.notes ? `<div class="pre">${esc(p.notes)}</div>` : ""}</div>` : ""}
  ${has("plan_pauta") && S.client.pauta ? `<details class="card"><summary class="card-t">Porciones por día</summary>${Object.entries(S.client.pauta).filter(([, v]) => +v > 0).map(([g, v]) => `<div class="li row between"><span>${esc(g)}</span><b>${v}</b></div>`).join("")}</details>` : ""}`;
}

// Solo entrenamiento: sin plan de alimentación, con una guía de macros en rangos según su peso
async function macroGuideView() {
  const days = await getDays(addDays(ymd(), -30), ymd()), kg = Object.keys(days).sort().map((k) => days[k].weight).filter(Boolean).pop() || S.client.weightStart;
  const g = macroGuide(S.client, kg), c = S.client;
  const row = (l, k, unit, col) => `<div class="mg"><span class="mg-l" style="color:${col}">${l}</span><span class="mg-r"><b>${g[k][0]}–${g[k][1]} ${unit}</b>${k !== "kcal" ? `<small>${g.R[k][0]}–${g.R[k][1]} g por kg</small>` : ""}</span></div>`;
  return `${head("Mi guía de macros", "mas")}
  <div class="card"><p class="small">Tu asesoría es de <b>entrenamiento</b>, así que no tienes un plan de alimentación cerrado: tienes <b>rangos</b> para guiarte. Registra lo que comes en <b>Comida</b> y trata de quedar dentro de ellos, sobre todo en proteína.</p></div>
  ${g ? `<div class="card"><div class="card-t">Para tu peso actual · ${r1(g.w)} kg</div>${row("Proteína", "prot", "g", "var(--g)")}${row("Carbohidratos", "cho", "g", "var(--y)")}${row("Grasas", "fat", "g", "var(--b)")}${row("Calorías", "kcal", "kcal", "var(--r)")}
  <p class="muted small mt">Tu meta diaria en el inicio es ${(c.kcal || 0).toLocaleString("es-CL")} kcal · P ${c.prot} · C ${c.cho} · G ${c.fat}. Los rangos se ajustan solos cuando registras tu peso.</p></div>` : `<div class="card"><p class="muted">Registra tu peso para calcular tus rangos.</p></div>`}
  ${c.plan?.notes ? `<div class="card"><div class="card-t">Indicaciones de tu coach</div><div class="pre">${esc(c.plan.notes)}</div></div>` : ""}`;
}

// ---------- Check-in semanal (igual al de la planilla)
let CI = {};
async function checkinView() {
  const w = weekInfo(S.client, ymd()), saved = (await db.get(`${P()}/checkins/${w.key}`)) || {};
  CI = { ...saved };
  const days = await getDays(w.first, w.last);
  const regDays = Object.values(days).filter((d) => Object.values(d.meals || {}).some((m) => m.length)).length;
  const dep = avg(Object.values(days).map((d) => d.depos).filter((x) => x != null));
  // Seguimiento: el foco que se propuso la semana pasada (o la meta que le dejó el coach)
  const pw = weekInfo(S.client, addDays(w.first, -7)), prevCi = pw.n >= 1 ? await db.get(`${P()}/checkins/${pw.key}`) : null;
  const prevFoco = (S.client.weeklyGoals || [])[0] || prevCi?.foco || "";
  if (prevFoco && !CI.accionFoco) CI.accionFoco = prevFoco;
  const [rts, sss] = await Promise.all([getRoutines(S.cid), getSessions(S.cid)]), tp = weekPlan(S.client, rts, sss, w.first);
  const q = ([k, label, type, extra, ph]) => {
    let inp;
    if (type === "text") inp = `<textarea rows="2" data-a-input="ciTxt" data-k="${k}">${esc(CI[k] || "")}</textarea>`;
    else if (type === "line") inp = `<input data-a-input="ciTxt" data-k="${k}" value="${esc(CI[k] || "")}" placeholder="${esc(ph || "Ejercicio, peso × reps")}">`;
    else if (type === "num") inp = `<input type="number" step="0.1" inputmode="decimal" data-a-input="ciTxt" data-k="${k}" value="${esc(CI[k] ?? "")}">`;
    else if (type.multi) inp = `<div class="ci-grid">${type.multi.map((o) => `<label><input type="checkbox" data-a-change="ciMulti" data-k="${k}" value="${esc(o)}" ${(CI[k] || []).includes(o) ? "checked" : ""}>${esc(o)}</label>`).join("")}</div>`;
    else if (type.length > 6) inp = `<select data-a-change="ciSel" data-k="${k}"><option value="">—</option>${type.map((o) => `<option ${CI[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else inp = chips(k, type.map((o) => [o, o]), CI[k], "ciChip");
    const ex = extra ? `<input class="mt" data-a-input="ciTxt" data-k="${k}Det" value="${esc(CI[k + "Det"] || "")}" placeholder="${esc(extra)}">` : "";
    return `<div class="ci-q"><div>${esc(label)}</div>${inp}${ex}</div>`;
  };
  return `${head(`Check-in · Semana ${w.n}`, "mas")}
  <p class="muted small center">${fmtDate(w.first)} – ${fmtDate(w.last)}${saved.at ? " · enviado ✓ (puedes actualizarlo)" : ""}</p>
  ${prevFoco ? `<div class="ci-sec ci-open"><h3>Tu foco de la semana pasada</h3><div class="note"><b>${esc(prevFoco)}</b></div>
    ${q(["accion", "¿Cómo te fue?", ["Lo logré", "A medias", "No lo logré"]])}${q(["accionDet", "¿Qué te ayudó o qué te lo impidió?", "text"])}</div>` : ""}
  ${CHECKIN.map((sec) => `<div class="ci-sec ${sec.open ? "ci-open" : ""}"><h3>${esc(sec.t)}</h3>
    ${sec.open ? `<p class="muted small">Tómate un par de minutos en estas: son las que más me sirven para ajustar tu plan.</p>` : ""}
    ${sec.t === "Entrenamiento" && tp.planned.length ? `<div class="ci-q"><div>Entrenamientos de la semana</div><b>${tp.doneCount} de ${tp.planned.length}</b> <span class="muted small">(automático)</span></div>` : ""}
    ${sec.t === "Nutrición" ? `<div class="ci-q"><div>¿Cuántos días registraste tu alimentación en la app?</div><b>${regDays} de 7</b> <span class="muted small">(automático)</span></div>` : ""}
    ${sec.t === "Digestión" && dep != null ? `<div class="note">Según tus registros diarios: ${r1(dep)} deposiciones por día en promedio.</div>` : ""}
    ${sec.q.map(q).join("")}
    ${sec.t === "Nutrición" && S.client.sex === "F" ? q(["ciclo", "¿Estás en tu ciclo menstrual?", ["Sí", "No"]]) : ""}</div>`).join("")}
  <div class="pad-x"><button class="btn primary big" data-a="ciSave">${saved.at ? "Actualizar" : "Enviar"} check-in</button></div>`;
}
act("ciChip", (el) => { CI[el.dataset.name] = el.dataset.v; $$(`[data-a="ciChip"][data-name="${el.dataset.name}"]`).forEach((b) => b.classList.toggle("on", b === el)); });
act("ciSel", (el) => (CI[el.dataset.k] = el.value));
act("ciTxt", (el) => (CI[el.dataset.k] = el.value));
act("ciMulti", (el) => { const s = new Set(CI[el.dataset.k] || []); el.checked ? s.add(el.value) : s.delete(el.value); CI[el.dataset.k] = [...s]; });
act("ciSave", async () => {
  const w = weekInfo(S.client, ymd()), days = await getDays(w.first, w.last);
  CI.diasRegistrados = Object.values(days).filter((d) => Object.values(d.meals || {}).some((m) => m.length)).length;
  const [rts, sss] = await Promise.all([getRoutines(S.cid), getSessions(S.cid)]), tp = weekPlan(S.client, rts, sss, w.first);
  CI.entrenos = `${tp.doneCount}/${tp.planned.length}`;
  await db.set(`${P()}/checkins/${w.key}`, { ...CI, at: Date.now(), date: ymd() }, false);
  toast("Check-in enviado ✓"); go("inicio");
});
async function guidesView() {
  const g = (await db.get("library/guides"))?.items || [];
  return `${head("Guías", "mas")}<div class="list">${g.map((x, k) => `<a ${embedUrl(x.url) ? `data-a="guideOpen" data-k="${k}"` : `target="_blank" href="${esc(x.url)}"`}><span>${esc(x.title)}<small>${esc(x.desc || "")}</small></span>${I.chev}</a>`).join("") || `<p class="muted pad">Pronto encontrarás aquí tus guías.</p>`}</div>`;
}
// Las guías en PDF (Drive) se leen dentro de la app, sin salir
act("guideOpen", async (el) => {
  const g = ((await db.get("library/guides"))?.items || [])[+el.dataset.k]; if (!g) return;
  sheet(g.title, `<div class="pdfview"><iframe src="${embedUrl(g.url)}" allow="autoplay"></iframe></div><a class="btn block" target="_blank" href="${esc(g.url)}">Abrir en Drive (para descargarla)</a>`, { full: true });
});
async function equipView() {
  const ph = (await db.list(P() + "/photos")).filter((p) => p.kind === "equipo");
  return `${head("Mi equipamiento", "mas")}<div class="card"><p class="muted small">Sube fotos de las máquinas y equipos que tienes disponibles. Así tu coach arma la rutina con lo que realmente hay.</p>
  <div class="thumbs big">${ph.map((p) => `<img src="${p.data}" data-a="viewPhoto" data-id="${p.id}">`).join("")}<label class="padd">＋<input type="file" accept="image/*" multiple hidden data-a-change="equipUp"></label></div></div>`;
}
act("equipUp", async (el) => { for (const f of el.files) { const data = await compressImage(f, 900, 0.65); await db.set(`${P()}/photos/${uid()}`, { kind: "equipo", data, at: Date.now(), week: weekInfo(S.client).key }); } refresh(); });
async function infoView() {
  const c = S.client;
  const rows = [["Nombre", c.name], ["Fecha de nacimiento", c.birth ? fmtDate(c.birth) : ""], ["Sexo", { M: "Masculino", F: "Femenino" }[c.sex] || ""], ["Estatura", c.height ? c.height + " cm" : ""], ["Inicio de la asesoría", c.startDate ? fmtDate(c.startDate) : ""], ["Etapa actual", c.phase], ["Objetivo", c.goal]];
  return `${head("Información personal", "mas")}<div class="card">${rows.map(([l, v]) => `<div class="li row between"><span class="muted">${l}</span><b>${esc(v || "—")}</b></div>`).join("")}</div><p class="muted small center">Para cambiar algo, escríbele a tu coach.</p>`;
}
async function settingsView() {
  const theme = LS.get("theme") || "dark";
  const perm = "Notification" in window ? Notification.permission : "no";
  const r = remCfg(), on = r.on && perm === "granted";
  const sw = (k, v) => `<label class="sw"><input type="checkbox" ${v ? "checked" : ""} data-a-change="remSet" data-k="${k}"><i></i></label>`;
  const tm = (k, v) => `<input type="time" value="${v}" data-a-change="remSet" data-k="${k}" class="tm">`;
  const row = (t, sub, right) => `<div class="li row between remrow"><span><b>${t}</b>${sub ? `<small class="muted">${sub}</small>` : ""}</span><span class="row gap">${right}</span></div>`;
  return `${head("Ajustes", "mas")}<div class="card"><div class="card-t">Tema</div>${chips("t", [["dark", "Oscuro"], ["light", "Claro"]], theme, "theme")}</div>
  <div class="card"><div class="card-t">${I.bell}Recordatorios</div>
    ${perm === "no" ? `<p class="muted small">Este navegador no permite notificaciones.</p>` : perm === "denied" ? `<p class="warn small">Bloqueaste las notificaciones. Actívalas en los ajustes de Chrome para esta app.</p>` : ""}
    <div class="sched"><b>Tu horario de todos los días</b><div class="remmeals"><span>Despierto a las${tm("sched.wake", r.sched.wake)}</span><span>Me duermo a las${tm("sched.bed", r.sched.bed)}</span></div></div>
    ${row("Activar recordatorios", on ? "Activados ✓" : "Te avisa solo si te falta registrar algo", sw("on", on))}
    ${on ? `
    ${row("Agua", "Si vas atrasado con tu meta", `<select data-a-change="remSet" data-k="water.every" class="tm">${[1, 2, 3].map((h) => `<option value="${h}" ${+r.water.every === h ? "selected" : ""}>cada ${h} h</option>`).join("")}</select>${sw("water.on", r.water.on)}`)}
    ${row("Comidas", "Si a esa hora no has registrado esa comida", sw("meals.on", r.meals.on))}
    ${r.meals.on ? `<div class="remmeals">${Object.entries(r.meals.times).map(([m, t]) => `<span>${m}${tm("meals.times." + m, t)}</span>`).join("")}</div>` : ""}
    ${row("¿Cuántos pasos llevas?", `A mediodía (${minTo(toMin(r.sched.wake) + 360)}) y en la tarde (${minTo(toMin(r.sched.bed) - 240)}): te dice cuánto te falta y te propone una caminata`, sw("steps.checks", r.steps.checks))}
    ${row("Pasos de ayer", "Al abrir la app un día nuevo, si no anotaste los pasos del día anterior te los pide", sw("steps.on", r.steps.on))}
    ${row("Peso", "En ayunas", `${tm("weight.at", r.weight.at)}${sw("weight.on", r.weight.on)}`)}
    ${row("Entrenamiento", "Los días que te toca", `${tm("train.at", r.train.at)}${sw("train.on", r.train.on)}`)}
    ${row("Check-in semanal", "Al final de tu semana", `${tm("checkin.at", r.checkin.at)}${sw("checkin.on", r.checkin.on)}`)}
    <div class="li remrow"><span><b>Avisos con la app cerrada</b><small class="muted">${pushOn() ? "Activados en este celular ✓" : pushReady() ? "Te llegan como notificación aunque no abras la app" : "Tu coach aún está terminando de configurarlos"}</small></span>${pushReady() && !pushOn() ? `<button class="btn tiny primary" data-a="pushOn">Activar</button>` : ""}</div>
    <button class="btn block small mt" data-a="testNotif">🔔 Probar notificación</button>
    <p class="muted small mt">La campana de arriba a la derecha se mueve cuando tienes algo urgente.</p>` : ""}
  </div>
  <div class="card"><div class="card-t">Unidades</div><p class="muted small">Kilogramos, litros y centímetros.</p></div>`;
}
const REM_DEF = { on: false, water: { on: true, every: 2, from: "09:00", to: "21:00" }, meals: { on: true, times: { "Comida 1": "09:30", "Comida 2": "13:30", "Comida 3": "17:30", "Comida 4": "21:00" } }, sched: { wake: "07:00", bed: "23:00" }, weight: { on: true, at: "07:20" }, steps: { on: true, checks: true }, train: { on: true, at: "17:00" }, checkin: { on: true, at: "10:00" } };
function remCfg() {
  let c = {}; try { c = JSON.parse(LS.get("rem") || "{}"); } catch {}
  const out = JSON.parse(JSON.stringify(REM_DEF));
  for (const k of Object.keys(c)) out[k] = typeof c[k] === "object" ? { ...out[k], ...c[k], ...(k === "meals" ? { times: { ...out.meals.times, ...Object.fromEntries(Object.entries(c.meals.times || {}).filter(([m]) => m.startsWith("Comida "))) } } : {}) } : c[k];
  return out;
}
act("pushOn", async () => {
  try { await enablePush(S.cid); await db.set(`${P()}/settings/reminders`, { ...remCfg(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, at: Date.now() }, false); toast("Listo: te llegarán avisos con la app cerrada"); }
  catch (e) { toast(e.message === "denied" ? "Activa las notificaciones para esta app en los ajustes del celular" : "No se pudo activar: " + (e.code || e.message)); }
  refresh();
});
act("remSet", async (el) => {
  const c = remCfg(), path = el.dataset.k.split("."), v = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? +el.value : el.value;
  if (path[0] === "on" && v && "Notification" in window && Notification.permission !== "granted") {
    const p = await Notification.requestPermission(); if (p !== "granted") { toast("Sin permiso no puedo avisarte"); return refresh(); }
  }
  let o = c; for (const k of path.slice(0, -1)) o = o[k]; o[path[path.length - 1]] = v;
  if (el.dataset.k === "sched.wake") c.weight.at = minTo(toMin(v) + 20);
  if (S.cid) db.set(`${P()}/settings/reminders`, { ...c, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, at: Date.now() }, false); // para avisos con la app cerrada (próximo paso)
  if (path[0] === "sched") refresh();
  LS.set("rem", JSON.stringify(c)); if (path[0] === "on" || path[1] === "on") refresh();
  checkReminders();
});
const minTo = (m) => { m = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
// Al entrar un día nuevo: 1) pide los pasos de ayer si faltan  2) muestra cómo te fue ayer
async function askYesterdaySteps() {
  if (S.preview) return; // el coach mirando la app de un cliente
  const today = ymd(), k = "ystep:" + today;
  if (LS.get(k) || !S.cid || document.querySelector(".sheet-bg")) return;
  LS.set(k, "1");
  const y = addDays(today, -1);
  if (S.raw?.startDate && y < S.raw.startDate) return;
  const d = await getDay(y);
  if (d.steps || remCfg().steps.on === false) return yesterdayReport(y);
  const dt = parseYmd(y), dia = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][dt.getDay()];
  const b = sheet("Pasos de ayer", `<div class="nightbox"><div class="nb-ic">👣</div><b>Antes de que se te olvide…</b><p>¿Cuántos pasos diste ayer <b>${dia} ${dt.getDate()}</b>? Revisa tu app de pasos o reloj y regístralo aquí.</p>
    <input id="yStepsI" type="number" inputmode="numeric" class="bignum" placeholder="Ej: 10.000"><button class="btn primary big" data-a="yStepsSave" data-d="${y}">Guardar pasos de ayer</button><button class="btn ghost block" data-a="ySkip" data-d="${y}">Ahora no</button></div>`);
  setTimeout(() => $("#yStepsI", b)?.focus(), 300);
}
act("yStepsSave", async (el) => {
  const st = num($("#yStepsI").value); if (!st) return toast("Escribe tus pasos");
  await setDay(el.dataset.d, { steps: st }); closeSheet(); refresh(); setTimeout(() => yesterdayReport(el.dataset.d), 400);
});
act("ySkip", (el) => { closeSheet(); setTimeout(() => yesterdayReport(el.dataset.d), 300); });

// ¿Cómo te fue ayer? Celebra lo cumplido (con confeti) y marca con cariño lo que faltó o se pasó
async function yesterdayReport(y) {
  const d = await getDay(y), c = applyStage(S.raw || {}, y), tot = dayTotals(d);
  const water = sum(d.water || [], (x) => x.ml), ate = Object.values(d.meals || {}).some((m) => m.length);
  if (!ate && !water && !d.steps) return;
  // ±5 % cumplido · 6–10 % "un pelito" · más de 10 % "hay que mejorar". Agua y pasos: pasarse está bien.
  const ok = [], near = [], bad = [], n = (v) => Math.round(v).toLocaleString("es-CL");
  const chk = (label, v, goal, unit, overOk) => {
    if (!goal) return; const dv = (v - goal) / goal, a = Math.abs(dv), line = `${label}: <b>${n(v)}</b> / ${n(goal)} ${unit}`;
    if (a <= 0.05 || (overOk && dv > 0)) return ok.push(line);
    const pct = `${dv > 0 ? "+" : "−"}${Math.round(a * 100)} %`;
    if (a <= 0.10) near.push(`${line} <span class="${dv < 0 ? "lo" : "hi"}">${dv < 0 ? "faltó un pelito" : "te pasaste un pelito"} (${pct})</span>`);
    else bad.push(`${line} <span class="${dv < 0 ? "lo" : "hi"}">${dv < 0 ? "faltó" : "te pasaste"} (${pct})</span>`);
  };
  chk("💧 Agua", water, c.water || 2500, "ml", true);
  if (d.steps != null) chk("👣 Pasos", d.steps || 0, c.steps || 8000, "", true);
  if (ate) {
    chk("🔥 Calorías", tot.kcal, c.kcal, "kcal");
    chk("🍗 Proteína", tot.prot, c.prot, "g");
    chk("🍚 Carbohidratos", tot.cho, c.cho, "g");
    chk("🥑 Grasas", tot.fat, c.fat, "g");
  } else bad.push(`🍽️ Comidas: <b>sin registrar</b> <span class="lo">faltó</span>`);
  const all = !bad.length && !near.length;
  sheet(all ? "¡Felicidades! 🎉" : "Así te fue ayer", `<div class="report">
    ${ok.length ? `<div class="rp ok"><b>${all ? "¡Cumpliste todo ayer! Enhorabuena 👏" : "Cumplido ✅"}</b><ul>${ok.map((x) => `<li>✅ ${x}</li>`).join("")}</ul></div>` : ""}
    ${near.length ? `<div class="rp near"><b>🤏 Casi, por un pelito</b><ul>${near.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : ""}
    ${bad.length ? `<div class="rp warn"><b>👀 Hay que mejorar</b><ul>${bad.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : ""}
    ${!all ? `<p class="small">No te preocupes si ayer no salió perfecto: <b>hoy intentemos hacerlo mejor</b> 💪</p>` : ""}
    <button class="btn primary big" data-a="closeSheet">${all ? "¡Vamos por otro día así!" : "¡Vamos con todo hoy!"}</button></div>`);
  if (ok.length) confetti(all ? 1 : 0.4);
}
// Confeti y serpentinas (sin librerías)
function confetti(power = 1) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"), g = cv.getContext("2d"), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  cv.className = "confetti"; document.body.appendChild(cv);
  const cols = ["#e0313b", "#ffffff", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899"], N = Math.round(160 * power);
  const P = Array.from({ length: N }, (_, i) => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 10 + Math.random() * 8, c: cols[i % cols.length], s: i % 7 === 0 }));
  let t0 = performance.now();
  (function f(t) {
    const k = (t - t0) / 1000; g.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k / 3.2);
      if (p.s) { g.strokeStyle = p.c; g.lineWidth = 3; g.beginPath(); for (let j = 0; j < 24; j++) g.lineTo(Math.sin(j / 2.5 + k * 6) * 6, j * 2.2); g.stroke(); }
      else { g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      g.restore();
    }
    if (k < 3.3) requestAnimationFrame(f); else cv.remove();
  })(t0);
}
// Recuadro grande de cierre del día: pasos + pendientes
async function nightBox() {
  const day = await getDay(ymd()), pend = (S.pend || []).filter((p) => p.to !== "pasos");
  const b = sheet("Cierre del día", `<div class="nightbox"><div class="nb-ic">👣</div><b>Recuerda anotar tus pasos</b><p class="muted small">Revisa tu app de pasos o reloj y anótalos aquí.</p>
    <input id="stepsI" type="number" inputmode="numeric" class="bignum" value="${day.steps || ""}" placeholder="Ej: 10.000"><button class="btn primary big" data-a="stepsSave">Guardar pasos</button></div>
    ${pend.length ? `<div class="card-t mt">También te queda pendiente</div><div class="pendlist">${pend.map((p) => `<a class="pend ${p.c}" href="#${p.to}" data-a="closeSheet"><span class="dot"></span>${esc(p.t)}${I.chev}</a>`).join("")}</div>` : ""}`);
  setTimeout(() => $("#stepsI", b)?.focus(), 300);
}
// Revisa qué falta registrar y avisa una sola vez por recordatorio
let remSynced = false;
export async function checkReminders() {
  if (S.preview) return;
  try {
    // Mantiene al día la copia de tus recordatorios que usa el servidor de avisos
    if (!remSynced && S.cid && pushOn()) { remSynced = true; refreshPush(S.cid); db.set(`${P()}/settings/reminders`, { ...remCfg(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, at: Date.now() }, false); }
    const r = remCfg();
    if (!r.on || !S.cid || !("Notification" in window) || Notification.permission !== "granted") return;
    const today = ymd(), now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), c = S.client || S.raw || {};
    const once = (id, title, body) => { const k = `rs:${id}:${today}`; if (LS.get(k)) return; LS.set(k, "1"); if (!document.hidden) toast(title); else if (!pushOn()) notify(title, body); };
    const day = await getDay(today);
    if (r.weight.on && nm >= toMin(r.weight.at) && !day.weight) once("peso", "Registra tu peso", "En ayunas, antes de comer 🙌");
    if (r.meals.on) for (const [m, t] of Object.entries(r.meals.times)) if (t && nm >= toMin(t) && nm < toMin(t) + 180 && !(day.meals?.[m] || []).length) once("m-" + m, "¿Te falta registrar alguna comida? 🍽️", "Anota lo que comiste ahora que lo tienes fresco (también puedes dictarlo)");
    if (r.water.on) {
      const f = toMin(r.water.from), t = toMin(r.water.to), every = (+r.water.every || 2) * 60;
      if (nm >= f + every && nm <= t) {
        const goal = c.water || 2500, done = sum(day.water || [], (x) => x.ml), exp = goal * Math.min(1, (nm - f) / (t - f));
        if (done < exp - 250) once("agua-" + Math.floor((nm - f) / every), "Toma agua 💧", `Llevas ${r1(done / 1000)} de ${r1(goal / 1000)} L`);
      }
    }
    if (r.steps.checks) [[toMin(r.sched.wake) + 360, 0.4, "medio"], [toMin(r.sched.bed) - 240, 0.75, "tarde"]].forEach(([t, need, id]) => {
      if (nm >= t && nm < t + 120 && (day.steps || 0) < (c.steps || 8000) * need) once("pasos-" + id, "¿Cuántos pasos llevas? 👟", "Anótalos y te digo cuánto te falta para tu meta");
    });
    if (r.train.on && nm >= toMin(r.train.at)) {
      const [routines, sessions] = await Promise.all([getRoutines(S.cid), getSessions(S.cid)]);
      const hoy = weekPlan(c, routines, sessions, today).slots.find((x) => x.date === today && x.status === "hoy");
      if (hoy) once("ent", `Hoy te toca ${hoy.name} 💪`, "Cuando termines, registra tu sesión");
    }
    if (r.checkin.on && nm >= toMin(r.checkin.at)) {
      const w = weekInfo(c, today);
      if (today >= addDays(w.last, -1) && !(await db.get(P() + "/checkins/" + w.key))) once("chk-" + w.key, "Completa tu check-in semanal", "Así tu coach puede ajustar tu plan");
    }
  } catch (e) { console.error(e); }
}
setInterval(checkReminders, 60 * 1000);
document.addEventListener("visibilitychange", () => setTimeout(checkReminders, 1500));
act("testNotif", async () => {
  if (!("Notification" in window)) return toast("Este navegador no permite notificaciones");
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return toast("Activa las notificaciones para IMA en los ajustes del celular");
  if (pushOn()) refreshPush(S.cid);
  await notify("Así te llegan los avisos de IMA ✓", "Si ves esto, las notificaciones funcionan en este celular");
  toast("Te mandé una notificación de prueba");
});
act("askNotif", async () => { await Notification.requestPermission(); refresh(); });

// ================================================================ TIMELINE (como la hoja Timeline)
export function weeksTable(raw, days, routines, sessions, today = ymd()) {
  const cur = weekInfo(raw, today);
  const rows = [];
  let prevAvg = null;
  for (let n = 1; n <= cur.n; n++) {
    const w = weekInfo(raw, addDays(raw.startDate || today, (n - 1) * 7));
    const t = applyStage(raw, w.first);
    const D = w.days.map((d) => days[d] || {});
    const A = (f) => avg(D.map(f).filter((v) => v != null && v !== 0));
    const reg = D.filter((d) => Object.values(d.meals || {}).some((m) => m.length));
    const T = (k) => avg(reg.map((d) => dayTotals(d)[k]));
    const plan = weekPlan(raw, routines, sessions, w.first);
    const wAvg = A((d) => weightCorr(d));
    rows.push({ n, w, t, reg: reg.length, kcal: T("kcal"), cho: T("cho"), fat: T("fat"), prot: T("prot"), ses: `${plan.doneCount}/${plan.planned.length}`, steps: A((d) => d.steps), cardio: sum(D.flatMap((d) => d.cardio || []), (x) => x.min), weight: wAvg, dW: wAvg && prevAvg ? wAvg - prevAvg : null, sleep: A((d) => sleepHours(d.sleep)), cur: n === cur.n });
    if (wAvg) prevAvg = wAvg;
  }
  let curPh = "";
  const cell = (v, goal, f = r0, k = "") => v == null || v === 0 ? `<td class="dim">—</td>` : `<td class="${judge(k, v, goal, curPh)}">${f(v)}</td>`;
  return `<div class="scroll-x wk-scroll"><table class="xl"><thead>
    <tr><th></th><th colspan="2">Coaching</th><th colspan="5">Nutrición (registro)</th><th colspan="5">Métricas diarias</th><th colspan="6">Metas</th></tr>
    <tr><th>Sem.</th><th>Fecha</th><th>Etapa</th><th>Días reg.</th><th>Kcal</th><th>CHO</th><th>Lip</th><th>Prot</th><th>Sesiones</th><th>Pasos</th><th>Cardio</th><th>Peso prom.</th><th>Sueño</th><th>Kcal</th><th>CHO</th><th>Lip</th><th>Prot</th><th>Agua</th><th>Pasos</th></tr></thead>
    <tbody>${rows.map((r) => { curPh = r.t.phase || ""; return `<tr class="${r.cur ? "cur" : ""}"><td>${r.n}</td><td>${fmtDate(r.w.first)}</td><td><span class="ph" style="background:${phaseColor(r.t.phase)}">${esc(r.t.phase || "—")}</span></td>
      <td>${r.reg}/7</td>${cell(r.kcal, r.t.kcal, r0, "kcal")}${cell(r.cho, r.t.cho, r0, "cho")}${cell(r.fat, r.t.fat, r0, "fat")}${cell(r.prot, r.t.prot, r0, "prot")}<td>${r.ses}</td>${cell(r.steps, r.t.steps, (v) => r0(v).toLocaleString("es-CL"), "steps")}<td>${r.cardio ? r.cardio + " min" : "—"}</td>
      <td>${r.weight ? r1(r.weight) + (r.dW != null ? ` <small class="muted">(${r.dW > 0 ? "+" : ""}${r1(r.dW)})</small>` : "") : "—"}</td><td style="color:${sleepColor(r.sleep)}">${r.sleep ? r1(r.sleep) + " h" : "—"}</td>
      <td class="muted">${r.t.kcal || "—"}</td><td class="muted">${r.t.cho || "—"}</td><td class="muted">${r.t.fat || "—"}</td><td class="muted">${r.t.prot || "—"}</td><td class="muted">${r.t.water ? r1(r.t.water / 1000) + " L" : "—"}</td><td class="muted">${(r.t.steps || 0).toLocaleString("es-CL")}</td></tr>`; }).join("")}</tbody></table></div>
    <div class="legend small"><span><i class="okc"></i>en meta</span><span><i class="lowc"></i>ojo</span><span><i class="hic"></i>lejos de la meta</span></div>`;
}
async function timelineView() {
  const raw = S.raw || {}, today = ymd(), cur = weekInfo(raw, today);
  const [days, routines, sessions] = await Promise.all([getDays(raw.startDate || addDays(today, -90), today), getRoutines(S.cid), getSessions(S.cid)]);
  const st = [...(raw.stages || [])].sort((a, b) => a.from - b.from);
  const next = st.find((s) => +s.from > cur.n), curStage = stageAt(raw, today);
  const dates = (raw.dates || []).filter((d) => d.date >= today);
  return `${head("Timeline", "progreso")}
  <div class="card"><div class="card-t">Calendario nutricional</div>${stagesBar(raw, cur.n)}
  ${curStage ? `<div class="note"><b style="color:${phaseColor(curStage.phase)}">${esc(curStage.phase)}</b> · semanas ${curStage.from} a ${curStage.to}${curStage.note ? ` · ${esc(curStage.note)}` : ""}</div>` : ""}
  ${next ? `<div class="small muted">Próxima etapa: <b style="color:${phaseColor(next.phase)}">${esc(next.phase)}</b> desde la semana ${next.from}</div>` : ""}</div>
  <div class="card" style="padding:8px">${weeksTable(raw, days, routines, sessions, today)}</div>
  ${dates.length ? `<div class="card"><div class="card-t">Fechas de interés</div>${dates.map((d) => `<div class="li"><b>${fmtDate(d.date)}</b> · ${esc(d.label)}</div>`).join("")}</div>` : ""}`;
}
