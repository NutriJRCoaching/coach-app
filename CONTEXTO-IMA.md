# CONTEXTO-IMA — léelo primero

Resumen para retomar el desarrollo en un chat nuevo sin el historial. Actualizado: 17-nov-2026, versión **1.11.2**.

## Qué es
**IMA · Inteligencia Muscular Aplicada** (antes "Team JR"). Es la app de coaching de Joaquín Rojas (nutricionista y coach online), inspirada en tracked.gg.
- **Clientes:** la usan en el celular (PWA instalable desde Chrome).
- **Coach:** usa el panel de escritorio.
- **Él mismo** también la usa como cliente, con la opción "Mi registro (vista cliente)".
- **Sin conexión:** funciona offline y sincroniza al volver la señal.
- **Costo:** todo con planes gratuitos, no usar servicios pagados.

- App: https://nutrijrcoaching.github.io/coach-app/
- Repositorio: `NutriJRCoaching/coach-app` (rama main). GitHub Pages publica solo al hacer push.
- Copia local en su PC: `~/OneDrive/Escritorio/Claudio App/App (código)/` (sincronizar a mano tras los cambios).
- Firebase: proyecto `jr-coach` (plan Spark; Firestore en nam5; Auth con correo/contraseña).

## Stack
- JS vanilla con módulos ES, **sin compilación**. Enrutado por hash (`#inicio`, `#comida`, `#coach/...`).
- Acciones por delegación: `data-a="nombre"` para clic, y `data-a-change` / `data-a-input`, más el registro `act("nombre", fn)` (en ui.js).
- Firebase v10.12.2 desde gstatic, con `persistentLocalCache` (offline). Las escrituras **no se esperan**.
- Modo demo: si `apiKey` está vacío usa IndexedDB local. La copia de pruebas está en /tmp/demoapp con `apiKey: ""`.
- `sw.js`: red primero y caché de respaldo. **Cada versión: subir `VERSION` en sw.js y `appVersion` en js/config.js.** El aviso "Nueva versión disponible" sale cuando cambia sw.js.
- Íconos con `?v=ima2` para romper el caché.

## Archivos
| Archivo | Qué hace |
|---|---|
| js/config.js | Firebase, `coachEmailHash` (SHA-256 del correo del coach; el correo NO va en el código), `vapidKey`, `appName`, `appVersion`, comidas por defecto |
| js/db.js | Capa de datos (`get`, `list`, `set`, `del`, `watch`, auth). Lectura rápida: caché si ya se descargó + revisión del servidor en segundo plano (`onStale` → re-render) |
| js/app.js | Login (mantener sesión, recordar correo), roles, `enterClient` (el coach como cliente, carga su rutina y sus metas una vez), render, transición `.enter`, aviso de actualización |
| js/client.js | Vistas del cliente: inicio (campana de pendientes que se mueve, días con rutina abreviada), comida (Comida 1…N + "Agregar otra comida", sin mostrar hora, comidas con borde rojo brillante, voz, código de barras (lee una vez y espera ~1 s con "Cargando datos del producto…"), macros C/L/P de cada alimento bajo su nombre, renombrar alimento escaneado o registrado), agua (+200), peso (dos preguntas Sí/No: "¿En ayunas?" → `weightFast` y "¿Después de ir al baño?" → `weightBath`; obliga a responder ambas), progreso, ajustes (recordatorios, horario, avisos push, "Probar notificación"), pasos de ayer + informe de ayer en 3 niveles con confeti |
| js/train.js | Entrenamiento: semana (botón **Ver** rutina sin empezarla, con la última vez), sesión (objetivo destacado, técnica Mejor/Igual/Peor en azul/verde/rojo, unilaterales Izq/Der con diferencia, video por serie guardado en el celular, descanso ajustable con pantalla encendida y alarma a pantalla completa que suena y vibra, reiniciar/descartar), resumen con progreso por serie, imagen para compartir, audio para el coach (graba en m4a si se puede; se guarda en el panel y se comparte con un toque) |
| js/data.js | Helpers de datos, `weekPlan`, `setVerdict` / `suggest` (progresión), `setProgress`, `mealList`, etapas (`applyStage`), CHECKIN |
| js/coach.js | Panel coach: clientes, timeline, etapas, entrenamientos (con audio y progreso), rutinas, alimentación, check-ins, feedback, biblioteca |
| js/voice.js | Registro de comidas por voz o texto: separa los alimentos, cantidades, medidas caseras y gramos estimados |
| js/push.js | Token de FCM para avisos con la app cerrada; `refreshPush` lo renueva al abrir la app (los tokens caducan) |
| js/realfoods.js | 250 alimentos USDA en español: [nombre, grupo, kcal, cho, lip, prot por 100 g, g por porción de intercambio, medida, gramos] |
| js/seed-jr.js | Rutina de Joaquín (Lun–Sáb, LD/PG; serie 1 8 reps @RIR1, serie 2 6 reps @RIR1) |
| scripts/reminders.mjs + .github/workflows/reminders.yml | "Reloj" de avisos cada 15 min (GitHub Actions + firebase-admin + FCM). Necesita el secreto `FIREBASE_SERVICE_ACCOUNT` y la variable `PUSH_ON=1` (ya configurados). Borra tokens caducados y solo marca un aviso como enviado si llegó. Ojo: GitHub corre el cron más o menos cada hora, no cada 15 min |
| firestore.rules | Plantilla (las reglas reales están publicadas en la consola con el correo del coach, incluida `barcodes`) |

