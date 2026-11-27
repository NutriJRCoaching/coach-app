// Acceso a datos del cliente + lógica de entrenamiento compartida (cliente y coach)
import { db } from "./db.js";
import { S } from "./state.js";
import { ymd, addDays, weekInfo, e1rm, uid, esc, fmtDate, diffDays, parseYmd } from "./util.js";
import { REAL_FOODS, realToFood } from "./realfoods.js";
import { GROUPS } from "./foods.js";

const C = (cid = S.cid) => "clients/" + cid;
export const dayPath = (date, cid) => `${C(cid)}/days/${date}`;
export const getDay = async (date, cid) => (await db.get(dayPath(date, cid))) || {};
export const setDay = (date, data, cid) => db.set(dayPath(date, cid), data);
export async function getDays(from, to, cid) {
  const all = await db.list(C(cid) + "/days");
  return Object.fromEntries(all.filter((d) => d.id >= from && d.id <= to).map((d) => [d.id, d]));
}
// Comidas del día: Comida 1…5 + las que agregue el cliente (+ nombres antiguos si tenían datos)
export function mealList(day = {}) {
  const has = (k) => (day.meals?.[k] || []).length || day.mealNotes?.[k];
  const nums = Object.keys(day.meals || {}).map((k) => +(k.match(/^Comida (\d+)$/) || [])[1] || 0);
  const n = Math.max(5, day.mealCount || 0, ...nums);
  const legacy = Object.keys(day.meals || {}).filter((k) => !/^Comida \d+$/.test(k) && has(k));
  return [...legacy, ...Array.from({ length: n }, (_, i) => "Comida " + (i + 1))];
}
export const getRoutines = async (cid) => (await db.list(C(cid) + "/routines")).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
export const getSessions = async (cid) => (await db.list(C(cid) + "/sessions")).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
export const getClient = async (cid) => (await db.get(C(cid))) || {};

// ---------- Tipo de asesoría → qué ve el cliente
// completa (1-1): todo · entrenamiento: plan de entrenamiento + registro de comida con guía de macros (sin plan de alimentación)
// nutricion: plan de alimentación + diseña y registra su propio entrenamiento (sin videos, sin sugerencias de carga ni rangos)
export const svc = (c) => c?.service || "completa";
export const feat = (c) => { const s = svc(c); return { plan: s !== "entrenamiento", macroGuide: s === "entrenamiento", coachTrain: s !== "nutricion", selfTrain: s === "nutricion" }; };
// Guía de macros por kg de peso (solo entrenamiento). ranges = { prot: [1.6, 2.2], fat: [0.8, 1], cho: [3, 5] }
export const DEFAULT_RANGES = { prot: [1.6, 2.0], fat: [0.8, 1.2], cho: [3, 5] };
// ---------- Calculadora de requerimientos del cliente (solo entrenamiento): la maneja él (clients/{id}/settings/calc)
export const ACT_LEVELS = [[1.2, "Sedentario", "Trabajo sentado y menos de 5.000 pasos al día"], [1.375, "Ligero", "5.000–7.500 pasos o entrenas 1–3 días"], [1.55, "Moderado", "7.500–10.000 pasos y entrenas 3–5 días"], [1.725, "Alto", "Más de 10.000 pasos y entrenas 5–6 días"], [1.9, "Muy alto", "Trabajo físico pesado y entrenas casi todos los días"]];
// Objetivos que puede elegir solo (nada más agresivo que esto sin el coach)
export const SELF_GOALS = [["mant", "Mantención", 0, "Mantener tu peso y mejorar tu composición con el entrenamiento"], ["defL", "Déficit ligero", -10, "Bajar grasa de a poco (≈ 0,25–0,5 % de tu peso por semana)"], ["defM", "Déficit moderado", -20, "Bajar grasa más rápido (≈ 0,5–1 % de tu peso por semana)"], ["supL", "Superávit ligero", 10, "Ganar músculo con poca grasa (≈ 0,25–0,5 % de tu peso por semana)"]];
export const ageFrom = (b) => { if (!b) return null; const d = new Date(b + "T12:00"), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
// x = { sex, birth, height, kg, act, goal, protKg, fatKg } → mantención (Mifflin-St Jeor × actividad), calorías del objetivo y macros (CHO = el resto)
export function selfCalc(x) {
  const age = ageFrom(x.birth), kg = +x.kg, h = +x.height, act = +x.act || 1.375;
  const miss = [!x.sex && "sexo", !age && "fecha de nacimiento", !h && "estatura", !kg && "peso"].filter(Boolean);
  if (miss.length) return { miss };
  const bmr = 10 * kg + 6.25 * h - 5 * age + (x.sex === "F" ? -161 : 5), maint = Math.round((bmr * act) / 10) * 10;
  const G = SELF_GOALS.find((g) => g[0] === x.goal) || SELF_GOALS[0], kcal = Math.round((maint * (1 + G[2] / 100)) / 10) * 10;
  const prot = Math.round(kg * +x.protKg), fat = Math.round(kg * +x.fatKg), cho = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  const pc = (v) => Math.round((v / kcal) * 100);
  return { age, bmr: Math.round(bmr), maint, kcal, prot, fat, cho, choKg: Math.round((cho / kg) * 10) / 10, pct: { prot: pc(prot * 4), fat: pc(fat * 9), cho: pc(cho * 4) }, goal: G, byGoal: SELF_GOALS.map((g) => [g[0], Math.round((maint * (1 + g[2] / 100)) / 10) * 10]) };
}
export function macroGuide(c, kg) {
  const R = { ...DEFAULT_RANGES, ...(c.ranges || {}) }, w = +kg || +c.weightStart || null;
  if (!w) return null;
  const g = (k) => [Math.round(R[k][0] * w), Math.round(R[k][1] * w)];
  const prot = g("prot"), fat = g("fat"), cho = g("cho");
  return { w, R, prot, fat, cho, kcal: [prot[0] * 4 + cho[0] * 4 + fat[0] * 9, prot[1] * 4 + cho[1] * 4 + fat[1] * 9].map((x) => Math.round(x / 50) * 50) };
}

// Base de alimentos: semilla + importados por el coach
let foodCache = null;
export async function getFoodBase() {
  if (foodCache) return foodCache;
  // Registro con aporte REAL por 100 g (USDA en español) + alimentos que agregue el coach
  const lib = await db.get("library/foods");
  const extra = (lib?.items || []).map((f, i) => ({ ...f, id: f.id || "l" + i, src: "base" }));
  // Si el coach sube un alimento con el mismo nombre que uno de la base, su versión reemplaza a la de la base
  const key = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), mine = new Set(extra.map((f) => key(f.name)));
  return (foodCache = [...extra, ...REAL_FOODS.map(realToFood).filter((f) => !mine.has(key(f.name)))]);
}
export const resetFoodCache = () => (foodCache = null);
// Productos envasados de Chile (Open Food Facts): se cargan recién al buscar o escanear
let offCache = null;
export async function getOffCL() {
  if (offCache) return offCache;
  const { OFF_CL } = await import("./offchile.js");
  return (offCache = OFF_CL.map(([code, name, brand, kcal, cho, fat, prot, sq]) => ({ id: "cl-" + code, code, name, brand, kcal, cho, fat, prot, portion: null, medida: sq ? "1 porción (etiqueta)" : "", medidaG: sq || null, src: "offcl", fuente: "Open Food Facts (etiqueta)" })));
}
// ¿Los datos tienen sentido? Calorías vs macros y proteína razonable para el grupo
// Alimento sin datos: todo en 0 por 100 g (típico de un producto de Open Food Facts sin tabla nutricional). zeroOk = de verdad es 0 (agua, bebida zero)
export const foodEmpty = (f) => !!f && !(+f.kcal) && !(+f.cho) && !(+f.fat) && !(+f.prot) && !f.zeroOk;
export function foodCheck(f) {
  const k = +f.kcal || 0, calc = 4 * (+f.cho || 0) + 4 * (+f.prot || 0) + 9 * (+f.fat || 0), out = [];
  if (foodEmpty(f)) out.push("todos los valores están en 0 por 100 g: probablemente el producto quedó guardado sin su tabla nutricional");
  if (k > 40 && Math.abs(calc - k) / k > 0.2) out.push(`las calorías (${Math.round(k)}) no cuadran con los macros (≈${Math.round(calc)} kcal)`);
  const lim = { "Cereales": 14, "Frutas": 4, "Verduras generales": 6, "Verduras libre consumo": 5, "Azúcar": 2 }[f.cat];
  if (lim && +f.prot > lim) out.push(`${Math.round(f.prot * 10) / 10} g de proteína por 100 g es mucho para ${f.cat.toLowerCase()}`);
  if ((+f.prot || 0) + (+f.cho || 0) + (+f.fat || 0) > 102) out.push("los macros suman más de 100 g por cada 100 g");
  return out;
}

