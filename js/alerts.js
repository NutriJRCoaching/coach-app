// Pendientes del coach por cliente: rojo = urgente · amarillo = pendiente · gris = informativo
import { db } from "./db.js";
import { S } from "./state.js";
import { ymd, addDays, weekInfo, diffDays, fmtDate, DAYS } from "./util.js";
import { getRoutines, getSessions, getDays } from "./data.js";
import { weekPlan, reviewWindow, payState, regSoFar, hasFood, appStart, isRotation, ciOverdue, weightCorr, phaseAt, PHASE_PCT } from "./data.js";
import { GROUPS, pautaExtras, pautaMac } from "./foods.js";

export const SERVICES = { completa: "Coaching 1-1", entrenamiento: "Entrenamiento", nutricion: "Nutrición" };
export const SERVICE_GROUPS = [["completa", "Coaching 1-1"], ["entrenamiento", "Entrenamiento"], ["nutricion", "Nutrición"], ["", "Sin definir"]];
const trains = (c) => ["completa", "entrenamiento"].includes(c.service);
const eats = (c) => ["completa", "nutricion"].includes(c.service);
export const emailKey = (e) => String(e || "").trim().toLowerCase();

// Carga lo necesario para revisar a un cliente
export async function loadCtx(c) {
  const today = ymd();
  if (c.service === "entrenamiento" && c.selfCalc === undefined) c.selfCalc = await db.get(`clients/${c.id}/settings/calc`).catch(() => null);
  const [routines, sessions, days, checkins, feedbacks, fbreplies, access, onb] = await Promise.all([
    getRoutines(c.id), getSessions(c.id), getDays([addDays(today, -6), c.startDate ? weekInfo(c, today).first : today].sort()[0], today, c.id),
    db.list(`clients/${c.id}/checkins`), db.list(`clients/${c.id}/feedbacks`), db.list(`clients/${c.id}/fbreplies`),
    c.email ? db.get("access/" + emailKey(c.email)).catch(() => null) : null,
    db.get(`clients/${c.id}/settings/onboarding`).catch(() => null)
  ]);
  return { routines, sessions, days, checkins, feedbacks, fbreplies, access, onb };
}

