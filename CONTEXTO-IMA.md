# CONTEXTO-IMA — léelo primero

Resumen para retomar el desarrollo en un chat nuevo sin el historial. Actualizado: 18-nov-2026, versión **1.16.0**.

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
| js/train.js | Entrenamiento: semana (botón **Ver** rutina sin empezarla, con la última vez), sesión (reps del plan pegadas a la izquierda del casillero de reps, estilo app de referencia) (objetivo destacado, técnica Mejor/Igual/Peor en azul/verde/rojo, unilaterales Izq/Der con diferencia, video por serie guardado en el celular, descanso ajustable con pantalla encendida y alarma a pantalla completa que suena y vibra, reiniciar/descartar), resumen con progreso por serie y botón "Eliminar este entrenamiento" (borra sesión + audio), imagen para compartir, audio para el coach (graba en m4a si se puede; se guarda en el panel y se comparte con un toque) |
| js/data.js | Helpers de datos, `weekPlan`, `setVerdict` / `suggest` (progresión), `setProgress`, `mealList`, etapas (`applyStage`), CHECKIN |
| js/coach.js | Panel coach: clientes (tabla por estado + campana), timeline, etapas, entrenamientos (con audio y progreso), rutinas, alimentación, check-ins (responder / marcar respondido), feedback, datos (acceso, asesoría, pendientes a mano, notas), biblioteca (+ casillas de servicios), importar clientes, clientes de ejemplo |
| js/alerts.js | Pendientes del coach por cliente: `alertsFor(c, ctx)` → rojo (urgente) / amarillo (pendiente) / gris (info). `loadCtx` carga rutinas, sesiones, 7 días, check-ins, feedbacks y `access` |
| js/features.js | **Qué incluye cada servicio**: lista `FEATURES` (32 funciones × 1-1 / solo entrenamiento / solo nutrición) con valores de fábrica; el coach las cambia con casillas (doc `library/services`). En la app del cliente todo se pregunta con `has("clave")` |
| js/voice.js | Registro de comidas por voz o texto: separa los alimentos, cantidades, medidas caseras y gramos estimados |
| js/menus.js | **Plan por opciones** (editor del coach + vista del cliente), **reemplazos** por grupo, **lista de compras** y **escala de hambre** con carita (`faceSvg`) |
| js/push.js | Token de FCM para avisos con la app cerrada; `refreshPush` lo renueva al abrir la app (los tokens caducan) |
| js/realfoods.js | **600 alimentos**: 514 de la Tabla de Composición de Alimentos **INTA 2018** + 86 del USDA que la tabla no trae. [nombre, grupo, kcal, CHO disponibles, lip, prot por 100 g, g por porción de intercambio, medida, g de la medida, fuente]. Carnes/pescados crudos dicen "(crudo)" |
| js/offchile.js | **5.076 productos envasados chilenos** de Open Food Facts (ODbL), verificados (kcal cuadran con macros). Se carga al buscar/escanear; el escáner lo revisa antes de ir a internet (funciona sin señal) |
| scripts/base-alimentos/ | Transcripción de la tabla INTA, scripts para regenerar ambas bases y LEEME con el proceso |
| js/seed-jr.js | Rutina de Joaquín (Lun–Sáb, LD/PG; serie 1 8 reps @RIR1, serie 2 6 reps @RIR1) |
| scripts/reminders.mjs + .github/workflows/reminders.yml | "Reloj" de avisos cada 15 min (GitHub Actions + firebase-admin + FCM). Necesita el secreto `FIREBASE_SERVICE_ACCOUNT` y la variable `PUSH_ON=1` (ya configurados). Borra tokens caducados y solo marca un aviso como enviado si llegó. Ojo: GitHub corre el cron más o menos cada hora, no cada 15 min |
| firestore.rules | Plantilla (las reglas reales están publicadas en la consola con el correo del coach, incluida `barcodes`) |

