// Pendientes del coach por cliente: rojo = urgente · amarillo = pendiente · gris = informativo
import { db } from "./db.js";
import { S } from "./state.js";
import { ymd, addDays, weekInfo, diffDays, fmtDate, DAYS } from "./util.js";
import { getRoutines, getSessions, getDays } from "./data.js";
import { weekPlan, reviewWindow } from "./data.js";

export const SERVICES = { completa: "Coaching 1-1", entrenamiento: "Entrenamiento", nutricion: "Nutrición" };
export const SERVICE_GROUPS = [["completa", "Coaching 1-1"], ["entrenamiento", "Entrenamiento"], ["nutricion", "Nutrición"], ["", "Sin definir"]];
const trains = (c) => ["completa", "entrenamiento"].includes(c.service);
const eats = (c) => ["completa", "nutricion"].includes(c.service);
export const emailKey = (e) => String(e || "").trim().toLowerCase();

// Carga lo necesario para revisar a un cliente
export async function loadCtx(c) {
  const today = ymd();
  const [routines, sessions, days, checkins, feedbacks, fbreplies, access, onb] = await Promise.all([
    getRoutines(c.id), getSessions(c.id), getDays(addDays(today, -6), today, c.id),
    db.list(`clients/${c.id}/checkins`), db.list(`clients/${c.id}/feedbacks`), db.list(`clients/${c.id}/fbreplies`),
    c.email ? db.get("access/" + emailKey(c.email)).catch(() => null) : null,
    db.get(`clients/${c.id}/settings/onboarding`).catch(() => null)
  ]);
  return { routines, sessions, days, checkins, feedbacks, fbreplies, access, onb };
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
  const miss = [["sex", "sexo"], ["birth", "fecha de nacimiento"], ["height", "estatura"]].filter(([k]) => !c[k]).map(([, l]) => l);
  if (miss.length) add("y", "Faltan datos: " + miss.join(", "));
  if (c.service === "nutricion" && active && !x.routines.length) add("i", "Aún no arma sus rutinas en la app", "rutinas");
  if (trains(c)) {
    if (!x.routines.length) add("r", "Falta su plan de entrenamiento (rutinas)", "rutinas");
    else if (!Object.values(c.schedule || {}).some(Boolean)) add("y", "Falta el calendario semanal: qué rutina toca cada día", "rutinas");
    const rv = reviewWindow(c, x.routines, x.sessions);
    if (rv?.open && !rv.done) add(today === rv.w.last ? "r" : "y", `Revisa su rutina para la semana ${rv.next.n} (parte el ${fmtDate(rv.next.first)})`, "rutinas");
  }
  if (eats(c)) {
    if (!c.kcal || !c.prot) add("r", "Faltan los objetivos de calorías y macros");
    if (!(c.menus || []).length && !c.plan?.pdfUrl && !c.planPdf) add("r", "Falta su plan de alimentación", "plan");
    else if (!(c.menus || []).length) add("y", "Su plan está solo en PDF: pásalo a la app", "plan");
    if (!c.pauta || !Object.keys(c.pauta).length) add("y", "Falta la pauta por porciones");
  }
  if (c.service === "entrenamiento" && !c.ranges) add("i", "Guía de macros por defecto (1,6–2,2 g/kg de proteína)");
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
  if (c.payDate) { const d = diffDays(c.payDate, today); if (d < 0) add("r", `Pago vencido desde el ${fmtDate(c.payDate)}`); else if (d === 0) add("r", "Hoy le toca pagar"); else if (d <= 3) add("y", `Le toca pagar el ${fmtDate(c.payDate)}`); }
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
    if (active && !c.checkinForm && prev.n >= 1 && !ci[prev.key]) add("y", `No ha enviado el check-in de la semana ${prev.n}`, "checkins");
    if (c.checkinForm && c.checkinDay != null && new Date().getDay() === +c.checkinDay) add("i", "Hoy le toca el check-in por formulario", "checkins");
    if (active && trains(c)) {
      const plan = weekPlan(c, x.routines, x.sessions);
      const late = plan.slots.filter((s) => s.status === "atrasado").length;
      if (late) add("y", `${late} entrenamiento${late > 1 ? "s" : ""} atrasado${late > 1 ? "s" : ""} esta semana`, "entrenos");
      const wk = x.sessions.filter((s) => s.status === "fin" && s.weekKey === w.key);
      if (wk.some((s) => s.survey?.articular === "si")) add("r", "Reportó molestia articular", "entrenos");
      if (wk.some((s) => s.exercises?.some((e) => e.tech === "peor" || e.sets?.some((y) => y.tech === "peor")))) add("y", "Técnica peor en algún ejercicio", "entrenos");
      const seen = c.seen?.entrenos || 0, nuevos = x.sessions.filter((s) => s.status === "fin" && !s.imported && (s.endedAt || 0) > seen).length;
      if (nuevos) add("i", `${nuevos} entrenamiento${nuevos > 1 ? "s" : ""} nuevo${nuevos > 1 ? "s" : ""} para revisar`, "entrenos");
    }
    if (active) {
      const d7 = Object.values(x.days), elapsed = Math.min(7, diffDays(today, c.startDate) + 1);
      const food = d7.filter((d) => Object.values(d.meals || {}).some((m) => m.length)).length, wts = d7.filter((d) => d.weight).length;
      if (eats(c) && elapsed >= 3 && food < Math.min(3, elapsed)) add("y", `Registró comida solo ${food} de los últimos 7 días`, "comida");
      if (elapsed >= 4 && wts < 3) add("y", `Solo ${wts} pesaje${wts === 1 ? "" : "s"} en los últimos 7 días`, "resumen");
    }
  }
  const order = { r: 0, y: 1, i: 2 };
  return A.sort((a, b) => order[a.c] - order[b.c]);
}
export const levelOf = (A) => (A.some((a) => a.c === "r") ? "r" : A.some((a) => a.c === "y") ? "y" : "g");
export const checkinDayTxt = (c) => (c.checkinDay != null && c.checkinDay !== "" ? DAYS[+c.checkinDay] : "—");