// ---------- Semana de entrenamiento: qué toca y en qué estado está
// schedule: { "1": routineId, "2": routineId, ... } (0=domingo)
// Fecha desde la que el cliente usa la app (puede ser después del inicio de la semana 1, ej. semana dom–sáb y parte el lunes)
export const appStart = (c) => [c?.startDate || "", c?.appFrom || ""].sort().pop() || "";
// Rotación (ej. Fullbody A/B sin días fijos): c.rotation = { on, order:[rid…], perWeek, days:[dow sugeridos], minRest }
export const isRotation = (c) => !!(c?.rotation?.on && (c.rotation.order || []).length);
export function nextInRotation(c, sessions) {
  const order = c.rotation.order, last = sessions.filter((s) => s.status === "fin" && order.includes(s.routineId) && (!c.startDate || s.date >= c.startDate)).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.startedAt || 0) - (a.startedAt || 0))[0];
  return { rid: last ? order[(order.indexOf(last.routineId) + 1) % order.length] : order[0], lastDate: last?.date || null };
}
function rotationPlan(client, routines, sessions, w, today) {
  const R = client.rotation, order = R.order, per = +R.perWeek || 3, gap = (+R.minRest || 1) + 1, sug = (R.days || []).map(Number);
  const from = appStart(client), nameOf = (rid) => routines.find((x) => x.id === rid)?.name || "Rutina";
  const done = sessions.filter((s) => s.status === "fin" && s.weekKey === w.key).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const byDate = {}; for (const s of done) (byDate[s.date] ||= []).push(s);
  const { rid: next, lastDate } = nextInRotation(client, sessions);
  // Días posibles desde hoy (o desde el inicio): respetan el descanso mínimo desde el último entreno
  const start = [today, w.first, from].sort().pop(), left = Math.max(0, per - done.length), pick = [];
  let prev = lastDate, ri = order.indexOf(next);
  const ok = (d) => d >= start && d <= w.last && !byDate[d] && (!prev || diffDays(d, prev) >= gap);
  const cand = w.days.filter((d) => d >= start);
  // "Día por medio" (R.everyOther): sin días fijos; cada entreno sugerido al primer día que cumple el descanso, y una vez
  // cumplido el objetivo de la semana (perWeek = mínimo) siguen sugerencias OPCIONALES día por medio (extra: true)
  if (R.everyOther) for (const d of cand) { if (!ok(d)) continue; pick.push({ d, rid: order[ri % order.length], sug: true, extra: pick.length >= left }); ri++; prev = d; }
  else for (let i = 0; i < cand.length && pick.length < left; i++) {
    const d = cand[i]; if (!ok(d)) continue;
    const isSug = sug.includes(new Date(d + "T12:00").getDay());
    // ¿Alcanzan los días que quedan si no entrena este día? (cada entreno necesita "gap" días)
    const restDays = diffDays(w.last, d), need = left - pick.length;
    const fitsLater = (restDays >= 1 ? Math.floor((restDays - 1) / gap) + 1 : 0) >= need;
    if (isSug || !fitsLater || (d === today && !sug.length)) { pick.push({ d, rid: order[ri % order.length], sug: isSug }); ri++; prev = d; }
  }
  const missing = w.last < from ? 0 : Math.max(0, left - pick.filter((x) => !x.extra).length);
  const pmap = Object.fromEntries(pick.map((x) => [x.d, x]));
  const slots = w.days.map((d) => {
    if (byDate[d]) { const s = byDate[d][0]; return { date: d, rid: s.routineId, name: s.routineName || nameOf(s.routineId), status: "hecho", session: s }; }
    const p = pmap[d]; if (!p) return { date: d, rest: true, freeToday: d === today && left > 0 && ok(d) };
    return { date: d, rid: p.rid, name: nameOf(p.rid), status: d === today ? "hoy" : "proximo", sug: p.sug, rot: true, ...(p.extra ? { extra: true } : {}) };
  });
  const planned = slots.filter((s) => !s.rest);
  return { week: w, slots, planned, doneCount: done.length, rotation: true, perWeek: per, missing, next: { rid: next, name: nameOf(next) }, total: per };
}
// ---------- Adherencia proporcional a lo que va de la semana (pedido de Joaquín: el martes, 2 de 2 está perfecto, no "2/7")
// Días que cuentan: desde el inicio de la semana (o desde que usa la app) hasta ayer; hoy cuenta solo si ya lo registró.
export function regSoFar(c, w, dayMap, test, today = ymd()) {
  const from = [w.first, appStart(c) || w.first].sort().pop(), ds = w.days.filter((d) => d >= from && d <= today);
  const ok = (d) => !!(dayMap[d] && test(dayMap[d])), k = ds.filter(ok).length;
  return { k, n: ds.filter((d) => d < today).length + (ds.includes(today) && ok(today) ? 1 : 0) };
}
// Entrenamientos que ya correspondían: los del plan menos los que todavía quedan por delante (hoy incluido si no lo ha hecho)
export function trainSoFar(plan, today = ymd()) {
  const ahead = (plan.slots || []).filter((s) => !s.rest && !s.extra && s.status !== "hecho" && s.date >= today).length; // los opcionales no cuentan
  return { done: plan.doneCount || 0, due: Math.max(plan.doneCount || 0, (plan.total || 0) - ahead), total: plan.total || 0 };
}
export const hasFood = (d) => Object.values(d?.meals || {}).some((m) => m.length);
export const ratioCls = (k, n) => (!n ? "" : k / n >= 0.7 ? "g" : k / n >= 0.4 ? "y" : "r");
// Calendario de una semana: el especial de esa semana (client.weekSched[S0N], ej. una semana con menos tiempo) o el de siempre
export const schedFor = (c, wkey) => c?.weekSched?.[wkey] || c?.schedule || {};
export function weekPlan(client, routines, sessions, date = ymd()) {
  const w = weekInfo(client, date);
  const today = ymd();
  if (isRotation(client)) return w.last < appStart(client) ? { week: w, slots: w.days.map((d) => ({ date: d, rest: true })), planned: [], total: 0, doneCount: 0, rotation: true, missing: 0 } : rotationPlan(client, routines, sessions, w, today);
  const special = !!client.weekSched?.[w.key];
  const sched = w.last < appStart(client) ? {} : schedFor(client, w.key); // semanas antes de partir: sin entrenamientos
  const done = sessions.filter((s) => s.weekKey === w.key && s.status === "fin");
  const used = new Set();
  const slots = w.days.map((d) => {
    const rid = d < appStart(client) ? null : sched[new Date(d + "T12:00").getDay()]; // días antes de que parta en la app: nada
    if (!rid) return { date: d, rest: true };
    const r = routines.find((x) => x.id === rid);
    // En una semana especial, si ese día hizo otra de sus rutinas (las de siempre siguen disponibles), también cuenta
    const s = done.find((x) => x.routineId === rid && !used.has(x.id)) || (special ? done.find((x) => x.date === d && !used.has(x.id)) : null);
    if (s) used.add(s.id);
    const status = s ? "hecho" : d === today ? "hoy" : d < today ? "atrasado" : "proximo";
    return { date: d, rid, name: r?.name || "Rutina", status, session: s };
  });
  const planned = slots.filter((s) => !s.rest);
  return { week: w, slots, planned, total: planned.length, doneCount: planned.filter((s) => s.status === "hecho").length, special };
}

