// Bienvenida para clientes nuevos: se abre sola la primera vez y se puede volver a ver desde Más.
// El coach configura el video, el mensaje y el link al manual en Biblioteca → "Bienvenida".
import { db } from "./db.js";
import { S, refresh } from "./state.js";
import { act, sheet, closeSheet } from "./ui.js";
import { esc, fmtDate, embedUrl, DAYS, LS } from "./util.js";
import { has } from "./features.js";
import { pushReady } from "./push.js";

const SVC = { completa: "Coaching 1-1 (entrenamiento + nutrición)", entrenamiento: "Asesoría de entrenamiento", nutricion: "Asesoría de nutrición" };
let OB = { i: 0, cfg: {} };

function steps() {
  const c = S.client || {}, cfg = OB.cfg, first = (c.name || "").split(" ")[0], emb = embedUrl(cfg.videoUrl);
  const inc = [
    has("plan_menus") && "Tu plan de alimentación por opciones, con reemplazos y lista de compras",
    has("macro_guide") && "Tu guía de macros en rangos según tu peso",
    has("food_log") && "Registro de comidas con buscador, código de barras y voz",
    has("train_coach") && "Tus rutinas, con lo que tienes que hacer en cada serie",
    has("train_self") && "Un espacio para armar y registrar tus propias rutinas",
    has("train_suggest") && "Sugerencias para subir o mantener el peso de cada ejercicio",
    has("checkin") && "Check-in semanal y mi retroalimentación",
    "Agua, peso, sueño, pasos, fotos y medidas"
  ].filter(Boolean);
  const out = [
    { t: `¡Bienvenido${c.sex === "F" ? "a" : ""}, ${esc(first) || "a IMA"}!`, h: `<div class="ob-hero"><img src="icons/logo.png?v=ima2" alt=""><b>INTELIGENCIA MUSCULAR APLICADA</b></div>
      ${emb ? `<div class="video"><iframe src="${emb}" allowfullscreen></iframe></div>` : cfg.videoUrl ? `<a class="btn primary block" target="_blank" href="${esc(cfg.videoUrl)}">▶ Ver video de bienvenida</a>` : ""}
      <p>${esc(cfg.text || "Esta es tu app de asesoría. Aquí vas a tener tu plan, vas a registrar tu día y tus entrenamientos, y vamos a conversar cada semana en tu check-in. Te muestro en 1 minuto cómo funciona.")}</p>` },
    { t: "Tu asesoría", h: `<p><b>${SVC[c.service] || SVC.completa}</b>${c.startDate ? ` · desde el ${fmtDate(c.startDate, true)}` : ""}</p><p class="muted small">Esto es lo que tienes en la app:</p><ul class="ob-list">${inc.map((x) => `<li>${x}</li>`).join("")}</ul>` },
    { t: "Instálala y activa los avisos", h: `<ol class="ob-list"><li><b>Android:</b> en Chrome, menú ⋮ → <i>Agregar a la pantalla principal</i>.</li><li><b>iPhone:</b> en Safari, Compartir → <i>Agregar a inicio</i>.</li><li>Ábrela siempre desde el ícono. Funciona sin señal: lo que anotes se sube solo al volver la conexión.</li></ol>
      <p class="muted small">Los avisos te recuerdan registrar comidas, agua, peso, pasos, entrenamiento y check-in.</p>
      ${!S.preview && pushReady() ? `<button class="btn primary block" data-a="pushOn">Activar avisos</button>` : ""}<p class="muted small">Puedes ajustar los horarios en Más → Ajustes.</p>` },
    { t: "Tu día a día", h: `<p>La regla de oro: <b>registra al momento</b>. Dura segundos y no se te olvida.</p><ul class="ob-list">
      ${has("food_log") ? "<li><b>Comida:</b> pestaña Comida → +. Busca, escanea o dícta lo que comiste.</li>" : ""}
      <li><b>Peso:</b> en ayunas y después de ir al baño, al menos 3 veces por semana.</li>
      <li><b>Agua, sueño y pasos:</b> desde las tarjetas del inicio.</li>
      <li>La <b>campana</b> de arriba te dice qué te falta hoy.</li></ul>
      <p class="muted small">Si se te olvida un día, tócalo en la tira de días y complétalo.</p>` }
  ];
  if (has("train_tab")) out.push({ t: "Tus entrenamientos", h: `<ul class="ob-list">
      ${has("train_self") ? "<li>En <b>Entreno → Crear rutina</b> arma tus rutinas y elige qué días las haces.</li>" : "<li>En <b>Entreno</b> ves qué rutina toca cada día. Si cambio algo, te aparece marcado en rojo.</li>"}
      <li>Toca <b>Empezar</b> y anota peso, repeticiones y RIR de cada serie. Al lado ves lo que hiciste la semana pasada.</li>
      ${has("train_tech") ? "<li>Marca tu técnica: <b>la técnica va antes que el peso</b>.</li>" : ""}
      ${has("train_setvideo") ? "<li>Grábate y mándame por WhatsApp el video de tu ejecución, para revisar tu técnica e intensidad.</li>" : ""}
      <li>Al terminar, responde la encuesta corta y comparte tu resumen.</li></ul>` });
  if (has("checkin")) out.push({ t: "Tu check-in semanal", h: `<p>Cada <b>${c.checkinDay != null && c.checkinDay !== "" ? DAYS[+c.checkinDay].toLowerCase() : "semana"}</b> me cuentas cómo te fue en <b>Progreso → Check-in</b> y subes tus fotos.</p><p>Yo reviso todo y te respondo: te llega como <b>“Tu coach respondió tu check-in”</b> en el inicio.</p>` });
  out.push({ t: "¡Listo!", h: `<p>Eso es todo. Cualquier duda me escribes por WhatsApp.</p>${cfg.manualUrl ? `<a class="btn block" target="_blank" href="${esc(cfg.manualUrl)}">Ver el manual completo</a>` : ""}<p class="muted small">Puedes volver a ver esta bienvenida en Más → Bienvenida a IMA.</p>` });
  return out;
}
function show() {
  const st = steps(), i = Math.max(0, Math.min(OB.i, st.length - 1)), s = st[i];
  sheet(s.t, `<div class="ob">${s.h}</div><div class="ob-dots">${st.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
    <div class="row gap"><button class="btn grow" data-a="obGo" data-n="-1" ${i === 0 ? "disabled" : ""}>Atrás</button>
    ${i < st.length - 1 ? `<button class="btn primary grow" data-a="obGo" data-n="1">Siguiente</button>` : `<button class="btn primary grow" data-a="obDone">Empezar a usar IMA</button>`}</div>`, { full: true });
}
export async function openOnboarding() {
  OB = { i: 0, cfg: (await db.get("library/onboarding").catch(() => null)) || {} };
  show();
}
// Primera vez: se abre sola (no en la vista previa del coach)
export async function maybeOnboard() {
  if (S.preview || !S.cid || LS.get("onb:" + S.cid) || document.querySelector(".sheet-bg")) return;
  const d = await db.get(`clients/${S.cid}/settings/onboarding`).catch(() => null);
  if (d?.done) return LS.set("onb:" + S.cid, "1");
  openOnboarding();
}
act("obGo", (el) => { OB.i += +el.dataset.n; show(); });
act("obDone", async () => {
  if (!S.preview) { await db.set(`clients/${S.cid}/settings/onboarding`, { done: true, at: Date.now() }); LS.set("onb:" + S.cid, "1"); }
  closeSheet(); refresh();
});
act("obOpen", () => openOnboarding());