// ---------- ¿Algo no calza en los planes de alimentación? (planes de la etapa actual y de las que vienen)
// Revisa: pauta vs metas, cada opción vs su pauta y sus metas, metas vs requerimiento (mantención × % de la etapa)
// y si el peso cambió desde que se calcularon las metas.
const MK = [["kcal", "kcal", 0.05], ["cho", "CHO", 0.1], ["fat", "lípidos", 0.1], ["prot", "proteína", 0.1]];
const pMacA = (p) => { const t = { kcal: 0, cho: 0, fat: 0, prot: 0 }; for (const [g, n] of Object.entries(p || {})) { const G = GROUPS[g]; if (G) { t.kcal += n * G[0]; t.cho += n * G[1]; t.fat += n * G[2]; t.prot += n * G[3]; } } return t; };
function optTot(mn) {
  const t = { kcal: 0, cho: 0, fat: 0, prot: 0 }, por = {};
  for (const m of mn.meals || []) {
    const bud = m.free && +m.budget?.kcal > 0;
    if (bud) for (const k in t) t[k] += +m.budget[k] || 0;
    for (const it of m.items || []) {
      const G = GROUPS[it.cat];
      if (G && G[4]) { if (!it.por) continue; t.kcal += G[0] * it.por; t.cho += G[1] * it.por; t.fat += G[2] * it.por; t.prot += G[3] * it.por; por[it.cat] = (por[it.cat] || 0) + +it.por; }
      else if (!bud) for (const k in t) t[k] += +it[k] || 0;
    }
  }
  return { t, por };
}
const offTxt = (a, T) => MK.filter(([k, , tol]) => +T[k] && Math.abs(a[k] / T[k] - 1) > tol).map(([k, l]) => { const d = Math.round(a[k] - T[k]); return `${l} ${d > 0 ? "+" : ""}${d}`; });
function planChecks(c, x, plans, add) {
  const today = ymd(), n = c.startDate ? weekInfo(c, today).n : 1, cur = phaseAt(c, today);
  const live = Object.keys(plans).filter((ph) => ph === cur || (c.stages || []).some((st) => st.phase === ph && +st.to >= n && +st.from - n <= 3));
  const ws = Object.keys(x.days || {}).sort().map((d) => weightCorr(x.days[d])).filter(Boolean), kgNow = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null;
  for (const ph of live) {
    const P = plans[ph], T = P.targets || {}, tag = `Plan de ${ph}`;
    if (!+T.kcal) continue;
    // 1) Pauta vs metas
    if (Object.values(P.pauta || {}).some((v) => +v)) { const o = offTxt(pautaMac(P.pauta, pautaExtras(P.menus)), T); if (o.length) add("y", `${tag}: la pauta no calza con las metas (${o.join(" · ")})`, "plan"); }
    else add("y", `${tag}: falta la pauta por porciones`, "plan");
    // 2) Cada opción vs su pauta (porciones) y vs las metas (macros)
    for (const mn of P.menus || []) {
      const { t, por } = optTot(mn), pz = mn.leg && Object.values(P.pautaLeg || {}).some((v) => +v) ? P.pautaLeg : P.pauta || {};
      const dif = Object.keys({ ...pz, ...por }).filter((g) => GROUPS[g]?.[4] && Math.abs((por[g] || 0) - (+pz[g] || 0)) >= 0.5);
      const o = offTxt(t, T);
      if (o.length) add("y", `${tag} · ${mn.name || "opción"}: ${o.join(" · ")} vs las metas`, "plan");
      else if (dif.length) add("i", `${tag} · ${mn.name || "opción"}: porciones distintas a la pauta en ${dif.slice(0, 3).join(", ").toLowerCase()}${dif.length > 3 ? "…" : ""}`, "plan");
    }
    if ((P.menus || []).length && !(P.menus || []).some((m) => m.leg)) add("i", `${tag}: falta el día con legumbres`, "plan");
    // 3) Metas vs requerimiento de la etapa (mantención × (1 + %))
    const maint = +P.calc?.maint || +c.kcalMaint || null;
    if (maint) { const pct = P.calc?.pct !== "" && P.calc?.pct != null ? +P.calc.pct : PHASE_PCT[ph] ?? 0, req = Math.round(maint * (1 + pct / 100));
      if (Math.abs(T.kcal / req - 1) > 0.08) add("y", `${tag}: sus metas (${T.kcal} kcal) no calzan con el requerimiento de la etapa (${req} kcal = mantención ${maint} ${pct >= 0 ? "+" : ""}${pct} %)`, "plan"); }
    // 4) El peso cambió desde que se calcularon las metas
    const kg0 = +P.calc?.kg;
    if (kg0 && kgNow && Math.abs(kgNow - kg0) >= Math.max(2, kg0 * 0.03)) { const d = Math.round((kgNow - kg0) * 10) / 10;
      add("i", `${tag}: su peso ${d > 0 ? "subió" : "bajó"} ${Math.abs(d).toString().replace(".", ",")} kg desde que calculaste las metas (${kg0} → ${Math.round(kgNow * 10) / 10} kg)`, "plan"); } // dato, no pendiente (pedido de Joaquín)
  }
}
export function alertsFor(c, x) {
  const A = [], add = (lvl, t, tab = "datos") => A.push({ c: lvl, t, tab });
  const today = ymd();
  const active = !!(x.access?.ok || c.id === S.user?.uid || c.example); // ya usa la app
  // ---------- Configuración
  if (!c.service) add("r", "Falta definir el tipo de asesoría");
  if (!c.email && !c.example) add("y", "Falta su correo (lo necesita para crear su cuenta)");
  else if (!active) add("i", "Aún no tiene acceso a la app");
  if (active && !c.example && !x.onb?.done) add("i", "Aún no completa la bienvenida a la app");
  if (!c.startDate) add("y", "Falta la fecha de inicio (define sus semanas)");
  else if (appStart(c) > today) add("i", `${c.appFrom > c.startDate ? "Empieza a usar la app" : "Empieza"} el ${fmtDate(appStart(c))}`);
  const miss = [["sex", "sexo"], ["birth", "fecha de nacimiento"], ["height", "estatura"]].filter(([k]) => !c[k]).map(([, l]) => l);
  if (miss.length) add("y", "Faltan datos: " + miss.join(", "));
  if (c.service === "nutricion" && active && !x.routines.length) add("i", "Aún no arma sus rutinas en la app", "entrenos");
  if (trains(c)) {
    if (!x.routines.length) add("r", "Falta su plan de entrenamiento (rutinas)", "entrenos");
    else if (!isRotation(c) && !Object.values(c.schedule || {}).some(Boolean)) add("y", "Falta el calendario semanal: qué rutina toca cada día", "entrenos");
    const rv = reviewWindow(c, x.routines, x.sessions);
    if (rv?.open && !rv.done) { const pend = (rv.list || []).filter((x) => !x.done).map((x) => x.r.name); add(today === rv.w.last ? "r" : "y", `Revisa ${pend.length ? pend.join(", ") : "su rutina"} para la semana ${rv.next.n} (parte el ${fmtDate(rv.next.first)})`, "entrenos"); }
  }
  if (eats(c)) {
    const plans = c.plans && Object.keys(c.plans).length ? c.plans : null;
    if (!plans) {
      if (!c.kcal || !c.prot) add("r", "Faltan los objetivos de calorías y macros");
      if (!(c.menus || []).length && !c.plan?.pdfUrl && !c.planPdf) add("r", "Falta su plan de alimentación", "plan");
      else if (!(c.menus || []).length) add("y", "Su plan está solo en PDF: pásalo a la app", "plan");
      if (!c.pauta || !Object.keys(c.pauta).length) add("y", "Falta la pauta por porciones", "plan");
    } else if (c.startDate) {
      // Cada etapa del Timeline necesita su plan: aviso cuando la etapa ya corre o parte en ≤ 2 semanas
      const n = weekInfo(c, today).n, seen = new Set();
      for (const st of [...(c.stages || [])].sort((a, b) => a.from - b.from)) {
        if (+st.to < n || plans[st.phase] || seen.has(st.phase)) continue; seen.add(st.phase);
        const d = +st.from - n;
        if (d <= 0) add("r", `Falta el plan de alimentación de ${st.phase} (etapa actual)`, "plan");
        else if (d <= 2) add("y", `En ${d} semana${d === 1 ? "" : "s"} parte ${st.phase}: arma su plan de alimentación`, "plan");
      }
      for (const [ph, P] of Object.entries(plans)) if (!+P.targets?.kcal && (c.stages || []).some((st) => st.phase === ph && +st.to >= n)) add("y", `El plan de ${ph} no tiene metas de calorías y macros`, "plan");
    }
    if (plans) planChecks(c, x, plans, add);
  }
  if (c.service === "entrenamiento" && c.selfCalc === null && c.startDate) add("i", "Aún no calcula sus macros en su calculadora");
  if (!c.steps) add("y", "Falta la meta de pasos");
  // Planificación (etapas / bloque)
  const w = c.startDate ? weekInfo(c, today) : null;
  if (w && w.n >= 1) {
    const st = c.stages || [], lastTo = st.length ? Math.max(...st.map((s) => +s.to || 0)) : 0;
    if (!st.length) add("i", "Sin planificación por etapas", "etapas");
    else if (w.n > lastTo) add("r", `Su planificación terminó en la semana ${lastTo}: define la siguiente`, "etapas");
    else if (lastTo - w.n <= 1) add("y", `Su planificación termina en la semana ${lastTo}`, "etapas");
  }
  if (c.endDate) {
    const d = diffDays(c.endDate, today);
    if (d < 0) add("r", `Su servicio terminó el ${fmtDate(c.endDate)}`);
    else if (d <= 7) add("y", `Su servicio termina el ${fmtDate(c.endDate)} (${d} días)`);
  }
  // Cumpleaños (aviso el día antes y el mismo día) y pagos
  if (c.birth) { const md = c.birth.slice(5), tm = addDays(today, 1).slice(5); if (md === today.slice(5)) add("y", "🎂 Hoy está de cumpleaños"); else if (md === tm) add("y", "🎂 Mañana está de cumpleaños"); }
  if (c.payDate) { const ps = payState(c, today); if (ps === "vencido") add("r", `Pago vencido desde el ${fmtDate(c.payDate)}${c.payGrace ? ` (plazo hasta el ${fmtDate(c.payGrace)})` : ""}`); else if (ps === "hoy") add("i", "Hoy le toca pagar"); else if (ps === "pronto") add("i", `Le toca pagar el ${fmtDate(c.payDate)}`); // dato, no pendiente: solo el pago vencido pide que hagas algo else if (ps === "pospuesto") add("i", `Pago del ${fmtDate(c.payDate)} pospuesto hasta el ${fmtDate(c.payGrace)}`); }
  // Pendientes anotados a mano ("!" al inicio = urgente)
  (c.todo || []).forEach((t) => { const u = t.startsWith("!"); add(u ? "r" : "y", u ? t.slice(1).trim() : t); });

  // Respuestas a tus videos de retroalimentación
  for (const r of x.fbreplies || []) if (!r.seen && (r.rating || r.duda || r.falto)) {
    const n = +r.id.slice(1);
    if (r.duda) add("r", `Tiene una duda sobre tu retro de la semana ${n}`, "feedback");
    else if (r.falto) add("y", `Sintió que faltó algo en tu retro de la semana ${n}`, "feedback");
    else if (r.rating <= 3) add("y", `Calificó tu retro de la semana ${n} con ${r.rating}/5`, "feedback");
    else add("i", `Calificó tu retro de la semana ${n} con ${r.rating}/5`, "feedback");
  }
  // ---------- Semana en curso
  if (w && w.n >= 1) {
    const answered = (key) => x.feedbacks.some((f) => f.id === key && (f.at || f.answered));
    const ci = Object.fromEntries(x.checkins.map((k) => [k.id, k]));
    const prev = weekInfo(c, addDays(w.first, -7));
    for (const k of [w.key, prev.n >= 1 ? prev.key : null]) if (k && ci[k] && !answered(k)) add("r", `Check-in de la semana ${+k.slice(1)} sin responder`, "checkins");
    const due = ciOverdue(c, today); // si su check-in es al inicio de la semana, cubre la anterior: se avisa recién pasado ese día
    if (active && !c.checkinForm && due.n >= 1 && due.last >= appStart(c) && !ci[due.key]) add("y", `No ha enviado el check-in de la semana ${due.n}`, "checkins");
    if (c.checkinForm && c.checkinDay != null && new Date().getDay() === +c.checkinDay) add("i", "Hoy le toca el check-in por formulario", "checkins");
    if (active && trains(c)) {
      const plan = weekPlan(c, x.routines, x.sessions);
      const late = plan.slots.filter((s) => s.status === "atrasado").length;
      if (late) add("y", `${late} entrenamiento${late > 1 ? "s" : ""} atrasado${late > 1 ? "s" : ""} esta semana`, "entrenos");
      if (plan.rotation) { // en rotación no hay "atrasados": se avisa si ya no alcanzan los días o si no respetó el descanso
        if (plan.missing) add("y", `Le ${plan.missing > 1 ? "faltan" : "falta"} ${plan.missing} entrenamiento${plan.missing > 1 ? "s" : ""} esta semana y ya no alcanzan los días con descanso`, "entrenos");
        const gap = (+c.rotation.minRest || 1) + 1, ds = [...new Set(x.sessions.filter((s) => s.status === "fin" && s.date >= addDays(w.first, -1) && s.date <= today).map((s) => s.date))].sort();
        const pairs = ds.slice(1).filter((d, i) => diffDays(d, ds[i]) < gap);
        if (pairs.length) add("y", gap === 2 ? `Entrenó 2 días seguidos (${pairs.map((d) => fmtDate(addDays(d, -1)) + " y " + fmtDate(d)).join("; ")})` : `Entrenó sin los ${gap - 1} días de descanso (${pairs.map((d) => fmtDate(d)).join(", ")})`, "entrenos");
      }
      const wk = x.sessions.filter((s) => s.status === "fin" && s.weekKey === w.key);
      if (wk.some((s) => s.survey?.articular === "si")) add("r", "Reportó molestia articular", "entrenos");
      if (wk.some((s) => s.exercises?.some((e) => e.tech === "peor" || e.sets?.some((y) => y.tech === "peor")))) add("y", "Técnica peor en algún ejercicio", "entrenos");
      const seen = c.seen?.entrenos || 0, nuevos = x.sessions.filter((s) => s.status === "fin" && !s.imported && (s.endedAt || 0) > seen).length;
      if (nuevos) add("i", `${nuevos} entrenamiento${nuevos > 1 ? "s" : ""} nuevo${nuevos > 1 ? "s" : ""} para revisar`, "entrenos");
    }
    if (active) {
      // Proporcional a lo que va de su semana: avisa si ya le faltan 2 o más días sin registrar comida, o menos de 3 de cada 7 pesajes
      const F = regSoFar(c, w, x.days, hasFood, today), W = regSoFar(c, w, x.days, (d) => d.weight, today);
      // Son datos de adherencia (el coach no puede "arreglarlos"): van en gris, no en amarillo
      if (eats(c) && F.n - F.k >= 2) add("i", `Registró comida ${F.k} de ${F.n} días de esta semana`, "comida");
      if (W.n >= 3 && W.k < Math.ceil((W.n * 3) / 7)) add("i", `Se pesó ${W.k} de ${W.n} días de esta semana`, "resumen");
    }
  }
  const order = { r: 0, y: 1, i: 2 };
  return A.sort((a, b) => order[a.c] - order[b.c]);
}
export const levelOf = (A) => (A.some((a) => a.c === "r") ? "r" : A.some((a) => a.c === "y") ? "y" : "g");
export const checkinDayTxt = (c) => (c.checkinDay != null && c.checkinDay !== "" ? DAYS[+c.checkinDay] : "—");
