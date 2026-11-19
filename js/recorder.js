// Grabador de retroalimentación tipo Loom: graba esta pestaña (o la pantalla) con la cara del coach en una burbuja,
// transcribe en vivo lo que dice (reconocimiento de voz de Chrome, gratis) y sube el video a su Google Drive.
import { CONFIG } from "./config.js";
import { act, toast, $, bindActions } from "./ui.js";
import { esc, LS } from "./util.js";

let R = null; // grabación en curso
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Un "reloj" en un worker: sigue marcando aunque la pestaña quede en segundo plano (requestAnimationFrame se congela)
function ticker(ms, fn) {
  const w = new Worker(URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: "text/javascript" })));
  w.onmessage = fn; return () => w.terminate();
}

// Ventana flotante (Picture-in-Picture de Chrome): ahí van los controles y tu guía, y NO salen en el video
let PIP = null;
async function openPip(guideHtml) {
  if (!window.documentPictureInPicture) return null;
  try {
    const w = await documentPictureInPicture.requestWindow({ width: 460, height: 640 });
    const d = w.document;
    d.documentElement.dataset.theme = document.documentElement.dataset.theme || "dark";
    const l = d.createElement("link"); l.rel = "stylesheet"; l.href = new URL("css/app.css", location.href).href; d.head.appendChild(l);
    d.title = "IMA · Grabando";
    d.body.className = "pipbody";
    d.body.innerHTML = `<div id="pipbar"></div><div class="pipguide">${guideHtml || ""}</div><p class="muted small">Esta ventana no sale en el video. Muévela donde te acomode.</p>`;
    bindActions(d);
    w.addEventListener("pagehide", () => { PIP = null; if (R) bar(); });
    return (PIP = w);
  } catch { return null; }
}

export async function startRecording({ onDone, guideHtml }) {
  if (R) return;
  if (!navigator.mediaDevices?.getDisplayMedia) return toast("Este navegador no permite grabar la pantalla (usa Chrome en el computador)");
  await openPip(guideHtml);
  document.body.classList.add("rec-on"); document.body.classList.toggle("rec-pip", !!PIP); // oculta los otros clientes, tus pendientes y el preanálisis
  let screen, cam;
  try { cam = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: "user" }, audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { endUI(); return toast("Necesito permiso para la cámara y el micrófono"); }
  bubble(cam); // tu cara aparece altiro, antes de elegir qué compartir
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, height: { max: 1080 } }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "include" });
  } catch { cam.getTracks().forEach((t) => t.stop()); endUI(); return toast("Grabación cancelada"); }
  const vt = screen.getVideoTracks()[0], surface = vt.getSettings().displaySurface;
  let videoTrack, stopTick = () => {};
  if (surface === "browser") {
    // Grabando esta pestaña: la burbuja y los dibujos son parte de la página, así que salen tal cual los ves
    try { await vt.applyConstraints({ height: { max: 720 }, frameRate: 30 }); } catch {}
    videoTrack = vt;
  } else {
    // Grabando una ventana o la pantalla completa: se arma el video con la burbuja abajo a la izquierda
    const vs = Object.assign(document.createElement("video"), { muted: true, playsInline: true, srcObject: screen });
    const vc = Object.assign(document.createElement("video"), { muted: true, playsInline: true, srcObject: new MediaStream(cam.getVideoTracks()) });
    await Promise.all([vs.play(), vc.play()]);
    const st = vt.getSettings(), sc = Math.min(1, 720 / (st.height || 1080));
    const W = Math.round((st.width || 1920) * sc / 2) * 2, H = Math.round((st.height || 1080) * sc / 2) * 2;
    const cv = Object.assign(document.createElement("canvas"), { width: W, height: H }), g = cv.getContext("2d");
    const D = Math.round(H * 0.26), X = Math.round(W * 0.025), Y = H - D - Math.round(H * 0.04);
    stopTick = ticker(33, () => {
      g.drawImage(vs, 0, 0, W, H);
      if (R?.camOff) return;
      const cw = vc.videoWidth || 480, ch = vc.videoHeight || 480, s2 = Math.min(cw, ch);
      g.save(); g.beginPath(); g.arc(X + D / 2, Y + D / 2, D / 2, 0, Math.PI * 2); g.clip(); g.translate(X + D, Y); g.scale(-1, 1); g.drawImage(vc, (cw - s2) / 2, (ch - s2) / 2, s2, s2, 0, 0, D, D); g.restore();
      g.beginPath(); g.arc(X + D / 2, Y + D / 2, D / 2, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = "#d1262f"; g.stroke();
    });
    videoTrack = cv.captureStream(30).getVideoTracks()[0];
  }
  const out = new MediaStream([videoTrack, ...cam.getAudioTracks()]);
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 64_000 });
  const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  R = { rec, chunks, t0: Date.now(), paused: 0, pausedAt: 0, transcript: "", interim: "", cues: [], marks: [], uStart: null, onDone, cam, color: "#ef4444", stopAll: () => { stopTick(); screen.getTracks().forEach((t) => t.stop()); cam.getTracks().forEach((t) => t.stop()); } };
  vt.onended = () => stopRecording(); // si toca "Dejar de compartir" en Chrome
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const sr = new SR(); sr.lang = "es-CL"; sr.continuous = true; sr.interimResults = true;
    sr.onresult = (e) => {
      let it = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (R.uStart == null) R.uStart = Math.max(0, elapsed() - 0.6);
        if (e.results[i].isFinal) {
          if (t) { const txt = t.charAt(0).toUpperCase() + t.slice(1) + "."; R.transcript += (R.transcript ? " " : "") + txt; R.cues.push({ s: +R.uStart.toFixed(1), e: +elapsed().toFixed(1), t: txt }); }
          R.uStart = null;
        } else it += t;
      }
      R.interim = it;
    };
    sr.onend = () => { if (R && R.rec.state === "recording") try { sr.start(); } catch {} };
    try { sr.start(); R.sr = sr; } catch {}
  }
  drawLayer();
  await countdown();
  rec.start(1000); R.t0 = Date.now(); R.started = true;
  bar();
}

