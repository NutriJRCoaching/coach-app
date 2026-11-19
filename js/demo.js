// Datos de ejemplo para el MODO DEMO (solo se usan si no hay Firebase configurado)
import { ymd, addDays, weekInfo, uid } from "./util.js";
import { REAL_FOODS, realToFood } from "./realfoods.js";

export async function seedDemo(L) {
  const set = (p, d) => L.set(p, d, false);
  set("users/coach-demo", { role: "coach", email: "coach@demo.cl", name: "Joaquín" });
  set("users/cli-demo", { role: "client", email: "cliente@demo.cl", name: "Felipe Demo" });
  const routines = await seedClient(set, "cli-demo", { name: "Felipe Demo", email: "cliente@demo.cl" });
  set("library/exercises", { items: Object.values(routines).flatMap((r) => r.exercises).map((e) => ({ id: e.id, name: e.name, group: "", video: "", inc: e.inc, alts: e.alts })) });
  set("library/guides", { items: [{ title: "Guía para no pasar hambre", url: "#", desc: "Estrategias de saciedad" }, { title: "Porciones de intercambio", url: "#", desc: "Cómo usar tu pauta" }] });
  set("meta/seeded", { at: Date.now() });
}

// Cliente con ~4 semanas de datos (registros, entrenamientos, check-in, retroalimentación).
// Se usa en el modo demo y en el botón "Crear cliente de ejemplo" del panel.
export async function seedClient(set, cid, extra = {}) {
  const today = ymd();
  const start = addDays(today, -26);
  const client = {
    name: "Felipe Demo", email: "cliente@demo.cl", service: "completa", modalidad: "Completa", checkinDay: new Date(start + "T12:00").getDay(), sex: "M", birth: "1998-04-12", height: 176, startDate: start, goal: "Ganar masa muscular",
    phase: "Recomposición corporal", kcal: 2600, cho: 300, fat: 75, prot: 170, steps: 9000, water: 2800, sleep: 8, rest: 180,
    cardio: { perWeek: 2, type: "Bici", minutes: 25, intensity: "Moderada", days: [3, 6] },
    schedule: { 1: "antA", 2: "posA", 4: "antB", 5: "posB" },
    weeklyGoals: ["Registrar todas las comidas al menos 5 días", "Llegar a 9.000 pasos diarios", "Dormir antes de las 23:30"],
    dates: [{ date: addDays(today, 12), label: "Evaluación antropométrica" }],
    stages: [
      { phase: "Mantención", from: 1, to: 2, kcal: 2700, cho: 320, fat: 80, prot: 160, note: "Adaptación: aprender a registrar y llegar a la proteína" },
      { phase: "Recomposición corporal", from: 3, to: 8, kcal: 2600, cho: 300, fat: 75, prot: 170, steps: 9000, note: "Leve ajuste calórico, prioridad a la progresión en el gimnasio" },
      { phase: "Superávit / Volumen", from: 9, to: 16, kcal: 2900, cho: 360, fat: 80, prot: 170, steps: 8000, note: "Superávit controlado (+250 kcal)" }
    ],
    plan: { pdfUrl: "", notes: "Pauta día de entrenamiento. Prioriza la proteína en cada comida." },
    pauta: { "Cereales": 9, "Verduras generales": 3, "Verduras libre consumo": 2, "Frutas": 3, "Lácteos bajos en grasa": 2, "Carnes magras": 7, "Huevo": 2, "Legumbres": 1, "Aceites y grasas": 3, "Alimentos ricos en lípidos": 1 }
  };
  // Opciones del plan (pautas alternativas) con alimentos de ejemplo
  const pi = (name, cat, por, gp, medida = "", medidaG = null) => ({ name, cat, por, gp, g: Math.round(por * gp * 10) / 10, medida, medidaG });
  client.menus = [
    { id: "m1", name: "Día de entrenamiento", meals: [
      { name: "Desayuno", time: "08:00", items: [pi("Avena", "Cereales", 2, 40), pi("Leche descremada", "Lácteos medios en grasa", 1, 180, "1 taza", 200), pi("Huevo entero", "Huevo", 2, 48, "1 unidad", 50), pi("Plátano", "Frutas", 1, 60)] },
      { name: "Almuerzo", time: "13:30", items: [pi("Arroz cocido", "Cereales", 3, 100), pi("Pollo pechuga deshuesada (crudo)", "Carnes magras", 4, 50, "1 filete", 150), pi("Lechuga", "Verduras libre consumo", 1, 50), pi("Tomate", "Verduras generales", 1, 120), pi("Aceite de oliva", "Aceites y grasas", 1, 5)] },
      { name: "Once", time: "18:00", items: [pi("Marraqueta", "Cereales", 2, 50), pi("Pechuga de pollo cocida (fiambre)", "Carnes magras", 1, 62, "1 lámina", 20), pi("Palta", "Alimentos ricos en lípidos", 1, 90)] },
      { name: "Cena", time: "21:00", items: [pi("Porotos cocidos", "Legumbres", 1, 100), pi("Pollo pechuga deshuesada (crudo)", "Carnes magras", 2, 50, "1 filete", 150), pi("Manzana", "Frutas", 1, 100)] }] },
    { id: "m2", name: "Día de descanso", meals: [
      { name: "Desayuno", time: "09:00", items: [pi("Marraqueta", "Cereales", 1, 50), pi("Huevo entero", "Huevo", 2, 48, "1 unidad", 50), pi("Yogurt light", "Lácteos bajos en grasa", 1, 130, "1 pote", 125)] },
      { name: "Almuerzo", time: "14:00", items: [pi("Papa cocida", "Cereales", 2, 150), pi("Pollo pechuga deshuesada (crudo)", "Carnes magras", 4, 50, "1 filete", 150), pi("Aceite de oliva", "Aceites y grasas", 1, 5)] },
      { name: "Cena", time: "20:30", items: [pi("Arroz cocido", "Cereales", 2, 100), pi("Pollo pechuga deshuesada (crudo)", "Carnes magras", 3, 50, "1 filete", 150), pi("Naranja", "Frutas", 1, 120)] }] }
  ];
  const w = weekInfo(client, today);
  const pw = weekInfo(client, addDays(today, -7));
  client.feedback = { week: pw.key, videoUrl: "", points: ["Buen progreso en press inclinado: +2,5 kg manteniendo técnica", "Faltó registrar la once 3 días", "Esta semana subimos a 9.000 pasos"], text: "", at: Date.now() - 864e5 };
  Object.assign(client, extra);
  const sv = client.service || "completa";
  if (sv === "entrenamiento") { // sin plan de alimentación: guía de macros en rangos
    for (const k of ["menus", "pauta", "kcal", "cho", "fat", "prot", "stages"]) delete client[k];
    Object.assign(client, { ranges: { prot: [1.8, 2.2], fat: [0.8, 1], cho: [3.5, 4.5] }, weightStart: 74.6, phase: "Mantención", plan: { notes: "Prioriza llegar a la proteína todos los días. Los carbohidratos, alrededor del entrenamiento." } });
  }
  set("clients/" + cid, client);

  const ex = (id, name, sets, alts = [], inc = 2.5) => ({ id, name, sets: sets.map(([reps, rir]) => ({ reps, rir })), alts, inc, video: "" });
  const routines = {
    antA: { name: "Anterior A", order: 1, exercises: [ex("e1", "Press banca con barra", [["6-8", 1], ["6-8", 1]], [{ name: "Press banca con mancuernas" }, { name: "Press en máquina convergente" }]), ex("e2", "Sentadilla hack", [["8", 1], ["8", 0]], [{ name: "Prensa 45°" }], 5), ex("e3", "Press inclinado mancuernas", [["8", 1], ["6", 0]], [], 2), ex("e4", "Extensión de cuádriceps", [["10-12", 0], ["10-12", 0]], [], 5), ex("e5", "Elevaciones laterales en polea", [["12", 0], ["12", 0]], [], 1.25)] },
    posA: { name: "Posterior A", order: 2, exercises: [ex("p1", "Peso muerto rumano", [["8", 2], ["8", 1]], [{ name: "Hip thrust" }]), ex("p2", "Jalón al pecho", [["8-10", 1], ["8-10", 0]], [{ name: "Dominadas asistidas" }], 5), ex("p3", "Remo en máquina pecho apoyado", [["8", 1], ["8", 0]], [], 5), ex("p4", "Curl femoral sentado", [["10", 0], ["10", 0]], [], 5), ex("p5", "Curl bíceps mancuernas", [["8", 1], ["6", 0]], [], 2)] },
    antB: { name: "Anterior B", order: 3, exercises: [ex("b1", "Press militar mancuernas", [["8", 1], ["8", 0]], [], 2), ex("b2", "Prensa 45°", [["10", 1], ["10", 0]], [], 10), ex("b3", "Aperturas en máquina", [["12", 0], ["12", 0]], [], 5)] },
    posB: { name: "Posterior B", order: 4, exercises: [ex("q1", "Hip thrust", [["8", 1], ["8", 0]], [], 10), ex("q2", "Remo con barra", [["8", 1], ["8", 1]], [], 2.5), ex("q3", "Face pull", [["12", 0], ["12", 0]], [], 2.5)] }
  };
  routines.antA.exercises[2].changed = true;
  routines.antA.changes = { week: w.key, list: ["Press inclinado mancuernas: series 8@1, 8@1 → 8@1, 6@0"] };
  if (sv === "nutricion") { // el cliente arma sus rutinas: sin rangos de reps, sin videos, sin cambios del coach
    const dayOf = Object.fromEntries(Object.entries(client.schedule).map(([d, r]) => [r, +d]));
    for (const [id, r] of Object.entries(routines)) set(`clients/${cid}/routines/${id}`, { name: r.name, order: r.order, own: true, days: [dayOf[id]], exercises: r.exercises.map((e) => ({ id: e.id, name: e.name, sets: e.sets.map(() => ({ reps: "", rir: "" })), notes: "Controla la bajada, sin rebotes. Mantén la técnica en todas las series.", alts: (e.alts || []).map((a) => ({ name: a.name })), inc: e.inc })) });
    set("clients/" + cid, { ...client, schedule: {} });
  } else for (const [id, r] of Object.entries(routines)) set(`clients/${cid}/routines/${id}`, r);

  // Días anteriores con registros
  const foods = REAL_FOODS.map(realToFood);
  const F = (n) => foods.find((f) => f.name === n) || foods[0];
  const it = (n, g) => { const f = F(n); return { name: f.name, g, kcal: f.kcal, cho: f.cho, fat: f.fat, prot: f.prot, cat: f.cat, por: f.portion }; };
  const q = (name, kcal, cho, fat, prot) => ({ name, g: 0, kcal, cho, fat, prot, per100: false, quick: true });
  let wgt = 74.6;
  for (let i = 25; i >= 0; i--) {
    const d = addDays(today, -i), rnd = (a, b) => a + Math.random() * (b - a);
    wgt += rnd(-0.25, 0.2);
    const day = {};
    if (Math.random() > 0.15) day.weight = Math.round(wgt * 10) / 10;
    if (i > 0) {
      day.steps = Math.round(rnd(5500, 11500));
      day.sleep = { bed: ["22:45", "23:10", "23:40", "00:15"][i % 4], wake: ["07:00", "07:15", "06:50", "08:00"][i % 4], awake: [0, 10, 0, 20][i % 3], quality: 2 + (i % 4) };
      day.water = [{ ml: 500, t: "09:10" }, { ml: 750, t: "12:30" }, { ml: 500, t: "16:00" }, { ml: 750, t: "20:00" }].slice(0, 2 + (i % 3));
      if (i % 5 !== 2) day.meals = {
        Desayuno: [it("Avena (hojuelas)", 60), it("Plátano", 120), it("Leche descremada", 300)],
        Almuerzo: [it("Arroz blanco cocido", 200), it("Pechuga de pollo a la plancha (pesada cocida)", 150), it("Lechuga", 100), it("Tomate", 120)],
        Once: i % 3 ? [it("Pan marraqueta", 100), it("Jamón de pavo", 60), it("Quesillo", 60)] : [],
        Cena: [it("Fideos cocidos", 220), it("Carne molida 5% grasa cocida", 130)],
        Colaciones: [it("Manzana", 150), q("Yogurt protein (etiqueta)", 120, 10, 2, 20)]
      };
      if (i % 4 === 1) day.cardio = [{ type: "Bici", min: 25, int: "Moderada", t: "19:00" }];
    }
    set(`clients/${cid}/days/${d}`, day);
  }

  // Sesiones de semanas anteriores
  let t0 = Date.now() - 26 * 864e5;
  for (let i = 25; i >= 1; i--) {
    const d = addDays(today, -i), dow = new Date(d + "T12:00").getDay(), rid = client.schedule[dow];
    if (!rid) continue;
    const r = routines[rid], wk = weekInfo(client, d).key, progress = (25 - i) / 7;
    const sid = uid() + i;
    const startedAt = new Date(d + "T19:00").getTime();
    set(`clients/${cid}/sessions/${sid}`, {
      routineId: rid, routineName: r.name, date: d, weekKey: wk, startedAt, endedAt: startedAt + 62 * 60000, status: "fin",
      survey: { dureza: 7 + (i % 3), fuerza: 3 + (i % 2), energia: 3 + (i % 3 ? 1 : 0), doms: 2, general: 4, articular: i === 4 ? "si" : "no", articularDet: i === 4 ? "Hombro derecho en press banca" : "", orden: "si" },
      exercises: r.exercises.map((e, k) => ({ exId: e.id, name: e.name, target: sv === "nutricion" ? e.sets.map(() => ({ reps: "", rir: "" })) : e.sets, alts: e.alts, inc: e.inc, video: "", tech: sv === "nutricion" ? "" : k === 0 && i < 7 ? "mejor" : "igual",
        sets: e.sets.map((s, j) => ({ w: Math.round((40 + k * 8 - j * 2 + progress * (e.inc || 2.5)) / (e.inc || 2.5)) * (e.inc || 2.5), r: parseInt(s.reps) + (j ? -1 : 0), rir: s.rir, note: j === 0 && k === 0 && i < 10 ? "Primera serie muy liviana" : "", done: true })) }))
    });
  }
  set(`clients/${cid}/checkins/${weekInfo(client, addDays(today, -7)).key}`, { facil: "Subir la escalera del metro sin cansarme y llegar a la proteína casi sin pensarlo", barrera: "Más fácil: dejar el almuerzo listo el domingo. Más difícil: la once en la pega, siempre hay pan con algo", orgullo: "Cumplí los 4 entrenamientos aunque tuve semana de pruebas", proxSemana: "El viernes tengo un cumpleaños y el sábado viajo a la playa", foco: "Llevar mi once lista a la pega 4 días", confianza: "Press banca ya lo domino. En el peso muerto rumano todavía no me siento seguro con la espalda", momentoDificil: "La once: llego con mucha hambre", entrenos: "4/4", otroDeporte: "No", progCarga: "Más carga/reps", progTec: "Sí, mejoró", entGeneral: "Bueno", motivEnt: "Alto", fuerza: "Alto", doms: "Leve", articular: "Nada", top1: "Press banca 60 × 8", cintura: 84, adhPlan: "70–90%", motivNut: "Alto", contribuyen: "Sí", hambre: "Normal", saciedad: "Normal", antojos: "Pocos", fueraPlan: "Un completo el sábado con amigos", "f_Frutas": "5 veces a la semana", "f_Verduras": "Todos los días", "f_Alcohol": "1 vez a la semana", depos: "1", bristol: "Normales", digest: "Bueno", enerSes: "Alto", enerFuera: "Normal", recup: "Sí", salud: "Bueno", resfrio: "Todo bien", estGen: "Normal", estLab: "Alto", animo: "Bueno", sintomas: ["Distensión abdominal (hinchazón)"], orgullo: "Cumplí todos los entrenamientos", dificil: "La once en la pega", mejorar: "Registrar la once", expProg: "Muy bueno", consultas: "¿Puedo cambiar el arroz por papas?", diasRegistrados: 5, date: addDays(today, -7), at: Date.now() });
  set(`clients/${cid}/measures/${addDays(today, -24)}`, { cuello: 38, hombros: 118, pecho: 99, brazo: 33.5, cintura: 82, abdomen: 85, cadera: 97, muslo: 57, pantorrilla: 37 });
  // La semana anterior ya tiene su retroalimentación publicada (check-in respondido)
  set(`clients/${cid}/feedbacks/${pw.key}`, { ...client.feedback, answered: true });
  return routines;
}
