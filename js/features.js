// Qué incluye cada tipo de asesoría. El coach lo ajusta con casillas en Biblioteca → "Servicios";
// los valores de abajo son los de fábrica. La app del cliente muestra u oculta cada función según esto.
import { db } from "./db.js";
import { S } from "./state.js";

export const SVC_COLS = [["completa", "Coaching 1-1"], ["entrenamiento", "Entrenamiento"], ["nutricion", "Nutrición"]];
const T = [1, 1, 1], E = [1, 1, 0], N = [1, 0, 1], O = [0, 1, 0], X = [0, 0, 1];
// [grupo, clave, nombre, descripción, [1-1, entrenamiento, nutrición]]
export const FEATURES = [
  ["Inicio", "home_kcal", "Calorías y macros del día", "Barras de calorías, carbohidratos, grasas y proteína", T],
  ["Inicio", "home_water", "Agua", "Registro y meta de agua", T],
  ["Inicio", "home_steps", "Pasos", "Pasos del día y de ayer", T],
  ["Inicio", "home_sleep", "Sueño", "Hora de acostarse, despertar y calidad", T],
  ["Inicio", "home_weight", "Peso corporal", "Pesaje en ayunas y tendencia", T],
  ["Inicio", "home_cardio", "Cardio", "Sesiones de cardio de la semana", T],
  ["Inicio", "home_digest", "Digestión", "Deposiciones y molestias", T],
  ["Inicio", "home_train", "Entrenamiento del día", "Qué rutina toca hoy", T],
  ["Inicio", "feedback", "Retroalimentación del coach", "Respuesta al check-in con puntos clave y video", T],
  ["Alimentación", "food_log", "Registro de comidas", "Buscador, código de barras, voz, fotos de comida", T],
  ["Alimentación", "plan_menus", "Plan de alimentación por opciones", "Opciones de día completo con reemplazos por grupo", N],
  ["Alimentación", "plan_pdf", "Plan en PDF y notas", "Link al PDF del plan e indicaciones", N],
  ["Alimentación", "plan_pauta", "Pauta por porciones", "Porciones por grupo que se descuentan al registrar", N],
  ["Alimentación", "plan_shop", "Lista de compras", "Suma los alimentos de las opciones del plan", N],
  ["Alimentación", "macro_guide", "Guía de macros en rangos", "Rangos por kg de peso en vez de plan (ej. proteína 1,6–2,2 g/kg)", O],
  ["Entrenamiento", "train_tab", "Registro de entrenamiento", "Semana, sesión, series, descanso y resumen", T],
  ["Entrenamiento", "train_coach", "Rutinas diseñadas por el coach", "Plan semanal con rutinas, cambios marcados en rojo", E],
  ["Entrenamiento", "train_self", "El cliente diseña sus rutinas", "Arma sus rutinas con la biblioteca de ejercicios", X],
  ["Entrenamiento", "train_tips", "Tips de ejecución", "Indicaciones de cada ejercicio y su configuración de máquina", T],
  ["Entrenamiento", "train_videos", "Videos de los ejercicios", "Video de técnica de tu canal", E],
  ["Entrenamiento", "train_targets", "Rangos de repeticiones y RIR", "Lo que tiene que hacer en cada serie", E],
  ["Entrenamiento", "train_suggest", "Sugerencias de carga", "Subir, mantener o bajar el peso según cómo le fue", E],
  ["Entrenamiento", "train_tech", "Evaluación de técnica", "Mejor / igual / peor que la semana pasada", E],
  ["Entrenamiento", "train_setvideo", "Videos de sus series (vía WhatsApp)", "Te manda por WhatsApp videos de su ejecución; en cada ejercicio la app se lo recuerda", E],
  ["Entrenamiento", "train_audio", "Audio para el coach", "Audio al terminar la sesión", E],
  ["Progreso", "prog_timeline", "Timeline y etapas", "Calendario nutricional semana a semana", T],
  ["Progreso", "prog_photos", "Fotos de progreso", "Fotos por semana y comparador", T],
  ["Progreso", "prog_measures", "Medidas corporales", "Perímetros una vez al mes", T],
  ["Progreso", "checkin", "Check-in semanal", "Formulario semanal dentro de la app", T],
  ["Más", "guides", "Guías", "Tus guías en PDF", T],
  ["Más", "equipment", "Mi equipamiento", "Fotos de las máquinas de su gimnasio", E],
  ["Más", "reminders", "Recordatorios", "Avisos de comidas, agua, peso, pasos y entrenamiento", T]
];
const IDX = { completa: 0, entrenamiento: 1, nutricion: 2 };
export const defaultOf = (key, svc) => { const f = FEATURES.find((x) => x[1] === key); return f ? !!f[4][IDX[svc] ?? 0] : true; };

let MX = null; // casillas del coach (library/services)
export async function loadMatrix(force) { if (!MX || force) MX = (await db.get("library/services").catch(() => null))?.matrix || {}; return MX; }
export const matrix = () => MX || {};
// ¿El cliente que se está viendo tiene esta función?
export function has(key, c = S.client) {
  const svc = c?.service || "completa", m = MX?.[key]?.[svc];
  return m != null ? !!m : defaultOf(key, svc);
}
