// Acceso a datos del cliente + lógica de entrenamiento compartida (cliente y coach)
import { db } from "./db.js";
import { S } from "./state.js";
import { ymd, addDays, weekInfo, e1rm, uid } from "./util.js";
import { REAL_FOODS, realToFood } from "./realfoods.js";

const C = (cid = S.cid) => "clients/" + cid;
export const dayPath = (date, cid) => `${C(cid)}/days/${date}`;
export const getDay = async (date, cid) => (await db.get(dayPath(date, cid))) || {};
export const setDay = (date, data, cid) => db.set(dayPath(date, cid), data);
export async function getDays(from, to, cid) {
  const all = await db.list(C(cid) + "/days");
  return Object.fromEntries(all.filter((d) => d.id >= from && d.id <= to).map((d) => [d.id, d]));
}
export const getRoutines = async (cid) => (await db.list(C(cid) + "/routines")).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
export const getSessions = async (cid) => (await db.list(C(cid) + "/sessions")).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
export const getClient = async (cid) => (await db.get(C(cid))) || {};

// Base de alimentos: semilla + importados por el coach
let foodCache = null;
export async function getFoodBase() {
  if (foodCache) return foodCache;
  // Registro con aporte REAL por 100 g (USDA en español) + alimentos que agregue el coach
  const lib = await db.get("library/foods");
  const extra = (lib?.items || []).map((f, i) => ({ ...f, id: f.id || "l" + i, src: "base" }));
  return (foodCache = [...extra, ...REAL_FOODS.map(realToFood)]);
}
export const resetFoodCache = () => (foodCache = null);

// ---------- Semana de entrenamiento: qué toca y en qué estado está
// schedule: { "1": routineId, "2": routineId, ... } (0=domingo)
export function weekPlan(client, routines, sessions, date = ymd()) {
  const w = weekInfo(client, date);
  const today = ymd();
  const sched = client.schedule || {};
  const done = sessions.filter((s) => s.weekKey === w.key && s.status === "fin");
  const used = new Set();
  const slots = w.days.map((d) => {
    const rid = sched[new Date(d + "T12:00").getDay()];
    if (!rid) return { date: d, rest: true };
    const r = routines.find((x) => x.id === rid);
    const s = done.find((x) => x.routineId === rid && !used.has(x.id));
    if (s) used.add(s.id);
    const status = s ? "hecho" : d === today ? "hoy" : d < today ? "atrasado" : "proximo";
    return { date: d, rid, name: r?.name || "Rutina", status, session: s };
  });
  const planned = slots.filter((s) => !s.rest);
  return { week: w, slots, planned, doneCount: planned.filter((s) => s.status === "hecho").length };
}

// Sesión de la semana anterior (misma rutina) para comparar
export function prevSession(sessions, s) {
  return sessions.filter((x) => x.routineId === s.routineId && x.status === "fin" && x.weekKey < s.weekKey).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0] || null;
}
export const refSet = (prev, exId, j) => prev?.exercises?.find((e) => e.exId === exId)?.sets?.[j] || null;

