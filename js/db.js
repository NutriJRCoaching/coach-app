// ============================================================
//  Capa de datos: funciona sin conexión y sincroniza al volver
//  - Modo demo: todo en IndexedDB del navegador
//  - Modo Firebase: Firestore con caché persistente offline
//    (las escrituras quedan en cola y se suben solas al volver la señal)
// ============================================================
import { CONFIG } from "./config.js";

export const DEMO = !CONFIG.firebase.apiKey;
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

const clean = (o) => JSON.parse(JSON.stringify(o ?? null));
const parentOf = (p) => p.split("/").slice(0, -1).join("/");

// ---------------------------------------------------------- DEMO
const local = {
  mem: new Map(), watchers: new Set(), idb: null, authCbs: [],
  async init() {
    try {
      this.idb = await new Promise((res, rej) => {
        const r = indexedDB.open("coach-demo", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("docs");
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        setTimeout(() => rej(new Error("timeout")), 3000);
      });
      await new Promise((res) => {
        const tx = this.idb.transaction("docs").objectStore("docs").openCursor();
        tx.onsuccess = (e) => { const c = e.target.result; if (c) { this.mem.set(c.key, c.value); c.continue(); } else res(); };
        tx.onerror = () => res();
      });
    } catch { this.idb = null; } // sin IndexedDB: los datos viven solo en memoria
    if (!this.mem.has("meta/seeded")) { const { seedDemo } = await import("./demo.js"); await seedDemo(this); }
  },
  persist(path, val) {
    if (!this.idb) return;
    const st = this.idb.transaction("docs", "readwrite").objectStore("docs");
    val === undefined ? st.delete(path) : st.put(val, path);
  },
  notify(path) {
    for (const w of this.watchers) if (w.path === path || w.path === parentOf(path)) w.fire();
  },
  async get(path) { return clean(this.mem.get(path)) || null; },
  async list(col) {
    const out = [];
    for (const [k, v] of this.mem) if (parentOf(k) === col) out.push({ id: k.split("/").pop(), ...clean(v) });
    return out;
  },
  set(path, data, merge = true) {
    const prev = merge ? this.mem.get(path) || {} : {};
    const val = clean({ ...prev, ...data });
    this.mem.set(path, val); this.persist(path, val); this.notify(path);
    return Promise.resolve();
  },
  del(path) { this.mem.delete(path); this.persist(path); this.notify(path); return Promise.resolve(); },
  watch(path, cb) {
    const isCol = path.split("/").length % 2 === 1;
    const w = { path, fire: async () => cb(isCol ? await this.list(path) : await this.get(path)) };
    this.watchers.add(w); w.fire();
    return () => this.watchers.delete(w);
  },
  user: null,
  onAuth(cb) { this.authCbs.push(cb); cb(this.user); },
  async signIn(uid) {
    const u = this.mem.get("users/" + uid); if (!u) throw new Error("Usuario demo no existe");
    this.user = { uid, email: u.email }; try { localStorage.setItem("demo-uid", uid); } catch {}
    this.authCbs.forEach((c) => c(this.user));
  },
  async restore() { let id = null; try { id = localStorage.getItem("demo-uid"); } catch {} if (id && this.mem.has("users/" + id)) this.user = { uid: id, email: this.mem.get("users/" + id).email }; },
  async signOut() { this.user = null; try { localStorage.removeItem("demo-uid"); } catch {} this.authCbs.forEach((c) => c(null)); },
  async createClientAccount(email, pass, name) {
    const uid = "cli-" + Math.random().toString(36).slice(2, 8);
    this.set("users/" + uid, { role: "client", email, name }); return uid;
  },
  async resetData() { if (this.idb) this.idb.transaction("docs", "readwrite").objectStore("docs").clear(); try { localStorage.removeItem("demo-uid"); } catch {} }
};

// ---------------------------------------------------------- FIREBASE
const fire = {
  m: {}, app: null, db: null, auth: null, user: null,
  async init() {
    const [a, f, au] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-firestore.js"), import(FB + "firebase-auth.js")]);
    this.m = { ...a, ...f, ...au };
    this.app = a.initializeApp(CONFIG.firebase);
    this.db = f.initializeFirestore(this.app, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
    this.auth = au.getAuth(this.app);
    await au.setPersistence(this.auth, au.indexedDBLocalPersistence);
  },
  // Lectura rápida: la primera vez en la sesión pregunta al servidor (máx. 2,5 s);
  // después responde al instante desde el celular y revisa el servidor en segundo plano.
  snap: new Map(), lastStale: new Map(), onStale: null, _t: null,
  stale(key) {
    const now = Date.now(); if (now - (this.lastStale.get(key) || 0) < 3000) return;
    this.lastStale.set(key, now); clearTimeout(this._t); this._t = setTimeout(() => this.onStale?.(), 120);
  },
  async read(key, server, cache, map, empty) {
    const bg = () => server().then((r) => { const v = map(r), j = JSON.stringify(v); if (this.snap.get(key) !== j) { this.snap.set(key, j); this.stale(key); } }).catch(() => {});
    if (this.snap.has(key)) {
      try { const v = map(await cache()); this.snap.set(key, JSON.stringify(v)); bg(); return v; } catch {}
    }
    try {
      const v = map(await Promise.race([server(), new Promise((_, rej) => setTimeout(() => rej(new Error("lento")), 2500))]));
      this.snap.set(key, JSON.stringify(v)); return v;
    } catch {
      try { const v = map(await cache()); this.snap.set(key, JSON.stringify(v)); bg(); return v; } catch { return empty; }
    }
  },
  get(path) {
    const { doc, getDoc, getDocFromCache } = this.m, ref = doc(this.db, path);
    return this.read("d:" + path, () => getDoc(ref), () => getDocFromCache(ref), (s) => (s.exists() ? s.data() : null), null);
  },
  list(col) {
    const { collection, getDocs, getDocsFromCache } = this.m, ref = collection(this.db, col);
    return this.read("c:" + col, () => getDocs(ref), () => getDocsFromCache(ref), (s) => s.docs.map((d) => ({ id: d.id, ...d.data() })), []);
  },
  // Importante: NO se espera la respuesta del servidor. Firestore guarda localmente
  // al instante y sube el cambio cuando haya conexión.
  set(path, data, merge = true) {
    const { doc, setDoc } = this.m;
    setDoc(doc(this.db, path), clean(data), { merge }).catch((e) => console.error("set", path, e));
    return Promise.resolve();
  },
  del(path) { const { doc, deleteDoc } = this.m; deleteDoc(doc(this.db, path)).catch(console.error); return Promise.resolve(); },
  watch(path, cb) {
    const { doc, collection, onSnapshot } = this.m;
    const isCol = path.split("/").length % 2 === 1;
    const ref = isCol ? collection(this.db, path) : doc(this.db, path);
    return onSnapshot(ref, (s) => cb(isCol ? s.docs.map((d) => ({ id: d.id, ...d.data() })) : s.exists() ? s.data() : null), (e) => console.error(e));
  },
  onAuth(cb) { this.m.onAuthStateChanged(this.auth, (u) => { this.user = u; cb(u); }); },
  async signIn(email, pass) { await this.m.signInWithEmailAndPassword(this.auth, email, pass); },
  async signUp(email, pass) { await this.m.createUserWithEmailAndPassword(this.auth, email, pass); },
  async resetPass(email) { await this.m.sendPasswordResetEmail(this.auth, email); },
  async signOut() { await this.m.signOut(this.auth); },
  // Crea la cuenta del cliente sin cerrar la sesión del coach (usa una 2ª instancia)
  async createClientAccount(email, pass, name) {
    const sec = this.m.initializeApp(CONFIG.firebase, "sec-" + Date.now());
    const auth2 = this.m.getAuth(sec);
    const cred = await this.m.createUserWithEmailAndPassword(auth2, email, pass);
    const uid = cred.user.uid;
    await this.m.signOut(auth2);
    this.set("users/" + uid, { role: "client", email, name });
    return uid;
  }
};

export const db = DEMO ? local : fire;
export const online = () => navigator.onLine;
