// Recordatorios de Team JR con la app cerrada.
// GitHub Actions lo ejecuta cada 15 minutos: revisa a quién le toca un aviso y se lo manda por Firebase Cloud Messaging.
// Necesita el secreto FIREBASE_SERVICE_ACCOUNT (el JSON de la cuenta de servicio de Firebase).
import admin from "firebase-admin";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore(), fcm = admin.messaging();
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const fmt = (n) => Math.round(n).toLocaleString("es-CL");

function localNow(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, nm: (+p.hour % 24) * 60 + +p.minute, dow: new Date(date + "T12:00:00Z").getUTCDay() };
}
const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function weekOf(start, date) {
  const s = start || date, n = Math.max(0, Math.floor((new Date(date + "T12:00:00Z") - new Date(s + "T12:00:00Z")) / 864e5 / 7));
  const first = addDays(s, n * 7); return { n: n + 1, first, last: addDays(first, 6), key: first };
}

async function run() {
  const clients = await db.collection("clients").get();
  let sent = 0;
  for (const cdoc of clients.docs) {
    const cid = cdoc.id, c = cdoc.data();
    const [rs, ps] = await Promise.all([db.doc(`clients/${cid}/settings/reminders`).get(), db.doc(`clients/${cid}/settings/push`).get()]);
    const r = rs.data(), tokens = Object.values(ps.data()?.tokens || {});
    if (!tokens.length) continue;
    // Videos que le mandó el coach y aún no ve: un aviso por video (aunque no tenga los recordatorios activados), entre 8:00 y 22:00
    const vnow = localNow(r?.tz || "America/Santiago");
    if (vnow.nm >= 8 * 60 && vnow.nm < 22 * 60) {
      const vids = await db.collection(`clients/${cid}/videos`).where("seen", "==", false).get();
      for (const v of vids.docs) {
        if (v.data().notified) continue;
        let ok = false;
        for (const token of tokens) {
          try { await fcm.send({ token, data: { title: "🎥 Tu coach te mandó un video", body: v.data().title || "Ábrelo en la app", url: "#inicio", tag: "vid-" + v.id }, webpush: { headers: { Urgency: "high", TTL: "86400" } } }); ok = true; sent++; }
          catch (e) { console.log(cid, "video, token inválido:", e.code); }
        }
        if (ok) await v.ref.set({ notified: Date.now() }, { merge: true });
      }
    }
    if (!r?.on) continue;
    const { date, nm, dow } = localNow(r.tz || "America/Santiago");
    const logRef = db.doc(`clients/${cid}/settings/pushlog`), log = (await logRef.get()).data() || {};
    const done = new Set(log.date === date ? log.sent || [] : []);
    const day = (await db.doc(`clients/${cid}/days/${date}`).get()).data() || {};
    const out = [];
    const add = (id, title, body, url = "#inicio") => { if (!done.has(id)) { done.add(id); out.push({ id, title, body, url }); } };
    const within = (t, span = 120) => nm >= t && nm < t + span;
    const goalSteps = c.steps || 8000, st = day.steps || 0, sched = r.sched || { wake: "07:00", bed: "23:00" };

    if (r.weight?.on && within(toMin(r.weight.at)) && !day.weight) add("peso", "Registra tu peso ⚖️", "En ayunas, antes de comer", "#peso");
    if (r.meals?.on) for (const [m, t] of Object.entries(r.meals.times || {})) if (m.startsWith("Comida ") && t && within(toMin(t), 180) && !(day.meals?.[m] || []).length) add("m-" + m, "¿Te falta registrar alguna comida? 🍽️", "Anota lo que comiste ahora que lo tienes fresco (también puedes dictarlo)", "#comida");
    if (r.water?.on) {
      const f = toMin(r.water.from || "09:00"), to = toMin(r.water.to || "21:00"), every = (+r.water.every || 2) * 60;
      if (nm >= f + every && nm <= to) {
        const goal = c.water || 2500, w = sum(day.water || [], (x) => x.ml), exp = goal * Math.min(1, (nm - f) / (to - f));
        if (w < exp - 200) add("agua-" + Math.floor((nm - f) / every), "Toma agua 💧", `Llevas ${(w / 1000).toFixed(1)} de ${(goal / 1000).toFixed(1)} L`, "#agua");
      }
    }
    if (r.steps?.checks) for (const [t, need, id] of [[toMin(sched.wake) + 360, 0.4, "medio"], [toMin(sched.bed) - 240, 0.75, "tarde"]])
      if (within(t) && st < goalSteps * need) add("pasos-" + id, "¿Cuántos pasos llevas? 👟", st ? `Llevas ${fmt(st)} de ${fmt(goalSteps)}. ¿Hacemos una caminata?` : "Anótalos y te digo cuánto te falta para tu meta", "#inicio");
    if (r.train?.on && within(toMin(r.train.at), 240) && c.schedule?.[dow]) {
      const ses = await db.collection(`clients/${cid}/sessions`).where("date", "==", date).get();
      if (!ses.docs.some((d) => d.data().status === "fin")) {
        const rt = (await db.doc(`clients/${cid}/routines/${c.schedule[dow]}`).get()).data();
        add("ent", `Hoy te toca ${rt?.name || "entrenar"} 💪`, "Cuando termines, registra tu sesión", "#entreno");
      }
    }
    if (r.checkin?.on && within(toMin(r.checkin.at), 360)) {
      const w = weekOf(c.startDate, date);
      if (date >= addDays(w.last, -1) && !(await db.doc(`clients/${cid}/checkins/${w.key}`).get()).exists) add("chk-" + w.key, "Completa tu check-in semanal 📋", "Así tu coach puede ajustar tu plan", "#checkin");
    }

    // Solo se marca como enviado si llegó a algún celular; los tokens caducados se borran
    const dead = new Set(), okIds = new Set(done);
    for (const n of out) {
      let ok = false;
      for (const token of tokens) {
        if (dead.has(token)) continue;
        try { await fcm.send({ token, data: { title: n.title, body: n.body, url: n.url, tag: n.id }, webpush: { headers: { Urgency: "high", TTL: "3600" } } }); sent++; ok = true; }
        catch (e) { console.log(cid, "token inválido:", e.code); if (/not-registered|invalid-registration|invalid-argument/.test(e.code || "")) dead.add(token); }
      }
      if (!ok) okIds.delete(n.id);
    }
    if (dead.size) {
      const all = ps.data()?.tokens || {}, keep = Object.fromEntries(Object.entries(all).filter(([, t]) => !dead.has(t)));
      await db.doc(`clients/${cid}/settings/push`).set({ tokens: keep, at: Date.now() });
      console.log(cid, "tokens caducados borrados:", dead.size);
    }
    if (out.length) await logRef.set({ date, sent: [...okIds] });
  }
  console.log("Avisos enviados:", sent);
}
run().catch((e) => { console.error(e); process.exit(1); });