// Sesión de la semana anterior (misma rutina) para comparar
export function prevSession(sessions, s) {
  return sessions.filter((x) => x.routineId === s.routineId && x.status === "fin" && x.weekKey < s.weekKey).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0] || null;
}
export const refSet = (prev, exId, j) => prev?.exercises?.find((e) => e.exId === exId)?.sets?.[j] || null;
// "Última vez" de cada ejercicio (v1.45): se busca la última sesión terminada en que se hizo ESE ejercicio, en cualquier rutina.
// · Ejercicio original: solo cuenta cuando se hizo el original (no un reemplazo SOS que quedó en su lugar).
// · Reemplazo SOS (e.replaced): la última vez que se hizo ese reemplazo (por nombre), aunque haya sido en otra semana o como extra.
const normN = (n) => String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const sameEx = (y, e) => (e.replaced ? normN(y.name) === normN(e.name) : !y.replaced && (y.exId === e.exId || normN(y.name) === normN(e.name)));
const hasData = (y) => (y?.sets || []).some((z) => z.w !== "" || z.r !== "");
export function lastEx(sessions, s, e) {
  const t0 = s.startedAt || Infinity;
  const before = sessions.filter((x) => x.status === "fin" && x.id !== s.id && (x.startedAt || 0) < t0).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  for (const x of before) { const m = (x.exercises || []).find((y) => sameEx(y, e) && hasData(y)); if (m) return { ex: m, date: x.date, sid: x.id }; }
  return null;
}
// Sesión "virtual" de referencia: por cada ejercicio de s, sus series de la última vez (se usa igual que prevSession con refSet)
export function prevFor(sessions, s) {
  if (!s) return null;
  return { virtual: true, exercises: (s.exercises || []).map((e) => { const L = lastEx(sessions, s, e); return { exId: e.exId, name: L?.ex.name || e.name, sets: L?.ex.sets || [], date: L?.date || null, tech: L?.ex.tech || "" }; }) };
}
export const refInfo = (prev, exId) => prev?.exercises?.find((e) => e.exId === exId) || null;
// Qué intentar hoy según cómo salió la última vez (antes de anotar la serie de hoy). Técnica primero.
export function nextHint(ref, t = {}) {
  if (!ref || ref.w === "" || ref.r === "") return null;
  const rg = range(t.reps), tr = t.rir === "F" ? -1 : t.rir === "" || t.rir == null ? 1 : +t.rir, r = +ref.r, a = rirN(ref.rir);
  if (ref.tech === "peor") return { k: "y", t: "Técnica peor la última vez: mantén el peso y afírmala" };
  if (a === -1 && tr !== -1) return { k: "y", t: "Llegaste al fallo: mantén el peso y deja 1 rep en reserva" };
  if (rg && r < rg.lo - 1) return { k: "r", t: "Te faltaron reps: baja un poco el peso" };
  if (rg && (r > rg.hi || (r >= rg.hi && a != null && a > tr))) return { k: "g", t: "Te sobró margen: intenta subir el peso" };
  return null; // sin nada especial que cambiar: no se muestra sugerencia (menos ruido)
}

// ---------- Modificaciones de rutina que ve el cliente (v1.48, regla de Joaquín):
// SOLO cuentan series, reps, RIR, orden y cambio/alta/baja de ejercicios. NO cuentan peso sugerido, comentarios por ejercicio
// (esos se ven en la sesión, sobre el ejercicio), tips, descanso, tempo ni el comentario general de la rutina.
const rirT = (v) => (v === "F" ? "al fallo" : v === "" || v == null ? "sin RIR" : "RIR " + v);
export function setChanges(a, b) {
  const out = [];
  for (let j = 0; j < Math.max(a.length, b.length); j++) {
    const o = a[j], e = b[j];
    if (!o) out.push(`se agrega la serie ${j + 1} (${e.reps || "–"} reps, ${rirT(e.rir)})`);
    else if (!e) out.push(`se quita la serie ${j + 1}`);
    else { const t = []; if (String(o.reps ?? "") !== String(e.reps ?? "")) t.push(`${o.reps || "–"} → ${e.reps || "–"} reps`); if (String(o.rir ?? "") !== String(e.rir ?? "")) t.push(`${rirT(o.rir)} → ${rirT(e.rir)}`); if (t.length) out.push(`serie ${j + 1}: ${t.join(", ")}`); }
  }
  return out;
}
const fmtSets = (s) => (s || []).map((x) => String(x.reps ?? "") + "@" + String(x.rir ?? "")).join(",");
export function modsBetween(old, exercises) {
  const list = [], ids = new Set();
  (exercises || []).forEach((e, k) => {
    const o = old.find((x) => x.id === e.id);
    if (!o) { list.push(`Nuevo ejercicio: ${e.name}`); ids.add(e.id); return; }
    if (o.name !== e.name) { list.push(`${o.name} → ${e.name}`); ids.add(e.id); }
    if (fmtSets(o.sets) !== fmtSets(e.sets)) { setChanges(o.sets || [], e.sets || []).forEach((t) => list.push(`${e.name}: ${t}`)); ids.add(e.id); }
    if (old.indexOf(o) !== k) { list.push(`${e.name}: cambió de orden`); ids.add(e.id); }
  });
  old.filter((o) => !(exercises || []).find((e) => e.id === o.id)).forEach((o) => list.push(`Se quitó: ${o.name}`));
  return { list, ids };
}
// Lo que el cliente ve de una rutina modificada. Con `changes.base` se recalcula con la regla de arriba; los avisos antiguos
// guardados como texto (`pre`, o `list` sin base) se filtran: fuera peso sugerido, descanso, tempo, comentarios.
export function routineMods(r, weekKey) {
  const ch = r?.changes; if (!ch || (weekKey && ch.week !== weekKey)) return { list: [], ids: new Set() };
  const notes = new Set((r.exercises || []).filter((e) => e.weekNote).map((e) => `${e.name}: ${e.weekNote}`));
  const okTxt = (t) => !notes.has(t) && !/^Comentario de la rutina:/.test(t) && !/: (descanso|tempo) /.test(t) && !/: peso sugerido [\d.,]+ kg$/.test(t) && !/: serie \d+: peso sugerido [\d.,]+ kg$/.test(t);
  const strip = (t) => t.replace(/, peso sugerido [\d.,]+ kg/g, "");
  const pre = (ch.base != null ? ch.pre || [] : ch.list || []).map(strip).filter(okTxt);
  // Sin base (avisos antiguos): "Modificado" solo para los ejercicios que siguen nombrados en la lista ya filtrada
  if (ch.base == null) return { list: pre, ids: new Set((r.exercises || []).filter((e) => pre.some((t) => t.startsWith(e.name + ":") || t.endsWith("→ " + e.name) || t === "Nuevo ejercicio: " + e.name)).map((e) => e.id)) };
  let old = []; try { old = JSON.parse(ch.base); } catch (e) {}
  const m = modsBetween(old, r.exercises);
  return { list: [...new Set([...pre, ...m.list])], ids: m.ids };
}

// Crea una sesión nueva a partir de la rutina
// Ejercicios unilaterales: cada serie se anota por lado (izquierdo y derecho)
export const isUniName = (n) => /\buni(lateral)?\b/i.test(n || "");
export const splitSides = (arr, blank) => arr.flatMap((x) => [{ ...x, side: "I" }, { ...(blank ? blank() : x), side: "D" }]);
export const setLabel = (ex, j) => (ex.sides ? `Serie ${Math.floor(j / 2) + 1} ${ex.sets[j]?.side === "D" || j % 2 ? "derecha" : "izquierda"}` : `Serie ${j + 1}`);
const blankSet = () => ({ w: "", r: "", rir: "", note: "", done: false });
export function newSession(client, routine, date = ymd()) {
  const mods = routineMods(routine, weekInfo(client, date).key);
  return {
    id: uid(), routineId: routine.id, routineName: routine.name, date, weekKey: weekInfo(client, date).key,
    startedAt: Date.now(), status: "curso", coachNote: routine.note || "",
    exercises: routine.exercises.map((e) => {
      const sides = e.uni ?? isUniName(e.name), tg = e.sets || [];
      return {
        exId: e.id, name: e.name, video: e.video || "", inc: e.inc || 2.5, rest: e.rest || null, notes: e.notes || "", tempo: e.tempo || "", weekNote: e.weekNote || "", wSug: e.wSug || "",
        target: sides ? splitSides(tg) : tg, alts: e.alts || [], changed: mods.ids.has(e.id), sides,
        sets: sides ? splitSides(tg.map(blankSet), blankSet) : tg.map(blankSet), tech: ""
      };
    })
  };
}

// "8" → {lo:8,hi:8}; "6-8" → {lo:6,hi:8}
export function range(s) { const m = String(s ?? "").match(/(\d+)\s*[-–a]\s*(\d+)/); if (m) return { lo: +m[1], hi: +m[2] }; const n = parseInt(s); return isNaN(n) ? null : { lo: n, hi: n }; }

