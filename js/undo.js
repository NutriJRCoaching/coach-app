// Panel del coach: guardado automático + Deshacer / Rehacer (como Ctrl+Z en Excel).
// Cada editor (plan de alimentación, rutina) se registra como "fuente" con:
//   ctx()        → el objeto en edición (MW, RE) o null si no hay nada abierto
//   key(ctx)     → qué se está editando (cliente + etapa / rutina)
//   snap(ctx)    → los datos que importan (sin estado de pantalla)
//   apply(ctx,s) → vuelve a poner esos datos (deshacer)
//   save(ctx)    → guarda en Firestore sin re-dibujar la pantalla
// Después de cada acción del panel se compara con la foto anterior: si cambió, se apila para deshacer y se guarda solo
// a los 1,2 s. Si se cambia de rutina/etapa/cliente o se cierra la pestaña antes, se guarda en ese momento.
import { toast } from "./ui.js";
const SRC = {}, BASE = {}, UNDO = [], REDO = [], PEND = new Map();
let timer = null, saving = 0, lastErr = false;
// Foto comparable: claves ordenadas (Firestore devuelve los mapas en otro orden) y sin la marca interna "changed" que pone el guardado
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().filter((k) => k !== "changed" && v[k] !== undefined).map((k) => [k, canon(v[k])])) : v;
const J = (x) => JSON.stringify(canon(x));

export function undoSource(name, def) { SRC[name] = def; }
// Olvidar lo pendiente de una fuente (ej. se eliminó la rutina: que no se vuelva a crear al guardar)
export function forget(name) { PEND.delete(name); BASE[name] = null; for (const L of [UNDO, REDO]) for (let i = L.length - 1; i >= 0; i--) if (L[i].name === name) L.splice(i, 1); bar(); }

function current(name) {
  const s = SRC[name], ctx = location.hash.startsWith("#coach") ? s.ctx() : null;
  return ctx ? { ctx, key: s.key(ctx), json: J(s.snap(ctx)) } : null;
}
export function track() {
  for (const name of Object.keys(SRC)) {
    const b = BASE[name], c = current(name);
    // Se fue de esa rutina/etapa/cliente (o se recargó desde el servidor): guardar ya lo pendiente
    if (b && PEND.has(name) && (!c || c.key !== b.key || c.ctx !== b.ctx)) doSave(name, PEND.get(name));
    // Solo cuenta como cambio si es el MISMO objeto en edición (una recarga desde el servidor no es un cambio tuyo)
    if (b && c && c.key === b.key && c.ctx === b.ctx && c.json !== b.json) { UNDO.push({ name, key: b.key, json: b.json }); REDO.length = 0; if (UNDO.length > 80) UNDO.shift(); PEND.set(name, c.ctx); schedule(); }
    BASE[name] = c;
  }
  bar();
}
// Después de guardar, lo guardado es la nueva foto (el guardado puede agregar datos, ej. el peso de las metas)
export function rebase(name) { const c = current(name); if (c && BASE[name]?.key === c.key) BASE[name] = c; }
function schedule() { clearTimeout(timer); timer = setTimeout(flush, 1200); bar(); }
export function flush() { clearTimeout(timer); for (const [name, ctx] of PEND) doSave(name, ctx); }
async function doSave(name, ctx) {
  PEND.delete(name); saving++; bar();
  try { await SRC[name].save(ctx); lastErr = false; rebase(name); }
  catch (e) { lastErr = true; console.error(e); toast("No se pudo guardar: revisa tu conexión", 4000); }
  finally { saving--; bar(); }
}
// Deshacer / rehacer solo lo que está abierto en pantalla
function step(from, to) {
  for (let i = from.length - 1; i >= 0; i--) {
    const e = from[i], c = current(e.name); if (!c || c.key !== e.key) continue;
    from.splice(i, 1); to.push({ name: e.name, key: e.key, json: c.json });
    SRC[e.name].apply(c.ctx, JSON.parse(e.json));
    BASE[e.name] = { ...c, json: e.json }; PEND.set(e.name, c.ctx); schedule(); return true;
  }
  return false;
}
export function undo() { if (!step(UNDO, REDO)) toast("No hay nada que deshacer aquí"); }
export function redo() { if (!step(REDO, UNDO)) toast("No hay nada que rehacer"); }
const canStep = (list) => list.some((e) => current(e.name)?.key === e.key);

// Barra flotante: Deshacer · Rehacer · estado del guardado
function bar() {
  let el = document.getElementById("undobar");
  const active = Object.keys(SRC).some((n) => current(n));
  if (!active) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement("div"); el.id = "undobar";
    el.innerHTML = `<button type="button" data-u="undo" title="Deshacer (Ctrl+Z)">↶ Deshacer</button><button type="button" data-u="redo" title="Rehacer (Ctrl+Y)">↷</button><span class="ust"></span>`;
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-u]"); if (b) b.dataset.u === "undo" ? undo() : redo(); });
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.querySelector('[data-u="undo"]').disabled = !canStep(UNDO);
  el.querySelector('[data-u="redo"]').disabled = !canStep(REDO);
  el.querySelector(".ust").textContent = saving || PEND.size ? "Guardando…" : lastErr ? "⚠ Sin guardar" : "Guardado ✓";
  el.querySelector(".ust").className = "ust " + (saving || PEND.size ? "busy" : lastErr ? "err" : "ok");
}

// Ctrl+Z / Ctrl+Y (Cmd en Mac). Dentro de un campo de texto, Ctrl+Z sigue siendo el deshacer normal del campo.
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || !location.hash.startsWith("#coach")) return;
  const t = e.target, typing = t?.matches?.("input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable]");
  const k = e.key.toLowerCase(); if (typing) return;
  if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
});
window.addEventListener("hashchange", () => setTimeout(track, 50));
document.addEventListener("rendered", () => track()); // después de dibujar (ahí se cargan el plan o la rutina en edición)
window.addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
window.addEventListener("beforeunload", (e) => { if (PEND.size || saving) { flush(); e.preventDefault(); e.returnValue = ""; } });
