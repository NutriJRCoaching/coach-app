// Reproductor de la retroalimentación del coach: velocidad, subtítulos, capítulos, % visto
// y, al terminar, una mini encuesta (calificación, dudas, qué faltó) que le llega al coach.
import { db } from "./db.js";
import { S } from "./state.js";
import { act, toast, sheet, closeSheet, $, $$ } from "./ui.js";
import { esc, embedUrl, LS } from "./util.js";

const SPEEDS = [1, 1.25, 1.5, 2];
const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
const vttTime = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = (x % 60).toFixed(3).padStart(6, "0"); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s}`; };
function vtt(cues) {
  return "WEBVTT\n\n" + cues.map((c, i) => {
    const e = Math.max(c.e, c.s + 1.2), nx = cues[i + 1]?.s;
    return `${vttTime(c.s)} --> ${vttTime(nx ? Math.min(e, nx) : e)}\n${c.t}`;
  }).join("\n\n");
}
// Archivo de video directo (Firebase Storage u otro) → reproductor propio. Drive/YouTube → su reproductor.
const isFile = (u) => /firebasestorage|\.webm|\.mp4|^blob:/i.test(u || "");
let P = null; // { fb, path, max, saved }

export async function openFeedbackPlayer(fb) {
  const path = `clients/${S.cid}/fbreplies/${fb.week}`;
  const prev = (await db.get(path)) || {};
  P = { fb, path, max: prev.viewed || 0, saved: prev.viewed || 0, prev };
  const u = fb.videoUrl, emb = !isFile(u) && embedUrl(u);
  const sp = +LS.get("fbSpeed") || 1;
  let video = "";
  if (isFile(u)) {
    const track = fb.cues?.length ? `<track kind="subtitles" srclang="es" label="Español" src="${URL.createObjectURL(new Blob([vtt(fb.cues)], { type: "text/vtt" }))}" ${LS.get("fbCC") === "0" ? "" : "default"}>` : "";
    video = `<div class="fbplayer"><video id="fbVid" src="${esc(u)}" controls playsinline preload="metadata" crossorigin="anonymous">${track}</video>
    <div class="fbctl"><span class="muted small">Velocidad</span>${SPEEDS.map((x) => `<button class="chip ${x === sp ? "on" : ""}" data-a="fbSpeed" data-v="${x}">${String(x).replace(".", ",")}x</button>`).join("")}
    ${fb.cues?.length ? `<button class="chip ${LS.get("fbCC") === "0" ? "" : "on"}" data-a="fbCC">CC Subtítulos</button>` : ""}</div>
    ${fb.chapters?.length ? `<div class="fbch">${fb.chapters.map((c) => `<button data-a="fbJump" data-s="${c.s}"><b>${mmss(c.s)}</b> ${esc(c.t)}</button>`).join("")}</div>` : ""}</div>`;
  } else if (emb) {
    video = `<div class="video"><iframe src="${emb}" allowfullscreen allow="autoplay; fullscreen"></iframe></div>
    ${fb.chapters?.length ? `<div class="fbch static">${fb.chapters.map((c) => `<span><b>${mmss(c.s)}</b> ${esc(c.t)}</span>`).join("")}</div>` : ""}`;
  } else if (u) video = `<a class="btn primary" target="_blank" href="${esc(u)}">Abrir video</a>`;
  const done = prev.rating || prev.duda || prev.falto;
  sheet("Tu retroalimentación", `${video}
    ${fb.text ? `<p>${esc(fb.text)}</p>` : ""}${(fb.points || []).length ? `<ul class="fbpts">${fb.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    <div id="fbSurvey">${done ? thanks() : isFile(u) && P.max < 90 ? `<p class="muted small center">Al terminar el video te haré 3 preguntas cortas 🙌</p>` : survey()}</div>`, { wide: true, onClose: saveViewed });
  const v = $("#fbVid");
  if (v) {
    v.playbackRate = sp;
    v.addEventListener("timeupdate", () => { if (v.duration) P.max = Math.max(P.max, (v.currentTime / v.duration) * 100); if (P.max - P.saved >= 20) saveViewed(); });
    v.addEventListener("ended", () => { P.max = 100; saveViewed(); const box = $("#fbSurvey"); if (box && !box.querySelector(".fbsv, .fbthanks")) { box.innerHTML = survey(); box.scrollIntoView({ behavior: "smooth" }); } });
  }
}
function survey(r = P?.prev || {}) {
  return `<div class="fbsv"><h3>¿Qué te pareció?</h3>
  <label>Califica esta retroalimentación</label><div class="stars-in">${[1, 2, 3, 4, 5].map((n) => `<button data-a="fbStar" data-n="${n}" class="${n <= (r.rating || 0) ? "on" : ""}">★</button>`).join("")}</div>
  <label>¿Tienes alguna duda o consulta?<textarea id="svDuda" rows="2" placeholder="Opcional">${esc(r.duda || "")}</textarea></label>
  <label>¿Sientes que hubo algo que faltó mencionar?<textarea id="svFalto" rows="2" placeholder="Opcional">${esc(r.falto || "")}</textarea></label>
  <button class="btn primary block" data-a="fbSend">Enviar a mi coach</button></div>`;
}
const thanks = () => `<div class="fbthanks">✅ Le enviaste tu respuesta a tu coach. <button class="btn ghost small" data-a="fbEdit">Editar</button></div>`;
async function saveViewed() {
  if (!P || P.max <= P.saved) return;
  P.saved = Math.round(P.max);
  try { await db.set(P.path, { viewed: P.saved, viewedAt: Date.now() }); } catch {}
}
act("fbSpeed", (el) => { const v = $("#fbVid"); if (!v) return; v.playbackRate = +el.dataset.v; LS.set("fbSpeed", el.dataset.v); $$(".fbctl [data-a=fbSpeed]").forEach((b) => b.classList.toggle("on", b === el)); });
act("fbCC", (el) => { const t = $("#fbVid")?.textTracks?.[0]; if (!t) return; const on = t.mode !== "showing"; t.mode = on ? "showing" : "hidden"; LS.set("fbCC", on ? "1" : "0"); el.classList.toggle("on", on); });
act("fbJump", (el) => { const v = $("#fbVid"); if (!v) return; v.currentTime = +el.dataset.s; v.play().catch(() => {}); });
act("fbStar", (el) => { const n = +el.dataset.n; P.rating = n; $$(".stars-in button").forEach((b) => b.classList.toggle("on", +b.dataset.n <= n)); });
act("fbEdit", () => { $("#fbSurvey").innerHTML = survey(); });
act("fbSend", async () => {
  const rating = P.rating || P.prev.rating || 0, duda = $("#svDuda").value.trim(), falto = $("#svFalto").value.trim();
  if (!rating && !duda && !falto) return toast("Pon al menos una calificación");
  const r = { rating, duda, falto, at: Date.now(), seen: false, viewed: Math.round(Math.max(P.max, P.saved)) };
  await db.set(P.path, r); P.prev = { ...P.prev, ...r };
  $("#fbSurvey").innerHTML = thanks(); toast("Enviado a tu coach ✓");
});
