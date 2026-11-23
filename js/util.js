// Utilidades generales
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const r1 = (n) => Math.round((+n || 0) * 10) / 10;
export const r0 = (n) => Math.round(+n || 0);
export const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
export const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
export const avg = (a) => (a.length ? sum(a) / a.length : null);
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const D1 = ["D", "L", "M", "M", "J", "V", "S"];
export const D3 = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const fmtDate = (s, long) => { const d = parseYmd(s); return long ? `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}` : `${D3[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

// Semana de asesoría: empieza el día en que empezó el cliente
export function weekInfo(client, date = ymd()) {
  const start = client?.startDate || date;
  const n = Math.floor(diffDays(date, start) / 7) + 1;
  const first = addDays(start, (n - 1) * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  return { n, key: "S" + pad(Math.max(n, 0)), first, last: days[6], days };
}
export const weekKeyOf = (client, date) => weekInfo(client, date).key;

// Macros de un ítem de comida
export function itemMacros(it) {
  const f = (+it.g || 0) / 100;
  if (it.per100 === false) return { kcal: +it.kcal || 0, cho: +it.cho || 0, fat: +it.fat || 0, prot: +it.prot || 0 };
  return { kcal: (+it.kcal || 0) * f, cho: (+it.cho || 0) * f, fat: (+it.fat || 0) * f, prot: (+it.prot || 0) * f };
}
export function dayTotals(day) {
  const t = { kcal: 0, cho: 0, fat: 0, prot: 0 };
  for (const items of Object.values(day?.meals || {})) for (const it of items) { const m = itemMacros(it); for (const k in t) t[k] += m[k]; }
  return t;
}
export function sleepHours(s) {
  if (!s?.bed || !s?.wake) return null;
  let [bh, bm] = s.bed.split(":").map(Number), [wh, wm] = s.wake.split(":").map(Number);
  let min = wh * 60 + wm - (bh * 60 + bm); if (min <= 0) min += 1440;
  return Math.max(0, (min - (+s.awake || 0)) / 60);
}
// Colores de sueño (como en el Excel): <6 rojo · 6–7 amarillo · 7–8 verde · 8+ azul
export const sleepColor = (h) => (h == null ? "var(--surf2)" : h < 6 ? "#ef4444" : h < 7 ? "#eab308" : h < 8 ? "#22c55e" : "#3b82f6");

// Estimación de RM con RIR (Epley con repeticiones en reserva)
export const e1rm = (w, r, rir) => (+w || 0) * (1 + ((+r || 0) + (rir == null || rir === "F" ? 0 : +rir)) / 30);

// Comprime una imagen a JPEG (para fotos)
// Achica la foto a JPEG (base64) para guardarla en Firestore. Garantiza que quede bajo ~800 KB (el límite de un documento es 1 MB)
// bajando la calidad y el tamaño si hace falta. Si el celular no puede leer el formato (ej. HEIC en Android) lanza un error claro.
export async function compressImage(file, max = 900, q = 0.72, limit = 800000) {
  let src = null, w = 0, h = 0;
  try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); w = src.width; h = src.height; } catch {}
  if (!src) src = await new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(/hei[cf]/i.test(file.type + file.name) ? "El formato HEIC no se puede leer en este celular: saca la foto en JPG (Ajustes de la cámara → Formato → Más compatible) o elige una captura de pantalla." : "No se pudo leer la imagen (formato no compatible).")); }; img.src = url; }).then((img) => { w = img.naturalWidth || img.width; h = img.naturalHeight || img.height; return img; });
  let size = max, data = "";
  for (let i = 0; i < 6; i++) {
    const s = Math.min(1, size / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    data = c.toDataURL("image/jpeg", q);
    if (data.length <= limit) break;
    if (q > 0.5) q -= 0.1; else size = Math.round(size * 0.8);
  }
  src.close?.();
  if (!data || data.length < 100) throw new Error("No se pudo procesar la imagen.");
  return data;
}

// Media móvil exponencial (tendencia del peso)
export function trend(vals, alpha = 0.25) { let t = null; return vals.map((v) => (v == null ? t : (t = t == null ? v : t + alpha * (v - t)))); }

// Video de YouTube → URL embebible
export function embedUrl(u) {
  if (!u) return null;
  const d = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{20,})/);
  if (d) return `https://drive.google.com/file/d/${d[1]}/preview`;
  const m = u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
