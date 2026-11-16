// Registro de comidas por voz (o texto libre): "2 plátanos medianos, una mandarina y una cucharada de mantequilla de maní"
// Entiende cantidades, medidas caseras y tamaños, busca el alimento en la base y estima los gramos.

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const sing = (w) => (w.length > 4 && w.endsWith("es") && !w.endsWith("ces") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w.endsWith("ces") ? w.slice(0, -3) + "z" : w);

const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, media: 0.5, medio: 0.5, cuarto: 0.25, par: 2, mitad: 0.5 };
// Medidas caseras: gramos genéricos si el alimento no trae la suya
const UNITS = [
  [/^(cucharaditas?|cdtas?|cditas?)$/, "cdta", 5],
  [/^(cucharadas?|cdas?)$/, "cda", 15],
  [/^(tazas?)$/, "taza", 200],
  [/^(vasos?)$/, "vaso", 200],
  [/^(rebanadas?|tajadas?|laminas?|lonjas?)$/, "rebanada", 25],
  [/^(punados?)$/, "puñado", 30],
  [/^(onzas?)$/, "onza", 28],
  [/^(scoops?|medidas?|medidores?)$/, "scoop", 30],
  [/^(platos?)$/, "plato", 250],
  [/^(porcion|porciones)$/, "porción", 100],
  [/^(unidades?|piezas?)$/, "unidad", null],
  [/^(gramos?|grs?|g)$/, "g", 1],
  [/^(kilos?|kg)$/, "g", 1000],
  [/^(ml|mililitros?|cc)$/, "g", 1],
  [/^(litros?|lt|l)$/, "g", 1000]
];
const SIZE = { pequeno: 0.7, pequena: 0.7, chico: 0.7, chica: 0.7, mediano: 1, mediana: 1, grande: 1.3, gran: 1.3 };
const STOP = new Set(["de", "del", "con", "la", "el", "los", "las", "y", "a", "al", "en", "mas", "unos", "unas", "algo", "como", "aprox", "aproximadamente", "mi", "me", "comi", "tome", "desayune", "almorce", "cene", "hoy", "tambien", "le", "puse", "eche"]);

// Parte una frase en alimentos
export function splitItems(text) {
  return norm(text)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\b(\d+)\s+y\s+medi[oa]\b/g, (_, n) => String(+n + 0.5))
    .replace(/\b(un|una|uno)\s+y\s+medi[oa]\b/g, "1.5")
    .split(/,|;|\.\s|\+|\by\b|\bmas\b|\bademas\b|\bcon\b|\n/)
    .map((x) => x.trim()).filter((x) => x.length > 1);
}

function parseChunk(chunk) {
  let qty = null, unit = null, unitG = null, size = 1;
  const words = [];
  const toks = chunk.split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^\d+(\.\d+)?$/.test(t)) { qty = (qty || 0) + +t; continue; }
    if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split("/"); qty = (qty || 0) + a / b; continue; }
    const m = t.match(/^(\d+(?:\.\d+)?)(g|gr|grs|kg|ml)$/); if (m) { qty = +m[1] * (m[2] === "kg" ? 1000 : 1); unit = "g"; unitG = 1; continue; }
    if (NUM[t] != null && !(t === "medio" && words.length)) { qty = qty == null ? NUM[t] : qty * NUM[t]; continue; }
    const u = UNITS.find(([re]) => re.test(t)); if (u && !unit) { unit = u[1]; unitG = u[2]; continue; }
    if (SIZE[t] != null) { size = SIZE[t]; continue; }
    if (STOP.has(t)) continue;
    words.push(sing(t));
  }
  return { qty: qty ?? 1, unit, unitG, size, query: words.join(" ") };
}

