// Plan de alimentación por opciones (pautas alternativas), reemplazos por grupo, lista de compras
// y escala de hambre con carita que cambia al deslizar.
import { db } from "./db.js";
import { S, refresh } from "./state.js";
import { act, toast, sheet, closeSheet, confirmBox, $, $$ } from "./ui.js";
import { esc, r0, r1, num, uid, LS } from "./util.js";
import { getFoodBase } from "./data.js";
import { GROUPS } from "./foods.js";

const nk = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const GORDER = Object.keys(GROUPS);
export const DEFAULT_MEALS = [["Desayuno", "08:00"], ["Colación", "11:00"], ["Almuerzo", "14:00"], ["Once", "18:00"], ["Cena", "21:00"]];

// ---------- Medida casera aproximada: 161 g de "1 taza" (200 g) → "¾ taza"
function fr(q) {
  const n = Math.round(q * 4) / 4, w = Math.floor(n), f = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[n - w];
  return n === 0 ? String(r1(q)) : w ? `${w}${f ? " " + f : ""}` : f;
}
export function homeMeasure(g, medida, medidaG) {
  if (!g || !medida || !medidaG) return "";
  // La medida puede traer cantidad propia ("1 ½ taza", "¾ taza", "5 unidades"): se multiplica
  const m = medida.match(/^(\d+(?:[.,]\d+)?)?\s*([¼½¾])?\s*(.*)$/), F = { "¼": 0.25, "½": 0.5, "¾": 0.75 };
  const amt = (m[1] ? parseFloat(m[1].replace(",", ".")) : 0) + (m[2] ? F[m[2]] : 0) || 1;
  const q = (g / medidaG) * amt; if (q < 0.2 || q > 60) return "";
  let unit = (m[1] || m[2] ? m[3] : medida).trim(); if (!unit) return "";
  // singular base: "5 unidades" → "unidad", "2 tazas" → "taza"
  unit = unit.replace(/^(\S+?)(es|s)\b/, (w, a, b) => (b === "es" && /[dnlr]$/.test(a) ? a : b === "s" ? a : w));
  if (Math.round(q * 4) / 4 > 1) unit = unit.replace(/^(\S+)/, (w) => (/[aeiou]$/i.test(w) ? w + "s" : /[dnlr]$/i.test(w) ? w + "es" : w));
  return `${fr(q)} ${unit}`;
}
const fmtG = (g) => (g >= 1000 ? `${r1(g / 1000).toLocaleString("es-CL")} kg` : `${r0(g)} g`);
const porTxt = (p) => `${r1(p).toLocaleString("es-CL")} porc.`;
const itemLine = (it) => [it.por && it.gp ? porTxt(it.por) : "", it.g ? r0(it.g) + " g" : "", homeMeasure(it.g, it.medida, it.medidaG)].filter(Boolean).join(" · ");

async function foodIndex() {
  const base = await getFoodBase(), m = new Map();
  for (const f of base) if (!m.has(nk(f.name))) m.set(nk(f.name), f);
  return m;
}

