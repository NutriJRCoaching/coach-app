# JR Coach Online — App de asesoría

App web instalable (PWA): se instala desde Chrome en el celular, funciona **sin conexión** y sincroniza sola cuando vuelve la señal.
- **Clientes (celular):** inicio con pendientes, alimentación, agua, entrenamiento guiado, progreso, check-in.
- **Coach (escritorio):** panel de clientes, timeline semanal, entrenamientos vs semana anterior, editor de rutinas, retroalimentación, biblioteca.

Mientras `js/config.js` no tenga los datos de Firebase, la app funciona en **modo demo** (datos de ejemplo guardados solo en ese navegador).

---

## Paso 1 · Subir la app a GitHub (gratis)

1. Crea una cuenta en https://github.com (si no tienes).
2. Arriba a la derecha: **+ → New repository**. Nombre: `coach-app`. Déjalo **Public**. Clic en **Create repository**.
3. En la página del repositorio: **uploading an existing file** (o **Add file → Upload files**).
4. Descomprime el zip y **arrastra todo el contenido de la carpeta** (index.html, sw.js, manifest.webmanifest, README.md, firestore.rules y las carpetas css, js, icons). Clic en **Commit changes**.
5. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)` → **Save**.
6. Espera 1–2 minutos. Tu app queda en: `https://TU-USUARIO.github.io/coach-app/`

Con esto ya puedes abrirla y probarla en modo demo.

## Paso 2 · Conectar la base de datos (Firebase, plan gratis)

1. Entra a https://console.firebase.google.com con tu cuenta de Google → **Crear un proyecto** (nombre: `jr-coach`). Puedes desactivar Google Analytics.
2. **Authentication** → Comenzar → **Correo electrónico/contraseña** → Habilitar → Guardar.
   - En **Authentication → Configuración → Dominios autorizados** → Agregar dominio: `TU-USUARIO.github.io`
3. **Firestore Database** → Crear base de datos → modo **producción** → ubicación `southamerica-west1 (Santiago)` → Crear.
   - Pestaña **Reglas**: borra lo que hay, pega el contenido de `firestore.rules` (cambia `TU_CORREO@gmail.com` por tu correo) → **Publicar**.
4. ⚙ **Configuración del proyecto** → *Tus apps* → ícono **</>** (Web) → nombre `coach-app` → Registrar. Copia los valores de `firebaseConfig`.
5. En GitHub abre `js/config.js` → ✏ (editar) y pega los valores dentro de `firebase: { ... }`. Pon también tu correo en `coachEmail` y tu WhatsApp en `coachWhatsapp` (ej: `56912345678`). **Commit changes**.

## Paso 3 · Primer ingreso como coach

1. Abre tu app en el computador. Escribe tu correo y una contraseña y toca **"Soy el coach y es mi primera vez"**.
2. Ya estás en el panel. Crea clientes con **＋ Nuevo cliente**: la app te da un mensaje listo para mandarle por WhatsApp con el link, su correo y su contraseña.
3. En **Biblioteca** carga tus ejercicios (con los links de YouTube no listados), tus guías (links a los PDF de Drive) e **importa tu base de alimentos** (CSV de tu hoja BaseAlimentos).

## Paso 4 · Instalar en el celular (clientes)

- **Android (Chrome):** abrir el link → menú ⋮ → **Agregar a la pantalla principal / Instalar app**.
- **iPhone (Safari):** abrir el link → botón Compartir → **Agregar a inicio**.

## Cómo publicar cambios

Edita los archivos en GitHub (o súbelos de nuevo) y en `sw.js` cambia `const VERSION = "v1"` por `"v2"`, `"v3"`… Así los celulares descargan la versión nueva.

## Qué hay en cada archivo

| Archivo | Para qué sirve |
|---|---|
| `js/config.js` | **Lo único que editas a mano:** Firebase, tu correo, tu WhatsApp, tiempos de comida |
| `js/client.js` | Pantallas del cliente (inicio, comida, agua, progreso, más) |
| `js/train.js` | Entrenamiento: tu semana, sesión, descanso, encuesta, resumen |
| `js/coach.js` | Panel del coach |
| `js/data.js` | Lógica compartida (semana, sugerencias de carga, medidas) |
| `js/db.js` | Guardado sin conexión + sincronización |
| `js/foods.js` | Grupos de intercambio y base inicial de alimentos |
| `css/app.css` | Colores y diseño |
| `firestore.rules` | Seguridad: cada cliente solo ve lo suyo |

## Pendiente para próximas versiones
- Sincronizar pasos con Health Connect (app Android en Google Play) y Atajos de iPhone.
- Recordatorios con la app cerrada (comidas cada 4 h, agua, cardio, fotos) vía notificaciones push.
- Videos de técnica subidos a la app con comparación lado a lado y comentarios por segundo.
- Base de FatSecret y peso sugerido semanal automático.