// ---------- Burbuja con tu cara: se ve mientras grabas, se arrastra y cambia de tamaño
const BS = [140, 200, 280];
function bubble(cam) {
  cleanupUI();
  const b = document.createElement("div"); b.id = "recbub"; b.className = "recbub";
  const size = +LS.get("bubSize") || 1; b.style.setProperty("--bs", BS[size] + "px");
  const pos = JSON.parse(LS.get("bubPos") || "null");
  if (pos) { b.style.left = Math.min(pos.x, innerWidth - 120) + "px"; b.style.top = Math.min(pos.y, innerHeight - 120) + "px"; } else { b.style.left = "24px"; b.style.top = innerHeight - BS[size] - 90 + "px"; }
  const v = Object.assign(document.createElement("video"), { muted: true, playsInline: true, autoplay: true, srcObject: new MediaStream(cam.getVideoTracks()) });
  b.appendChild(v); document.body.appendChild(b);
  let d = null;
  b.addEventListener("pointerdown", (e) => { d = { x: e.clientX - b.offsetLeft, y: e.clientY - b.offsetTop }; b.setPointerCapture(e.pointerId); });
  b.addEventListener("pointermove", (e) => { if (!d) return; b.style.left = Math.max(0, Math.min(innerWidth - b.offsetWidth, e.clientX - d.x)) + "px"; b.style.top = Math.max(0, Math.min(innerHeight - b.offsetHeight, e.clientY - d.y)) + "px"; });
  b.addEventListener("pointerup", () => { d = null; LS.set("bubPos", JSON.stringify({ x: b.offsetLeft, y: b.offsetTop })); });
}
act("bubSize", () => { const b = $("#recbub"); if (!b) return; const n = ((+LS.get("bubSize") || 1) + 1) % 3; LS.set("bubSize", n); b.style.setProperty("--bs", BS[n] + "px"); });
act("bubHide", () => { const b = $("#recbub"); if (!b || !R) return; R.camOff = !R.camOff; b.hidden = R.camOff; bar(); });

