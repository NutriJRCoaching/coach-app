// Vistas del cliente (celular)
import { CONFIG } from "./config.js";
import { db, DEMO } from "./db.js";
import { S, refresh, go } from "./state.js";
import { act, toast, sheet, closeSheet, bar, lineChart, chips, confirmBox, promptBox, $, $$ } from "./ui.js";
import { esc, ymd, addDays, fmtDate, weekInfo, dayTotals, itemMacros, sleepHours, sleepColor, r0, r1, num, avg, sum, uid, hm, compressImage, trend, D1, D3, MONTHS, embedUrl, parseYmd, pad, LS } from "./util.js";
import { getDay, setDay, getDays, getRoutines, getSessions, weekPlan, getFoodBase, MEASURE_ZONES, PHOTO_TYPES, applyStage, stageAt, stagesBar, phaseColor, CHECKIN } from "./data.js";
import { trainView, sessionView, surveyView, summaryView, restBar } from "./train.js";
import { I } from "./icons.js";

const P = () => "clients/" + S.cid;

export function clientTabs() {
  const r = S.route[0];
  const t = [["inicio", "Inicio", I.home], ["comida", "Comida", I.food], ["entreno", "Entreno", I.dumbbell], ["progreso", "Progreso", I.chart], ["mas", "Más", I.menu]];
  const active = { sesion: "entreno", encuesta: "entreno", resumen: "entreno", peso: "progreso", sueno: "progreso", fotos: "progreso", medidas: "progreso", timeline: "progreso", plan: "mas", checkin: "mas", guias: "mas", equipo: "mas", info: "mas", ajustes: "mas", agua: "comida" }[r] || r;
  return `${restBar()}<nav class="tabs">${t.map(([k, l, i]) => `<a href="#${k}" class="${active === k ? "on" : ""}">${i}${l}</a>`).join("")}</nav>`;
}

export async function clientView() {
  const [r, a] = S.route;
  S.client = applyStage(S.raw || {}, S.date); // objetivos de la etapa vigente
  const views = { inicio: home, comida: food, agua: waterView, entreno: trainView, sesion: () => sessionView(a), encuesta: () => surveyView(a), resumen: () => summaryView(a),
    progreso: progress, timeline: timelineView, peso: weightView, sueno: sleepView, fotos: photosView, medidas: measuresView,
    mas: more, plan: planView, checkin: checkinView, guias: guidesView, equipo: equipView, info: infoView, ajustes: settingsView };
  return (views[r] || home)();
}

const head = (title, back, right = "") => `<header class="ch">${back ? `<a href="#${back}" class="icon-btn">${I.back}</a>` : "<span></span>"}<h2>${esc(title)}</h2><span class="right">${right}</span></header>`;

// Tira de días de la semana del cliente
function dayStrip() {
  const w = weekInfo(S.client, S.date), today = ymd();
  return `<div class="strip"><button class="icon-btn" data-a="shiftDay" data-n="-7">${I.back}</button>${w.days.map((d) => { const dt = parseYmd(d); return `<button class="sd ${d === S.date ? "on" : ""} ${d === today ? "today" : ""}" data-a="pickDay" data-d="${d}"><small>${D1[dt.getDay()]}</small>${dt.getDate()}</button>`; }).join("")}<button class="icon-btn" data-a="shiftDay" data-n="7">${I.chev}</button></div>
  <div class="strip-sub"><span>${fmtDate(S.date, true)} · Semana ${w.n}</span>${S.date !== today ? `<button class="btn tiny" data-a="pickDay" data-d="${today}">Hoy</button>` : ""}</div>`;
}
act("pickDay", (el) => { S.date = el.dataset.d; refresh(); });
act("shiftDay", (el) => { S.date = addDays(S.date, +el.dataset.n); refresh(); });

