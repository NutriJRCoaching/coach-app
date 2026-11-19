// Grabador de retroalimentación tipo Loom: graba esta pestaña (o la pantalla) con la cara del coach en una burbuja,
// transcribe en vivo lo que dice (reconocimiento de voz de Chrome, gratis) y sube el video a su Google Drive.
import { CONFIG } from "./config.js";
import { act, toast, $ } from "./ui.js";
import { esc, LS } from "./util.js";

let R = null; // grabación en curso
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Un "reloj" en un worker: sigue marcando aunque la pestaña quede en segundo plano (requestAnimationFrame se congela)
function ticker(ms, fn) {
  const w = new Worker(URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: "text/javascript" })));
  w.onmessage = fn; return () => w.terminate();
}

export async function startRecording({ onDone }) {
  if (R) return;
  if (!navigator.mediaDevices?.getDisplayMedia) return toast("Este navegador no permite grabar la pantalla (usa Chrome en el computador)");
  let screen, cam;
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "include" });
  } catch { return toast("Grabación cancelada"); }
  try { cam = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: "user" }, audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { screen.getTracks().forEach((t) => t.stop()); return toast("Necesito permiso para la cámara y el micrófono"); }

  const vs = Object.assign(document.createElement("video"), { muted: true, playsInline: true, srcObject: screen });
  const vc = Object.assign(document.createElement("video"), { muted: true, playsInline: true, srcObject: new MediaStream(cam.getVideoTracks()) });
  await Promise.all([vs.play(), vc.play()]);
  // Se graba en 720p a ~1,2 Mbps (≈ 9 MB por minuto): el texto de la pantalla se lee bien y el Drive no se llena
  const st = screen.getVideoTracks()[0].getSettings(), sc = Math.min(1, 720 / (st.height || 1080));
  const W = Math.round((st.width || 1920) * sc / 2) * 2, H = Math.round((st.height || 1080) * sc / 2) * 2;
  const cv = Object.assign(document.createElement("canvas"), { width: W, height: H }), g = cv.getContext("2d");
  const D = Math.round(Math.min(W, H) * 0.26), X = Math.round(W * 0.025), Y = H - D - Math.round(H * 0.04);
  const draw = () => {
    g.drawImage(vs, 0, 0, W, H);
    // burbuja redonda con la cámara (espejada), borde rojo IMA
    const cw = vc.videoWidth || 480, ch = vc.videoHeight || 480, s = Math.min(cw, ch);
    g.save(); g.beginPath(); g.arc(X + D / 2, Y + D / 2, D / 2, 0, Math.PI * 2); g.closePath(); g.clip();
    g.translate(X + D, Y); g.scale(-1, 1); g.drawImage(vc, (cw - s) / 2, (ch - s) / 2, s, s, 0, 0, D, D); g.restore();
    g.beginPath(); g.arc(X + D / 2, Y + D / 2, D / 2, 0, Math.PI * 2); g.lineWidth = Math.max(4, D * 0.03); g.strokeStyle = "#d1262f"; g.stroke();
  };
  const stopTick = ticker(33, draw);
  const out = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...cam.getAudioTracks()]);
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 64_000 });
  const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  R = { rec, chunks, t0: Date.now(), paused: 0, pausedAt: 0, transcript: "", interim: "", onDone, stopAll: () => { stopTick(); screen.getTracks().forEach((t) => t.stop()); cam.getTracks().forEach((t) => t.stop()); } };
  screen.getVideoTracks()[0].onended = () => stopRecording(); // si toca "Dejar de compartir" en Chrome
  // transcripción en vivo (si el navegador lo permite)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const sr = new SR(); sr.lang = "es-CL"; sr.continuous = true; sr.interimResults = true;
    sr.onresult = (e) => { let it = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript.trim(); if (e.results[i].isFinal) R.transcript += (R.transcript ? " " : "") + t.charAt(0).toUpperCase() + t.slice(1) + "."; else it += t; } R.interim = it; };
    sr.onend = () => { if (R && R.rec.state !== "inactive") try { sr.start(); } catch {} }; // Chrome corta cada ~1 min: se reanuda
    try { sr.start(); R.sr = sr; } catch {}
  }
  rec.start(1000);
  bar();
}
function bar() {
  let b = $("#recbar");
  if (!b) { b = document.createElement("div"); b.id = "recbar"; b.className = "recbar"; document.body.appendChild(b); }
  const secs = () => ((R.pausedAt || Date.now()) - R.t0 - R.paused) / 1000;
  b.innerHTML = `<span class="rdot ${R.pausedAt ? "p" : ""}"></span><b id="recT">${fmt(secs())}</b><button class="btn tiny" data-a="recPause">${R.pausedAt ? "Seguir" : "Pausar"}</button><button class="btn tiny primary" data-a="recStop">Terminar</button>`;
  clearInterval(R.iv); R.iv = setInterval(() => { const t = $("#recT"); if (t) t.textContent = fmt(secs()); }, 500);
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
    r.stopAll(); clearInterval(r.iv); $("#recbar")?.remove();
    try { r.sr?.stop(); } catch {}
    const blob = new Blob(r.chunks, { type: "video/webm" }), secs = Math.round(((r.pausedAt || Date.now()) - r.t0 - r.paused) / 1000);
    R = null; r.onDone?.({ blob, secs, transcript: (r.transcript + (r.interim ? " " + r.interim : "")).trim() });
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
  const init = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/webm", "X-Upload-Content-Length": blob.size }, body: JSON.stringify({ name, parents: [parent] }) });
  const url = init.headers.get("Location");
  const file = await new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open("PUT", url); x.setRequestHeader("Content-Type", "video/webm");
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