// ================================================================ CLIENTE: opciones del plan
let PV = { k: 0 };
export function menusHtml(c) {
  const menus = c.menus || [];
  if (!menus.length) return "";
  if (PV.k >= menus.length) PV.k = 0;
  const mn = menus[PV.k];
  return `<div class="card"><div class="card-t">Opciones de tu plan</div>
  ${menus.length > 1 ? `<div class="seg scroll">${menus.map((x, k) => `<button class="${k === PV.k ? "on" : ""}" data-a="pvOpt" data-k="${k}">${esc(x.name || "Opción " + (k + 1))}</button>`).join("")}</div>` : `<b>${esc(mn.name || "Opción 1")}</b>`}
  ${mn.note ? `<div class="note">${esc(mn.note)}</div>` : ""}
  <p class="muted small">Toca un alimento para ver con qué lo puedes reemplazar.</p></div>
  ${(mn.meals || []).map((m, i) => `<div class="card pmeal"><div class="pmh"><b>${esc(m.name)}</b>${m.time ? `<span class="ptime">${esc(m.time)} hrs</span>` : ""}</div>
    ${(m.items || []).map((it, j) => `<div class="fi" data-a="pvSwap" data-i="${i}" data-j="${j}"><span>${esc(it.name)}<small>${esc(itemLine(it))}</small>${it.cat ? `<small class="pgrp">${esc(it.cat)}</small>` : ""}</span><span class="swap">⇄</span></div>`).join("") || `<div class="muted small">Sin alimentos</div>`}
    ${m.note ? `<div class="note">${esc(m.note)}</div>` : ""}</div>`).join("")}
  <a class="btn big block" href="#compras">🛒 Lista de compras</a>`;
}
act("pvOpt", (el) => { PV.k = +el.dataset.k; refresh(); });

act("pvSwap", async (el) => {
  const mn = S.client.menus[PV.k], it = mn.meals[+el.dataset.i].items[+el.dataset.j];
  const gInfo = GROUPS[it.cat];
  if (!it.cat || !gInfo || !gInfo[4] || !it.por) return sheet(it.name, `<p class="muted">Este alimento no pertenece a un grupo de intercambio, así que no tiene reemplazos directos. Si quieres cambiarlo, pregúntale a tu coach.</p>`);
  const base = await getFoodBase();
  const list = base.filter((f) => f.cat === it.cat && f.portion > 0).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const rows = list.map((f) => { const g = it.por * f.portion, hm = homeMeasure(g, f.medida, f.medidaG), same = nk(f.name) === nk(it.name);
    return `<div class="li row between sw-row ${same ? "same" : ""}" data-n="${esc(nk(f.name))}"><span>${esc(f.name)}${same ? ' <span class="badge g">en tu plan</span>' : ""}</span><span class="sw-q"><b>${r0(g)} g</b>${hm ? `<small>${esc(hm)}</small>` : ""}</span></div>`; }).join("");
  sheet("Reemplazos", `<div class="sw-head"><b>${esc(it.name)}</b><span class="muted small">${porTxt(it.por)} de <b>${esc(it.cat)}</b> · ${r0(gInfo[0] * it.por)} kcal</span></div>
  <p class="muted small">Cualquiera de estos equivale a lo mismo (${porTxt(it.por)} de ${esc(it.cat.toLowerCase())}). Pésalo tal como aparece (crudo o cocido según el nombre).</p>
  <div class="fsearch">${'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'}<input placeholder="Filtrar…" data-a-input="swFilter" autocomplete="off"></div>
  <div id="swL">${rows || `<p class="muted small">Sin alimentos en este grupo.</p>`}</div>`, { full: true });
});
act("swFilter", (el) => { const q = nk(el.value); $$("#swL .sw-row").forEach((r) => (r.style.display = !q || r.dataset.n.includes(q) ? "" : "none")); });

// ================================================================ CLIENTE: lista de compras
const shopKey = () => "ima-shop-" + S.cid;
const shopState = (menus) => {
  let st; try { st = JSON.parse(LS.get(shopKey()) || "{}"); } catch { st = {}; }
  st.days = st.days || {}; st.checked = st.checked || {};
  if (!Object.keys(st.days).length && menus[0]) st.days[menus[0].id] = 7;
  return st;
};
const shopSave = (st) => LS.set(shopKey(), JSON.stringify(st));