// ---------- Dibujar sobre la pantalla (se borra solo a los 4 s, como en Loom)
function drawLayer() {
  const c = document.createElement("canvas"); c.id = "recdraw"; c.className = "recdraw"; c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const g = c.getContext("2d"); g.scale(devicePixelRatio, devicePixelRatio); g.lineCap = g.lineJoin = "round";
  const strokes = []; let cur = null;
  c.addEventListener("pointerdown", (e) => { cur = { color: R.color, w: R.color === "rgba(250,204,21,.45)" ? 18 : 4, pts: [[e.clientX, e.clientY]], t: Date.now() }; strokes.push(cur); c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove", (e) => { if (cur) { cur.pts.push([e.clientX, e.clientY]); cur.t = Date.now(); } });
  c.addEventListener("pointerup", () => (cur = null));
  const loop = () => {
    if (!document.getElementById("recdraw")) return;
    g.clearRect(0, 0, c.width, c.height);
    const now = Date.now();
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s2 = strokes[i], age = s2 === cur ? 0 : now - s2.t;
      if (age > 4500) { strokes.splice(i, 1); continue; }
      g.globalAlpha = age > 3500 ? 1 - (age - 3500) / 1000 : 1; g.strokeStyle = s2.color; g.lineWidth = s2.w;
      g.beginPath(); s2.pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    g.globalAlpha = 1; requestAnimationFrame(loop);
  };
  loop();
  R.clearDraw = () => (strokes.length = 0);
}
act("drawTog", () => { const c = $("#recdraw"); if (!c || !R) return; R.drawing = !R.drawing; c.classList.toggle("on", R.drawing); bar(); });
act("drawColor", (el) => { if (!R) return; R.color = el.dataset.c; R.drawing = true; $("#recdraw")?.classList.add("on"); bar(); });
act("drawClear", () => R?.clearDraw?.());
function countdown() {
  return new Promise((res) => { const d = document.createElement("div"); d.className = "reccount"; document.body.appendChild(d); let n = 3; const tick = () => { if (!n) { d.remove(); return res(); } d.textContent = n--; setTimeout(tick, 800); }; tick(); });
}
function cleanupUI() { ["recbub", "recdraw", "recbar"].forEach((id) => document.getElementById(id)?.remove()); }
function endUI() { cleanupUI(); document.body.classList.remove("rec-on", "rec-pip"); try { PIP?.close(); } catch {} PIP = null; }

// Segundos grabados sin contar las pausas
function elapsed() { if (!R || !R.started) return 0; return ((R.pausedAt || Date.now()) - R.t0 - R.paused) / 1000; }
act("recMark", () => { if (!R) return; R.marks.push(Math.round(elapsed())); toast(`Capítulo marcado en ${fmt(elapsed())}`); });
function bar() {
  const host = PIP ? PIP.document.getElementById("pipbar") : document.body, doc = PIP ? PIP.document : document;
  if (PIP) document.getElementById("recbar")?.remove();
  let b = doc.getElementById("recbar");
  if (!b) { b = doc.createElement("div"); b.id = "recbar"; b.className = "recbar" + (PIP ? " inpip" : ""); host.appendChild(b); }
  const secs = () => ((R.pausedAt || Date.now()) - R.t0 - R.paused) / 1000;
  const C = [["#ef4444", "Rojo"], ["#ffffff", "Blanco"], ["rgba(250,204,21,.45)", "Destacador"]];
  b.innerHTML = `<span class="rdot ${R.pausedAt ? "p" : ""}"></span><b id="recT">${fmt(secs())}</b>
    <button class="rb" data-a="recPause" title="Pausar">${R.pausedAt ? "▶" : "❚❚"}</button>
    <button class="rb" data-a="recMark" title="Marcar un capítulo (ej. cuando cambias de tema)">🔖</button>
    <span class="rsep"></span><button class="rb ${R.drawing ? "on" : ""}" data-a="drawTog" title="Dibujar (se borra solo)">✏️</button>${C.map(([c, l]) => `<button class="rb sw ${R.drawing && R.color === c ? "on" : ""}" data-a="drawColor" data-c="${c}" title="${l}"><i style="background:${c}"></i></button>`).join("")}<button class="rb" data-a="drawClear" title="Borrar dibujos">⌫</button>
    <span class="rsep"></span><button class="rb" data-a="bubSize" title="Tamaño de la burbuja">◐</button><button class="rb ${R.camOff ? "on" : ""}" data-a="bubHide" title="Ocultar cámara">${R.camOff ? "🙈" : "📷"}</button>
    <button class="rb stop" data-a="recStop" title="Terminar">■ Terminar</button>`;
  clearInterval(R.iv); R.iv = setInterval(() => { const t = doc.getElementById("recT"); if (t) t.textContent = fmt(secs()); }, 500);
}
act("recPause", () => {
  if (!R) return;
  if (R.pausedAt) { R.paused += Date.now() - R.pausedAt; R.pausedAt = 0; R.rec.resume(); } else { R.pausedAt = Date.now(); R.rec.pause(); }
  bar();
});
act("recStop", () => stopRecording());
export function stopRecording() {
  if (!R || R.rec.state === "inactive") return;
  const r = R;
  r.rec.onstop = () => {
    r.stopAll(); clearInterval(r.iv); endUI();
    try { r.sr?.stop(); } catch {}
    const blob = new Blob(r.chunks, { type: "video/webm" }), secs = Math.round(((r.pausedAt || Date.now()) - r.t0 - r.paused) / 1000);
    R = null; r.onDone?.({ blob, secs, transcript: (r.transcript + (r.interim ? " " + r.interim : "")).trim(), cues: r.cues, marks: r.marks });
  };
  r.rec.stop();
}

// ---------- Google Drive (solo el coach): la app solo puede ver y tocar los archivos que ella misma sube (permiso drive.file)
let tokenClient = null, token = null, tokenExp = 0;
async function gis() {
  if (window.google?.accounts?.oauth2) return;
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function getToken() {
  if (token && Date.now() < tokenExp - 60000) return token;
  await gis();
  return new Promise((res, rej) => {
    tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CONFIG.googleClientId, scope: "https://www.googleapis.com/auth/drive.file", callback: (r) => { if (r.error) return rej(r); token = r.access_token; tokenExp = Date.now() + r.expires_in * 1000; res(token); } });
    tokenClient.requestAccessToken({ prompt: token ? "" : "consent" });
  });
}
const api = async (url, opts = {}) => { const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + (await getToken()), ...(opts.headers || {}) } }); if (!r.ok) throw new Error((await r.text()).slice(0, 200)); return r; };
async function folderId() {
  const k = LS.get("driveFolder"); if (k) return k;
  const f = await (await api("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "IMA · Retroalimentaciones", mimeType: "application/vnd.google-apps.folder" }) })).json();
  LS.set("driveFolder", f.id); return f.id;
}
// Sube el video (subida reanudable), lo deja visible para quien tenga el link y devuelve el link
export async function uploadToDrive(blob, name, onProgress) {
  if (!CONFIG.googleClientId) throw new Error("Falta configurar el acceso a Google Drive");
  const parent = await folderId();
  const init = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": blob.type || "video/webm", "X-Upload-Content-Length": blob.size }, body: JSON.stringify({ name, parents: [parent] }) });
  const url = init.headers.get("Location");
  const file = await new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open("PUT", url); x.setRequestHeader("Content-Type", blob.type || "video/webm");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => (x.status < 300 ? res(JSON.parse(x.responseText)) : rej(new Error("No se pudo subir (" + x.status + ")")));
    x.onerror = () => rej(new Error("Se cortó la conexión")); x.send(blob);
  });
  await api(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" }) });
  return file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
}
export const driveReady = () => !!CONFIG.googleClientId;
export const recSupported = () => !!(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder);
export const transcriptHtml = (t) => esc(t);
