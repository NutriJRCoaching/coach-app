// Rutina inicial de Joaquín (se carga una sola vez en su perfil de cliente si aún no tiene rutinas)
// Formato: [series, ejercicio]. Plan: 1ª serie 8 reps @RIR 1, 2ª serie 6 reps @RIR 1.
const R = {
  lun: ["Lunes (LD)", [[2, "Extensión de Tríceps Uni Polea"], [2, "Elevaciones Laterales Polea"], [2, "Leg Curl Sentado"], [1, "Extensión de Tríceps DB"], [2, "Remo Foco Dorsal Uni PL"], [2, "Pantorrilla"], [2, "Remo T Trapecio y DP"], [1, "SLDL o 45°"], [1, "Jalón a Pecho Agarre Amplio"]]],
  mar: ["Martes (LD)", [[2, "Leg Extension"], [2, "Preacher Curl Unilateral"], [1, "Pendulum Squat"], [1, "Curl Martillo Bilateral Sentado"], [2, "PL Press Inclinado"], [2, "Aductores"], [1, "PecFly"], [1, "Abductores"], [2, "Crunch Abdominal"]]],
  mie: ["Miércoles (PG)", [[2, "Extensión de Tríceps Uni Polea"], [2, "Elevaciones Laterales Polea"], [2, "Leg Curl Sentado"], [2, "Remo Espalda Completa"], [2, "Pantorrilla"], [2, "Jalón a Pecho Agarre Amplio"], [1, "Hip Thrust BB"]]],
  jue: ["Jueves (PG)", [[2, "Leg Extension"], [2, "Preacher Curl Unilateral"], [2, "PecFly"], [1, "Curl Martillo"], [1, "Prensa Foco Cuádriceps"], [2, "Aductores"], [1, "Abductores"], [2, "Crunch Abdominal"]]],
  vie: ["Viernes (PG)", [[2, "Extensión de Tríceps Uni Polea"], [2, "Elevaciones Laterales Polea"], [2, "Leg Curl Sentado"], [1, "Extensión de Tríceps DB"], [2, "Pantorrilla"], [2, "Jalón a Pecho Agarre Amplio"], [2, "Rotaciones"]]],
  sab: ["Sábado (LD)", [[2, "Leg Extension"], [2, "Preacher Curl Unilateral"], [1, "Pendulum Squat"], [2, "Remo T Espalda Completa"], [2, "PL Press Inclinado"], [1, "RDL"], [1, "Press Militar Delt Ant"], [2, "Crunch Abdominal"]]]
};
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function jrRoutines() {
  const days = { lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
  const routines = {}, schedule = {};
  let order = 0;
  for (const [k, [name, ex]] of Object.entries(R)) {
    routines["jr-" + k] = { name, order: ++order, exercises: ex.map(([n, e], i) => ({ id: slug(e) + "-" + k + i, name: e, sets: [{ reps: "8", rir: 1 }, { reps: "6", rir: 1 }].slice(0, n), alts: [], inc: 2.5, video: "" })) };
    schedule[days[k]] = "jr-" + k;
  }
  const lib = [...new Set(Object.values(R).flatMap(([, ex]) => ex.map(([, e]) => e)))].map((e) => ({ id: slug(e), name: e, group: "", video: "", inc: 2.5, alts: [] }));
  return { routines, schedule, lib };
}
