// ============================================================
//  CONFIGURACIÓN — lo único que tienes que editar a mano
// ============================================================
// Mientras "apiKey" esté vacío, la app funciona en MODO DEMO:
// los datos se guardan solo en este navegador (sirve para probarla).
// Cuando crees tu proyecto en Firebase, pega aquí los datos
// (ver README.md, paso 2) y la app pasa a guardar en la nube.

export const CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },

  // Tu correo de coach (el mismo con el que te registras en la app).
  // Debe coincidir con el que pongas en firestore.rules.
  coachEmail: "TU_CORREO@gmail.com",

  // Tu WhatsApp con código de país, sin + ni espacios (ej: 56912345678).
  // Se usa en el botón "Compartir con tu coach".
  coachWhatsapp: "",

  appName: "JR Coach Online",

  // Tiempos de comida
  meals: ["Desayuno", "Almuerzo", "Once", "Cena", "Colaciones"],

  // Descanso por defecto entre series (segundos)
  defaultRest: 180
};
