// Plan de alimentación por opciones (pautas alternativas), reemplazos por grupo, lista de compras
// y escala de hambre con carita que cambia al deslizar.
import { has } from "./features.js";
import { INTERCAMBIO } from "./intercambio.js";
import { db } from "./db.js";
import { S, refresh } from "./state.js";
import { act, toast, sheet, closeSheet, confirmBox, $, $$ } from "./ui.js";
import { esc, r0, r1, num, uid, LS } from "./util.js";
import { getFoodBase } from "./data.js";
import { GROUPS, pautaExtras, pautaMac } from "./foods.js";
import { undoSource } from "./undo.js";

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
  // "6 cdas o ½ taza": se escala cada parte por separado (si no, queda "12 cdas o ½ taza")
  if (/\s+o\s+[\d¼½¾]/.test(medida)) return medida.split(/\s+o\s+/).map((m) => homeMeasure(g, m, medidaG)).filter(Boolean).join(" o ");
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
const itemLine = (it) => [it.por && it.gp ? porTxt(it.por) : "", it.g ? r0(it.g) + " g" : "", homeMeasure(it.g, it.medida, it.medidaG), isExtra(it) && it.kcal ? r0(it.kcal) + " kcal" : ""].filter(Boolean).join(" · ");
// Extra = alimento sin grupo de intercambio (chía, Nutella, comida rápida…): lleva sus propios macros (de la cantidad del plan) y suma al total
export const isExtra = (it) => !it.cat || !GROUPS[it.cat]?.[4];

// El plan se arma con la base de PORCIONES DE INTERCAMBIO de Joaquín (1 porción = lo que aporta los macros del grupo)
// + los alimentos propios que haya subido en Biblioteca.
const IC = INTERCAMBIO.map(([name, cat, medida, g, kcal, cho, fat, prot]) => ({ name, cat, portion: cat ? g : null, medida: cat ? medida : "", medidaG: cat ? g : null, kcal, cho, fat, prot, ic: true }));
async function foodIndex() {
  const m = new Map();
  for (const f of IC) m.set(nk(f.name), f);
  for (const f of (await db.get("library/foods"))?.items || []) if (!m.has(nk(f.name))) m.set(nk(f.name), f);
  return m;
}

// ================================================================ CLIENTE: opciones del plan
let PV = { k: 0 };
export function menusHtml(c) {
  const menus = c.menus || [];
  if (!menus.length) return "";
  if (PV.k >= menus.length) PV.k = 0;
  // Día con legumbres: si el coach dejó esa pauta y ninguna opción es de legumbres, se muestra como una pestaña más
  const legTab = legPauta(c) && !menus.some((m) => m.leg);
  if (PV.k === -1 && legTab) return `<div class="card"><div class="card-t">Opciones de tu plan</div>${optSeg(menus, legTab)}</div>${legHtml(c)}`;
  if (PV.k < 0) PV.k = 0;
  const mn = menus[PV.k];
  return `<div class="card"><div class="card-t">Opciones de tu plan</div>
  ${menus.length > 1 || legTab ? optSeg(menus, legTab) : `<b>${esc(mn.name || "Opción 1")}</b>`}
  ${mn.note ? `<div class="note">${esc(mn.note)}</div>` : ""}
  ${mn.noTime ? `<div class="note">🕒 <b>Sin horario fijo:</b> come cada 3 a 4 horas, como te acomode ese día.</div>` : ""}
  <p class="muted small">Toca un alimento para ver con qué lo puedes reemplazar.</p></div>
  ${(mn.meals || []).map((m, i) => `<div class="card pmeal" style="--mc:${mealColor(m, i)}"><div class="pmh"><b>${esc(m.name)}</b>${m.free ? `<span class="ptime">Libre durante el día</span>` : m.time && !mn.noTime ? `<span class="ptime">${esc(m.time)} hrs</span>` : ""}</div>
    ${(m.items || []).map((it, j) => `<div class="fi" data-a="pvSwap" data-i="${i}" data-j="${j}"><span>${esc(it.name)}<small>${esc(itemLine(it))}</small>${isExtra(it) ? `<small class="pgrp">Extra</small>` : `<small class="pgrp">${esc(it.cat)}</small>`}</span>${isExtra(it) ? "" : '<span class="swap">⇄</span>'}</div>`).join("") || `<div class="muted small">Sin alimentos</div>`}
    ${m.note ? `<div class="note">${esc(m.note)}</div>` : ""}</div>`).join("")}
  ${has("plan_shop") ? `<a class="btn big block" href="#compras">🛒 Lista de compras</a>` : ""}`;
}
act("pvOpt", (el) => { PV.k = +el.dataset.k; refresh(); });
const optSeg = (menus, legTab) => `<div class="seg scroll">${menus.map((x, k) => `<button class="${k === PV.k ? "on" : ""}" data-a="pvOpt" data-k="${k}">${esc(x.name || "Opción " + (k + 1))}</button>`).join("")}${legTab ? `<button class="${PV.k === -1 ? "on" : ""}" data-a="pvOpt" data-k="-1">Día con legumbres</button>` : ""}</div>`;
export const legPauta = (c) => (c.pautaLeg && Object.values(c.pautaLeg).some((v) => +v > 0) ? c.pautaLeg : null);
const fmtP = (v) => { const n = +v || 0, w = Math.floor(n), f = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[Math.round((n - w) * 4) / 4]; return n ? `${w || ""}${f || ""}` || "0" : "0"; };
// Pauta del día con legumbres: lo que cambia respecto de un día normal
export function legHtml(c) {
  const pl = legPauta(c), pn = c.pauta || {}; if (!pl) return "";
  const gs = GORDER.filter((g) => GROUPS[g][4] && (+pl[g] || +pn[g]));
  const ch = gs.map((g) => [g, (+pl[g] || 0) - (+pn[g] || 0)]).filter(([, d]) => Math.abs(d) > 0.01);
  return `<div class="card"><div class="card-t">Día con legumbres</div>
  <p class="small">Los días que comas porotos, lentejas o garbanzos sigue cualquier opción de tu plan, con este cambio:</p>
  <div class="pills-wrap">${ch.map(([g, d]) => `<span class="pill ${d > 0 ? "g" : "y"}">${d > 0 ? "+" : "−"}${fmtP(Math.abs(d))} ${esc(g.toLowerCase())}</span>`).join(" ")}</div>
  <p class="muted small">Por ejemplo, cambia el arroz y parte de la carne del almuerzo por las legumbres.</p>
  <table class="tbl mt"><tr><th>Grupo</th><th>Día normal</th><th>Con legumbres</th></tr>${gs.map((g) => `<tr><td>${esc(g)}</td><td>${fmtP(pn[g])}</td><td><b>${fmtP(pl[g])}</b></td></tr>`).join("")}</table></div>`;
}