## Acceso de clientes (v1.16)
- El coach crea la ficha (`clients/{id}` con id propio, ya no es el uid) y `access/{correo en minúsculas}` = `{cid, name, ok}`.
- El cliente toca **"Crear mi cuenta"** con ese correo → Firebase le manda correo de verificación → entra solo si verificó y `ok == true` (si no, ve una pantalla de espera). El coach da/quita acceso en "Datos y objetivos" y copia la invitación para WhatsApp.
- Fichas antiguas cuyo id = uid (el registro propio de Joaquín) siguen funcionando.
- **Reglas nuevas** en `firestore.rules` (hay que pegarlas en la consola manteniendo su correo en `isCoach`): `access`, `hasAccess(cid)` con `email_verified`, y rutinas editables por el cliente si su `service == 'nutricion'`.
- Archivar un cliente le quita el acceso.

## Tipos de asesoría (v1.16)
- `client.service`: `completa` (1-1), `entrenamiento`, `nutricion`. Otros campos nuevos: `modalidad`, `checkinDay` (0–6), `checkinForm` (usa Google Forms), `endDate`, `city`, `sheetUrl` (planilla anterior), `todo` (pendientes a mano; "!" = urgente), `notes` (internas), `ranges` (guía de macros g/kg), `planPdf`, `weightStart`, `seen.entrenos`, `example`.
- **Solo entrenamiento**: sin plan de alimentación; "Mi guía de macros" con rangos por kg (`macroGuide` en data.js; por defecto P 1,6–2,2 · G 0,7–1 · C 3–5). Si no hay kcal/macros fijos, la meta del inicio es el punto medio.
- **Solo nutrición**: el cliente arma sus rutinas (editor en Entreno: nombre, días, ejercicios de la biblioteca, n° de series; `routine.own`, `routine.days` → arma el calendario). Sin videos, rangos, sugerencias de carga, técnica, videos de series ni audio. Ve los **tips** de la biblioteca (`library/exercises[].tips`).
- Todo esto se ajusta en Biblioteca → "Servicios" (casillas).

## Panel del coach (v1.16)
- Tabla de clientes ordenada por gravedad, con resumen (urgentes / pendientes / al día / con acceso), campana con todos los pendientes y punto de color por cliente en la barra lateral.
- Check-in "respondido" = existe `feedbacks/{semana}` con `at` o `answered` (al publicar la retro o con "Marcar respondido").
- La retro del coach le aparece al cliente en el inicio ("Tu coach respondió tu check-in") y en Progreso durante 9 días desde que se publica (`freshFb`).
- **"Ver como cliente"**: abre la app del cliente (`S.preview`), con barra amarilla; no activa avisos ni pide pasos de ayer.
- **Importar clientes**: sube un `ima-clientes.json` (no se guarda en el repo porque es público). Crea/actualiza fichas, rutinas, entrenamientos anteriores (`imported: true`), notas de configuración y la biblioteca. Nunca da acceso.
- **Clientes de ejemplo**: uno por servicio, con 4 semanas de datos (`seedClient` en demo.js).
- Importación del 18-nov-2026: 7 clientes desde "PANEL DE CONTROL - Asesorías" y sus planillas (Vicente, Felipe, Marian, René, Cristóbal, Gabriel, Déborah). La historia de entrenamiento se acomodó para que el último registro de la planilla quede en la semana pasada. Solo Vicente tenía su plan por opciones en el panel; los demás quedan con "plan en PDF: pásalo a la app".

## Datos (Firestore)
- `users/{uid}`
- `library/exercises`, `library/foods`
- `barcodes/{code}` (compartida)
- `clients/{cid}` (metas, `schedule`, `startDate`, `stages`, `pauta`, `plan` {pdfUrl, notes}, `menus`)
  - `days/{fecha}`: `meals` (`{"Comida 1": [items]}`, cada item con `t` = hora, que ya no se muestra), `water`, `steps`, `weight`, `weightFast` y `weightBath` (true/false), `sleep`, `mealCount`, `hunger` (`{"Comida 1": {a: 1–10 antes, d: 1–10 después}}`), `stress` (1–10)
  - Otras subcolecciones: `sessions`, `routines`, `foods`, `checkins`, `exnotes`, `photos`, `audios`, `settings` (`reminders`, `push`, `pushlog`)
