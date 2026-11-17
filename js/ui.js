// Ayudas de interfaz: acciones, toasts, hojas modales y gráficos
import { esc } from "./util.js";

const actions = {};
export const act = (name, fn) => (actions[name] = fn);
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Cualquier elemento con data-a="nombre" ejecuta la acción registrada
for (const type of ["click", "change", "input"]) {
  document.addEventListener(type, (e) => {
    const el = e.target.closest(`[data-a${type === "click" ? "" : "-" + type}]`);
    if (!el) return;
    const name = el.dataset[type === "click" ? "a" : "a" + type[0].toUpperCase() + type.slice(1)];
    if (actions[name]) { if (type === "click" && el.tagName === "A" && !el.href) e.preventDefault(); actions[name](el, e); }
  });
}

export function toast(msg, ms = 2200) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
}

// Hoja inferior (móvil) / modal (escritorio)
export function sheet(title, html, { wide = false, onClose } = {}) {
  closeSheet();
  const w = document.createElement("div"); w.className = "sheet-bg"; w.id = "sheet";
  w.innerHTML = `<div class="sheet ${wide ? "wide" : ""}"><div class="sheet-h"><b>${esc(title)}</b><button class="icon-btn" data-a="closeSheet" aria-label="Cerrar">✕</button></div><div class="sheet-b">${html}</div></div>`;
  w.addEventListener("click", (e) => { if (e.target === w) closeSheet(); });
  w._onClose = onClose;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add("open"));
  return w.querySelector(".sheet-b");
}
export function closeSheet() { const s = $("#sheet"); if (s) { s._onClose?.(); s.remove(); } }
act("closeSheet", closeSheet);

// Confirmación y texto dentro de la app (no usa ventanas del navegador)
export function confirmBox(msg, ok = "Sí") {
  return new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    const b = sheet("Confirmar", `<p>${esc(msg)}</p><div class="row gap"><button class="btn grow" id="cbNo">Cancelar</button><button class="btn primary grow" id="cbOk">${esc(ok)}</button></div>`, { onClose: () => fin(false) });
    b.querySelector("#cbNo").onclick = () => { closeSheet(); };
    b.querySelector("#cbOk").onclick = () => { fin(true); closeSheet(); };
  });
}
export function promptBox(msg, val = "") {
  return new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    const b = sheet(msg, `<input id="pbI" value="${esc(val)}"><button class="btn primary big" id="pbOk">Aceptar</button>`, { onClose: () => fin(null) });
    const i = b.querySelector("#pbI"); i.focus();
    const ok = () => { fin(i.value.trim() || null); closeSheet(); };
    b.querySelector("#pbOk").onclick = ok; i.onkeydown = (e) => { if (e.key === "Enter") ok(); };
  });
}

// Barra de progreso "llevas X de Y"
export function bar(label, val, goal, unit = "", cls = "") {
  const p = goal ? Math.min(100, (val / goal) * 100) : 0;
  const over = goal && val > goal * 1.05;
  return `<div class="bar ${cls}"><div class="bar-t"><span>${label}</span><span><b>${Math.round(val)}</b>${goal ? ` / ${Math.round(goal)}` : ""} ${unit}</span></div><div class="bar-o"><div class="bar-i ${over ? "over" : ""}" style="width:${p}%"></div></div></div>`;
}

// Gráfico de líneas simple en SVG: series = [{vals:[...], color, dots, dash}]
export function lineChart(labels, series, { h = 180, unit = "" } = {}) {
  const all = series.flatMap((s) => s.vals).filter((v) => v != null);
  if (!all.length) return `<div class="muted small center pad">Aún no hay datos</div>`;
  let mn = Math.min(...all), mx = Math.max(...all); if (mn === mx) { mn -= 1; mx += 1; }
  const padv = (mx - mn) * 0.15; mn -= padv; mx += padv;
  const W = 600, H = h, L = 40, B = 22, n = labels.length;
  const x = (i) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - 10));
  const y = (v) => 8 + (1 - (v - mn) / (mx - mn)) * (H - B - 8);
  let g = "";
  for (let k = 0; k <= 3; k++) { const v = mn + ((mx - mn) * k) / 3; g += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${Math.round(v * 10) / 10}</text>`; }
  const step = Math.max(1, Math.ceil(n / 6));
  labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 4}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
  for (const s of series) {
    let d = "", pen = false;
    s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i)},${y(v)}`; pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.5}" ${s.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
    if (s.dots) s.vals.forEach((v, i) => { if (v != null) g += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"><title>${esc(labels[i])}: ${v}${unit}</title></circle>`; });
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${g}</svg>`;
}

// Selector de opciones tipo "chips"
export function chips(name, options, value, act) {
  return `<div class="chips">${options.map(([v, l, cls]) => `<button type="button" class="chip ${cls || ""} ${String(v) === String(value) ? "on" : ""}" data-a="${act}" data-name="${name}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>`;
}

// Sonido corto (fin del descanso)
export function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.25, c.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.25); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.3); });
  } catch {}
  navigator.vibrate?.([300, 150, 300]);
}
export async function notify(title, body) {
  try {
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: "icons/icon-192.png?v=ima", vibrate: [300, 150, 300] });
    else new Notification(title, { body });
  } catch {}
}