function shopItems(menus, st) {
  const m = new Map();
  for (const mn of menus) {
    const d = +st.days[mn.id] || 0; if (!d) continue;
    for (const meal of mn.meals || []) for (const it of meal.items || []) {
      if (!it.name) continue;
      const k = nk(it.name), x = m.get(k) || { name: it.name, cat: it.cat || "", g: 0, medida: it.medida, medidaG: it.medidaG };
      x.g += (+it.g || 0) * d; m.set(k, x);
    }
  }
  return [...m.entries()].map(([k, x]) => ({ k, ...x }));
}
export async function shoppingView(head) {
  const menus = S.client.menus || [];
  if (!menus.length) return `${head("Lista de compras", "plan")}<div class="card"><p class="muted">Tu coach aún no arma las opciones de tu plan. Cuando lo haga, aquí aparecerá tu lista de compras.</p></div>`;
  const st = shopState(menus), items = shopItems(menus, st);
  const groups = {}; for (const it of items) (groups[it.cat || "Otros"] ||= []).push(it);
  const order = Object.keys(groups).sort((a, b) => (GORDER.indexOf(a) + 1 || 99) - (GORDER.indexOf(b) + 1 || 99));
  const totalDays = Object.values(st.days).reduce((a, b) => a + (+b || 0), 0), left = items.filter((x) => !st.checked[x.k]).length;
  return `${head("Lista de compras", "plan")}
  <div class="card"><div class="card-t">¿Cuántos días de cada opción?</div>
  ${menus.map((mn, k) => `<div class="row between li"><span>${esc(mn.name || "Opción " + (k + 1))}</span><span class="row gap"><button class="btn tiny" data-a="shopDays" data-id="${mn.id}" data-n="-1">−</button><b class="shop-d">${+st.days[mn.id] || 0}</b><button class="btn tiny" data-a="shopDays" data-id="${mn.id}" data-n="1">＋</button></span></div>`).join("")}
  <p class="muted small">${totalDays} día${totalDays === 1 ? "" : "s"} en total · cantidades según los alimentos de ejemplo de tu plan.</p></div>
  ${items.length ? `<div class="card"><div class="row between"><div class="card-t">Por comprar · ${left} de ${items.length}</div><span class="row gap"><button class="btn tiny" data-a="shopShare">Compartir</button><button class="btn tiny ghost" data-a="shopReset">Desmarcar</button></span></div>
  ${order.map((g) => `<div class="shop-g">${esc(g)}</div>${groups[g].sort((a, b) => a.name.localeCompare(b.name, "es")).map((it) => { const hm = homeMeasure(it.g, it.medida, it.medidaG);
    return `<label class="shop-i ${st.checked[it.k] ? "done" : ""}"><input type="checkbox" ${st.checked[it.k] ? "checked" : ""} data-a-change="shopCheck" data-k="${esc(it.k)}"><span>${esc(it.name)}</span><span class="sw-q"><b>${fmtG(it.g)}</b>${hm ? `<small>≈ ${esc(hm)}</small>` : ""}</span></label>`; }).join("")}`).join("")}</div>`
  : `<div class="card"><p class="muted">Elige cuántos días vas a seguir cada opción para armar la lista.</p></div>`}`;
}
act("shopDays", (el) => { const menus = S.client.menus || [], st = shopState(menus); st.days[el.dataset.id] = Math.max(0, Math.min(31, (+st.days[el.dataset.id] || 0) + +el.dataset.n)); shopSave(st); refresh(); });
act("shopCheck", (el) => { const st = shopState(S.client.menus || []); if (el.checked) st.checked[el.dataset.k] = 1; else delete st.checked[el.dataset.k]; shopSave(st); refresh(); });
act("shopReset", () => { const st = shopState(S.client.menus || []); st.checked = {}; shopSave(st); refresh(); });
act("shopShare", async () => {
  const menus = S.client.menus || [], st = shopState(menus), items = shopItems(menus, st).filter((x) => !st.checked[x.k]);
  const txt = "🛒 Lista de compras\n" + items.map((it) => `• ${it.name}: ${fmtG(it.g)}${homeMeasure(it.g, it.medida, it.medidaG) ? ` (≈ ${homeMeasure(it.g, it.medida, it.medidaG)})` : ""}`).join("\n");
  try { if (navigator.share) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); toast("Lista copiada"); } } catch {}
});