const mini = (v, goal, cls = "") => `<div class="minibar ${cls}"><i style="width:${goal ? Math.min(100, (v / goal) * 100) : 0}%"></i></div>`;
const status = (v, goal, tol = 0.1) => { if (!goal) return ""; if (!v) return ""; const d = (v - goal) / goal; return Math.abs(d) <= tol ? `<span class="badge g">En meta</span>` : d < 0 ? `<span class="badge y">Bajo</span>` : `<span class="badge r">Alto</span>`; };
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
  return `<header class="topbar"><span></span><div class="brand-c">JR <b>COACH</b></div><a class="icon-btn" href="#checkin" title="Check-in">${I.bell}</a></header>${dayStrip()}
  ${date === today ? `<details class="pendbox ${pend.length ? "" : "ok"}"><summary>${pend.length ? I.info : I.check}${pend.length ? `Tienes ${pend.length} pendiente${pend.length > 1 ? "s" : ""}` : "Todo al día"}${pend.length ? I.chevDown : ""}</summary>
    ${pend.length ? `<div class="pendlist">${pend.map((p) => `<a class="pend ${p.c}" href="#${p.to}"><span class="dot"></span>${esc(p.t)}${I.chev}</a>`).join("")}</div>` : ""}</details>` : ""}
  <div class="grid2">
    <a class="card tile" href="#comida"><div class="card-t">${I.fire}Calorías ${status(tot.kcal, c.kcal)}</div><div class="big">${r0(tot.kcal).toLocaleString("es-CL")} <small>/ ${(c.kcal || 0).toLocaleString("es-CL")} kcal</small></div><div class="foot grow">${mini(tot.kcal, c.kcal)}</div></a>
    <a class="card tile" href="#comida"><div class="card-t">${I.macros}Macros</div>
      ${[["C", tot.cho, c.cho, "y"], ["L", tot.fat, c.fat, "b"], ["P", tot.prot, c.prot, "g"]].map(([l, v, g, cl]) => `<div class="mrow"><b>${l}</b>${mini(v, g, cl)}<span>${r0(v)}/${g || "–"}</span></div>`).join("")}</a>
    <a class="card tile" href="#agua"><div class="card-t">${I.drop}Agua ${status(water, waterGoal, 0.08)}</div><div class="big">${r1(water / 1000)} <small>/ ${r1(waterGoal / 1000)} L</small></div><div class="foot"><button class="btn tiny" data-a="water" data-ml="250">+250</button><button class="btn tiny" data-a="water" data-ml="500">+500</button></div></a>
    <div class="card tile" data-a="stepsEdit"><div class="card-t">${I.steps}Pasos ${status(day.steps, c.steps, 0.05)}</div><div class="big">${(day.steps || 0).toLocaleString("es-CL")}</div><div class="foot grow">${mini(day.steps || 0, c.steps || 8000, "g")}</div><div class="muted small">Meta ${(c.steps || 8000).toLocaleString("es-CL")}</div></div>
    <a class="card tile" href="#sueno"><div class="card-t">${I.moon}Sueño</div><div class="big" style="color:${sl != null ? sleepColor(sl) : "inherit"}">${sl != null ? fmtH(sl) : "—"}</div><div class="muted small">${day.sleep?.quality ? "Calidad " + day.sleep.quality + "/5" : "Registrar"} · meta ${c.sleep || 8} h</div></a>
    <a class="card tile" href="#peso"><div class="card-t">${I.scale}Peso</div><div class="big">${day.weight ? r1(day.weight) + " <small>kg</small>" : "—"}</div><div class="muted small">${day.weight ? "Registrado" : "En ayunas"}</div></a>
    <div class="card tile"><div class="card-t">${I.run}Cardio <span class="badge ${Object.keys(cardioDone).length >= (c.cardio?.perWeek || 0) && c.cardio?.perWeek ? "g" : ""}">${Object.keys(cardioDone).length}/${c.cardio?.perWeek || 0}</span></div>
      <div class="cweek">${w.days.map((d) => { const dw = new Date(d + "T12:00").getDay(); return `<span class="${cardioDone[d] ? "ok" : cdays.includes(dw) ? "plan" : ""} ${d === today ? "today" : ""}">${D1[dw]}</span>`; }).join("")}</div>
      <div class="legend-mini"><span>● hecho</span><span>○ sugerido</span></div><div class="foot"><button class="btn tiny" data-a="cardioAdd">Registrar</button></div></div>
    <div class="card tile"><div class="card-t">${I.gut}Digestión</div><div class="row between"><span class="small muted">Deposiciones</span><div class="stepper-s"><button data-a="depo" data-n="-1">−</button><b>${day.depos ?? 0}</b><button data-a="depo" data-n="1">+</button></div></div>
      <div class="foot"><button class="btn tiny" data-a="gutNote">${day.gut ? "Molestias ●" : "¿Molestias?"}</button></div></div>
    <a class="card tile wide train-tile" href="#${inProgress ? "sesion/" + inProgress.id : "entreno"}"><div class="card-t" style="margin:0">${I.dumbbell}</div><div class="tt">${trainTxt}<span class="muted small">${plan.doneCount} de ${plan.planned.length} entrenamientos esta semana</span></div>${slot && !slot.rest && slot.status !== "hecho" || inProgress ? `<span class="btn primary small">${inProgress ? "Continuar" : "Empezar"}</span>` : I.chev}</a>
  </div>`;
}

