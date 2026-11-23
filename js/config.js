// ============================================================
//  CONFIGURACIÓN — lo único que tienes que editar a mano
// ============================================================
// Mientras "apiKey" esté vacío, la app funciona en MODO DEMO:
// los datos se guardan solo en este navegador (sirve para probarla).
// Cuando crees tu proyecto en Firebase, pega aquí los datos
// (ver README.md, paso 2) y la app pasa a guardar en la nube.

export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyCC6h_z9xIFvjgfKNY1sAu1J83tP6EAX6k",
    authDomain: "jr-coach.firebaseapp.com",
    projectId: "jr-coach",
    storageBucket: "jr-coach.firebasestorage.app",
    messagingSenderId: "568231927832",
    appId: "1:568231927832:web:0a27e2436de5b95047636d"
  },

  // Huella (SHA-256) de tu correo de coach: así tu correo no queda visible en el código público.
  // Tu correo real va solo en las reglas de Firestore (en la consola de Firebase).
  coachEmailHash: "2026e8ae5bb7e4a8ba9ae033186e04cf2080a3d7b1bad99e7071aeabe09ddbfa",

  // Tu WhatsApp con código de país, sin + ni espacios (ej: 56912345678).
  // Se usa en el botón "Compartir con tu coach".
  coachWhatsapp: "",

  appName: "IMA",
  // ID de cliente OAuth de Google (Google Cloud → APIs y servicios → Credenciales) para subir
  // los videos de retroalimentación a tu Google Drive. Es público por diseño (no es una clave secreta).
  googleClientId: "568231927832-vdnq93d4q00s7cdoanvol6dk1i6lgp26.apps.googleusercontent.com",
  // Clave pública para avisos con la app cerrada (Firebase → Configuración → Cloud Messaging → Certificados web push)
  vapidKey: "BM_EJh8lKa6m4CNrG7l_Z7OIh8eGAr2MwJLrKfq0OrEVEGtAVNvedfJCGx4en_4zGRU-X8VI0s0jI0ORUyKsiJM",
  appVersion: "1.38.3",

  // Tiempos de comida
  meals: ["Comida 1", "Comida 2", "Comida 3", "Comida 4", "Comida 5"],

  // Descanso por defecto entre series (segundos)
  defaultRest: 180
};