// ================================================================ ESCALA DE HAMBRE (carita que cambia)
export const HUNGER = ["Muerto de hambre", "Mucha hambre", "Con hambre", "Un poco de hambre", "Ni hambre ni lleno", "Satisfecho", "Tranquilo, en su punto", "Lleno", "Muy lleno", "A punto de reventar"];
const lerp = (pts, v) => { for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0); } return pts[pts.length - 1][1]; };
export const hungerHue = (v) => lerp([[1, 4], [3, 26], [5, 70], [6.5, 150], [8, 195], [10, 262]], v);
export const hungerColor = (v, l = 80) => `hsl(${r0(hungerHue(v))} 62% ${l}%)`;
export function faceSvg(v, size = 120) {
  if (v == null) return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="5" opacity=".45"/><circle cx="44" cy="52" r="4.5" fill="currentColor" opacity=".45"/><circle cx="76" cy="52" r="4.5" fill="currentColor" opacity=".45"/><path d="M42 80h36" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".45"/></svg>`;
  const s = lerp([[1, -1], [3, -0.55], [5, 0.15], [6.5, 1], [8, 0.55], [9, 0], [10, -0.5]], v); // sonrisa (+) o mueca (−)
  const o = lerp([[1, 1], [4, 0.75], [5.5, 0.35], [6.5, 0], [8, 0.35], [10, 0.12]], v);        // ojos abiertos → cerrados y relajados
  const wy = lerp([[1, 5], [3, 2.5], [5, 0.5], [6.5, 0], [8.5, 1], [10, 3.5]], v);             // cejas preocupadas / apretadas
  const ck = lerp([[1, 0], [5, 0.1], [6.5, 0.45], [8, 0.3], [10, 0.7]], v);                     // mejillas
  const cr = lerp([[1, 7], [8, 8], [10, 11]], v), mw = lerp([[1, 15], [6.5, 20], [10, 13]], v), ink = "#3b3644";
  const eye = (x) => { const up = 2.5 + 4.5 * o, lo = -3 + 10 * o; return `<path d="M${x - 7},54 Q${x},${54 - 2 * up} ${x + 7},54 Q${x},${54 + 2 * lo * 0.5} ${x - 7},54Z" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`; };
  const brow = (x, d) => `<path d="M${x - 9},${38 + d * wy} L${x + 9},${38 - d * wy}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" opacity="${r1(0.25 + Math.min(1, wy / 4) * 0.6)}"/>`;
  const wave = v > 9 ? lerp([[9, 0], [10, 4]], v) : 0; // boca ondulada cuando está muy lleno
  const mouth = wave ? `M${60 - mw},80 q${mw / 2},${-wave} ${mw},0 q${mw / 2},${wave} ${mw},0` : `M${60 - mw},80 Q60,${80 + 22 * s} ${60 + mw},80`;
  return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="${hungerColor(v)}"/>
  <circle cx="33" cy="72" r="${cr}" fill="#ff8fa3" opacity="${r1(ck)}"/><circle cx="87" cy="72" r="${cr}" fill="#ff8fa3" opacity="${r1(ck)}"/>
  ${brow(44, 1)}${brow(76, -1)}${eye(44)}${eye(76)}<path d="${mouth}" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/></svg>`;
}
// Botón de la carita en cada comida
export const hungerBtn = (day, m) => { const h = day.hunger?.[m] || {}; const v = h.d ?? h.a; return `<button class="icon-btn hbtn ${v == null ? "empty" : ""}" data-a="hunger" data-m="${esc(m)}" title="Hambre y saciedad">${faceSvg(v ?? null, 26)}</button>`; };
export const hungerTxt = (h) => (h && (h.a != null || h.d != null) ? `Hambre ${h.a ?? "–"} → ${h.d ?? "–"}` : "");