- Reglas: el cliente escribe sus subcolecciones, salvo `routines` y `feedbacks`. El doc del cliente solo lo escribe el coach.

## Agregar alimento (v1.12.1, inspirado en FatSecret)
- Pantalla completa (`sheet(..., { full: true })`) con el **buscador fijo arriba**; al escribir pasa solo a resultados y al borrar vuelve a la pestaña anterior.
- Pestañas: Frecuentes (lo más registrado en 30 días; al tocarlo queda con los gramos de la última vez), Favoritos, Recetas, Por voz, Añadir rápido, Suplementos, Crear.
- `pickFood`: con medida casera parte en 1 unidad; al cambiar a **Gramos el campo queda vacío ("–")**, no se convierte el número.
- Ojo: los ids de la base (`r0`, `r1`…) cambiaron con la base INTA; los registros viejos guardan `fid` antiguos. Siempre buscar alimentos por **nombre** (Frecuentes ya lo hace).
- Inicio: calorías, agua y pasos muestran "Llevas el X %".
- Idea pendiente: mostrar los alimentos de las opciones del plan (`menus`) como atajo en el agregador.

## Base de alimentos (v1.12)
- Búsqueda: genéricos (INTA) primero, después marcas; varias palabras deben aparecer todas (nombre o marca).
- Ficha del alimento muestra la **fuente** y un aviso si los datos parecen raros (`foodCheck` en data.js: kcal vs macros ±20 %, proteína alta para cereales/frutas/verduras).
- El coach corrige un alimento de la base subiendo un CSV en Biblioteca con **el mismo nombre** (reemplaza al de la base).
- FatSecret descartado: lo gratis solo trae datos de EE.UU. (Chile es de pago) y su API exige un servidor con IP fija.
- La tabla INTA 2018 escaneada no trae plátano, pera, uva, piña ni sandía (salen del USDA).

## Plan de alimentación por opciones (v1.13)
- `menus` en el doc del cliente: `[{id, name, note, meals: [{name, time, note, items: [{name, cat, por, gp, g, medida, medidaG}]}]}]`. `gp` = g por porción de intercambio del alimento (de la base), `g` = por × gp. Alimentos sin grupo de intercambio van solo en gramos.
- **Coach**: pestaña "Plan alimentación" del cliente. Copia de trabajo local (`MW`) que se publica con "Guardar y publicar". Opciones con duplicar/eliminar; tiempos de comida con hora sugerida, subir/bajar; buscador de alimentos (datalist de la base) que completa grupo, gramos y medida. Muestra kcal/macros por intercambio y porciones de la opción vs la `pauta` (verde igual, amarillo faltan, rojo sobran). Por defecto: Desayuno, Colación, Almuerzo, Once, Cena.
- **Cliente** ("Mi plan"): pestañas por opción, comidas con hora, cada alimento con porciones · gramos · medida casera. Al tocarlo: hoja con **todos los alimentos del mismo grupo** y los gramos equivalentes a esas porciones (filtro de búsqueda). El PDF, las notas y la pauta siguen abajo.
- **Lista de compras** (`#compras`): el cliente elige cuántos días de cada opción; suma los gramos por alimento, agrupa por grupo de intercambio, ≈ medida casera, check para tachar (guardado en localStorage del celular), compartir como texto.
- `homeMeasure(g, medida, medidaG)` convierte gramos a medida casera multiplicando la cantidad que trae la medida ("1 ½ taza", "5 unidades") y usa plural.