async function cardioWeek(w) {
  const days = await getDays(w.first, w.last);
  const out = {}; for (const [d, v] of Object.entries(days)) if ((v.cardio || []).length) out[d] = true; return out;
}
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
  const b = sheet("Pasos del día", `<p class="muted small">Pronto se sincronizarán solos con tu celular. Por ahora anótalos desde tu app de pasos.</p><input id="stepsI" type="number" inputmode="numeric" value="${day.steps || ""}" placeholder="Ej: 9500"><button class="btn primary big" data-a="stepsSave">Guardar</button>`);
  $("#stepsI", b).focus();
});
act("stepsSave", async () => { await setDay(S.date, { steps: num($("#stepsI").value) || 0 }); closeSheet(); refresh(); });
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
  <div class="row gap center-row"><button class="btn" data-a="water" data-ml="250">+250 ml</button><button class="btn" data-a="water" data-ml="500">+500 ml</button></div>
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
  <div class="card sticky-macros">${bar("Calorías", tot.kcal, c.kcal, "kcal")}${bar("CHO", tot.cho, c.cho, "g")}${bar("Lípidos", tot.fat, c.fat, "g")}${bar("Proteína", tot.prot, c.prot, "g")}</div>
  ${pauta ? `<details class="card"><summary class="card-t">Porciones de tu pauta</summary>${Object.entries(pauta).filter(([, v]) => +v > 0).map(([g, v]) => bar(g, r1(used[g] || 0), +v, "porc.")).join("")}<p class="muted small">Los alimentos de grupos fuera de la pauta suman calorías y macros, pero no descuentan porciones.</p></details>` : ""}
  ${CONFIG.meals.map((m) => {
    const items = day.meals?.[m] || [], mt = items.reduce((t, it) => { const x = itemMacros(it); for (const k in t) t[k] += x[k]; return t; }, { kcal: 0, cho: 0, fat: 0, prot: 0 });
    const ph = photos.filter((p) => p.meal === m);
    return `<div class="card meal"><div class="mh"><div><b>${m}</b><small>${r0(mt.kcal)} kcal · C ${r0(mt.cho)} · L ${r0(mt.fat)} · P ${r0(mt.prot)}</small></div>
    <div class="row"><button class="icon-btn" data-a="mealMenu" data-m="${m}">⋯</button><button class="icon-btn add" data-a="addFood" data-m="${m}">${I.plus}</button></div></div>
    ${items.map((it, i) => `<div class="fi" data-a="editItem" data-m="${m}" data-i="${i}"><span>${esc(it.name)}<small>${r0(it.g)} g${it.por ? ` · ${r1(it.g / it.por)} porc.` : ""}</small></span><span>${r0(itemMacros(it).kcal)} kcal</span></div>`).join("")}
    ${day.mealNotes?.[m] ? `<div class="note">📝 ${esc(day.mealNotes[m])}</div>` : ""}
    ${ph.length ? `<div class="thumbs">${ph.map((p) => `<img src="${p.data}" data-a="viewPhoto" data-id="${p.id}">`).join("")}</div>` : ""}</div>`;
  }).join("")}
  <a class="card row between" href="#agua"><span><b>Agua</b> <span class="muted small">${r1(water / 1000)} / ${r1((c.water || 2500) / 1000)} L</span></span><span class="row gap"><button class="btn tiny" data-a="water" data-ml="250">+250</button><button class="btn tiny" data-a="water" data-ml="500">+500</button></span></a>
  <a class="btn big block" href="#plan">Ver mi plan de alimentación</a>`;
}

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
let FS = { meal: "", tab: "buscar", q: "", sel: null, results: [] };
act("addFood", (el) => { FS = { meal: el.dataset.m, tab: "buscar", q: "", sel: null, results: [] }; openFoodSheet(); });
async function openFoodSheet() {
  const tabs = [["buscar", "Buscar"], ["rapido", "Añadir rápido"], ["fav", "Favoritos"], ["recetas", "Recetas"], ["supl", "Suplementos"], ["crear", "Crear"]];
  const b = sheet(FS.meal, `<div class="seg scroll">${tabs.map(([k, l]) => `<button class="${FS.tab === k ? "on" : ""}" data-a="foodTab" data-t="${k}">${l}</button>`).join("")}</div><div id="fsb"></div>`);
  await renderFoodTab();
}
act("foodTab", (el) => { FS.tab = el.dataset.t; FS.sel = null; openFoodSheet(); });
async function renderFoodTab() {
  const box = $("#fsb"); if (!box) return;
  if (FS.sel) return (box.innerHTML = foodDetail(FS.sel), syncFood());
  const custom = await db.list(P() + "/foods");
  if (FS.tab === "buscar") {
    box.innerHTML = `<div class="row gap"><input id="fq" placeholder="Buscar alimento…" value="${esc(FS.q)}" data-a-input="foodSearch" autocomplete="off"><button class="btn" data-a="scan" title="Escanear código">▥</button></div>
    <div id="fres"></div><button class="btn ghost small block" data-a="offSearch">Buscar en Open Food Facts (productos envasados)</button>`;
    $("#fq").focus(); showResults(custom);
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
  const pool = [...(custom || await db.list(P() + "/foods")).filter((f) => f.type !== "receta"), ...base];
  FS.results = q ? pool.filter((f) => norm(f.name).includes(q) || norm(f.brand || "").includes(q)).slice(0, 40) : pool.filter((f) => f.src !== "base").slice(0, 15);
  box.innerHTML = FS.results.map(resRow).join("") || (q ? `<p class="muted small pad">Sin resultados en tu base. Prueba “Añadir rápido” o Open Food Facts.</p>` : `<p class="muted small pad">Escribe para buscar en tu base de alimentos.</p>`);
}
act("foodSearch", (el) => { FS.q = el.value; showResults(); });
act("selFood", (el) => { FS.sel = FS.results.find((f) => String(f.id) === el.dataset.id); FS.selG = FS.sel?.medidaG || 100; renderFoodTab(); });
act("dMed", (el) => { FS.selG = +el.dataset.g; $("#dG").value = FS.selG; if ($("#dP")) $("#dP").value = r1(FS.selG / FS.sel.portion); syncFood(); });
function foodDetail(f) {
  return `<button class="btn ghost small" data-a="foodBack">‹ Volver</button><h3>${esc(f.name)}</h3><div class="muted small">${esc(f.brand || "")}${f.cat ? `Grupo: ${esc(f.cat)}${f.portion ? ` · 1 porción de intercambio ≈ ${f.portion} g` : ""}` : ""}</div>
  <div class="muted small">Aporte real por 100 g: ${r0(f.kcal)} kcal · CHO ${r1(f.cho)} · Lípidos ${r1(f.fat)} · Proteína ${r1(f.prot)}</div>
  <div class="chips">${f.medidaG ? `<button class="chip" data-a="dMed" data-g="${f.medidaG}">${esc(f.medida)} (${f.medidaG} g)</button>` : ""}${[50, 100, 150, 200].map((g) => `<button class="chip" data-a="dMed" data-g="${g}">${g} g</button>`).join("")}</div>
  <div class="row gap"><label class="grow">Gramos<input id="dG" type="number" inputmode="decimal" value="${FS.selG}" data-a-input="dSync" data-k="g"></label>${f.portion ? `<label class="grow">Porciones<input id="dP" type="number" inputmode="decimal" value="${r1(FS.selG / f.portion)}" data-a-input="dSync" data-k="p"></label>` : ""}</div>
  <div id="dMac" class="macros4"></div>
  <div class="row gap"><button class="btn" data-a="favToggle">${f.fav ? "♥" : "♡"}</button><button class="btn primary big grow" data-a="foodAdd">Añadir a ${esc(FS.meal)}</button></div>`;
}
function syncFood() {
  const f = FS.sel, m = itemMacros({ ...f, g: FS.selG });
  const el = $("#dMac"); if (el) el.innerHTML = [["Kcal", m.kcal], ["CHO", m.cho], ["Lípidos", m.fat], ["Proteína", m.prot]].map(([l, v]) => `<div><b>${r1(v)}</b><small>${l}</small></div>`).join("");
}
act("dSync", (el) => {
  const v = num(el.value) || 0, f = FS.sel;
  if (el.dataset.k === "g") { FS.selG = v; if ($("#dP")) $("#dP").value = r1(v / f.portion); }
  else { FS.selG = r1(v * f.portion); $("#dG").value = FS.selG; }
  syncFood();
});
act("foodBack", () => { FS.sel = null; openFoodSheet(); });
act("foodAdd", async () => {
  const f = FS.sel; if (!FS.selG) return toast("Indica los gramos");
  await addItems([{ name: f.name, g: FS.selG, kcal: f.kcal, cho: f.cho, fat: f.fat, prot: f.prot, cat: f.cat || "", por: f.portion || null, fid: f.id }]);
});
async function addItems(items) {
  const d = await getDay(S.date);
  await setDay(S.date, { meals: { ...(d.meals || {}), [FS.meal]: [...(d.meals?.[FS.meal] || []), ...items] } });
  closeSheet(); toast("Añadido a " + FS.meal); refresh();
}
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
  FS.sel = { ...food, id }; FS.selG = por || 100; FS.tab = food.type === "supl" ? "supl" : "buscar"; openFoodSheet();
});
act("editItem", async (el) => {
  const m = el.dataset.m, i = +el.dataset.i, d = await getDay(S.date), it = d.meals[m][i];
  sheet(it.name, `${it.per100 === false ? `<p class="muted small">${r0(it.kcal)} kcal · C${r0(it.cho)} L${r0(it.fat)} P${r0(it.prot)}</p>` : `<label>Gramos<input id="eG" type="number" inputmode="decimal" value="${it.g}"></label>`}
  <div class="row gap"><button class="btn danger grow" data-a="itemDel" data-m="${m}" data-i="${i}">Eliminar</button>${it.per100 === false ? "" : `<button class="btn primary grow" data-a="itemSave" data-m="${m}" data-i="${i}">Guardar</button>`}</div>`);
});
act("itemSave", async (el) => { const d = await getDay(S.date); d.meals[el.dataset.m][+el.dataset.i].g = num($("#eG").value) || 0; await setDay(S.date, { meals: d.meals }); closeSheet(); refresh(); });
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
    const loop = async () => { if (stop) return; try { const r = await det.detect(video); if (r[0]) { end(); navigator.vibrate?.(80); return into ? ($("#" + into).value = r[0].rawValue) : lookupCode(r[0].rawValue); } } catch {} requestAnimationFrame(loop); };
    loop();
  } catch { end(); toast("No se pudo abrir la cámara"); }
});
async function lookupCode(code) {
  const mine = (await db.list(P() + "/foods")).find((f) => f.code === code);
  if (mine) { FS.sel = mine; FS.selG = mine.portion || 100; return renderFoodTab(); }
  if (!navigator.onLine) return toast("Sin conexión: no se puede buscar el código");
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity`).then((r) => r.json());
    if (r.status !== 1) { toast("Producto no encontrado. Puedes crearlo."); FS.tab = "crear"; await openFoodSheet(); $("#nCode").value = code; return; }
    FS.sel = offToFood(r.product, code); FS.selG = FS.sel.portion || 100; renderFoodTab();
  } catch { toast("No se pudo consultar Open Food Facts"); }
}
function offToFood(p, code) {
  const n = p.nutriments || {};
  return { id: "off-" + (code || uid()), src: "off", name: p.product_name || "Producto", brand: p.brands || "", code, portion: +p.serving_quantity || null,
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


// ================================================================ PROGRESO
async function progress() {
  const c = S.client, w = weekInfo(c, ymd());
  const fb = c.feedback?.week === w.key ? c.feedback : null;
  const days = await getDays(addDays(ymd(), -60), ymd());
  const keys = Object.keys(days).sort(), wv = keys.map((k) => days[k].weight ?? null);
  return `${head("Progreso")}
  ${fb || (c.weeklyGoals || []).length ? `<div class="fbcard"><small>Tu retroalimentación · Semana ${w.n}</small><h3>${esc(fb?.text || "Esto es lo que trabajamos esta semana")}</h3>
    ${(fb?.points || []).length ? `<ul>${fb.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    ${(c.weeklyGoals || []).length ? `<div class="goals-t">Metas de la semana</div><ul>${c.weeklyGoals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
    ${fb?.videoUrl ? `<button class="btn small" data-a="openFeedback">${I.play} Ver video</button>` : ""}</div>` : ""}
  <a class="card" href="#peso"><div class="card-t">${I.scale}Peso corporal</div>${lineChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), [{ vals: wv, color: "var(--dim)", dots: true, w: 1 }, { vals: trend(wv), color: "var(--acc)" }], { h: 130 })}</a>
  <div class="list"><a href="#timeline"><span>Timeline y etapas<small>Tu calendario nutricional semana a semana</small></span>${I.chev}</a>
  <a href="#sueno"><span>Sueño<small>Registro y estadísticas</small></span>${I.chev}</a>
  <a href="#fotos"><span>Fotos<small>Por semana y comparador</small></span>${I.chev}</a>
  <a href="#medidas"><span>Medidas<small>Una vez al mes</small></span>${I.chev}</a>
  <a href="#checkin"><span>Check-in semanal<small>Semana ${w.n}</small></span>${I.chev}</a></div>`;
}
act("openFeedback", () => {
  const fb = S.client.feedback; if (!fb) return;
  const emb = embedUrl(fb.videoUrl);
  sheet("Tu retroalimentación", `${emb ? `<div class="video"><iframe src="${emb}" allowfullscreen></iframe></div>` : fb.videoUrl ? `<a class="btn primary" target="_blank" href="${esc(fb.videoUrl)}">Abrir video</a>` : ""}${fb.text ? `<p>${esc(fb.text)}</p>` : ""}`);
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
  <button class="btn primary big" data-a="wSave">${d.weight ? "Actualizar" : "Guardar"}</button><div class="muted small">Pésate en ayunas, después de ir al baño.</div></div>
  <div class="card stats3"><div><b>${a1 ? r1(a1) : "—"}</b><small>Promedio semana</small></div><div><b class="${a1 && a0 ? (a1 - a0 > 0 ? "up" : "down") : ""}">${a1 && a0 ? (a1 - a0 > 0 ? "+" : "") + r1(a1 - a0) + " kg" : "—"}</b><small>vs semana anterior</small></div><div><b>${regs}/7</b><small>Días registrados</small></div></div>
  <div class="card"><div class="card-t">Tendencia (90 días)</div>${lineChart(keys.map((k) => k.slice(8) + "/" + k.slice(5, 7)), [{ vals, color: "var(--muted)", dots: true, w: 1 }, { vals: tr, color: "var(--acc)" }], { unit: " kg" })}
  <div class="muted small">Puntos: pesajes diarios · Línea roja: tendencia (suaviza las subidas y bajadas del día a día).</div></div>`;
}
act("wStep", (el) => { const i = $("#wI"); i.value = r1((num(i.value) || 0) + +el.dataset.n); });
act("wSave", async () => { const v = num($("#wI").value); if (!v) return; await setDay(S.date, { weight: v }); toast("Peso guardado"); refresh(); });


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
  <button class="btn primary big" data-a="sleepSave">Guardar</button></div>
  <div class="card stats3"><div><b>${last7.length ? fmtH(avg(last7)) : "—"}</b><small>Prom. 7 días</small></div><div><b>${last30.length ? fmtH(avg(last30)) : "—"}</b><small>Prom. 30 días</small></div><div><b>${q7 ? r1(q7) + "/5" : "—"}</b><small>Calidad 7 días</small></div>
  <div><b>${last30.length ? fmtH(Math.max(...last30)) : "—"}</b><small>Mejor noche</small></div><div><b>${last30.length ? fmtH(Math.min(...last30)) : "—"}</b><small>Peor noche</small></div><div><b>${r1(sum(w.days.map(hrs).filter((x) => x != null)))} h</b><small>Total semana</small></div></div>
  <div class="card"><div class="card-t">${MONTHS[now.getMonth()]} ${now.getFullYear()} · ${last30.length} noches registradas</div>
  <div class="cal"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>${"<i></i>".repeat(off)}${Array.from({ length: nd }, (_, i) => { const k = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i + 1)}`, h = hrs(k); return `<b style="background:${sleepColor(h)};${h == null ? "color:var(--dim)" : ""}" title="${h != null ? fmtH(h) : ""}">${i + 1}</b>`; }).join("")}</div>
  <div class="legend"><span><i style="background:#ef4444"></i>&lt;6 h</span><span><i style="background:#eab308"></i>6–7 h</span><span><i style="background:#22c55e"></i>7–8 h</span><span><i style="background:#3b82f6"></i>8 h o más</span></div></div>`;
}
let sleepQ = null;
act("sleepQ", (el) => { sleepQ = +el.dataset.v; $$('[data-a="sleepQ"]').forEach((b) => b.classList.toggle("on", b === el)); });
act("sleepSave", async () => {
  const d = await getDay(S.date);
  await setDay(S.date, { sleep: { bed: $("#sB").value, wake: $("#sW").value, awake: num($("#sA").value) || 0, quality: sleepQ || d.sleep?.quality || null } });
  sleepQ = null; toast("Sueño guardado"); refresh();
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
  <a href="#plan"><span>Mi plan de alimentación</span>${I.chev}</a><a href="#checkin"><span>Check-in semanal</span>${I.chev}</a><a href="#guias"><span>Guías</span>${I.chev}</a><a href="#equipo"><span>Mi equipamiento</span>${I.chev}</a>
  <a href="#info"><span>Información personal</span>${I.chev}</a><a href="#ajustes"><span>Ajustes</span>${I.chev}</a>
  ${S.role === "coach" ? `<a data-a="asCoach"><span><b>Volver al panel de coach</b></span>${I.chev}</a>` : ""}<a data-a="logout"><span class="red">Cerrar sesión</span></a></div>
  <p class="muted small center">${navigator.onLine ? "Conectado · todo sincronizado" : "Sin conexión · tus datos se guardan y se suben al volver la señal"}${DEMO ? " · MODO DEMO" : ""}</p>`;
}
async function planView() {
  const p = S.client.plan || {};
  return `${head("Mi plan de alimentación", "mas")}<div class="card">${p.pdfUrl ? `<a class="btn primary big block" target="_blank" href="${esc(p.pdfUrl)}">Abrir mi plan (PDF)</a>` : `<p class="muted">Tu coach aún no sube tu plan.</p>`}
  ${p.notes ? `<div class="pre">${esc(p.notes)}</div>` : ""}</div>
  ${S.client.pauta ? `<div class="card"><div class="card-t">Porciones por día</div>${Object.entries(S.client.pauta).filter(([, v]) => +v > 0).map(([g, v]) => `<div class="li row between"><span>${esc(g)}</span><b>${v}</b></div>`).join("")}</div>` : ""}`;
}

// ---------- Check-in semanal (igual al de la planilla)
let CI = {};
async function checkinView() {
  const w = weekInfo(S.client, ymd()), saved = (await db.get(`${P()}/checkins/${w.key}`)) || {};
  CI = { ...saved };
  const days = await getDays(w.first, w.last);
  const regDays = Object.values(days).filter((d) => Object.values(d.meals || {}).some((m) => m.length)).length;
  const dep = avg(Object.values(days).map((d) => d.depos).filter((x) => x != null));
  const q = ([k, label, type, extra]) => {
    let inp;
    if (type === "text") inp = `<textarea rows="2" data-a-input="ciTxt" data-k="${k}">${esc(CI[k] || "")}</textarea>`;
    else if (type === "line") inp = `<input data-a-input="ciTxt" data-k="${k}" value="${esc(CI[k] || "")}" placeholder="Ejercicio, peso × reps">`;
    else if (type === "num") inp = `<input type="number" step="0.1" inputmode="decimal" data-a-input="ciTxt" data-k="${k}" value="${esc(CI[k] ?? "")}">`;
    else if (type.multi) inp = `<div class="ci-grid">${type.multi.map((o) => `<label><input type="checkbox" data-a-change="ciMulti" data-k="${k}" value="${esc(o)}" ${(CI[k] || []).includes(o) ? "checked" : ""}>${esc(o)}</label>`).join("")}</div>`;
    else if (type.length > 6) inp = `<select data-a-change="ciSel" data-k="${k}"><option value="">—</option>${type.map((o) => `<option ${CI[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else inp = chips(k, type.map((o) => [o, o]), CI[k], "ciChip");
    const ex = extra ? `<input class="mt" data-a-input="ciTxt" data-k="${k}Det" value="${esc(CI[k + "Det"] || "")}" placeholder="${esc(extra)}">` : "";
    return `<div class="ci-q"><div>${esc(label)}</div>${inp}${ex}</div>`;
  };
  return `${head(`Check-in · Semana ${w.n}`, "mas")}
  <p class="muted small center">${fmtDate(w.first)} – ${fmtDate(w.last)}${saved.at ? " · enviado ✓ (puedes actualizarlo)" : ""}</p>
  ${CHECKIN.map((sec) => `<div class="ci-sec"><h3>${esc(sec.t)}</h3>
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
  await db.set(`${P()}/checkins/${w.key}`, { ...CI, at: Date.now(), date: ymd() }, false);
  toast("Check-in enviado ✓"); go("inicio");
});
async function guidesView() {
  const g = (await db.get("library/guides"))?.items || [];
  return `${head("Guías", "mas")}<div class="list">${g.map((x) => `<a target="_blank" href="${esc(x.url)}"><span>${esc(x.title)}<small>${esc(x.desc || "")}</small></span>${I.chev}</a>`).join("") || `<p class="muted pad">Pronto encontrarás aquí tus guías.</p>`}</div>`;
}
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
  return `${head("Ajustes", "mas")}<div class="card"><div class="card-t">Tema</div>${chips("t", [["dark", "Oscuro"], ["light", "Claro"]], theme, "theme")}</div>
  <div class="card"><div class="card-t">Notificaciones</div><p class="muted small">Para el aviso de fin de descanso${perm === "granted" ? " · activadas ✓" : ""}.</p>${perm !== "granted" && perm !== "no" ? `<button class="btn" data-a="askNotif">Activar notificaciones</button>` : ""}</div>
  <div class="card"><div class="card-t">Unidades</div><p class="muted small">Kilogramos, litros y centímetros.</p></div>`;
}
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
    const wAvg = A((d) => d.weight);
    rows.push({ n, w, t, reg: reg.length, kcal: T("kcal"), cho: T("cho"), fat: T("fat"), prot: T("prot"), ses: `${plan.doneCount}/${plan.planned.length}`, steps: A((d) => d.steps), cardio: sum(D.flatMap((d) => d.cardio || []), (x) => x.min), weight: wAvg, dW: wAvg && prevAvg ? wAvg - prevAvg : null, sleep: A((d) => sleepHours(d.sleep)), cur: n === cur.n });
    if (wAvg) prevAvg = wAvg;
  }
  const cell = (v, goal, f = r0, tol = 0.1) => v == null || v === 0 ? `<td class="dim">—</td>` : `<td class="${goal ? (Math.abs(v - goal) / goal <= tol ? "okc" : v < goal ? "lowc" : "hic") : ""}">${f(v)}</td>`;
  return `<div class="scroll-x"><table class="xl"><thead>
    <tr><th></th><th colspan="2">Coaching</th><th colspan="5">Nutrición (registro)</th><th colspan="5">Métricas diarias</th><th colspan="6">Metas</th></tr>
    <tr><th>Sem.</th><th>Fecha</th><th>Etapa</th><th>Días reg.</th><th>Kcal</th><th>CHO</th><th>Lip</th><th>Prot</th><th>Sesiones</th><th>Pasos</th><th>Cardio</th><th>Peso prom.</th><th>Sueño</th><th>Kcal</th><th>CHO</th><th>Lip</th><th>Prot</th><th>Agua</th><th>Pasos</th></tr></thead>
    <tbody>${rows.slice().reverse().map((r) => `<tr class="${r.cur ? "cur" : ""}"><td>${r.n}</td><td>${fmtDate(r.w.first)}</td><td><span class="ph" style="background:${phaseColor(r.t.phase)}">${esc(r.t.phase || "—")}</span></td>
      <td>${r.reg}/7</td>${cell(r.kcal, r.t.kcal)}${cell(r.cho, r.t.cho)}${cell(r.fat, r.t.fat)}${cell(r.prot, r.t.prot)}<td>${r.ses}</td>${cell(r.steps, r.t.steps, (v) => r0(v).toLocaleString("es-CL"))}<td>${r.cardio ? r.cardio + " min" : "—"}</td>
      <td>${r.weight ? r1(r.weight) + (r.dW != null ? ` <small class="muted">(${r.dW > 0 ? "+" : ""}${r1(r.dW)})</small>` : "") : "—"}</td><td style="color:${sleepColor(r.sleep)}">${r.sleep ? r1(r.sleep) + " h" : "—"}</td>
      <td class="muted">${r.t.kcal || "—"}</td><td class="muted">${r.t.cho || "—"}</td><td class="muted">${r.t.fat || "—"}</td><td class="muted">${r.t.prot || "—"}</td><td class="muted">${r.t.water ? r1(r.t.water / 1000) + " L" : "—"}</td><td class="muted">${(r.t.steps || 0).toLocaleString("es-CL")}</td></tr>`).join("")}</tbody></table></div>
    <div class="legend small"><span><i class="okc"></i>±10% de la meta</span><span><i class="lowc"></i>bajo</span><span><i class="hic"></i>sobre</span></div>`;
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