let HZ = {};
const hBlock = (k, title, v) => `<div class="hz" style="--hc:${hungerColor(v ?? 5, 92)}"><div class="hz-t">${title}</div><div class="hz-face" id="hf-${k}">${faceSvg(v ?? 5)}</div>
  <div class="hz-l" id="hl-${k}">${v == null ? "Desliza para elegir" : `${Math.round(v)} · ${HUNGER[Math.round(v) - 1]}`}</div>
  <input type="range" class="hrange ${v == null ? "unset" : ""}" min="1" max="10" step="0.05" value="${v ?? 5}" data-a-input="hMove" data-k="${k}">
  <div class="row between small muted"><span>Hambre</span><span>Lleno</span></div></div>`;
export function openHunger(m, day, save) {
  const h = day.hunger?.[m] || {}; HZ = { m, a: h.a ?? null, d: h.d ?? null, save };
  sheet(m, `${hBlock("a", "¿Con cuánta hambre llegaste?", HZ.a)}${hBlock("d", "¿Cómo quedaste después de comer?", HZ.d)}
  <button class="btn primary big" data-a="hSave">Guardar</button>`);
}
act("hMove", (el) => {
  const v = +el.value, k = el.dataset.k; HZ[k] = v; el.classList.remove("unset");
  $("#hf-" + k).innerHTML = faceSvg(v); $("#hl-" + k).textContent = `${Math.round(v)} · ${HUNGER[Math.round(v) - 1]}`;
  el.closest(".hz").style.setProperty("--hc", hungerColor(v, 92));
});
act("hSave", async () => { const r = (x) => (x == null ? null : Math.round(x)); await HZ.save?.({ a: r(HZ.a), d: r(HZ.d) }); closeSheet(); toast("Guardado"); refresh(); });

// ================================================================ ESTRÉS DEL DÍA (pantalla de peso)
// 1 = muy tranquilo · 10 = muy estresado. Colores calmos: menta → arena → coral suave.
export const STRESS = ["Muy tranquilo", "Tranquilo", "Relajado", "Bien", "Normal", "Algo tenso", "Tenso", "Estresado", "Muy estresado", "Al límite"];
export const stressColor = (v, l = 80) => `hsl(${r0(lerp([[1, 160], [4, 120], [6, 50], [8, 25], [10, 4]], v))} 55% ${l}%)`;
export function stressFaceSvg(v, size = 120) {
  if (v == null) return faceSvg(null, size);
  const s = lerp([[1, 1], [3, 0.8], [5, 0.2], [7, -0.3], [10, -0.8]], v);        // sonrisa → boca tensa
  const o = lerp([[1, 0], [3, 0.15], [5, 0.6], [8, 0.95], [10, 1.15]], v);         // ojos cerrados en paz → muy abiertos
  const wy = lerp([[1, 0], [4, 0.3], [6, 1.5], [8, 3.5], [10, 5.5]], v);           // cejas de preocupación
  const zig = lerp([[1, 0], [7.5, 0], [10, 4]], v);                                 // boca en zigzag
  const sweat = lerp([[1, 0], [7, 0], [8.5, 0.6], [10, 1]], v), ck = lerp([[1, 0.4], [4, 0.25], [6, 0], [10, 0]], v), ink = "#3b3644";
  const eye = (x) => { const up = 2.5 + 4.5 * o, lo = -3 + 10 * o; return `<path d="M${x - 7},54 Q${x},${54 - 2 * up} ${x + 7},54 Q${x},${54 + lo} ${x - 7},54Z" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`; };
  const brow = (x, d) => `<path d="M${x - 9},${38 + d * wy} L${x + 9},${38 - d * wy}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" opacity="${r1(0.2 + Math.min(1, wy / 4) * 0.7)}"/>`;
  const mw = 17, mouth = zig ? `M${60 - mw},82 l${mw / 2},${-zig} l${mw / 2},${zig * 2} l${mw / 2},${-zig * 2} l${mw / 2},${zig}` : `M${60 - mw},80 Q60,${80 + 22 * s} ${60 + mw},80`;
  return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="${stressColor(v)}"/>
  <circle cx="33" cy="72" r="7" fill="#ff8fa3" opacity="${r1(ck)}"/><circle cx="87" cy="72" r="7" fill="#ff8fa3" opacity="${r1(ck)}"/>
  ${brow(44, 1)}${brow(76, -1)}${eye(44)}${eye(76)}<path d="${mouth}" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M95,30 q-6,10 0,13 q6,-3 0,-13Z" fill="#8ec5f0" opacity="${r1(sweat)}"/></svg>`;
}
export const stressCard = (v) => `<div class="card hz-card"><div class="hz" style="--hc:${stressColor(v ?? 5, 92)}"><div class="hz-t">¿Cómo está tu nivel de estrés hoy?</div>
  <div class="hz-face" id="sf">${stressFaceSvg(v ?? 5)}</div><div class="hz-l" id="sl">${v == null ? "Desliza para elegir" : `${v} · ${STRESS[v - 1]}`}</div>
  <input type="range" class="hrange srange ${v == null ? "unset" : ""}" min="1" max="10" step="0.05" value="${v ?? 5}" data-a-input="sMove" data-a-change="sSave">
  <div class="row between small muted"><span>Tranquilo</span><span>Estresado</span></div></div></div>`;