## Datos (Firestore)
- `users/{uid}`
- `library/exercises`, `library/foods`
- `barcodes/{code}` (compartida)
- `clients/{cid}` (metas, `schedule`, `startDate`, `stages`)
  - `days/{fecha}`: `meals` (`{"Comida 1": [items]}`, cada item con `t` = hora, que ya no se muestra), `water`, `steps`, `weight`, `weightFast` y `weightBath` (true/false), `sleep`, `mealCount`
  - Otras subcolecciones: `sessions`, `routines`, `foods`, `checkins`, `exnotes`, `photos`, `audios`, `settings` (`reminders`, `push`, `pushlog`)
- Reglas: el cliente escribe sus subcolecciones, salvo `routines` y `feedbacks`. El doc del cliente solo lo escribe el coach.

## Reglas de colores y cumplimiento (v1.11)
- **Barras de macros**: color fijo por macro (Calorías rojo, CHO amarillo, Lípidos azul, Proteína verde; igual en inicio y en comida) y un ✓ cuando llegan al 95 % de la meta. Joaquín descartó los colores según % de cumplimiento.
- **Informe de ayer**: ±5 % cumplido · 6–10 % "un pelito" · >10 % "hay que mejorar". En agua y pasos, pasarse cuenta como cumplido. Confeti completo solo si todo está cumplido.

## Notificaciones
- Ícono pequeño (`badge`) = `icons/badge-96.png`, silueta blanca del logo sobre transparente (Android exige monocromo; si no, muestra una campana).
- El texto "· nutrijrcoaching.github.io" lo agrega Chrome a todo aviso web, incluso con la app instalada (comprobado 17-nov). No se puede quitar desde el código: solo con la app Android nativa (Capacitor/TWA, ya pendiente por Health Connect) o con un dominio propio (pagado) en vez de github.io.

## Compartir con el coach
- Una web no puede mandar un archivo directo a un número de WhatsApp (wa.me solo acepta texto). Se usa el menú de compartir del celular; tras la primera vez el chat del coach aparece arriba como acceso directo. El audio y la sesión quedan igual en el panel del coach.
- Se quitó "Enviar como texto" y el "(imagen)" del botón.
- El audio fallaba porque Android no deja compartir `audio/webm;codecs=opus`: ahora el archivo va con tipo limpio (`audio/x-m4a` .m4a o `audio/webm` .weba) y se comparte con un toque (el permiso para compartir se pierde si se espera a que termine de guardar).

## Pendientes / ideas acordadas
- **Verificar en el celular** (v1.11): que llegue la notificación de prueba y los avisos con la app cerrada; que el audio se comparta a WhatsApp.
- **Criterio completo de progresión de cargas.** Actualmente: técnica primero; bajar el peso si hay fallo o faltan 2 o más reps; unilaterales con el mismo peso en ambos lados.
- **"Loom" dentro de IMA** para retroalimentación en video al cliente: grabador con burbuja de cámara, guardado en Google Drive, contador de vistas, comentarios con minuto, subtítulos y velocidad.
- **App Android (Capacitor) para leer los pasos desde Health Connect** (hoy se anotan a mano).
- **Tips de ejecución por ejercicio** desde su hoja "Programa y tips".
- **Plan de alimentación** en porciones de intercambio y más alimentos.
- **Planificación desde el lado del coach.**

## Forma de trabajar con Joaquín
- Habla en español de Chile, informal. Prefiere ver el código en el chat y no como adjunto.
- Pedir permiso antes de acciones irreversibles o en sus cuentas.
- Para ahorrar uso: chats nuevos, Sonnet para cambios chicos, varios pedidos juntos; "sin probar" para cambios simples.