// Sugerencia para la siguiente serie. La técnica va antes que el peso.
// Qué hacer con una serie según cómo salió (técnica primero, después reps/RIR)
export function setVerdict(ex, j) {
  const s = ex.sets[j]; if (!s || s.w === "" || s.r === "") return null;
  const t = ex.target[j] || ex.target[ex.target.length - 1] || {};
  const rg = range(t.reps), tr = t.rir === "" || t.rir == null ? 1 : +t.rir;
  const r = +s.r, rir = s.rir === "" ? null : s.rir;
  if (s.tech === "peor") return { a: "mant", why: "la técnica empeoró: primero afírmala" };
  if (rir === "F" || (rg && r < rg.lo - 1)) return { a: "baja", why: rir === "F" ? "llegaste al fallo" : "te faltaron 2 o más reps" };
  if (rg && ((r >= rg.hi && rir != null && +rir > tr) || r > rg.hi)) return { a: "sube", why: "te sobró margen" };
  return { a: "mant", why: "" };
}
// Mensaje bajo el ejercicio: durante la sesión habla de la serie siguiente;
// al completar la última, resume qué hacer la próxima semana serie por serie.
export function suggest(ex, j) {
  if (ex.sides) return suggestSides(ex, j);
  const v = setVerdict(ex, j); if (!v) return null;
  const last = j >= ex.sets.length - 1;
  if (!last) {
    const t = ex.target[j] || {}, nt = ex.target[j + 1] || t, s = ex.sets[j];
    const heavier = range(nt.reps) && range(t.reps) && range(nt.reps).hi < range(t.reps).lo; // la siguiente pide menos reps
    let a = v.a;
    if (a === "mant" && heavier && s.tech !== "peor") a = "sube";
    const txt = { sube: "sube el peso (salto mínimo)", mant: "mantén el peso", baja: "baja el peso" }[a];
    return { a, last: false, text: `${setLabel(ex, j + 1)}: ${txt}`, why: v.why };
  }
  const per = ex.sets.map((_, k) => setVerdict(ex, k));
  const words = { sube: "sube (salto mínimo)", mant: "mantén", baja: "baja" };
  const items = per.map((x, k) => (x ? `${setLabel(ex, k)}: ${words[x.a]}` : null)).filter(Boolean);
  const worst = per.some((x) => x?.a === "baja") ? "baja" : per.some((x) => x?.a === "sube") ? "sube" : "mant";
  const tech = ex.sets.some((x) => x.tech === "peor");
  return { a: worst, last: true, text: "Próxima semana", items, why: tech ? "Alguna serie salió con peor técnica: no subas peso ahí hasta afirmarla." : "" };
}
// Unilaterales: los dos lados van siempre con el MISMO peso; manda el lado más débil
const RANK = { baja: 0, mant: 1, sube: 2 };
const pairVerdict = (ex, p) => {
  const a = setVerdict(ex, p * 2), b = setVerdict(ex, p * 2 + 1); if (!a || !b) return null;
  const w = RANK[a.a] <= RANK[b.a] ? a : b;
  return { a: w.a, why: w.why ? `${RANK[a.a] <= RANK[b.a] ? "lado izquierdo" : "lado derecho"}: ${w.why}` : "" };
};
function suggestSides(ex, j) {
  const pairs = ex.sets.length / 2, p = Math.floor(j / 2);
  if (j % 2 === 0) return { a: "mant", last: false, text: `Serie ${p + 1} derecha: mismo peso que la izquierda`, why: "en unilaterales ambos lados usan el mismo peso; si un lado cuesta más, descansa un poco más entre lados" };
  const v = pairVerdict(ex, p); if (!v) return null;
  if (p < pairs - 1) {
    const t = ex.target[j] || {}, nt = ex.target[j + 1] || t;
    const heavier = range(nt.reps) && range(t.reps) && range(nt.reps).hi < range(t.reps).lo;
    let a = v.a; if (a === "mant" && heavier && !ex.sets.slice(j - 1, j + 1).some((x) => x.tech === "peor")) a = "sube";
    return { a, last: false, text: `Serie ${p + 2} (ambos lados): ${{ sube: "sube el peso (salto mínimo)", mant: "mantén el peso", baja: "baja el peso" }[a]}`, why: v.why };
  }
  const per = [...Array(pairs)].map((_, k) => pairVerdict(ex, k));
  const words = { sube: "sube (salto mínimo)", mant: "mantén", baja: "baja" };
  const worst = per.some((x) => x?.a === "baja") ? "baja" : per.some((x) => x?.a === "sube") ? "sube" : "mant";
  return { a: worst, last: true, text: "Próxima semana (mismo peso en ambos lados)", items: per.map((x, k) => (x ? `Serie ${k + 1}: ${words[x.a]}` : null)).filter(Boolean), why: per.find((x) => x?.why)?.why || "" };
}

// Reps "efectivas" = reps hechas + RIR (las que te quedaban en reserva). 7 reps RIR 1 = 8; 7 reps RIR 7 = 14; al fallo = las reps hechas.
// Es la forma justa de comparar dos series (lados izq/der, o semana vs semana). Sin RIR anotado se usan las reps tal cual.
const rirN = (v) => (v === "F" ? -1 : v === "" || v == null ? null : +v);
export const repsEff = (x) => { const r = +x.r, a = rirN(x.rir); return a == null ? r : r + Math.max(0, a); };
// ¿Cómo salió esta serie vs la misma serie de la vez anterior? Texto en palabras simples (sin "reps + RIR").
// k: up / same / down / bad (técnica peor) / new. t = frase larga, s = frase corta (imagen para compartir).
const nRep = (n) => `${n} rep${n === 1 ? "" : "s"}`;
const plusMinus = (n, what) => (n > 0 ? `${n} ${what} más` : `${-n} ${what} menos`);
export function perfText(x, ref) {
  const dw = Math.round((x.w - ref.w) * 10) / 10, dr = +x.r - +ref.r;
  // El fallo NO es un RIR (rep incompleta, fatiga variable): solo se compara la reserva entre dos RIR numéricos
  const a = rirN(x.rir), b = rirN(ref.rir), both = a != null && b != null && a !== -1 && b !== -1;
  const da = both ? a - b : 0, de = dr + da; // de = cambio de reps contando las que quedaron en reserva
  const fallo = a === -1 && b !== -1 ? " y al fallo" : b === -1 && a != null && a !== -1 ? " y sin llegar al fallo" : "";
  const res = da ? `${Math.abs(da)} ${da > 0 ? "más" : "menos"} en reserva` : "";
  if (dw > 0) return { k: "up", t: `Subió ${dw} kg${dr ? ` (${plusMinus(dr, dr === 1 || dr === -1 ? "rep" : "reps")})` : ""}`, s: `+${dw} kg` };
  if (dw < 0) return { k: de > 0 ? "same" : "down", t: `Bajó ${-dw} kg${dr > 0 ? ` e hizo ${nRep(dr)} más` : dr < 0 ? ` e hizo ${nRep(-dr)} menos` : ""}`, s: `−${-dw} kg` };
  // mismo peso
  const k = de > 0 ? "up" : de < 0 ? "down" : "same";
  let t;
  if (!dr && !da) t = a === -1 && b !== -1 ? "Mismas reps, pero al fallo" : b === -1 && a != null && a !== -1 ? "Mismas reps, sin llegar al fallo" : "Igual que la vez anterior";
  else if (!dr) t = `Mismas reps, con ${res}${fallo}`;
  else if (!da) t = `${dr > 0 ? "+" : "−"}${nRep(Math.abs(dr))}${fallo}`;
  else t = `${dr > 0 ? "+" : "−"}${nRep(Math.abs(dr))}${(dr > 0) === (da > 0) ? " y" : ", pero"} con ${res}${fallo}`;
  if (dr && da && !de) t += " (equivale a lo mismo)";
  const sh = !dr && !da ? "Igual" : !dr ? `${da > 0 ? "+" : "−"}${Math.abs(da)} en reserva` : `${dr > 0 ? "+" : "−"}${nRep(Math.abs(dr))}${da ? `, ${da > 0 ? "+" : "−"}${Math.abs(da)} RIR` : ""}`;
  return { k, t, s: sh };
}
export function setProgress(x, ref) {
  if (x.w === "" || x.r === "") return null;
  if (!ref || ref.w === "" || ref.r === "") return { k: "new", t: "Primera vez", s: "Primera vez" };
  const p = perfText(x, ref);
  if (x.tech === "peor") return { k: "bad", perf: p.k, t: `Técnica peor · ${p.t.charAt(0).toLowerCase() + p.t.slice(1)}`, s: "Técnica peor" };
  return p;
}
// Veredicto del ejercicio completo vs la última vez. Manda la PRIMERA serie (regla de Joaquín), pero la técnica nunca se pierde "normal":
// · una serie con técnica peor y otra bien → mixto (bien la que salió bien, ajusta la técnica de la otra) · todas con técnica peor → bad
// · la 1ª progresa → up (si la 2ª bajó en reps, se avisa: es normal que cueste más después de progresar en la primera)
// · progresa otra serie pero la 1ª bajó → part · solo bajas → down · nada cambia → same
export function exProgress(e, prevS) {
  const all = e.sets.map((x, j) => ({ j, p: setProgress(x, refSet(prevS, e.exId, j)) })).filter((o) => o.p);
  const cmp = all.filter((o) => o.p.k !== "new"); if (!all.length) return null; if (!cmp.length) return { k: "new", t: "Primera vez" };
  const isFirst = (o) => (e.sides ? o.j < 2 : o.j === 0);
  const sn = (o) => (e.sides ? Math.floor(o.j / 2) + 1 : o.j + 1);
  const lst = (arr) => [...new Set(arr.map(sn))].join(" y ");
  const first = cmp.filter(isFirst), rest = cmp.filter((o) => !isFirst(o));
  const has = (arr, k) => arr.some((o) => o.p.k === k);
  const bad = cmp.filter((o) => o.p.k === "bad"), okT = cmp.filter((o) => o.p.k !== "bad");
  if (bad.length && !okT.length) return { k: "bad", t: "Técnica peor" };
  if (bad.length) return { k: "mix", t: `Mixto · técnica peor en la serie ${lst(bad)}`, note: `Bien la serie ${lst(okT)}; ajusta tu técnica para que la serie ${lst(bad)} también salga bien.` };
  const dn = rest.filter((o) => o.p.k === "down"), upRest = rest.filter((o) => o.p.k === "up");
  if (has(first, "up") && !has(first, "down"))
    return { k: "up", t: "Progresó", note: dn.length ? `La serie ${lst(dn)} bajó: es normal que cueste más después de progresar en la primera.` : "" };
  if (has(first, "down")) return upRest.length ? { k: "part", t: `Progresó en la serie ${lst(upRest)}, bajó en la 1` } : { k: "down", t: "Bajó" };
  if (upRest.length) return dn.length ? { k: "part", t: `Progresó en la serie ${lst(upRest)}` } : { k: "up", t: "Progresó" };
  if (dn.length) return { k: "same", t: "Se mantuvo", note: `La serie ${lst(dn)} bajó.` };
  return { k: "same", t: "Se mantuvo" };
}
// Resumen de la sesión por ejercicio
export function sessionProgress(s, prevS) {
  const v = s.exercises.map((e) => ({ e, p: exProgress(e, prevS) })).filter((x) => x.p && x.p.k !== "new");
  const c = (k) => v.filter((x) => x.p.k === k);
  return { comp: v.length, up: c("up"), part: c("part"), mix: c("mix"), same: c("same"), down: c("down"), bad: c("bad") };
}