// Busca el mejor alimento por palabras en común
export function matchFoods(query, pool, n = 6) {
  const qw = query.split(" ").filter(Boolean); if (!qw.length) return [];
  const scored = [];
  for (const f of pool) {
    const nm = norm(f.name).replace(/[(),]/g, " "), fw = nm.split(/\s+/).map(sing);
    let hit = 0;
    for (const w of qw) if (fw.includes(w)) hit += 2; else if (fw.some((x) => x.startsWith(w) || (w.length > 4 && w.startsWith(x) && x.length > 3))) hit += 1;
    if (!hit) continue;
    const firstBonus = fw[0] === qw[0] ? 1.5 : 0;
    const raw = /crud/.test(nm) && !qw.some((w) => w.startsWith("crud")) ? 0.6 : 0;
    scored.push([hit + firstBonus - raw - fw.length * 0.15 - (f.src === "off" ? 0.5 : 0) + (f.fav ? 0.5 : 0), f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}

// Lee la medida del alimento: "2 cda" (32 g) → { n: 2, unit: "cda", each: 16 }
export function medidaInfo(f) {
  if (!f?.medida || !f.medidaG) return null;
  const m = norm(f.medida).match(/^([\d.,/½]+)\s*(.*)$/); if (!m) return { n: 1, unit: norm(f.medida), label: f.medida, each: f.medidaG };
  const n = m[1] === "½" ? 0.5 : m[1].includes("/") ? m[1].split("/")[0] / m[1].split("/")[1] : +m[1].replace(",", ".") || 1;
  const label = f.medida.replace(/^[\d.,/½]+\s*/, "");
  return { n, unit: m[2], label, each: f.medidaG / n };
}

// Gramos estimados para una cantidad + medida en un alimento concreto
export function estimateGrams(p, f) {
  const mi = medidaInfo(f), mu = mi ? mi.unit : "";
  if (p.unit === "g") return Math.round(p.qty * p.unitG);
  const same = (u) => mu.startsWith(u) || (u === "unidad" && /unidad|pieza/.test(mu));
  if (mi && p.unit && same(p.unit)) return Math.round(p.qty * mi.each * p.size);
  if (mi && p.unit === "cdta" && mu.startsWith("cda")) return Math.round((p.qty * mi.each) / 3);
  if (mi && p.unit === "cda" && mu.startsWith("cdta")) return Math.round(p.qty * mi.each * 3);
  if (!p.unit || p.unit === "unidad") {
    if (mi) return Math.round(p.qty * mi.each * p.size);
    return Math.round(p.qty * 100 * p.size);
  }
  return Math.round(p.qty * (p.unitG || 100) * p.size);
}

const fmtQ = (q) => (q === 0.5 ? "½" : q === 0.25 ? "¼" : String(Math.round(q * 100) / 100).replace(".", ","));
export function describe(p) {
  const u = { cdta: "cdta", cda: "cda", taza: "taza", vaso: "vaso", rebanada: "rebanada", "puñado": "puñado", onza: "onza", scoop: "scoop", plato: "plato", "porción": "porción", unidad: "unidad", g: "g" }[p.unit] || "";
  return p.unit === "g" ? `${Math.round(p.qty * p.unitG)} g` : `${fmtQ(p.qty)}${u ? " " + u + (p.qty > 1 && u !== "g" ? "s" : "") : ""}${p.size !== 1 ? (p.size < 1 ? " pequeño" : " grande") : ""}`;
}

export function parseMeal(text, pool) {
  return splitItems(text).map((chunk) => {
    const p = parseChunk(chunk);
    const options = matchFoods(p.query, pool);
    const f = options[0] || null;
    return { chunk, p, options, f, g: f ? estimateGrams(p, f) : null };
  }).filter((x) => x.p.query);
}

// Reconocimiento de voz del navegador (Chrome en Android lo trae)
export function speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
export function listen({ onText, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR(); rec.lang = "es-CL"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
  let final = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += (final ? ", " : "") + t.trim(); else interim += t; }
    onText(final, interim);
  };
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.(final);
  rec.start();
  return rec;
}