act("pvSwap", async (el) => {
  const mn = S.client.menus[PV.k], it = mn.meals[+el.dataset.i].items[+el.dataset.j];
  const gInfo = GROUPS[it.cat];
  if (!it.cat || !gInfo || !gInfo[4] || !it.por) return sheet(it.name, `${isExtra(it) && it.kcal ? `<p class="small">${it.g ? r0(it.g) + " g · " : ""}${r0(it.kcal)} kcal · C ${r1(it.cho)} · L ${r1(it.fat)} · P ${r1(it.prot)}</p>` : ""}<p class="muted">Este alimento no pertenece a un grupo de intercambio, así que no tiene reemplazos directos. Si quieres cambiarlo, pregúntale a tu coach.</p>`);
  const list = [...(await foodIndex()).values()].filter((f) => f.cat === it.cat && f.portion > 0).sort((a, b) => a.name.localeCompare(b.name, "es"));
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

// Lista de compras en crudo: lo cocido que tiene su par crudo en la base de intercambio (arroz, fideos, quínoa,
// legumbres…) se pasa a crudo con la misma cantidad de porciones (ej. 100 g de arroz cocido = 40 g de arroz crudo).
const RAWW = [[/\bcocidos\b/, "crudos"], [/\bcocidas\b/, "crudas"], [/\bcocido\b/, "crudo"], [/\bcocida\b/, "cruda"]];
function toRaw(it) {
  const n = nk(it.name); if (!/cocid/.test(n) || / o crud/.test(n)) return it;
  const ck = IC.find((f) => nk(f.name) === n), rk = RAWW.reduce((x, [re, r]) => x.replace(re, r), n), raw = IC.find((f) => nk(f.name) === rk);
  if (!ck?.portion || !raw?.portion || ck.cat !== raw.cat) return it;
  return { ...it, name: raw.name, g: ((+it.g || 0) / ck.portion) * raw.portion, medida: raw.medida, medidaG: raw.medidaG, raw: true };
}
function shopItems(menus, st) {
  const m = new Map();
  for (const mn of menus) {
    const d = +st.days[mn.id] || 0; if (!d) continue;
    for (const meal of mn.meals || []) for (const it0 of meal.items || []) {
      const it = toRaw(it0);
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
  <p class="muted small">${totalDays} día${totalDays === 1 ? "" : "s"} en total · cantidades según los alimentos de ejemplo de tu plan. El arroz, los fideos, la quínoa y las legumbres ya vienen en <b>crudo</b> (lo que compras).</p>
  <p class="muted small">La lista queda guardada en tu celular: lo que vas tachando y los días de cada opción se mantienen hasta que toques <b>Nueva lista</b> (por ejemplo, cada vez que vas a comprar).${st.started ? ` Esta lista la empezaste el ${new Date(st.started).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}.` : ""}</p></div>
  ${items.length ? `<div class="card"><div class="row between"><div class="card-t">Por comprar · ${left} de ${items.length}</div><span class="row gap"><button class="btn tiny" data-a="shopShare">Compartir</button><button class="btn tiny ghost" data-a="shopReset">Nueva lista</button></span></div>
  ${order.map((g) => `<div class="shop-g">${esc(g)}</div>${groups[g].sort((a, b) => a.name.localeCompare(b.name, "es")).map((it) => { const hm = homeMeasure(it.g, it.medida, it.medidaG);
    return `<label class="shop-i ${st.checked[it.k] ? "done" : ""}"><input type="checkbox" ${st.checked[it.k] ? "checked" : ""} data-a-change="shopCheck" data-k="${esc(it.k)}"><span>${esc(it.name)}</span><span class="sw-q"><b>${fmtG(it.g)}</b>${hm ? `<small>≈ ${esc(hm)}</small>` : ""}</span></label>`; }).join("")}`).join("")}</div>`
  : `<div class="card"><p class="muted">Elige cuántos días vas a seguir cada opción para armar la lista.</p></div>`}`;
}
act("shopDays", (el) => { const menus = S.client.menus || [], st = shopState(menus); st.days[el.dataset.id] = Math.max(0, Math.min(31, (+st.days[el.dataset.id] || 0) + +el.dataset.n)); shopSave(st); refresh(); });
act("shopCheck", (el) => { const st = shopState(S.client.menus || []); st.started ||= Date.now(); if (el.checked) st.checked[el.dataset.k] = 1; else delete st.checked[el.dataset.k]; shopSave(st); refresh(); });
act("shopReset", async () => { if (!(await confirmBox("¿Empezar una lista nueva? Se desmarca todo lo que tachaste (los días de cada opción se mantienen)."))) return; const st = shopState(S.client.menus || []); st.checked = {}; st.started = Date.now(); shopSave(st); refresh(); });
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

// ================================================================ COACH: editor de opciones
let MW = null; // copia de trabajo
const clone = (x) => JSON.parse(JSON.stringify(x));
// MW = plan de UNA etapa en edición (cada etapa del Timeline tiene su propio plan en c.plans[etapa])
const loadMW = (c, phase) => { const P = c.plans?.[phase] || null; MW = { cid: c.id, phase, exists: !!P, menus: clone(P?.menus || []), pauta: clone(P?.pauta || {}), pautaLeg: clone(P?.pautaLeg || {}), targets: clone(P?.targets || {}), calc: clone(P?.calc || {}), dirty: false, k: 0 }; };
export async function menusEditor(c) {
  if (!MW || MW.cid !== c.id || !c.phaseList.some((x) => x.phase === MW.phase)) loadMW(c, c.curPhase);
  else if (!MW.dirty) loadMW(c, MW.phase);
  const idx = await foodIndex();
  return `<datalist id="foodDL">${[...idx.values()].map((f) => `<option value="${esc(f.name)}">`).join("")}</datalist><div id="menuEd">${editorHtml(c)}</div>`;
}
function totals(mn) {
  const t = { kcal: 0, cho: 0, fat: 0, prot: 0 }, por = {};
  for (const m of mn.meals || []) for (const it of m.items || []) {
    if (isExtra(it) && hasBudget(m)) continue; // la comida libre cuenta con su total, no por ítem
    if (isExtra(it)) { for (const k of ["kcal", "cho", "fat", "prot"]) t[k] += +it[k] || 0; continue; }
    const g = GROUPS[it.cat]; if (!g || !it.por) continue;
    t.kcal += g[0] * it.por; t.cho += g[1] * it.por; t.fat += g[2] * it.por; t.prot += g[3] * it.por; por[it.cat] = (por[it.cat] || 0) + +it.por;
  }
  for (const m of mn.meals || []) if (hasBudget(m)) for (const k of ["kcal", "cho", "fat", "prot"]) t[k] += +m.budget[k] || 0;
  return { t, por };
}
const hasBudget = (m) => m.free && +m.budget?.kcal > 0;
// Color de cada tiempo de comida (borde y cápsula en "Mi plan")
const MCOL = [[/libre|durante el d/, "#94a3b8"], [/^pre ?entreno/, "#22c55e"], [/desayuno/, "#f59e0b"], [/colaci[oó]n (am|1)|media ma/, "#14b8a6"], [/almuerzo/, "#ef4444"], [/colaci[oó]n (pm|2)/, "#a855f7"], [/once|merienda/, "#3b82f6"], [/cena/, "#6366f1"], [/colaci[oó]n 3/, "#ec4899"], [/colaci[oó]n/, "#14b8a6"]];
const MPAL = ["#f59e0b", "#14b8a6", "#ef4444", "#a855f7", "#3b82f6", "#6366f1", "#ec4899"];
export const mealColor = (m, i) => (m.free ? "#94a3b8" : (MCOL.find(([re]) => re.test(nk(m.name))) || [])[1] || MPAL[i % MPAL.length]);
// Colores del editor: uno por opción (pestaña y borde de sus comidas) y uno por grupo de alimentos
const OPAL = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#14b8a6", "#ec4899", "#6366f1"];
export const optColor = (k) => OPAL[k % OPAL.length];
export const GCOL = { "Cereales": "#d4a373", "Verduras generales": "#22c55e", "Verduras libre consumo": "#86efac", "Frutas": "#f97316", "Lácteos altos en grasa": "#2563eb", "Lácteos medios en grasa": "#60a5fa", "Lácteos bajos en grasa": "#bfdbfe", "Carnes magras": "#f87171", "Carnes grasas": "#b91c1c", "Huevo": "#facc15", "Legumbres": "#a16207", "Aceites y grasas": "#eab308", "Alimentos ricos en lípidos": "#84cc16", "Azúcar": "#f472b6" };
const gdot = (g) => `<i class="gdot" style="background:${GCOL[g] || "#777"}"></i>`;
const PG = () => Object.entries(GROUPS).filter(([, g]) => g[4]).map(([g]) => g);
const pMac = (p) => { const t = { kcal: 0, cho: 0, fat: 0, prot: 0 }; for (const [g, n] of Object.entries(p || {})) { const G = GROUPS[g]; if (G) { t.kcal += n * G[0]; t.cho += n * G[1]; t.fat += n * G[2]; t.prot += n * G[3]; } } return t; };
const mealTot = (m) => totals({ meals: [m] }).t;
const macTxt = (t) => `${r0(t.kcal)} kcal · C ${r0(t.cho)} · L ${r0(t.fat)} · P ${r0(t.prot)}`;
const fmtN = (v) => (v == null || v === "" ? "" : String(Math.round(+v * 100) / 100));
// Pauta: se crea aquí mismo (día normal y día con legumbres) y se compara con las metas del cliente
// ¿La pauta (con el ajuste de la etapa, si tiene) calza con las metas vigentes? kcal ±5 %, macros ±10 %
// ¿La pauta calza con las metas de esta etapa? kcal ±5 %, macros ±10 %
function pautaWarn() {
  const T = MW.targets, m = pautaMac(MW.pauta, pautaExtras(MW.menus)), L = [["kcal", "kcal", 0.05], ["cho", "CHO", 0.1], ["fat", "lípidos", 0.1], ["prot", "proteína", 0.1]];
  if (!Object.values(MW.pauta).some((v) => +v) || !+T.kcal) return "";
  const off = L.filter(([k, , t]) => +T[k] && Math.abs(m[k] / T[k] - 1) > t);
  if (!off.length) return `<div class="note okn">✓ La pauta calza con las metas de <b>${esc(MW.phase)}</b>.</div>`;
  return `<div class="note warnn">⚠ <b>Ajusta la pauta para calzar con las metas de ${esc(MW.phase)}:</b> ${off.map(([k, l]) => { const d = Math.round(m[k] - T[k]); return `${l} ${r0(m[k])} vs ${r0(T[k])} (${d > 0 ? "+" : ""}${d})`; }).join(" · ")}.</div>`;
}
// Metas de la etapa: calculadora propia (mantención × (1 + %), proteína y grasa por kilo, CHO completa) o los macros de la pauta
function calcRes(c) {
  const k = MW.calc, kg = c.lastKg, m = +k.maint || +c.kcalMaint || null, pct = k.pct !== "" && k.pct != null ? +k.pct : c.pctOf(MW.phase);
  const pk = +k.protKg || +c.protKg || 2, fk = +k.fatKg || +c.fatKg || 0.8;
  if (!m) return { miss: "la mantención (calcúlala en Etapas o escríbela aquí)", pct, pk, fk };
  const kcal = Math.round(m * (1 + pct / 100)); if (!kg) return { kcal, miss: "un peso registrado", pct, pk, fk };
  const prot = Math.round(pk * kg), fat = Math.round(fk * kg); return { kcal, prot, fat, cho: Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4)), pct, pk, fk, m };
}
function targetsCard(c) {
  const R = calcRes(c), T = MW.targets, k = MW.calc, pm = pautaMac(MW.pauta, pautaExtras(MW.menus)), col = phaseColor(MW.phase);
  return `<div class="card tg-card" style="--pc:${col}"><div class="row between"><div><div class="card-t">Metas de ${esc(MW.phase)}</div><span class="muted small">Lo que la app le muestra al cliente las semanas de esta etapa.</span></div>
    </div>${tgBalance(c, T, pm)}
    <div class="tg-calc"><span class="muted small">Calculadora:</span>
      <label>Mantención<input type="number" value="${k.maint ?? ""}" placeholder="${c.kcalMaint || ""}" data-a-change="meCalc" data-k="maint"></label>
      <label>% vs mant.<input type="number" value="${k.pct ?? ""}" placeholder="${c.pctOf(MW.phase)}" data-a-change="meCalc" data-k="pct"></label>
      <label>Proteína g/kg<input type="number" step="0.1" value="${k.protKg ?? ""}" placeholder="${c.protKg ?? 2}" data-a-change="meCalc" data-k="protKg"></label>
      <label>Grasa g/kg<input type="number" step="0.1" value="${k.fatKg ?? ""}" placeholder="${c.fatKg ?? 0.8}" data-a-change="meCalc" data-k="fatKg"></label>
      <span class="small">${k.kg ? `<span class="muted">metas puestas con ${String(k.kg).replace(".", ",")} kg · </span>` : ""}${c.lastKg ? `${r1(c.lastKg)} kg hoy →` : ""} ${R.miss ? `<span class="muted">Falta ${esc(R.miss)}.</span>` : `<b>${R.kcal} kcal · C ${R.cho} · L ${R.fat} · P ${R.prot}</b>`}</span>
      ${R.miss ? "" : `<button class="btn small" data-a="meTgCalc">Usar el cálculo</button>`}<button class="btn small ghost" data-a="meTgPauta" title="Las metas quedan iguales a lo que aporta la pauta">Usar los macros de la pauta (${r0(pm.kcal)} kcal)</button></div></div>`;
}
// Metas balanceadas: kcal fija; al cambiar un macro (en g o g/kg) el macro "compensador" se ajusta para mantener las kcal.
// Al cambiar las kcal, se ajusta el compensador. Si cambias el compensador mismo, cambian las kcal.
const KF = { cho: 4, fat: 9, prot: 4 };
const tgKg = () => S._coachClient?.lastKg || +MW.calc.kg || null;
function tgBalance(c, T, pm) {
  const kg = tgKg(), comp = MW.calc.comp || "fat", kc = +T.kcal || 0;
  const pctK = (x) => (kc && T[x] ? Math.round((T[x] * KF[x] * 100) / kc) : null);
  const diff = (x) => { if (!pm || !+T[x]) return ""; const d = Math.round(pm[x] - T[x]), bad = Math.abs(pm[x] / T[x] - 1) > (x === "kcal" ? 0.05 : 0.1); return `<small class="${bad ? "r" : "g"}" title="Lo que aporta la pauta vs la meta">pauta ${r0(pm[x])}${d ? ` (${d > 0 ? "+" : ""}${d})` : " ✓"}</small>`; };
  const mac = (x, l) => `<div class="tgm ${x === comp ? "comp" : ""}"><b>${l}${x === comp ? ' <span class="badge">se ajusta</span>' : ""}</b>
    <span class="tgm-in"><input type="number" value="${T[x] ?? ""}" data-a-change="meTgM" data-k="${x}" placeholder="–"><small>g</small></span>
    <span class="tgm-in"><input type="number" step="0.05" value="${kg && T[x] ? r2(T[x] / kg) : ""}" data-a-change="meTgK" data-k="${x}" placeholder="–" ${kg ? "" : "disabled"}><small>g/kg</small></span>
    <small class="muted">${pctK(x) != null ? pctK(x) + " % de las kcal" : "&nbsp;"}</small>${diff(x)}</div>`;
  return `<div class="tg-bal"><div class="tgm kc"><b>Calorías</b><span class="tgm-in"><input type="number" value="${T.kcal ?? ""}" data-a-change="meTgM" data-k="kcal" placeholder="–"><small>kcal</small></span><small class="muted">${kg ? `peso ${r1(kg)} kg` : "sin peso: no hay g/kg"}</small>${diff("kcal")}</div>
    ${mac("prot", "Proteína")}${mac("fat", "Lípidos")}${mac("cho", "Carbohidratos")}
    <div class="tg-comp small"><span class="muted">Al cambiar un macro se ajusta:</span><label class="ck"><input type="radio" name="tgcomp" value="fat" ${comp === "fat" ? "checked" : ""} data-a-change="meTgComp">Lípidos</label><label class="ck"><input type="radio" name="tgcomp" value="cho" ${comp === "cho" ? "checked" : ""} data-a-change="meTgComp">Carbohidratos</label></div></div>`;
}
const r2 = (v) => Math.round(v * 100) / 100;
function tgSet(k, v) {
  const T = MW.targets, comp = MW.calc.comp || "fat", others = ["cho", "fat", "prot"].filter((x) => x !== comp);
  if (v === "" || v == null || isNaN(v)) delete T[k]; else T[k] = Math.max(0, Math.round(v));
  const sumK = (list) => list.reduce((a, x) => a + (+T[x] || 0) * KF[x], 0);
  if (k === comp || !+T.kcal) T.kcal = Math.round(sumK(["cho", "fat", "prot"])); // cambió el compensador (o no hay kcal): cambian las kcal
  else { // cambió otro macro o las kcal: el compensador absorbe la diferencia
    const g = Math.round((T.kcal - sumK(others)) / KF[comp]);
    T[comp] = Math.max(0, g); if (g < 0) T.kcal = Math.round(sumK(["cho", "fat", "prot"]));
  }
  const kg = tgKg(); if (S._coachClient?.lastKg) MW.calc.kg = Math.round(S._coachClient.lastKg * 10) / 10; else if (kg) MW.calc.kg = kg;
  redraw();
}
act("meTgM", (el) => tgSet(el.dataset.k, el.value === "" ? "" : num(el.value)));
act("meTgK", (el) => { const kg = tgKg(); if (!kg) return; tgSet(el.dataset.k, el.value === "" ? "" : num(el.value) * kg); });
act("meTgComp", (el) => { MW.calc.comp = el.value; redraw(); });
const phaseColor = (p) => ({ "Break de dieta": "#a855f7", "Déficit leve": "#e0484e", "Déficit moderado": "#c3242b", "Déficit agresivo": "#8e1b1f", "Mini cut": "#b0263a", "Mantención": "#7d7d86", "Recomposición corporal": "#3b82f6", "Dieta reversa": "#d6a21e", "Superávit / Volumen": "#22a35a" }[p] || "#888");
// Pestañas: una por etapa del Timeline (y las que ya tienen plan)
function phaseStrip(c) {
  const sem = (x) => (x.ranges.length ? x.ranges.map(([a, b]) => (a === b ? `S${a}` : `S${a}–${b}`)).join(", ") : "sin semanas en el Timeline");
  const when = (x) => (x.current ? "ahora" : x.startsIn != null ? `parte en ${x.startsIn} semana${x.startsIn === 1 ? "" : "s"}` : x.past ? "ya pasó" : "");
  return `<div class="phase-strip">${c.phaseList.map((x) => `<button class="ph-tab ${x.phase === MW.phase ? "on" : ""}" style="--pc:${x.color}" data-a="mePhase" data-p="${esc(x.phase)}">
    <b>${esc(x.phase)}</b><small>${sem(x)}${when(x) ? " · " + when(x) : ""}</small>${x.ready ? '<span class="badge g">Plan listo</span>' : `<span class="badge ${x.current || (x.startsIn != null && x.startsIn <= 2) ? "r" : "y"}">Falta el plan</span>`}</button>`).join("")}</div>`;
}
function pautaCard(c) {
  const pn = MW.pauta, pl = MW.pautaLeg, en = pautaExtras(MW.menus), el = MW.menus.some((m) => m.leg) ? pautaExtras(MW.menus, true) : en;
  const mn = pautaMac(pn, en), ml = pautaMac(pl, el), goal = MW.targets;
  const exNames = [...new Set([...en, ...el].map((e) => e.name))], exOf = (L, n) => L.find((e) => e.name === n);
  const exTd = (e) => (e ? `${e.g ? r0(e.g) + " g · " : ""}${r0(e.kcal)} kcal <span class="muted small">C ${r1(e.cho)} · L ${r1(e.fat)} · P ${r1(e.prot)}</span>` : "–");
  const adec = (v, g) => (g ? `<small class="${Math.abs(v / g - 1) <= 0.05 ? "g" : Math.abs(v / g - 1) <= 0.1 ? "y" : "r"}">${r0((v / g) * 100)} %</small>` : "");
  const empty = !Object.values(pn).some((v) => +v);
  return `<details class="card pauta-card" ${empty || MW.openPauta ? "open" : ""}><summary class="card-t" data-a="mePautaOpen">Pauta de alimentación${empty ? ' <span class="badge y">Por crear</span>' : ` <span class="muted small">· ${r0(mn.kcal)} kcal${en.length ? " con extras" : ""}</span>`}</summary>
  <p class="muted small">Porciones por grupo al día. Abajo ves sus kcal y macros (porciones de intercambio + los extras que van en todas las opciones, como un postre fijo) contra las metas de esta etapa. Se guarda con “Guardar y publicar”.</p>
  <table class="tbl pauta-t"><tr><th>Grupo</th><th>Día normal</th><th>Día con legumbres</th></tr>
  ${PG().map((g) => `<tr><td>${gdot(g)}${esc(g)}</td><td><input type="number" step="0.25" min="0" value="${fmtN(pn[g])}" data-a-change="mePauta" data-p="n" data-g="${esc(g)}"></td><td><input type="number" step="0.25" min="0" value="${fmtN(pl[g])}" data-a-change="mePauta" data-p="l" data-g="${esc(g)}"></td></tr>`).join("")}
  ${exNames.map((n) => `<tr class="exrow"><td><span class="badge">Extra</span> ${esc(n)}<br><span class="muted small">viene de las opciones (está en todas)</span></td><td>${exTd(exOf(en, n))}</td><td>${exTd(exOf(el, n))}</td></tr>`).join("")}
  ${[["kcal", "Kcal"], ["cho", "CHO (g)"], ["fat", "Lípidos (g)"], ["prot", "Proteína (g)"]].map(([k, l]) => `<tr class="ptot"><td><b>${l}</b>${goal[k] ? ` <span class="muted small">meta ${goal[k]}</span>` : ""}</td><td><b>${r0(mn[k])}</b> ${adec(mn[k], goal[k])}</td><td><b>${r0(ml[k])}</b> ${adec(ml[k], goal[k])}</td></tr>`).join("")}</table>
  <button class="btn small" data-a="mePautaCopy">Copiar día normal al día con legumbres (−2 cereales, −1 carnes, +2 legumbres)</button></details>`;
}
function editorHtml(c) {
  const ms = MW.menus; if (MW.k >= ms.length) MW.k = Math.max(0, ms.length - 1);
  const mn = ms[MW.k], pauta = MW.pauta, hasLeg = ms.some((x) => x.leg);
  const strip = `<div class="card plan-intro"><div class="card-t">Planes de alimentación por etapa</div><p class="muted small">Diseña un plan para cada etapa. La app le muestra al cliente el plan de la etapa marcada en su Timeline esa semana (las etapas se pintan en <b>Etapas</b>).</p>${phaseStrip(c)}</div>`;
  if (!ms.length && !Object.values(MW.pauta).some((v) => +v)) {
    const others = Object.keys(c.plans || {}).filter((p) => p !== MW.phase);
    return `${strip}<div class="card new-plan" style="--pc:${phaseColor(MW.phase)}"><div class="ps-name">${esc(MW.phase)}</div><p>Esta etapa aún no tiene plan de alimentación.</p>
      <div class="row gap">${others.map((p) => `<button class="btn primary" data-a="meFrom" data-p="${esc(p)}">Partir de una copia de ${esc(p)}</button>`).join("")}<button class="btn" data-a="meFrom" data-p="">Empezar vacío</button><label class="btn ghost">Importar plan<input type="file" accept=".json,application/json" hidden data-a-change="meImport"></label></div>
      ${others.length ? `<p class="muted small">Lo normal es copiar el plan de otra etapa y hacerle ajustes pequeños (gramajes de algún grupo).</p>` : ""}</div>`;
  }
  const head = `${strip}<div class="card" style="border-top:4px solid ${phaseColor(MW.phase)}"><div class="row between"><div class="card-t" style="font-size:15px;color:${phaseColor(MW.phase)}">Plan de ${esc(MW.phase)}</div><span class="row gap"><span class="muted small" title="Cada cambio se guarda y le llega al cliente al tiro. Si te equivocas usa ↶ Deshacer (Ctrl+Z)">Se guarda solo · ↶ Deshacer abajo</span><label class="btn" title="Archivo ima-planes.json con planes pasados desde PDF">Importar plan<input type="file" accept=".json,application/json" hidden data-a-change="meImport"></label></span></div>
  <p class="muted small">Cada opción es un día completo (entreno AM / PM, descanso, legumbres…). El cliente la ve en “Mi plan”, toca un alimento para ver los reemplazos de su grupo y arma su lista de compras.</p>
  ${MW.imported ? `<div class="note">Plan importado y publicado: revisa las opciones y la pauta. Si no era el que querías, toca ↶ Deshacer.</div>` : ""}
  <div class="seg scroll optseg">${ms.map((x, k) => `<button class="${k === MW.k ? "on" : ""}" style="--oc:${optColor(k)}" data-a="meOpt" data-k="${k}"><i class="gdot" style="background:${optColor(k)}"></i>${esc(x.name || "Opción " + (k + 1))}${x.leg ? " 🫘" : ""}</button>`).join("")}<button data-a="meAdd">＋ Nueva opción</button></div>
  ${ms.length && !hasLeg ? `<div class="note row between"><span>Falta el <b>día con legumbres</b>: arma una opción propia para ese día (no se le pide al cliente que modifique otra).</span><button class="btn small" data-a="meLegAdd">＋ Día con legumbres</button></div>` : ""}</div>
  ${targetsCard(c)}${pautaWarn()}${pautaCard(c)}`;
  if (!mn) return head;
  const oc = optColor(MW.k);
  const { t, por } = totals(mn);
  const pz = mn.leg && Object.values(MW.pautaLeg).some((v) => +v) ? MW.pautaLeg : pauta;
  const groups = PG().filter((g) => por[g] || pz[g]);
  const goal = MW.targets;
  const side = `<aside class="me-side" style="--oc:${oc}"><div class="card"><div class="card-t"><i class="gdot" style="background:${oc}"></i>${esc(mn.name || "Opción")}</div>
    <div class="muted small">Porciones de la opción / pauta ${mn.leg ? "del día con legumbres" : "del día normal"}</div>
    <table class="tbl side-t">${groups.map((g) => { const a = Math.round((por[g] || 0) * 100) / 100, b = +pz[g] || 0, ok = !b && !a ? "" : Math.abs(a - b) < 0.02 ? "okc" : a > b ? "hic" : "lowc"; return `<tr><td>${gdot(g)}${esc(g)}</td><td class="${ok}"><b>${fmtN(a) || 0}</b> / ${fmtN(b) || 0}</td></tr>`; }).join("") || `<tr><td class="muted small">Agrega alimentos o crea la pauta.</td></tr>`}</table>
    <div class="side-mac">${[["kcal", "Kcal"], ["cho", "CHO"], ["fat", "Lípidos"], ["prot", "Proteína"]].map(([k, l]) => { const e = goal[k] ? Math.abs(t[k] / goal[k] - 1) : null; return `<div class="${e == null ? "" : e <= 0.05 ? "okc" : e <= 0.1 ? "lowc" : "hic"}"><small>${l}</small><b>${r0(t[k])}</b>${goal[k] ? `<small>/ ${goal[k]} · ${r0((t[k] / goal[k]) * 100)} %</small>` : ""}</div>`; }).join("")}</div>
    <p class="muted small">Porciones: verde = igual a la pauta · amarillo = faltan · rojo = sobran. Macros vs meta: verde ±5 % · amarillo ±10 % · rojo más. Los extras suman kcal, no porciones.</p></div></aside>`;
  return `${head}<div class="me-grid"><div class="me-main" style="--oc:${oc}"><div class="card optcard"><div class="grid3"><label>Nombre de la opción<input value="${esc(mn.name || "")}" data-a-change="meF" data-f="name" placeholder="Ej: Día de entrenamiento"></label><label class="span2">Nota para el cliente (opcional)<input value="${esc(mn.note || "")}" data-a-change="meF" data-f="note"></label></div>
  <label class="chk mt"><input type="checkbox" ${mn.noTime ? "checked" : ""} data-a-change="meNoTime"> Sin horario fijo (el cliente ve “come cada 3 a 4 horas” en vez de las horas)</label>
  <label class="chk"><input type="checkbox" ${mn.leg ? "checked" : ""} data-a-change="meLeg"> Es el día con legumbres (se compara con la pauta del día con legumbres)</label>
  <div class="row gap mt"><button class="btn small" data-a="meDup">⧉ Duplicar opción</button><button class="btn small danger ghost" data-a="meDel">Eliminar opción</button></div></div>
  ${(mn.meals || []).map((m, i) => `<div class="card mecard"><div class="row gap"><input class="grow" value="${esc(m.name)}" data-a-change="meMeal" data-i="${i}" data-f="name" style="font-weight:700"><input type="time" value="${esc(m.time || "")}" data-a-change="meMeal" data-i="${i}" data-f="time" style="width:120px">
    <button class="icon-btn" data-a="meMealMove" data-i="${i}" data-n="-1" title="Subir">↑</button><button class="icon-btn" data-a="meMealMove" data-i="${i}" data-n="1" title="Bajar">↓</button><button class="icon-btn" data-a="meMealDel" data-i="${i}" title="Quitar">✕</button></div>
    <div class="meal-mac">${macTxt(mealTot(m))}</div>
    <label class="chk mt"><input type="checkbox" ${m.free ? "checked" : ""} data-a-change="meFree" data-i="${i}"> Libre durante el día (sin horario: lo reparte como pueda, ej. turno de trabajo)</label>
    ${m.free ? `<div class="small mt"><span class="muted">Aporte total de esta comida (opcional; si lo llenas, reemplaza la suma de los extras):</span> ${[["kcal", "Kcal"], ["cho", "CHO"], ["fat", "Lípidos"], ["prot", "Proteína"]].map(([k, l]) => `<label class="exin">${l}<input type="number" step="1" min="0" value="${m.budget?.[k] ?? ""}" data-a-change="meBudget" data-i="${i}" data-f="${k}"></label>`).join("")}</div>` : ""}
    <table class="tbl me-t"><tr><th>Alimento</th><th>Grupo</th><th>Porciones</th><th>Gramos</th><th>Medida casera</th><th></th></tr>
    ${(m.items || []).map((it, j) => `<tr style="--gc:${GCOL[it.cat] || "transparent"}" class="git"><td><input list="foodDL" value="${esc(it.name)}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="name" placeholder="Escribe y elige…"></td>
      <td><select data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="cat"><option value="">—</option>${Object.keys(GROUPS).map((g) => `<option ${g === it.cat ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></td>
      <td><input type="number" step="0.25" min="0" value="${it.por ?? ""}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="por" style="width:80px" ${it.gp ? "" : 'disabled title="Sin porción de intercambio: usa gramos"'}></td>
      <td><input type="number" step="1" min="0" value="${it.g ? r0(it.g) : ""}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="g" style="width:80px"></td>
      <td class="muted small">${esc(homeMeasure(it.g, it.medida, it.medidaG) || "")}</td><td><button class="icon-btn" data-a="meItDel" data-i="${i}" data-j="${j}">✕</button></td></tr>
      ${isExtra(it) && !hasBudget(m) ? `<tr class="exrow"><td colspan="6"><span class="badge">Extra</span> <span class="small muted">Aporte de ${it.g ? r0(it.g) + " g" : "esta cantidad"}:</span>
        ${[["kcal", "Kcal"], ["cho", "CHO"], ["fat", "Lípidos"], ["prot", "Proteína"]].map(([k, l]) => `<label class="exin">${l}<input type="number" step="0.1" min="0" value="${it[k] ?? ""}" data-a-change="meIt" data-i="${i}" data-j="${j}" data-f="${k}"></label>`).join("")}
        ${it.p100 ? '<span class="muted small">(sale de la base por 100 g: cambia solo con los gramos)</span>' : ""}</td></tr>` : ""}`).join("")}</table>
    <div class="row gap"><button class="btn small" data-a="meItAdd" data-i="${i}">＋ Alimento</button><button class="btn small" data-a="meExAdd" data-i="${i}" title="Alimento sin grupo de intercambio, con sus propios macros">＋ Extra</button><input class="grow small" value="${esc(m.note || "")}" placeholder="Nota de esta comida (opcional)" data-a-change="meMeal" data-i="${i}" data-f="note"></div></div>`).join("")}
  <button class="btn block ghost" data-a="meMealAdd">＋ Agregar tiempo de comida</button></div>${side}</div>`;
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
act("meExAdd", (el) => { const m = cur().meals[+el.dataset.i]; (m.items ||= []).push({ name: "", cat: "", por: null, gp: null, g: 0, kcal: 0, cho: 0, fat: 0, prot: 0 }); redraw(); });
act("meLeg", (el) => { cur().leg = el.checked; redraw(); });
act("mePhase", (el) => { loadMW(S._coachClient, el.dataset.p); redraw(false); }); // lo de la etapa anterior ya quedó guardado solo
act("meFrom", (el) => { const P = el.dataset.p ? S._coachClient.plans?.[el.dataset.p] : null; Object.assign(MW, { menus: clone(P?.menus || []), pauta: clone(P?.pauta || {}), pautaLeg: clone(P?.pautaLeg || {}), targets: {}, calc: {}, k: 0 }); if (!P) MW.menus = [newMenu("Opción 1")]; MW.exists = true; redraw(); toast(P ? `Copia del plan de ${el.dataset.p}: ajusta las metas y la pauta` : "Plan vacío creado"); });
act("meTg", (el) => { if (el.value === "") delete MW.targets[el.dataset.k]; else MW.targets[el.dataset.k] = num(el.value); const kg = S._coachClient?.lastKg; if (kg) MW.calc.kg = Math.round(kg * 10) / 10; redraw(); });
act("meCalc", (el) => { if (el.value === "") delete MW.calc[el.dataset.k]; else MW.calc[el.dataset.k] = num(el.value); redraw(); });
act("meTgCalc", () => { const c = S._coachClient, R = calcRes(c); MW.targets = { kcal: R.kcal, cho: R.cho, fat: R.fat, prot: R.prot }; if (c.lastKg) MW.calc.kg = Math.round(c.lastKg * 10) / 10; redraw(); });
act("meTgPauta", () => { const m = pautaMac(MW.pauta, pautaExtras(MW.menus)), kg = S._coachClient?.lastKg; MW.targets = { kcal: r0(m.kcal), cho: r0(m.cho), fat: r0(m.fat), prot: r0(m.prot) }; if (kg) MW.calc.kg = Math.round(kg * 10) / 10; redraw(); });
act("mePauta", (el) => { const p = el.dataset.p === "l" ? MW.pautaLeg : MW.pauta; if (el.value === "") delete p[el.dataset.g]; else p[el.dataset.g] = num(el.value); MW.openPauta = true; redraw(); });
act("mePautaOpen", (el) => { MW.openPauta = !el.parentElement.open; });
act("mePautaCopy", async () => {
  if (Object.values(MW.pautaLeg).some((v) => +v) && !(await confirmBox("¿Reemplazar la pauta del día con legumbres?"))) return;
  const p = { ...MW.pauta }; p["Cereales"] = Math.max(0, (+p["Cereales"] || 0) - 2); p["Legumbres"] = (+p["Legumbres"] || 0) + 2;
  if (+p["Carnes grasas"] >= 1) p["Carnes grasas"] -= 1; else p["Carnes magras"] = Math.max(0, (+p["Carnes magras"] || 0) - 1);
  MW.pautaLeg = p; MW.openPauta = true; redraw();
});
// El día con legumbres es una opción propia del plan: parte como copia de la opción elegida y se ajusta a su pauta
act("meLegAdd", () => { const x = clone(cur() || newMenu("")); x.id = uid(); x.name = "Día con legumbres"; x.leg = true; x.note = x.note || "Para los días que comes porotos, lentejas o garbanzos."; MW.menus.push(x); MW.k = MW.menus.length - 1; redraw(); toast("Ajusta los alimentos a la pauta del día con legumbres"); });
act("meNoTime", (el) => { cur().noTime = el.checked; redraw(); });
act("meFree", (el) => { const m = cur().meals[+el.dataset.i]; m.free = el.checked; if (m.free) m.time = ""; redraw(); });
act("meBudget", (el) => { const m = cur().meals[+el.dataset.i]; (m.budget ||= {})[el.dataset.f] = el.value === "" ? null : num(el.value); redraw(); });
act("meItDel", (el) => { cur().meals[+el.dataset.i].items.splice(+el.dataset.j, 1); redraw(); });
act("meIt", async (el) => {
  const it = cur().meals[+el.dataset.i].items[+el.dataset.j], f = el.dataset.f, v = el.value;
  if (f === "name") {
    it.name = v.trim(); const x = (await foodIndex()).get(nk(v));
    if (x) { it.name = x.name; it.cat = x.cat || ""; it.gp = x.portion || null; it.medida = x.medida || ""; it.medidaG = x.medidaG || null; }
    else { it.gp = null; it.medida = ""; it.medidaG = null; }
    if (it.gp) { it.por = it.por || 1; it.g = r1(it.por * it.gp); delete it.p100; } else { it.por = null; }
    // Sin grupo: si la base trae su aporte por 100 g, el extra calcula sus macros con los gramos
    if (x && !it.gp && isExtra(it) && x.kcal) { it.p100 = [x.kcal, x.cho, x.fat, x.prot].map((v) => +v || 0); exCalc(it); }
  } else if (f === "cat") it.cat = v;
  else if (f === "por") { it.por = num(v); if (it.gp) it.g = r1(it.por * it.gp); }
  else if (f === "g") { it.g = num(v); if (it.gp) it.por = Math.round((it.g / it.gp) * 100) / 100; exCalc(it); }
  else if (["kcal", "cho", "fat", "prot"].includes(f)) { it[f] = num(v) || 0; delete it.p100; }
  redraw();
});
const exCalc = (it) => { if (it.p100 && it.g) ["kcal", "cho", "fat", "prot"].forEach((k, i) => (it[k] = r1((it.p100[i] * it.g) / 100))); };
// Guardar el plan de una etapa. silent = guardado automático (no re-dibuja ni avisa, para no sacarte del campo en que escribes)
export async function savePlan(W, silent) {
  const menus = W.menus.map((mn) => ({ ...mn, meals: mn.meals.map((m) => ({ ...m, items: (m.items || []).filter((it) => it.name) })) }));
  const clean = (p) => Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v !== "" && v != null && !isNaN(+v)).map(([g, v]) => [g, +v]));
  const c0 = S._coachClient || {}, c = c0.id === W.cid ? c0 : { id: W.cid }; // si ya cambiaste de cliente, se guarda igual en el que corresponde
  if (!W.calc.kg && c.lastKg && +W.targets.kcal) W.calc.kg = Math.round(c.lastKg * 10) / 10; // peso con el que quedan las metas (para avisar si cambia)
  const plan = { menus, pauta: clean(W.pauta), pautaLeg: clean(W.pautaLeg), targets: clean(W.targets), calc: { ...W.calc }, at: Date.now() };
  const plans = { ...(c.plans || {}), [W.phase]: plan }, data = { plans };
  // El plan de la etapa actual también queda como plan general (respaldo para semanas sin etapa)
  if (c.phaseList?.find((x) => x.phase === W.phase)?.current) Object.assign(data, { menus: plan.menus, pauta: plan.pauta, pautaLeg: plan.pautaLeg });
  await db.set("clients/" + W.cid, data); W.exists = true;
  if (c === c0) { Object.assign(c, data); const ph = c.phaseList?.find((x) => x.phase === W.phase); if (ph) ph.ready = true; }
  W.dirty = false; window.dispatchEvent(new Event("ima-alerts"));
  if (!silent) { W.menus = clone(menus); W.imported = false; if (W === MW) redraw(false); toast(`Plan de ${W.phase} publicado ✓`); }
}
act("meSave", () => savePlan(MW, false));
// Guardado automático y Deshacer (undo.js)
undoSource("plan", {
  ctx: () => (MW && document.getElementById("menuEd") ? MW : null),
  key: (W) => `${W.cid}|${W.phase}`,
  snap: (W) => ({ menus: W.menus, pauta: W.pauta, pautaLeg: W.pautaLeg, targets: W.targets, calc: W.calc }),
  apply: (W, x) => { Object.assign(W, clone(x)); W.k = Math.max(0, Math.min(W.k, W.menus.length - 1)); if (W === MW) redraw(); },
  save: (W) => savePlan(W, true)
});
// Importar un plan pasado desde PDF (archivo ima-planes.json, se prepara aparte: no queda en el repositorio público)
const nameKey = (s) => nk(s).split(/\s+/).filter(Boolean);
act("meImport", async (el) => {
  let data; try { data = JSON.parse(await el.files[0].text()); } catch { return toast("El archivo no es válido"); } finally { el.value = ""; }
  if (data.type !== "ima-planes" || !Array.isArray(data.plans)) return toast("Este archivo no es un plan de IMA");
  const c = S._coachClient || {}, ck = nameKey(c.name);
  // Mismo cliente = coinciden el primer nombre y el apellido (con o sin tildes)
  const found = data.plans.find((p) => { const pk = nameKey(p.name); return pk[0] === ck[0] && pk.slice(1).some((w) => ck.includes(w)); });
  if (found) return loadPlan(found);
  sheet("Importar plan", `<p class="muted small">No encontré un plan con el nombre de <b>${esc(c.name || "este cliente")}</b>. ¿Cuál quieres cargar?</p>
  ${data.plans.map((p, k) => `<button class="btn big block" data-a="meImportPick" data-k="${k}">${esc(p.name)} · ${p.menus.length} opciones</button>`).join("")}`);
  MW.importData = data;
});
act("meImportPick", (el) => { closeSheet(); loadPlan(MW.importData.plans[+el.dataset.k]); });
async function loadPlan(p) {
  // El plan trae su etapa (ej. Mantención): se carga en esa pestaña si el cliente la tiene; si no, en la que estás viendo
  const c = S._coachClient || {};
  if (p.phase && p.phase !== MW.phase && c.phaseList?.some((x) => x.phase === p.phase)) loadMW(c, p.phase);
  const n = p.menus.length, prev = MW.menus.length;
  if (!(await confirmBox(`Cargar el plan de ${p.name}${p.phase ? ` (${p.phase})` : ""} en la etapa ${MW.phase}: ${n} opciones (${p.menus.map((m) => m.name).join(", ")})${p.targets ? ` y sus metas (${p.targets.kcal} kcal · C ${p.targets.cho} · L ${p.targets.fat} · P ${p.targets.prot})` : ""}.${prev ? ` Reemplaza las ${prev} opciones que tiene ahora.` : ""} Se publica al tiro (si te equivocas, ↶ Deshacer).`))) return;
  if (p.targets) MW.targets = { ...p.targets };
  if (p.calc) MW.calc = { ...p.calc };
  MW.menus = clone(p.menus).map((mn) => ({ ...mn, id: uid() })); MW.k = 0;
  if (p.pauta && Object.keys(p.pauta).length) MW.pauta = { ...p.pauta };
  if (p.pautaLeg && Object.keys(p.pautaLeg).length) MW.pautaLeg = { ...p.pautaLeg };
  MW.imported = true; MW.exists = true;
  redraw(); toast("Plan cargado y publicado: revísalo");
}
export const menusDirty = () => !!MW?.dirty;