act("sMove", (el) => { const v = +el.value; el.classList.remove("unset"); $("#sf").innerHTML = stressFaceSvg(v); $("#sl").textContent = `${Math.round(v)} · ${STRESS[Math.round(v) - 1]}`; el.closest(".hz").style.setProperty("--hc", stressColor(v, 92)); });
act("sSave", async (el) => { const v = Math.round(+el.value); el.value = v; const { setDay } = await import("./data.js"); await setDay(S.date, { stress: v }); toast("Estrés guardado"); });

// ================================================================ COACH: editor de opciones
let MW = null; // copia de trabajo
const clone = (x) => JSON.parse(JSON.stringify(x));
export async function menusEditor(c) {
  if (!MW || MW.cid !== c.id) MW = { cid: c.id, menus: clone(c.menus || []), dirty: false, k: 0 };
  const idx = await foodIndex();
  return `<datalist id="foodDL">${[...idx.values()].map((f) => `<option value="${esc(f.name)}">`).join("")}</datalist><div id="menuEd">${editorHtml(c)}</div>`;
}
function totals(mn) {
  const t = { kcal: 0, cho: 0, fat: 0, prot: 0 }, por = {};
  for (const m of mn.meals || []) for (const it of m.items || []) {
    const g = GROUPS[it.cat]; if (!g || !it.por) continue;
    t.kcal += g[0] * it.por; t.cho += g[1] * it.por; t.fat += g[2] * it.por; t.prot += g[3] * it.por; por[it.cat] = (por[it.cat] || 0) + +it.por;
  }
  return { t, por };
}
function editorHtml(c) {
  const ms = MW.menus; if (MW.k >= ms.length) MW.k = Math.max(0, ms.length - 1);
  const mn = ms[MW.k], pauta = c.pauta || {};
  const head = `<div class="card"><div class="row between"><div class="card-t">Opciones del plan de alimentación</div><span class="row gap">${MW.dirty ? '<span class="badge y">Sin guardar</span>' : ""}<button class="btn primary" data-a="meSave">Guardar y publicar</button></span></div>
  <p class="muted small">Cada opción es una pauta alternativa (ej. día de entrenamiento / descanso / fin de semana). El cliente la ve en “Mi plan”, toca un alimento para ver los reemplazos de su grupo y arma su lista de compras.</p>
  <div class="seg scroll">${ms.map((x, k) => `<button class="${k === MW.k ? "on" : ""}" data-a="meOpt" data-k="${k}">${esc(x.name || "Opción " + (k + 1))}</button>`).join("")}<button data-a="meAdd">＋ Nueva opción</button></div></div>`;
  if (!mn) return head;
  const { t, por } = totals(mn);
  const groups = Object.entries(GROUPS).filter(([, g]) => g[4]).map(([g]) => g);
  const cmp = groups.filter((g) => por[g] || pauta[g]).map((g) => { const a = r1(por[g] || 0), b = +pauta[g] || 0, ok = !b ? "" : Math.abs(a - b) < 0.01 ? "g" : a > b ? "r" : "y"; return `<span class="pill ${ok}">${esc(g)} ${a}${b ? "/" + b : ""}</span>`; }).join(" ");
  return `${head}<div class="card"><div class="grid3"><label>Nombre de la opción<input value="${esc(mn.name || "")}" data-a-change="meF" data-f="name" placeholder="Ej: Día de entrenamiento"></label><label class="span2">Nota para el cliente (opcional)<input value="${esc(mn.note || "")}" data-a-change="meF" data-f="note"></label></div>
  <div class="small mt"><b>${r0(t.kcal)} kcal</b> · C ${r0(t.cho)} · L ${r0(t.fat)} · P ${r0(t.prot)} <span class="muted">(por porciones de intercambio${c.kcal ? ` · meta ${c.kcal} kcal` : ""})</span></div>
  <div class="mt pills-wrap">${cmp || '<span class="muted small">Agrega alimentos para ver las porciones por grupo.</span>'}</div>
  ${Object.keys(pauta).length ? `<p class="muted small">Porciones de la opción / pauta del cliente (verde = igual, amarillo = faltan, rojo = sobran).</p>` : ""}
  <div class="row gap mt"><button class="btn small" data-a="meDup">⧉ Duplicar opción</button><button class="btn small danger ghost" data-a="meDel">Eliminar opción</button></div></div>
  ${(mn.meals || []).map((m, i) => `<div class="card"><div class="row gap"><input class="grow" value="${esc(m.name)}" data-a-change="meMeal" data-i="${i}" data-f="name" style="font-weight:700"><input type="time" value="${esc(m.time || "")}" data-a-change="meMeal" data-i="${i}" data-f="time" style="width:120px">
    <button class="icon-btn" data-a="meMealMove" data-i="${i}" data-n="-1" title="Subir">↑</button><button class="icon-btn" data-a="meMealMove" data-i="${i}" data-n="1" title="Bajar">↓</button><button class="icon-btn" data-a="meMealDel" data-i="${i}" title="Quitar">✕</button></div>
    <table class="tbl me-t"><tr><th>Alimento</th><th>Grupo</th><th>Porciones</th><th>Gramos</th><th>Medida casera</th><th></th></tr>
    ${(m.items || []).map((it, j) => `<tr><td><input list="foodDL" value="${esc(it.name)}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="name" placeholder="Escribe y elige…"></td>
      <td><select data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="cat"><option value="">—</option>${Object.keys(GROUPS).map((g) => `<option ${g === it.cat ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></td>
      <td><input type="number" step="0.25" min="0" value="${it.por ?? ""}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="por" style="width:80px" ${it.gp ? "" : 'disabled title="Sin porción de intercambio: usa gramos"'}></td>
      <td><input type="number" step="1" min="0" value="${it.g ? r0(it.g) : ""}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="g" style="width:80px"></td>
      <td class="muted small">${esc(homeMeasure(it.g, it.medida, it.medidaG) || "")}</td><td><button class="icon-btn" data-a="meItDel" data-i="${i}" data-j="${j}">✕</button></td></tr>`).join("")}</table>
    <div class="row gap"><button class="btn small" data-a="meItAdd" data-i="${i}">＋ Alimento</button><input class="grow small" value="${esc(m.note || "")}" placeholder="Nota de esta comida (opcional)" data-a-change="meMeal" data-i="${i}" data-f="note"></div></div>`).join("")}
  <button class="btn block ghost" data-a="meMealAdd">＋ Agregar tiempo de comida</button>`;
}
const redraw = (dirty = true) => { if (dirty) MW.dirty = true; const box = $("#menuEd"); if (box) box.innerHTML = editorHtml(S._coachClient || {}); };
const cur = () => MW.menus[MW.k];
const newMenu = (name) => ({ id: uid(), name, meals: DEFAULT_MEALS.map(([n, t]) => ({ name: n, time: t, items: [] })) });
act("meOpt", (el) => { MW.k = +el.dataset.k; redraw(false); });
act("meAdd", () => { MW.menus.push(newMenu("Opción " + (MW.menus.length + 1))); MW.k = MW.menus.length - 1; redraw(); });
act("meDup", () => { const x = clone(cur()); x.id = uid(); x.name = (x.name || "Opción") + " (copia)"; MW.menus.splice(MW.k + 1, 0, x); MW.k++; redraw(); });
act("meDel", async () => { if (!(await confirmBox(`¿Eliminar “${cur().name}”?`))) return; MW.menus.splice(MW.k, 1); redraw(); });
act("meF", (el) => { cur()[el.dataset.f] = el.value; redraw(); });
act("meMeal", (el) => { cur().meals[+el.dataset.i][el.dataset.f] = el.value; redraw(); });
act("meMealAdd", () => { cur().meals.push({ name: "Comida " + (cur().meals.length + 1), time: "", items: [] }); redraw(); });
act("meMealDel", async (el) => { const m = cur().meals[+el.dataset.i]; if (m.items?.length && !(await confirmBox(`¿Quitar ${m.name} y sus alimentos?`))) return; cur().meals.splice(+el.dataset.i, 1); redraw(); });
act("meMealMove", (el) => { const a = cur().meals, i = +el.dataset.i, j = i + +el.dataset.n; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; redraw(); });
act("meItAdd", (el) => { const m = cur().meals[+el.dataset.i]; (m.items ||= []).push({ name: "", cat: "", por: 1, g: 0 }); redraw(); setTimeout(() => { const ins = $$(`#menuEd [data-i="${el.dataset.i}"][data-f="name"][list]`); ins[ins.length - 1]?.focus(); }, 0); });
act("meItDel", (el) => { cur().meals[+el.dataset.i].items.splice(+el.dataset.j, 1); redraw(); });
act("meIt", async (el) => {
  const it = cur().meals[+el.dataset.i].items[+el.dataset.j], f = el.dataset.f, v = el.value;
  if (f === "name") {
    it.name = v.trim(); const x = (await foodIndex()).get(nk(v));
    if (x) { it.name = x.name; it.cat = x.cat || ""; it.gp = x.portion || null; it.medida = x.medida || ""; it.medidaG = x.medidaG || null; }
    else { it.gp = null; it.medida = ""; it.medidaG = null; }
    if (it.gp) { it.por = it.por || 1; it.g = r1(it.por * it.gp); } else { it.por = null; }
  } else if (f === "cat") it.cat = v;
  else if (f === "por") { it.por = num(v); if (it.gp) it.g = r1(it.por * it.gp); }
  else if (f === "g") { it.g = num(v); if (it.gp) it.por = Math.round((it.g / it.gp) * 100) / 100; }
  redraw();
});
act("meSave", async () => {
  const menus = MW.menus.map((mn) => ({ ...mn, meals: mn.meals.map((m) => ({ ...m, items: (m.items || []).filter((it) => it.name) })) }));
  await db.set("clients/" + MW.cid, { menus }); MW.menus = clone(menus); MW.dirty = false;
  if (S._coachClient) S._coachClient.menus = menus; redraw(false); toast("Plan publicado ✓");
});
export const menusDirty = () => !!MW?.dirty;