export const MEASURE_ZONES = [
  ["cuello", "Cuello", "Bajo la nuez, cinta horizontal."],
  ["hombros", "Hombros", "En la parte más ancha de los hombros, brazos relajados a los lados."],
  ["pecho", "Pecho", "A la altura de los pezones, al final de una espiración normal."],
  ["brazo", "Brazo (relajado)", "En el punto medio entre hombro y codo, brazo colgando relajado."],
  ["cintura", "Cintura", "En la parte más angosta del abdomen, entre costillas y ombligo."],
  ["abdomen", "Abdomen (ombligo)", "A la altura del ombligo, sin meter la guata."],
  ["cadera", "Cadera", "En la parte más prominente de los glúteos, pies juntos."],
  ["muslo", "Muslo", "Justo bajo el pliegue del glúteo, peso repartido en ambas piernas."],
  ["pantorrilla", "Pantorrilla", "En la parte más ancha, de pie y relajado."]
];
export const PHOTO_TYPES = [["frente", "Frente"], ["espalda", "Espalda"], ["perfil", "Perfil"], ["pose", "Pose"], ["extra", "Extra"]];

// ---------- Etapas nutricionales (calendario por semanas)
// client.stages = [{ phase, from, to, kcal, cho, fat, prot, steps, water, note }]  (from/to = n° de semana)
export const PHASE_PCT = { "Break de dieta": 0, "Déficit leve": -10, "Déficit moderado": -20, "Déficit agresivo": -25, "Mini cut": -30, "Mantención": 0, "Recomposición corporal": -5, "Dieta reversa": 5, "Superávit / Volumen": 10 };
export const PHASES = { "Break de dieta": "#a855f7", "Déficit leve": "#e0484e", "Déficit moderado": "#c3242b", "Déficit agresivo": "#8e1b1f", "Mini cut": "#b0263a", "Mantención": "#7d7d86", "Recomposición corporal": "#3b82f6", "Dieta reversa": "#d6a21e", "Superávit / Volumen": "#22a35a" };
export const phaseColor = (p) => PHASES[p] || "#6b6b72";
export function stageAt(c, date) {
  const n = weekInfo(c, date).n;
  return (c.stages || []).find((s) => +s.from >= 1 && n >= +s.from && n <= +s.to) || null;
}
// Objetivos vigentes en una fecha: los de la etapa (si hay) sobre los generales del cliente
// Cada etapa puede ajustar porciones por grupo (s.adj = { "Cereales": -1, "Aceites y grasas": -0.5 }):
// la pauta cambia y los alimentos de ese grupo en las opciones del plan se achican (o agrandan) en la misma proporción.
// Si la etapa no fija calorías/macros, se recalculan con los macros de las porciones de intercambio.
// Planes de alimentación por etapa (20-nov): c.plans = { "Mantención": { menus, pauta, pautaLeg, targets: {kcal, cho, fat, prot}, calc }, … }.
// La app muestra el plan de la etapa marcada en el Timeline para esa semana. Si esa etapa no tiene plan, queda el plan general (c.menus…).
export const phaseAt = (c, date = ymd()) => stageAt(c, date)?.phase || c.phase || null;
export const hasPlans = (c) => !!c.plans && Object.keys(c.plans).length > 0;
// Solo entrenamiento: las metas salen de la calculadora del cliente (c.selfCalc = settings/calc, se adjunta al cargar)
export function applyStage(c, date = ymd()) {
  const o = applyStage0(c, date), sc = c?.service === "entrenamiento" ? c.selfCalc : null;
  if (sc && +sc.kcal) { for (const k of ["kcal", "cho", "fat", "prot"]) o[k] = +sc[k]; o.selfGoal = sc.goalName || ""; }
  return o;
}
function applyStage0(c, date = ymd()) {
  const s = stageAt(c, date), ph = s?.phase || c.phase || null, P = ph ? c.plans?.[ph] : null;
  let o = { ...c, phase: ph || c.phase };
  if (P) { o = { ...o, menus: P.menus || [], pauta: P.pauta || {}, pautaLeg: P.pautaLeg || {}, planPhase: ph }; for (const k of ["kcal", "cho", "fat", "prot"]) if (+P.targets?.[k]) o[k] = +P.targets[k]; }
  if (!s) return o;
  o.stage = s;
  const adj = P ? [] : Object.entries(s.adj || {}).filter(([, d]) => +d); // con plan propio de la etapa, el ajuste ya está en su pauta
  if (adj.length && o.pauta) {
    const pauta = { ...o.pauta }, f = {}, dm = { kcal: 0, cho: 0, fat: 0, prot: 0 };
    for (const [g, d] of adj) {
      const old = +pauta[g] || 0, nu = Math.max(0, old + +d); pauta[g] = nu;
      if (old > 0) f[g] = nu / old;
      const G = GROUPS[g]; if (G) { const real = nu - old; dm.kcal += real * G[0]; dm.cho += real * G[1]; dm.fat += real * G[2]; dm.prot += real * G[3]; }
    }
    o.pauta = pauta;
    if (o.pautaLeg) { o.pautaLeg = { ...o.pautaLeg }; for (const [g, d] of adj) if (o.pautaLeg[g] != null) o.pautaLeg[g] = Math.max(0, +o.pautaLeg[g] + +d); }
    if (o.menus) o.menus = o.menus.map((m) => ({ ...m, meals: m.meals.map((ml) => ({ ...ml, items: ml.items.map((it) => (f[it.cat] != null && f[it.cat] !== 1 ? { ...it, por: it.por != null ? Math.round(it.por * f[it.cat] * 100) / 100 : it.por, g: it.g != null ? Math.round(it.g * f[it.cat]) : it.g, adj: true } : it)).filter((it) => !(it.adj && !it.g)) })) }));
    for (const k of ["kcal", "cho", "fat", "prot"]) if ((s[k] === "" || s[k] == null) && c[k]) o[k] = Math.round(c[k] + dm[k]);
  }
  const fixed = (k) => P && +P.targets?.[k]; // las metas del plan de la etapa mandan
  for (const k of ["kcal", "cho", "fat", "prot", "water"]) if (!fixed(k) && (s[k] === "" || s[k] == null) && s.auto?.[k] != null) o[k] = +s.auto[k];
  for (const k of ["kcal", "cho", "fat", "prot", "steps", "water"]) if (!fixed(k) && s[k] !== "" && s[k] != null) o[k] = +s[k];
  return o;
}
export const adjTxt = (adj) => Object.entries(adj || {}).filter(([, d]) => +d).map(([g, d]) => `${g} ${+d > 0 ? "+" : "−"}${String(Math.abs(+d)).replace(".", ",")}`).join(" · ");
// Barra de calendario de etapas
export function stagesBar(c, curN) {
  const st = [...(c.stages || [])].sort((a, b) => a.from - b.from);
  if (!st.length) return `<p class="muted small">Aún no hay etapas definidas.</p>`;
  const last = Math.max(curN + 2, ...st.map((s) => +s.to));
  const cells = [];
  for (let n = 1; n <= last; n++) { const s = st.find((x) => n >= +x.from && n <= +x.to); cells.push({ n, s }); }
  const segs = []; for (const c2 of cells) { const l = segs[segs.length - 1]; if (l && l.s === c2.s) l.to = c2.n; else segs.push({ s: c2.s, from: c2.n, to: c2.n }); }
  return `<div class="stagebar">${segs.map((g) => `<div class="seg-st ${g.s ? "" : "empty"}" style="flex:${g.to - g.from + 1};${g.s ? `background:${phaseColor(g.s.phase)}` : ""}" title="${g.s ? g.s.phase : "Sin etapa"}">
    <b>${g.s ? g.s.phase : "—"}</b><small>S${g.from}${g.to > g.from ? "–" + g.to : ""}${g.s?.kcal ? " · " + g.s.kcal + " kcal" : ""}</small></div>`).join("")}
    <i class="now" style="left:calc(${((curN - 0.5) / last) * 100}% - 1px)"><span>Hoy</span></i></div>`;
}