## Escala de hambre (v1.13 · QUITADA de las comidas en v1.14.1)
- Joaquín pidió sacarla de cada comida (no era para eso). El código (`faceSvg`, `openHunger`, `hungerBtn`) sigue en menus.js por si se reutiliza; los datos `day.hunger` ya guardados quedan.
- Antes: carita en cada comida (junto a ⋯). Abría una hoja con dos deslizadores 1–10: "¿Con cuánta hambre llegaste?" y "¿Cómo quedaste después de comer?". La carita cambia de forma al deslizar (cejas preocupadas → ojos cerrados tranquilos con sonrisa en 6–7 → mejillas infladas y boca ondulada en 10) y el color pastel (coral → verde menta → lavanda).
- Niveles: Muerto de hambre, Mucha hambre, Con hambre, Un poco de hambre, Ni hambre ni lleno, Satisfecho, Tranquilo en su punto, Lleno, Muy lleno, A punto de reventar.
- El coach lo ve en Alimentación ("Hambre 3 → 7" junto a cada comida).

## Estrés del día (QUITADO en v1.15.2)
- Se probó una barra deslizable de estrés con carita (en peso y luego en el inicio). A Joaquín no le convenció y se quitó completa, igual que la escala de hambre en las comidas. Los valores ya guardados (`day.stress`, `day.hunger`) quedan en Firestore, pero no se muestran. No volver a proponerla salvo que él lo pida.

## Descanso entre series (v1.15)
- Al terminar el descanso sigue contando hacia arriba: "+0:12" = segundos después del descanso (botón y barra en amarillo, sin texto). La barra flotante ya no tiene los botones −15/+15, solo el tiempo y ✕. Se apaga con ✕, al iniciar otro descanso o solo a los 10 min.
- Al terminar sigue igual: alarma en la app + notificación que vibra si la app está en segundo plano. Lo de pantalla completa fuera de la app quedó descartado por ahora.

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
- **Temporizador de descanso fuera de la app / con el celular bloqueado** (en pausa por decisión de Joaquín, 18-nov): una web no puede ponerse a pantalla completa sobre otras apps ni sobre la pantalla de bloqueo, y con la pantalla apagada el navegador puede congelar los temporizadores (el aviso de fin de descanso no es confiable). Opciones conversadas: (1) audio de fondo durante el descanso que suena al terminar (funciona bloqueado, pero pausa la música del cliente); (2) app Android nativa (Capacitor, misma que para Health Connect) con alarma a pantalla completa estilo despertador. En iPhone solo con app nativa en App Store (99 USD/año).
- **Verificar en el celular** (v1.11): que llegue la notificación de prueba y los avisos con la app cerrada; que el audio se comparta a WhatsApp.
- **Criterio completo de progresión de cargas.** Actualmente: técnica primero; bajar el peso si hay fallo o faltan 2 o más reps; unilaterales con el mismo peso en ambos lados.
- **"Loom" dentro de IMA** para retroalimentación en video al cliente: grabador con burbuja de cámara, guardado en Google Drive, contador de vistas, comentarios con minuto, subtítulos y velocidad.
- **App Android (Capacitor) para leer los pasos desde Health Connect** (hoy se anotan a mano).
- **Tips de ejecución por ejercicio** desde su hoja "Programa y tips".
- **Plan de alimentación**: verificar en el celular las opciones, reemplazos y lista de compras (v1.13). Idea: mostrar la escala de hambre como gráfico semanal en el panel.
- **Planificación por bloques (mesociclos de 6–8 semanas)** de entrenamiento y alimentación, conversada el 18-nov (ver propuesta en el chat): pendiente que Joaquín la apruebe.
- Videos de los clientes al coach: Firebase Storage ya no es gratis; opción conversada: subirlos a su Google Drive con un Apps Script.
- Pasar los planes en PDF de Felipe, Marian, René, Cristóbal y Déborah al plan por opciones.

## Forma de trabajar con Joaquín
- Habla en español de Chile, informal. Prefiere ver el código en el chat y no como adjunto.
- Pedir permiso antes de acciones irreversibles o en sus cuentas.
- Para ahorrar uso: chats nuevos, Sonnet para cambios chicos, varios pedidos juntos; "sin probar" para cambios simples.