// Crea una sesión nueva a partir de la rutina
export function newSession(client, routine, date = ymd()) {
  return {
    id: uid(), routineId: routine.id, routineName: routine.name, date, weekKey: weekInfo(client, date).key,
    startedAt: Date.now(), status: "curso",
    exercises: routine.exercises.map((e) => ({
      exId: e.id, name: e.name, video: e.video || "", inc: e.inc || 2.5, rest: e.rest || null, notes: e.notes || "",
      target: e.sets || [], alts: e.alts || [], changed: !!e.changed,
      sets: (e.sets || []).map(() => ({ w: "", r: "", rir: "", note: "", done: false })), tech: ""
    }))
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
  if (rir === "F" || (rg && r < rg.lo)) return { a: "baja", why: rir === "F" ? "llegaste al fallo" : "no alcanzaste las reps" };
  if (rg && ((r >= rg.hi && rir != null && +rir > tr) || r > rg.hi)) return { a: "sube", why: "te sobró margen" };
  return { a: "mant", why: "" };
}
// Mensaje bajo el ejercicio: durante la sesión habla de la serie siguiente;
// al completar la última, resume qué hacer la próxima semana serie por serie.
export function suggest(ex, j) {
  const v = setVerdict(ex, j); if (!v) return null;
  const last = j >= ex.sets.length - 1;
  if (!last) {
    const t = ex.target[j] || {}, nt = ex.target[j + 1] || t, s = ex.sets[j];
    const heavier = range(nt.reps) && range(t.reps) && range(nt.reps).hi < range(t.reps).lo; // la siguiente pide menos reps
    let a = v.a;
    if (a === "mant" && heavier && s.tech !== "peor") a = "sube";
    const txt = { sube: "sube el peso (salto mínimo)", mant: "mantén el peso", baja: "baja el peso" }[a];
    return { a, last: false, text: `Serie ${j + 2}: ${txt}`, why: v.why };
  }
  const per = ex.sets.map((_, k) => setVerdict(ex, k));
  const words = { sube: "sube (salto mínimo)", mant: "mantén", baja: "baja" };
  const items = per.map((x, k) => (x ? `Serie ${k + 1}: ${words[x.a]}` : null)).filter(Boolean);
  const worst = per.some((x) => x?.a === "baja") ? "baja" : per.some((x) => x?.a === "sube") ? "sube" : "mant";
  const tech = ex.sets.some((x) => x.tech === "peor");
  return { a: worst, last: true, text: "Próxima semana", items, why: tech ? "Alguna serie salió con peor técnica: no subas peso ahí hasta afirmarla." : "" };
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
export const PHASES = { "Déficit leve": "#e0484e", "Déficit moderado": "#c3242b", "Déficit agresivo": "#8e1b1f", "Mini cut": "#b0263a", "Mantención": "#7d7d86", "Recomposición corporal": "#3b82f6", "Dieta reversa": "#d6a21e", "Superávit / Volumen": "#22a35a" };
export const phaseColor = (p) => PHASES[p] || "#6b6b72";
export function stageAt(c, date) {
  const n = weekInfo(c, date).n;
  return (c.stages || []).find((s) => n >= +s.from && n <= +s.to) || null;
}
// Objetivos vigentes en una fecha: los de la etapa (si hay) sobre los generales del cliente
export function applyStage(c, date = ymd()) {
  const s = stageAt(c, date); if (!s) return c;
  const o = { ...c, phase: s.phase || c.phase, stage: s };
  for (const k of ["kcal", "cho", "fat", "prot", "steps", "water"]) if (s[k] !== "" && s[k] != null) o[k] = +s[k];
  return o;
}
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
export const CHECKIN = [
  { t: "Entrenamiento", q: [
    ["todos", "¿Hiciste todos los entrenamientos que te correspondían?", ["Sí", "Casi todos", "No"]],
    ["otroDeporte", "¿Hiciste otro deporte o actividad física aparte de lo planificado?", ["No", "Sí"], "¿Cuál y cuánto?"],
    ["progCarga", "¿Hubo progreso de carga/repeticiones esta semana?", ["Más carga/reps", "Igual", "Menos carga/reps"]],
    ["progTec", "¿Hubo progreso de técnica esta semana?", ["Sí, mejoró", "Se mantuvo", "Empeoró"]],
    ["entGeneral", "¿Cómo estuvieron los entrenamientos en general?", Q5],
    ["motivEnt", "Disposición a entrenar / motivación", L5],
    ["fuerza", "Fuerza y rendimiento", L5],
    ["doms", "DOMS / dolor muscular post entrenamiento", ["Nada", "Leve", "Moderado", "Alto", "Muy alto"]],
    ["articular", "¿Hubo dolor articular durante los entrenamientos?", ["Nada", "Leve", "Moderado", "Alto"], "¿Dónde y en qué ejercicio?"],
    ["comEnt", "Comentarios", "text"],
    ["top1", "Mejor levantamiento/serie · Top 1", "line"], ["top2", "Top 2", "line"], ["top3", "Top 3", "line"], ["peor", "El peor", "line"]
  ] },
  { t: "Nutrición", q: [
    ["cintura", "Circunferencia de cintura en ayunas, altura del ombligo (cm)", "num"],
    ["adhPlan", "¿Qué tanto pudiste seguir el plan de alimentación?", ["Menos del 50%", "50–70%", "70–90%", "Más del 90%"]],
    ["motivNut", "Motivación para tomar buenas decisiones alimentarias", L5],
    ["contribuyen", "¿Sientes que las decisiones que tomaste contribuyen a lograr tus objetivos?", ["Sí", "Más o menos", "No"]],
    ["hambre", "Hambre durante la semana", ["Poca", "Normal", "Mucha"]],
    ["saciedad", "Saciedad después de comer", ["Poca", "Normal", "Mucha"]],
    ["antojos", "Antojos durante la semana", ["No tuve", "Pocos", "Varios", "Muchos"]],
    ["fueraPlan", "Si tuviste comidas fuera de plan, cuéntame cuántas fueron y en qué contexto, junto con cualquier otra novedad de la alimentación", "text"],
    ["comNut", "Comentarios", "text"]
  ] },
  { t: "Encuesta de tendencia de consumo", freq: true, q: ["Frutas", "Verduras", "Lácteos", "Carne/Pollo/Cerdo", "Pescado/Mariscos", "Legumbres", "Huevo", "Frutos secos", "Semillas", "Ultraprocesados", "Mayo/Mantequilla/Margarina", "Azúcar de mesa", "Embutidos", "Alcohol"].map((f) => ["f_" + f, f, FREQ]).concat([["comFreq", "Comentarios", "text"]]) },
  { t: "Digestión", q: [
    ["depos", "Deposiciones por día (promedio de la semana)", ["0", "1", "2", "3 o más"]],
    ["bristol", "¿Cómo fueron tus deposiciones?", ["Duras", "Normales", "Blandas", "Líquidas"]],
    ["digest", "Digestión en general", Q5],
    ["comDig", "Molestias o síntomas intestinales", "text"]
  ] },
  { t: "Recuperación, rendimiento y energía", q: [
    ["enerSes", "Niveles de energía durante las sesiones", L5],
    ["enerFuera", "Niveles de energía fuera de las sesiones", L5],
    ["recup", "¿Te sientes lo suficientemente recuperado de una sesión a otra?", ["Sí", "Más o menos", "No"]],
    ["salud", "¿Cómo te sentiste de salud en general?", Q5],
    ["resfrio", "¿Hubo algún signo de resfrío o enfermedad esta semana?", ["Todo bien", "Síntomas leves", "Me enfermé"]],
    ["comRec", "Comentarios", "text"]
  ] },
  { t: "Estrés y ánimo", q: [
    ["estEmo", "Estrés emocional", L5], ["estFis", "Estrés físico", L5], ["estLab", "Estrés laboral/profesional", L5], ["estGen", "Estrés en general", L5],
    ["animo", "Ánimo en general", Q5], ["comEst", "Comentarios", "text"]
  ] },
  { t: "Sintomatología", q: [
    ["sintomas", "¿Has tenido alguno de estos síntomas durante la última semana?", { multi: ["Dolores de cabeza", "Debilidad/fatiga sin motivo aparente", "Mareos o visión borrosa", "Adormecimiento de extremidades", "Calambres", "Disnea (falta de aire)", "Náuseas o vómitos", "Diarrea", "Estreñimiento", "Distensión abdominal (hinchazón)", "Flatulencias (gases excesivos)", "Pérdida de apetito", "Cambios de ánimo", "Insomnio", "Dificultad para concentrarse", "Irritabilidad excesiva", "Alergias", "Acné", "Picazón"] }],
    ["comSin", "Comentarios", "text"]
  ] },
  { t: "Autoanálisis", q: [
    ["orgullo", "Cosas que quieras destacar de esta semana. ¿De qué te sientes orgulloso?", "text"],
    ["dificil", "¿Hay algo que se te haya dificultado más durante esta semana?", "text"],
    ["mejorar", "¿Hay algo que desees mejorar para la semana que viene?", "text"]
  ] },
  { t: "Experiencia con la asesoría", q: [
    ["expProg", "¿Cómo te sientes con el progreso que hemos tenido?", Q5],
    ["expResp", "¿Cómo evaluarías mi tiempo de respuesta esta semana?", Q5],
    ["expRetro", "¿Cómo evaluarías la retroalimentación esta semana?", Q5],
    ["expServ", "¿Qué te ha parecido el servicio en general esta semana?", Q5],
    ["sugerencia", "¿Tienes alguna sugerencia para mejorar tu experiencia con la asesoría?", "text"]
  ] },
  { t: "Consultas / dudas", q: [
    ["consultas", "¿Necesitas algo en específico de mi esta semana? ¿Dudas sobre tu plan de entrenamiento o de alimentación?", "text"]
  ] }
];