// ---------- Check-in semanal (mismo contenido que la hoja "Check-In Semanal" de COACHING LIVIANA)
const L5 = ["Muy bajo", "Bajo", "Normal", "Alto", "Muy alto"];
const Q5 = ["Muy malo", "Malo", "Regular", "Bueno", "Muy bueno"];
const FREQ = ["0 veces", "1 vez a la semana", "2 veces a la semana", "3 veces a la semana", "4 veces a la semana", "5 veces a la semana", "6 veces a la semana", "Todos los días"];
// Check-in v1.18: primero las preguntas abiertas que dan algo con qué trabajar (progreso, barreras, lo que viene,
// un foco concreto); después las escalas rápidas. Lo que la app ya sabe (entrenos hechos, días registrados) no se pregunta.
// Cada pregunta: [clave, texto, tipo, detalle, placeholder]. Tipo: "text", "line", "num", lista de opciones o { multi }.
// Detalle: texto (siempre se pide) o { when: [respuestas], ph } → el campo para explicar aparece solo con esas respuestas.
const why = (when, ph = "¿Por qué?") => ({ when, ph });
export const CHECKIN = [
  { t: "Lo más importante de tu semana", open: true, q: [
    ["facil", "¿Qué se te hace más fácil ahora que hace un mes? (en el gimnasio, al comer, en tu día a día)", "text"],
    ["barrera", "¿Qué hizo más fácil o más difícil seguir tu plan esta semana?", "text"],
    ["orgullo", "¿De qué te sientes orgulloso esta semana?", "text"],
    ["proxSemana", "¿Pasa algo la próxima semana que debamos planificar? (viajes, pruebas, turnos, panoramas, poco sueño…)", "text"],
    ["foco", "¿En qué cosa en particular quieres enfocarte de aquí al próximo check-in? Que sea concreta y realista", "line", null, "Ej: llevar almuerzo a la pega 4 días"]
  ] },
  { t: "Entrenamiento", q: [
    ["otroDeporte", "¿Hiciste otro deporte o actividad física aparte de lo planificado?", ["No", "Sí"], why(["Sí"], "¿Cuál y cuánto?")],
    ["entGeneral", "¿Cómo estuvieron los entrenamientos en general?", ["Muy malos", "Malos", "Regulares", "Buenos", "Muy buenos"], why(["Muy malos", "Malos", "Regulares"])],
    ["motivEnt", "Disposición a entrenar / motivación", ["Muy baja", "Baja", "Normal", "Alta", "Muy alta"], why(["Muy baja", "Baja"])],
    ["fuerza", "Fuerza y rendimiento", ["Muy malos", "Malos", "Regulares", "Buenos", "Muy buenos"], why(["Muy malos", "Malos"], "¿A qué lo asocias?")],
    ["doms", "DOMS / dolor muscular post entrenamiento", ["Sin dolor", "Molestias leves", "Adolorido", "Muy adolorido", "Dolor incapacitante"]],
    ["articular", "¿Hubo dolor articular durante los entrenamientos?", ["Nada", "Leve", "Moderado", "Alto"], why(["Leve", "Moderado", "Alto"], "¿Dónde y en qué ejercicio?")],
    ["confianza", "¿Qué ejercicio sientes que ya dominas y harías bien sin mí? ¿Y en cuál todavía no te sientes seguro?", "text"],
    ["top", "Top 3 series o ejercicios de la semana", "list3"],
    ["peor", "El ejercicio o la serie que más te costó", "line", null, "Ej: sentadilla hack, la segunda serie"]
  ] },
  { t: "Nutrición", q: [
    ["adhPlan", "¿Qué tanto pudiste seguir el plan de alimentación?", ["Menos del 50%", "50–70%", "70–90%", "Más del 90%"]],
    ["nutDificil", "¿Qué fue lo que más te costó de seguir el plan de alimentación?", "text"],
    ["nutFacil", "¿Qué fue lo más fácil de seguir en el plan de alimentación?", "text"],
    ["nutMejorar", "¿Qué crees que podría mejorar para seguir tu plan de alimentación?", "text"],
    ["hambre", "Hambre durante la semana", ["Sin hambre", "Poca hambre", "Lo normal", "Hambriento", "Muy hambriento"]],
    ["saciedad", "Saciedad después de comer", ["Poca", "Satisfecho", "Muy satisfecho", "Incómodamente satisfecho"]],
    ["antojos", "Antojos durante la semana", ["No tuve", "Pocos", "Varios", "Muchos"]],
    ["fueraPlan", "Si tuviste comidas fuera de plan, ¿cuántas fueron y en qué contexto?", "text"]
  ] },
  { t: "Encuesta de tendencia de consumo", freq: true, q: ["Frutas", "Verduras", "Lácteos", "Carne/Pollo/Cerdo", "Pescado/Mariscos", "Legumbres", "Huevo", "Frutos secos", "Semillas", "Ultraprocesados", "Mayo/Mantequilla/Margarina", "Azúcar de mesa", "Embutidos", "Alcohol"].map((f) => ["f_" + f, f, FREQ]) },
  { t: "Digestión", q: [
    ["depos", "Deposiciones por día (promedio de la semana)", ["0", "1", "2", "3 o más"]],
    ["bristol", "¿Cómo fueron tus deposiciones?", ["Duras", "Normales", "Blandas", "Pastosas (entre blandas y líquidas)", "Líquidas"]],
    ["digest", "Digestión en general", ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"]],
    ["comDig", "Si hubo, describe tus molestias o síntomas intestinales", "text"]
  ] },
  { t: "Recuperación, rendimiento y energía", sleep: true, q: [
    ["suenoVs", "¿Cómo describirías tu sueño comparado con la semana anterior?", ["Peor", "Igual", "Mejor"], why(["Peor"])],
    ["enerSes", "Energía durante las sesiones", ["Muy baja", "Baja", "Normal", "Alta", "Muy alta"]],
    ["enerFuera", "Energía fuera de las sesiones", ["Muy baja", "Baja", "Normal", "Alta", "Muy alta"]],
    ["recup", "¿Te sientes lo suficientemente recuperado de una sesión a otra?", ["Sí", "Más o menos", "No"]],
    ["salud", "¿Cómo te sentiste de salud en general?", ["Terrible", "Mal", "Regular", "Bien", "Muy bien", "Excelente"]],
    ["resfrio", "¿Hubo algún signo de resfrío o enfermedad esta semana?", ["Todo bien", "Síntomas leves", "Me enfermé"]]
  ] },
  { t: "Estrés y ánimo", q: [
    ["estEmo", "Estrés emocional", L5], ["estFis", "Estrés físico", L5], ["estLab", "Estrés laboral/profesional", L5], ["estGen", "Estrés en general", L5],
    ["animo", "Ánimo en general", Q5], ["comEst", "¿Algo que quieras contarme de cómo estuviste?", "text"]
  ] },
  { t: "Sintomatología", q: [
    ["sintomas", "¿Has tenido alguno de estos síntomas durante la última semana?", { multi: ["Dolores de cabeza", "Debilidad/fatiga sin motivo aparente", "Mareos o visión borrosa", "Adormecimiento de extremidades", "Calambres", "Disnea (falta de aire)", "Náuseas o vómitos", "Diarrea", "Estreñimiento", "Distensión abdominal (hinchazón)", "Flatulencias (gases excesivos)", "Pérdida de apetito", "Cambios de ánimo", "Insomnio", "Dificultad para concentrarse", "Irritabilidad excesiva", "Alergias", "Acné", "Picazón"] }],
    ["comSin", "Comentarios", "text"]
  ] },
  { t: "Experiencia con la asesoría", q: [
    ["expProg", "¿Cómo te sientes con el progreso que hemos tenido?", ["No he visto progreso", "Podría ser mejor", "Satisfecho", "Muy satisfecho", "Increíble"]],
    ["expRetro", "¿Qué tan útil fue mi retroalimentación para esta semana?", ["No la vi", "No me sirvió", "No la apliqué", "Útil", "Muy útil"]],
    ["sugerencia", "¿Tienes alguna sugerencia sobre qué podría hacer yo para facilitar tu proceso?", "text"]
  ] },
  { t: "Consultas / dudas", q: [
    ["consultas", "¿Necesitas algo en particular de mí esta semana? ¿Tienes dudas o consultas sobre tu plan de entrenamiento o de alimentación?", "text"]
  ] }
];
// Preguntas de versiones anteriores: se siguen mostrando en el panel si un check-in antiguo las tiene
// Preguntas que solo tienen sentido con un plan de alimentación (solo entrenamiento no tiene plan: registra y compara con sus macros)
export const PLAN_Q = new Set(["adhPlan", "nutDificil", "nutFacil", "nutMejorar", "fueraPlan"]);
export const CHECKIN_OLD = { cintura: "Circunferencia de cintura (cm)", momentoDificil: "¿Qué comida o momento del día te costó más?", todos: "¿Hiciste todos los entrenamientos?", progCarga: "¿Hubo progreso de carga/repeticiones?", progTec: "¿Hubo progreso de técnica?", comEnt: "Comentarios de entrenamiento", motivNut: "Motivación para tomar buenas decisiones alimentarias", contribuyen: "¿Las decisiones que tomaste contribuyen a tus objetivos?", comNut: "Comentarios de nutrición", comFreq: "Comentarios de consumo", comRec: "Comentarios de recuperación", dificil: "¿Algo que se te haya dificultado más?", mejorar: "¿Algo que desees mejorar para la semana que viene?", expResp: "Tiempo de respuesta", expServ: "Servicio en general" };


// ---------- Calendario del mes con las etapas (lu–do), como un calendario normal
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// opts: { month: "AAAA-MM", selWeek: n, act: "acción al tocar un día", nav: "acción ‹ ›", paint: true }
export function monthCal(c, opts = {}) {
  const today = ymd(), [y, m] = (opts.month || today.slice(0, 7)).split("-").map(Number);
  const first = new Date(y, m - 1, 1), startDow = (first.getDay() + 6) % 7, nDays = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const used = new Set();
  const cell = (d) => {
    if (!d) return `<span class="mc-d empty"></span>`;
    const st = c.startDate && d >= c.startDate ? stageAt(c, d) : null, wn = c.startDate && d >= c.startDate ? weekInfo(c, d).n : null;
    if (st) used.add(st.phase);
    const sel = opts.selWeek && wn === opts.selWeek;
    return `<button type="button" class="mc-d ${st ? "st" : ""} ${d === today ? "today" : ""} ${sel ? "sel" : ""}" ${st ? `style="--pc:${phaseColor(st.phase)}"` : ""} ${opts.act && wn ? `data-a="${opts.act}" data-w="${wn}"` : ""} title="${wn ? "Semana " + wn + (st ? " · " + st.phase : "") : ""}">${+d.slice(8)}</button>`;
  };
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`, next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  return `<div class="mcal"><div class="mc-h">${opts.nav ? `<button class="icon-btn" data-a="${opts.nav}" data-m="${prev}">‹</button>` : ""}<b>${MES[m - 1][0].toUpperCase() + MES[m - 1].slice(1)} ${y}</b>${opts.nav ? `<button class="icon-btn" data-a="${opts.nav}" data-m="${next}">›</button>` : ""}</div>
  <div class="mc-g">${["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((x) => `<span class="mc-w">${x}</span>`).join("")}${cells.map(cell).join("")}</div>
  <div class="mc-l">${[...used].map((p) => `<span><i style="background:${phaseColor(p)}"></i>${p}</span>`).join("") || '<span class="muted">Sin etapas en este mes</span>'}</div></div>`;
}

// ---------- ¿Qué tan bien está una métrica? (con criterio según el objetivo)
// devuelve "okc" (bien), "lowc" (ojo) o "hic" (lejos); "" si no hay meta
export function judge(metric, v, goal, phase = "") {
  if (v == null || v === 0 || !goal) return "";
  const d = (v - goal) / goal, cut = /Déficit|Mini cut|Mantención|Recomposición|Break/.test(phase), bulk = /Superávit|reversa/.test(phase);
  if (metric === "kcal") { if (Math.abs(d) <= 0.1) return "okc"; if (d > 0) return cut ? "hic" : "lowc"; return bulk ? "hic" : d < -0.25 ? "hic" : "lowc"; }
  if (metric === "cho" || metric === "fat") return Math.abs(d) <= 0.15 ? "okc" : Math.abs(d) <= 0.3 ? "lowc" : "hic";
  if (metric === "prot") return d >= -0.1 ? "okc" : d >= -0.25 ? "lowc" : "hic"; // pasarse en proteína no es malo
  // pasos, agua, sueño: más es mejor
  return d >= -0.1 ? "okc" : d >= -0.3 ? "lowc" : "hic";
}
// Peso corregido: si se pesó sin ir al baño se le resta una deposición promedio (~0,12 kg; mediana 128 g/día y 1,1 deposiciones/día, Rose et al. 2015)
export const STOOL_KG = 0.12;
export const weightCorr = (d) => (d?.weight ? (d.weightBath === false ? d.weight - STOOL_KG : d.weight) : null);
// Agua automática: 40 ml por kg del último peso registrado (redondeado a 100 ml)
export const waterAuto = (kg) => (kg ? Math.round((kg * 40) / 100) * 100 : null);

// Recordatorio de pago que ve el cliente (mismo texto en el panel, para revisarlo antes)
// Recordatorio de pago (inicio del cliente). Los datos para transferir viven en library/payment (los edita el coach en Biblioteca, no van en el código)
// Estado del pago: la fecha de pago es FIJA (payDate, ej. el 9 de cada mes). "Posponer" no la mueve: guarda payGrace
// (plazo acordado) y hasta ese día no se avisa. Devuelve null | "pronto" (≤ 3 días, solo coach) | "hoy" | "vencido" | "pospuesto".
export function payState(c, today = ymd()) {
  if (!c?.payDate) return null;
  const d = diffDays(c.payDate, today);
  if (d > 0) return d <= 3 ? "pronto" : null;
  if (c.payGrace && today < c.payGrace) return "pospuesto";
  return d === 0 ? "hoy" : "vencido";
}
export const PAY_FIELDS = [["name", "Nombre"], ["rut", "RUT"], ["bank", "Banco"], ["type", "Tipo de cuenta"], ["number", "N° de cuenta"], ["email", "Correo"]];
const MONTHS_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const longDate = (s) => { const d = parseYmd(s); return `${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getDay()]} ${d.getDate()} de ${MONTHS_L[d.getMonth()]}`; };
function payData(pay) {
  if (!pay || !PAY_FIELDS.some(([k]) => pay[k])) return "";
  const line2 = [pay.bank, pay.type, pay.number ? "N° " + pay.number : ""].filter(Boolean).join(" · ");
  return `<div class="paydata"><b>Datos para transferir:</b><br>${[pay.name, line2, pay.rut ? "RUT " + pay.rut : "", pay.email].filter(Boolean).map(esc).join("<br>")}</div>`;
}
export function payMsg(c, pay, late = false) {
  const first = (c.name || "").split(" ")[0], hi = `Hola${first ? " " + esc(first) : ""} 👋`;
  return late
    ? `<b>Pago pendiente</b><br>${hi}<br>Tu asesoría se renovaba el ${longDate(c.payDate)} y aún no tengo registrado el pago.${payData(pay)}<p>Una vez transferido recuerda enviarme el comprobante. Si ya pagaste, ignora este mensaje. Si tienes alguna dificultad, escríbeme por WhatsApp y lo vemos.</p>`
    : `${hi}<br>Hoy, ${longDate(c.payDate)}, se renueva tu asesoría.${payData(pay)}<p>Una vez transferido recuerda enviarme el comprobante. Cualquier duda o consulta puedes escribirme por WhatsApp.</p>`;
}

// ---------- Textos en femenino si la clienta es mujer (c.sex === "F"). Las respuestas se guardan igual (en masculino) para no romper comparaciones; solo cambia lo que se muestra.
const FEM = { orgulloso: "orgullosa", adolorido: "adolorida", seguro: "segura", hambriento: "hambrienta", satisfecho: "satisfecha", recuperado: "recuperada", relajado: "relajada", despierto: "despierta" };
export const isFem = (c = S.client) => c?.sex === "F";
export function gtxt(s, c = S.client) {
  if (!isFem(c) || !s) return s;
  return String(s).replace(/\b(orgulloso|adolorido|seguro|hambriento|satisfecho|recuperado|relajado|despierto)\b/gi, (w) => { const f = FEM[w.toLowerCase()]; return w[0] === w[0].toUpperCase() ? f[0].toUpperCase() + f.slice(1) : f; });
}

// ---------- Check-in: a qué semana corresponde
// Si su día de check-in cae al inicio de la semana (≤ 2 días después de que parte, ej. domingo con semanas dom–sáb),
// el check-in de ese día es el de la SEMANA ANTERIOR. ciOff = días desde el inicio de la semana hasta el día de check-in.
export const ciOff = (c) => (c?.checkinDay == null || c.checkinDay === "" || !c.startDate ? null : (+c.checkinDay - parseYmd(c.startDate).getDay() + 7) % 7);
export const ciLate = (c) => { const o = ciOff(c); return o != null && o <= 2; };
// Semana que cubre un check-in hecho hoy. open = es el momento de pedirlo (los 2 últimos días de la semana;
// si es "atrasado": el último día de la semana, el día de check-in y el siguiente).
export function ciWeek(c, date = ymd()) {
  const r = ciWeek0(c, date), from = appStart(c);
  // Antes de su primera semana en la app (ej. el domingo antes de partir): se muestra el check-in de la semana en que parte, sin pedirlo
  if (r.w.n < 1 || (from && r.w.last < from)) return { w: weekInfo(c, [date, from].sort().pop()), open: false };
  return r;
}
function ciWeek0(c, date) {
  const w = weekInfo(c, date);
  if (!ciLate(c)) return { w, open: date >= addDays(w.last, -1) };
  const k = diffDays(date, w.first), off = ciOff(c);
  if (k === 6) return { w, open: true }; // último día: ya puede mandar el de esta semana
  return { w: weekInfo(c, addDays(w.first, -7)), open: k <= off + 1 };
}
// Semana cuyo check-in ya debió llegar (para avisarle al coach). Sin día de check-in: la semana pasada.
export function ciOverdue(c, date = ymd()) {
  const w = weekInfo(c, date), prev = weekInfo(c, addDays(w.first, -7));
  if (!ciLate(c)) return prev;
  return diffDays(date, w.first) > ciOff(c) + 1 ? prev : weekInfo(c, addDays(w.first, -14));
}

// Revisión semanal de la rutina: la ventana parte el día del último entrenamiento de la semana
// (o 2 días antes de que termine si no hay calendario) y dura hasta que empieza la semana siguiente.
export function reviewWindow(c, routines, sessions, today = ymd()) {
  if (!c.startDate || !routines.length || today < appStart(c)) return null; // aún no empieza a usar la app: no hay semana que revisar
  const w = weekInfo(c, today), plan = weekPlan(c, routines, sessions, today);
  const lastTrain = plan.planned.length ? plan.planned[plan.planned.length - 1].date : addDays(w.last, -1);
  const next = weekInfo(c, addDays(w.last, 1));
  // Cada rutina se revisa por separado (r.review = {week, same}); la semana queda revisada si lo están todas (o se marcó todo igual)
  const inUse = isRotation(c) ? c.rotation.order : Object.values(c.schedule || {});
  const scheduled = routines.filter((r) => inUse.includes(r.id));
  const list = (scheduled.length ? scheduled : routines).map((r) => ({ r, done: r.review?.week === next.key || r.changes?.week === next.key, same: r.review?.week === next.key && r.review.same }));
  return { open: today >= lastTrain, next, w, lastTrain, list, done: c.rutReview?.week === next.key || list.every((x) => x.done) };
}

// ---------- Bloque de una rutina semana a semana (coach: Rutinas y Progreso)
// Por cada semana con la rutina terminada toma su último entrenamiento: lo indicado (target) y lo hecho por serie.
// Los unilaterales juntan izquierda y derecha en la misma serie (w/r = izquierda, w2/r2 = derecha).
export function routineBlock(routine, sessions) {
  const fin = sessions.filter((x) => x.routineId === routine.id && x.status === "fin").sort((a, b) => a.startedAt - b.startedAt);
  const byWeek = new Map(); for (const s of fin) byWeek.set(s.weekKey, s); // queda el último de cada semana
  const weeks = [...byWeek.keys()].sort();
  const exs = (routine.exercises || []).map((e) => {
    const cells = {};
    for (const wk of weeks) {
      const s = byWeek.get(wk), x = s.exercises.find((y) => y.exId === e.id) || s.exercises.find((y) => y.name === e.name);
      if (!x) continue;
      const tg = x.sides ? (x.target || []).filter((_, k) => k % 2 === 0) : x.target || [];
      const sets = [];
      if (x.sides) for (let j = 0; j * 2 < x.sets.length; j++) { const a = x.sets[2 * j] || {}, b = x.sets[2 * j + 1] || {}; sets.push({ w: a.w, r: a.r, rir: a.rir, w2: b.w, r2: b.r }); }
      else for (const a of x.sets || []) sets.push({ w: a.w, r: a.r, rir: a.rir });
      const notes = (x.sets || []).map((a, k) => (a.note ? `S${(x.sides ? Math.floor(k / 2) : k) + 1}: ${a.note}` : "")).filter(Boolean);
      cells[wk] = { plan: tg, sets: sets.filter((y) => y.w !== "" || y.r !== ""), date: s.date, name: x.name, tech: x.tech || (x.sets || []).map((a) => a.tech).find(Boolean) || "", notes, replaced: x.replaced ? x.replacedFrom : "" };
    }
    return { e, cells };
  });
  return { weeks, exs, byWeek };
}
export const planStr = (tg) => (tg?.length ? `${tg.length}×${[...new Set(tg.map((t) => t.reps || "–"))].join("/")}${tg.some((t) => t.rir !== "" && t.rir != null) ? ` @${[...new Set(tg.map((t) => t.rir))].join("/")}` : ""}` : "");
export const setStr = (y) => (y ? `${y.w || "–"}×${y.r || "–"}${y.w2 !== undefined ? ` | ${y.w2 || "–"}×${y.r2 || "–"}` : ""}` : "–");
